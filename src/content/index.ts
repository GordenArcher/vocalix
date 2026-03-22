/**
 * Vocalix - Text-to-Speech Chrome Extension Content Script
 *
 * This script handles text selection, speech synthesis, word highlighting,
 * and UI management for the Vocalix extension.
 */

// Core UI state variables, track what's currently happening
let container: HTMLDivElement | null = null;
let isPlaying = false; // Actively speaking
let isPaused = false; // Paused mid-speech
let isLoading = false; // Waiting for async operations
let autoRead = false; // Read immediately on selection
let highlightWordsEnabled = true; // Visual word tracking
let minLength = 2; // Minimum characters to trigger reading

// Speech synthesis tracking
let currentUtterance: SpeechSynthesisUtterance | null = null;
let voiceLoadAttempts = 0;
const MAX_VOICE_ATTEMPTS = 10;

// Voice loading management - voices aren't immediately available in all browsers
let voicesLoaded = false;
let pendingVoicesCallbacks: (() => void)[] = [];

/**
 * Wait for voices to be loaded before using speech synthesis
 * This prevents empty voice lists in some browsers (especially Chrome)
 */
function onVoicesReady(callback: () => void): void {
  if (voicesLoaded) {
    callback();
  } else {
    pendingVoicesCallbacks.push(callback);
  }
}

/**
 * Poll for voice availability since onvoiceschanged doesn't always fire reliably
 * Fallback polling mechanism ensures voices are eventually available
 */
function loadVoices(): void {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    voicesLoaded = true;
    pendingVoicesCallbacks.forEach((cb) => cb());
    pendingVoicesCallbacks = [];
  } else if (voiceLoadAttempts < MAX_VOICE_ATTEMPTS) {
    voiceLoadAttempts++;
    setTimeout(loadVoices, 100);
  }
}

// Initialize voice loading when window is ready
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

// Load saved settings from Chrome storage
chrome.storage.sync.get("settings", (result) => {
  const settings = result.settings || {};
  autoRead = settings.autoRead ?? false;
  highlightWordsEnabled = settings.highlightWords ?? true;
  minLength = settings.minLength ?? 2;
});

// Listen for settings changes while extension is active
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings?.newValue) {
    autoRead = changes.settings.newValue.autoRead ?? false;
    highlightWordsEnabled = changes.settings.newValue.highlightWords ?? true;
    minLength = changes.settings.newValue.minLength ?? 2;
  }
});

// Word highlighting management
let highlightedSpans: HTMLElement[] = [];
let originalRange: Range | null = null;
let originalParentNodes: Map<
  HTMLElement,
  { parent: Node; nextSibling: Node | null }
> = new Map();
let lastText = "";
let pendingReading = false; // Prevents multiple simultaneous play requests

/**
 * Show temporary notification message
 * Uses double requestAnimationFrame to ensure CSS transitions work properly
 */
function showToast(message: string): void {
  const existing = document.getElementById("vocalix-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "vocalix-toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  // Double RAF ensures DOM has rendered before adding visible class
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("vocalix-toast-visible"));
  });

  // Auto-remove after 2 seconds with animation
  setTimeout(() => {
    toast.classList.remove("vocalix-toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

/**
 * Get or create the floating control container
 * Singleton pattern to ensure only one container exists
 */
function getOrCreateContainer(): HTMLDivElement {
  const existing = document.getElementById(
    "vocalix-container",
  ) as HTMLDivElement;
  if (existing) {
    container = existing;
    return existing;
  }

  container = document.createElement("div");
  container.id = "vocalix-container";
  document.body.appendChild(container);

  return container;
}

/**
 * Position container near selection with edge detection
 * Prevents container from going off-screen by clamping values
 */
function showContainer(x: number, y: number): void {
  const c = getOrCreateContainer();

  const margin = 8;
  let left = x + margin;
  let top = y + margin;

  // Clamp to viewport boundaries
  left = Math.max(margin, Math.min(left, window.innerWidth - 230));
  top = Math.max(margin, Math.min(top, window.innerHeight - 50));

  // If still near edge, flip to other side of cursor
  if (left + 220 > window.innerWidth) left = Math.max(margin, x - 230);
  if (top + 44 > window.innerHeight) top = Math.max(margin, y - 50);

  c.style.left = `${left}px`;
  c.style.top = `${top}px`;
  c.classList.add("vocalix-visible");
}

/**
 * Show container at top-center for auto-reading state
 * Keeps UI consistent and out of the way during playback
 */
function showContainerCentered(): void {
  const c = getOrCreateContainer();
  c.style.left = `${Math.max(8, window.innerWidth / 2 - 110)}px`;
  c.style.top = `20px`;
  c.classList.add("vocalix-visible");
}

function hideContainer(): void {
  container?.classList.remove("vocalix-visible");
}

/**
 * Render appropriate buttons based on current reading state
 * This ensures UI always reflects actual state, preventing confusion
 */
function renderButtons(state: "idle" | "playing" | "paused"): void {
  const c = getOrCreateContainer();
  c.innerHTML = "";

  if (state === "idle") {
    const playBtn = makeButton("▶ Read", "vocalix-btn-play", () => {
      const text = window.getSelection()?.toString().trim() || lastText;
      if (text && text.length >= minLength) {
        startReading(text);
      } else if (!text) {
        showToast("No text to read");
      }
    });
    c.appendChild(playBtn);
  } else if (state === "playing") {
    const pauseBtn = makeButton("", "vocalix-btn-pause", pauseReading);
    // Visual waveform animation while speaking
    pauseBtn.innerHTML = `
      <div class="vocalix-wave">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
      ⏸ Pause
    `;
    const stopBtn = makeButton("⏹ Stop", "vocalix-btn-stop", stopReading);
    c.appendChild(pauseBtn);
    c.appendChild(stopBtn);
  } else if (state === "paused") {
    const resumeBtn = makeButton(
      "▶ Resume",
      "vocalix-btn-resume",
      resumeReading,
    );
    const stopBtn = makeButton("⏹ Stop", "vocalix-btn-stop", stopReading);
    c.appendChild(resumeBtn);
    c.appendChild(stopBtn);
  }
}

/**
 * Create a button with proper event handling
 * Prevents event bubbling which could interfere with page interactions
 */
function makeButton(
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = `vocalix-btn ${className}`;
  btn.textContent = label;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return btn;
}

/**
 * Wrap each word in the selected range with span tags for highlighting
 * Preserves whitespace structure while making each word individually targetable
 */
function wrapWordsInRange(range: Range): HTMLElement[] {
  const spans: HTMLElement[] = [];

  try {
    const fragment = range.cloneContents();
    const text = fragment.textContent || "";
    const words = text.split(/(\s+)/); // Keep whitespace tokens

    const wrapper = document.createDocumentFragment();

    words.forEach((part) => {
      if (/^\s+$/.test(part)) {
        // Preserve whitespace as text nodes
        wrapper.appendChild(document.createTextNode(part));
      } else if (part.length > 0) {
        const span = document.createElement("span");
        span.className = "vocalix-word";
        span.textContent = part;
        wrapper.appendChild(span);
        spans.push(span);
      }
    });

    // Replace original content with wrapped version
    range.deleteContents();
    range.insertNode(wrapper);
  } catch (error) {
    console.error("Error wrapping words:", error);
    return [];
  }

  return spans;
}

/**
 * Highlight specific word by index
 * Scrolls into view smoothly to keep current word visible
 */
function highlightWord(index: number): void {
  highlightedSpans.forEach((s) => s.classList.remove("vocalix-word-active"));
  if (index >= 0 && index < highlightedSpans.length) {
    highlightedSpans[index].classList.add("vocalix-word-active");
    highlightedSpans[index].scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }
}

/**
 * Restore original DOM structure by removing highlight spans
 * Important to not leave modified DOM after reading completes
 */
function cleanupHighlights(): void {
  // Replace each span with its text content
  highlightedSpans.forEach((span) => {
    const parent = span.parentNode;
    if (parent && span.textContent !== null) {
      const textNode = document.createTextNode(span.textContent);
      parent.replaceChild(textNode, span);
    }
  });

  // Normalize parent nodes to merge adjacent text nodes
  const parents = new Set<Node>();
  highlightedSpans.forEach((span) => {
    if (span.parentNode) parents.add(span.parentNode);
  });
  parents.forEach((parent) => {
    if (parent instanceof Element) parent.normalize();
  });

  // Clear tracking variables
  highlightedSpans = [];
  originalRange = null;
  originalParentNodes.clear();
}

/**
 * Reset all UI state to idle
 * Centralized state reset to ensure consistency
 */
function resetUIState(): void {
  isPlaying = false;
  isPaused = false;
  isLoading = false;
  pendingReading = false;

  if (container) {
    renderButtons("idle");
    hideContainer();
  }

  cleanupHighlights();
}

/**
 * Stop reading immediately and reset everything
 */
function stopReading(): void {
  if (pendingReading) {
    pendingReading = false;
  }

  if (currentUtterance) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }

  resetUIState();
}

/**
 * Pause at current position
 * Only works if actively playing and not already paused
 */
function pauseReading(): void {
  if (isPlaying && !isPaused && currentUtterance) {
    isPaused = true;
    window.speechSynthesis.pause();
    renderButtons("paused");
  }
}

/**
 * Resume from paused position
 */
function resumeReading(): void {
  if (isPaused && currentUtterance) {
    window.speechSynthesis.resume();
    isPaused = false;
    renderButtons("playing");
  }
}

/**
 * Main reading function, orchestrates the entire TTS process
 *
 * Key challenges handled:
 * - Preventing multiple simultaneous plays (pendingReading flag)
 * - Immediate UI update to give visual feedback
 * - Voice loading synchronization
 * - Settings application with bounds checking
 * - Proper cleanup on completion/error
 */
function startReading(text: string): void {
  // Guard against race conditions
  if (isPlaying || isPaused || isLoading || pendingReading) {
    console.log("Already playing/paused/loading, ignoring request");
    return;
  }

  if (!text || text.trim().length < minLength) {
    showToast(`Text must be at least ${minLength} characters`);
    return;
  }

  pendingReading = true;
  isLoading = true;

  // Clear any lingering speech
  if (currentUtterance) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }

  // Update UI immediately to prevent multiple clicks
  renderButtons("playing");
  showContainerCentered();

  // Set up word highlighting if enabled
  const selection = window.getSelection();
  if (highlightWordsEnabled && selection && !selection.isCollapsed) {
    try {
      originalRange = selection.getRangeAt(0).cloneRange();
      highlightedSpans = wrapWordsInRange(selection.getRangeAt(0));
    } catch (error) {
      console.error("Error creating word highlights:", error);
      highlightedSpans = [];
    }
  }

  // Wait for voices to be ready before creating utterance
  onVoicesReady(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;

    // Load and apply user settings
    chrome.storage.sync.get("settings", (result) => {
      const settings = result.settings || {};

      // Clamp values to valid ranges
      utterance.rate = Math.min(2, Math.max(0.5, settings.rate ?? 1.0));
      utterance.pitch = Math.min(2, Math.max(0.5, settings.pitch ?? 1.0));
      utterance.volume = Math.min(1, Math.max(0, settings.volume ?? 1.0));

      // Set voice if saved in settings
      if (settings.voiceId) {
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find((v) => v.voiceURI === settings.voiceId);
        if (match) utterance.voice = match;
      }

      let wordIndex = 0;
      utterance.onboundary = (e) => {
        // Only highlight if not paused (avoid showing wrong word after resume)
        if (e.name === "word" && !isPaused) {
          highlightWord(wordIndex);
          wordIndex++;
        }
      };

      utterance.onstart = () => {
        isPlaying = true;
        isLoading = false;
        pendingReading = false;
        isPaused = false;
        renderButtons("playing");

        // Save to reading history (max 50 entries)
        const entry = {
          id: Date.now().toString(),
          text: text.slice(0, 200),
          url: location.href,
          timestamp: Date.now(),
        };
        chrome.storage.local.get("history", (r) => {
          const history = r.history || [];
          const updated = [entry, ...history].slice(0, 50);
          chrome.storage.local.set({ history: updated });
        });
      };

      utterance.onend = () => {
        // Verify this is still the current utterance and not paused
        if (currentUtterance === utterance && !isPaused) {
          isPlaying = false;
          isPaused = false;
          isLoading = false;
          pendingReading = false;
          currentUtterance = null;
          cleanupHighlights();

          // Check if text is still selected, maybe user wants to read again
          const sel = window.getSelection();
          const stillSelected =
            sel &&
            !sel.isCollapsed &&
            (sel.toString().trim().length ?? 0) >= minLength;

          if (stillSelected) {
            const range = sel!.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            renderButtons("idle");
            showContainer(rect.right, rect.bottom);
          } else {
            renderButtons("idle");
            hideContainer();
          }
        }
      };

      utterance.onerror = (event) => {
        console.error("Speech synthesis error:", event);
        // Only reset if this is the current utterance and not intentionally paused
        if (currentUtterance === utterance && !isPaused) {
          isPlaying = false;
          isPaused = false;
          isLoading = false;
          pendingReading = false;
          currentUtterance = null;
          renderButtons("idle");
          cleanupHighlights();
          hideContainer();
          showToast("Error occurred while reading");
        }
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error("Failed to start speech synthesis:", error);
        resetUIState();
        showToast("Failed to start reading");
      }
    });
  });
}

/**
 * Handle messages from popup and background scripts
 * Supports: READ_TEXT, STOP, PAUSE, RESUME, PAUSE_RESUME
 */
chrome.runtime.onMessage.addListener(
  (message: { type: string; payload?: string }) => {
    if (message.type === "READ_TEXT") {
      const text = message.payload || window.getSelection()?.toString().trim();
      if (text && text.length >= minLength) {
        lastText = text;
        startReading(text);
      } else if (!text) {
        showToast("No text selected");
      } else {
        showToast(`Text must be at least ${minLength} characters`);
      }
    }
    if (message.type === "STOP") stopReading();
    if (message.type === "PAUSE") pauseReading();
    if (message.type === "RESUME") resumeReading();
    if (message.type === "PAUSE_RESUME") {
      if (isPaused) resumeReading();
      else if (isPlaying) pauseReading();
    }
  },
);

/**
 * Handle text selection with debounce
 * 50ms delay prevents race conditions with click events
 */
document.addEventListener("mouseup", () => {
  setTimeout(() => {
    // Don't interfere during active reading
    if (isPlaying || isPaused || isLoading || pendingReading) return;

    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (!text || text.length < minLength) {
      hideContainer();
      return;
    }

    const range = selection!.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (autoRead) {
      lastText = text;
      startReading(text);
    } else {
      lastText = text;
      renderButtons("idle");
      showContainer(rect.right, rect.bottom);
    }
  }, 50);
});

/**
 * Hide container when clicking outside
 * Important: Don't hide while actively playing to avoid accidental closures
 */
document.addEventListener("mousedown", (e) => {
  const target = e.target as HTMLElement;
  if (
    !target.closest("#vocalix-container") &&
    !isPlaying &&
    !isPaused &&
    !isLoading
  ) {
    hideContainer();
  }
});

/**
 * Clean up speech on page unload
 * Prevents speech continuing after page navigation
 */
window.addEventListener("beforeunload", () => {
  if (currentUtterance) {
    window.speechSynthesis.cancel();
  }
});
