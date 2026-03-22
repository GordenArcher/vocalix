let container: HTMLDivElement | null = null;
let isPlaying = false;
let isPaused = false;
let isLoading = false;
let autoRead = false;
let highlightWordsEnabled = true;
let minLength = 2;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let voiceLoadAttempts = 0;
const MAX_VOICE_ATTEMPTS = 10;

let voicesLoaded = false;
let pendingVoicesCallbacks: (() => void)[] = [];

function onVoicesReady(callback: () => void): void {
  if (voicesLoaded) {
    callback();
  } else {
    pendingVoicesCallbacks.push(callback);
  }
}

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

if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

chrome.storage.sync.get("settings", (result) => {
  const settings = result.settings || {};
  autoRead = settings.autoRead ?? false;
  highlightWordsEnabled = settings.highlightWords ?? true;
  minLength = settings.minLength ?? 2;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings?.newValue) {
    autoRead = changes.settings.newValue.autoRead ?? false;
    highlightWordsEnabled = changes.settings.newValue.highlightWords ?? true;
    minLength = changes.settings.newValue.minLength ?? 2;
  }
});

let highlightedSpans: HTMLElement[] = [];
let originalRange: Range | null = null;
let originalParentNodes: Map<
  HTMLElement,
  { parent: Node; nextSibling: Node | null }
> = new Map();
let lastText = "";
let pendingReading = false;

function showToast(message: string): void {
  const existing = document.getElementById("vocalix-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "vocalix-toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("vocalix-toast-visible"));
  });

  setTimeout(() => {
    toast.classList.remove("vocalix-toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

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

function showContainer(x: number, y: number): void {
  const c = getOrCreateContainer();

  const margin = 8;
  let left = x + margin;
  let top = y + margin;

  // Ensure container stays within viewport
  left = Math.max(margin, Math.min(left, window.innerWidth - 230));
  top = Math.max(margin, Math.min(top, window.innerHeight - 50));

  if (left + 220 > window.innerWidth) left = Math.max(margin, x - 230);
  if (top + 44 > window.innerHeight) top = Math.max(margin, y - 50);

  c.style.left = `${left}px`;
  c.style.top = `${top}px`;
  c.classList.add("vocalix-visible");
}

function showContainerCentered(): void {
  const c = getOrCreateContainer();
  c.style.left = `${Math.max(8, window.innerWidth / 2 - 110)}px`;
  c.style.top = `20px`;
  c.classList.add("vocalix-visible");
}

function hideContainer(): void {
  container?.classList.remove("vocalix-visible");
}

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

function wrapWordsInRange(range: Range): HTMLElement[] {
  const spans: HTMLElement[] = [];

  try {
    const fragment = range.cloneContents();
    const text = fragment.textContent || "";
    const words = text.split(/(\s+)/);

    const wrapper = document.createDocumentFragment();

    words.forEach((part) => {
      if (/^\s+$/.test(part)) {
        wrapper.appendChild(document.createTextNode(part));
      } else if (part.length > 0) {
        const span = document.createElement("span");
        span.className = "vocalix-word";
        span.textContent = part;
        wrapper.appendChild(span);
        spans.push(span);
      }
    });

    range.deleteContents();
    range.insertNode(wrapper);
  } catch (error) {
    console.error("Error wrapping words:", error);
    return [];
  }

  return spans;
}

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

function cleanupHighlights(): void {
  // Restore original DOM structure
  highlightedSpans.forEach((span) => {
    const parent = span.parentNode;
    if (parent && span.textContent !== null) {
      const textNode = document.createTextNode(span.textContent);
      parent.replaceChild(textNode, span);
    }
  });

  // Normalize all affected parents
  const parents = new Set<Node>();
  highlightedSpans.forEach((span) => {
    if (span.parentNode) parents.add(span.parentNode);
  });
  parents.forEach((parent) => {
    if (parent instanceof Element) parent.normalize();
  });

  highlightedSpans = [];
  originalRange = null;
  originalParentNodes.clear();
}

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

function stopReading(): void {
  // Cancel any pending reading
  if (pendingReading) {
    pendingReading = false;
  }

  if (currentUtterance) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }

  resetUIState();
}

function pauseReading(): void {
  if (isPlaying && !isPaused && currentUtterance) {
    isPaused = true;
    window.speechSynthesis.pause();
    renderButtons("paused");
  }
}

function resumeReading(): void {
  if (isPaused && currentUtterance) {
    window.speechSynthesis.resume();
    isPaused = false;
    renderButtons("playing");
  }
}

function startReading(text: string): void {
  // Prevent multiple simultaneous readings
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

  // Clear any ongoing speech
  if (currentUtterance) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }

  // Immediately update UI to prevent multiple clicks
  renderButtons("playing");
  showContainerCentered();

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

  onVoicesReady(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;

    chrome.storage.sync.get("settings", (result) => {
      const settings = result.settings || {};

      utterance.rate = Math.min(2, Math.max(0.5, settings.rate ?? 1.0));
      utterance.pitch = Math.min(2, Math.max(0.5, settings.pitch ?? 1.0));
      utterance.volume = Math.min(1, Math.max(0, settings.volume ?? 1.0));

      if (settings.voiceId) {
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find((v) => v.voiceURI === settings.voiceId);
        if (match) utterance.voice = match;
      }

      let wordIndex = 0;
      utterance.onboundary = (e) => {
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
        // Only cleanup if we're not paused and this is the current utterance
        if (currentUtterance === utterance && !isPaused) {
          isPlaying = false;
          isPaused = false;
          isLoading = false;
          pendingReading = false;
          currentUtterance = null;
          cleanupHighlights();

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
        // Don't reset if we're intentionally paused
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

document.addEventListener("mouseup", () => {
  setTimeout(() => {
    // Don't interfere if we're already playing or loading
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

window.addEventListener("beforeunload", () => {
  if (currentUtterance) {
    window.speechSynthesis.cancel();
  }
});
