/**
 * Vocalix Content Script - Text-to-Speech with Wake Word Support
 *
 * This script handles text selection, speech synthesis, word highlighting,
 * and wake word detection for hands-free reading.
 */

let container: HTMLDivElement | null = null;
let isPlaying = false;
let isPaused = false;
let isLoading = false;
let autoRead = false;
let highlightWordsEnabled = true;
let minLength = 2;
let wakeWordEnabled = false;
let wakeWord = "hey vocalix";
let recognition: SpeechRecognition | null = null;

/**
 * Load saved settings and initialize wake word listener if enabled
 * I need to get the wake word config early so the listener starts correctly
 */
chrome.storage.sync.get("settings", (result) => {
  const settings = result.settings || {};
  autoRead = settings.autoRead ?? false;
  highlightWordsEnabled = settings.highlightWords ?? true;
  minLength = settings.minLength ?? 2;
  wakeWordEnabled = settings.wakeWordEnabled ?? false;
  wakeWord = (settings.wakeWord ?? "hey vocalix").toLowerCase();
  if (wakeWordEnabled) startWakeWordListener();
});

/**
 * Listen for settings changes while the page is active
 * This allows enabling/disabling wake word without refreshing the page
 */
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings?.newValue) {
    autoRead = changes.settings.newValue.autoRead ?? false;
    highlightWordsEnabled = changes.settings.newValue.highlightWords ?? true;
    minLength = changes.settings.newValue.minLength ?? 2;
    wakeWordEnabled = changes.settings.newValue.wakeWordEnabled ?? false;
    wakeWord = (
      changes.settings.newValue.wakeWord ?? "hey vocalix"
    ).toLowerCase();

    if (wakeWordEnabled) {
      startWakeWordListener();
    } else {
      stopWakeWordListener();
    }
  }
});

/**
 * Start continuous speech recognition to listen for wake word
 * I use continuous mode so it keeps listening after each detection
 * The listener automatically restarts when it ends unless disabled
 */
function startWakeWordListener(): void {
  if (recognition) return;

  const SpeechRecognition =
    window.SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Vocalix: Speech Recognition not supported in this browser");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript
      .trim()
      .toLowerCase();
    if (transcript.includes(wakeWord)) {
      const text = window.getSelection()?.toString().trim();
      if (text && text.length >= minLength) {
        lastText = text;
        startReading(text);
      } else {
        showToast("Say the wake word with text selected");
      }
    }
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed") {
      showToast("Microphone access denied");
      wakeWordEnabled = false;
    }
  };

  recognition.onend = () => {
    if (wakeWordEnabled) {
      recognition?.start();
    }
  };

  recognition.start();
  showListeningIndicator(true);
}

/**
 * Stop wake word detection and clean up
 * I null out the onend handler to prevent auto-restart
 */
function stopWakeWordListener(): void {
  if (!recognition) return;
  recognition.onend = null;
  recognition.stop();
  recognition = null;
  showListeningIndicator(false);
}

/**
 * Show/hide visual indicator that microphone is active
 * This gives users feedback that wake word detection is running
 */
function showListeningIndicator(active: boolean): void {
  let indicator = document.getElementById(
    "vocalix-listening",
  ) as HTMLDivElement;

  if (!active) {
    indicator?.remove();
    return;
  }

  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "vocalix-listening";
    indicator.textContent = "🎤 Vocalix listening";
    document.body.appendChild(indicator);
  }
}

let highlightedSpans: HTMLElement[] = [];
let originalRange: Range | null = null;
let lastText = "";

/**
 * Show temporary toast notification
 * I use double requestAnimationFrame to ensure CSS transitions work properly
 */
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

/**
 * Get or create the floating control container
 * Singleton pattern ensures only one container exists
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
 * I flip to the other side if it would go off-screen
 */
function showContainer(x: number, y: number): void {
  const c = getOrCreateContainer();

  const margin = 8;
  let left = x + margin;
  let top = y + margin;

  if (left + 220 > window.innerWidth) left = x - 230;
  if (top + 44 > window.innerHeight) top = y - 50;

  c.style.left = `${left}px`;
  c.style.top = `${top}px`;
  c.classList.add("vocalix-visible");
}

/**
 * Show container at top-center during playback
 * Keeps controls accessible without obscuring content
 */
function showContainerCentered(): void {
  const c = getOrCreateContainer();
  c.style.left = `${window.innerWidth / 2 - 110}px`;
  c.style.top = `20px`;
  c.classList.add("vocalix-visible");
}

function hideContainer(): void {
  container?.classList.remove("vocalix-visible");
}

/**
 * Render appropriate buttons based on current reading state
 * I update UI immediately to prevent confusion from multiple clicks
 */
function renderButtons(state: "idle" | "playing" | "paused"): void {
  const c = getOrCreateContainer();
  c.innerHTML = "";

  if (state === "idle") {
    const playBtn = makeButton("▶ Read", "vocalix-btn-play", () => {
      const text = window.getSelection()?.toString().trim() || lastText;
      if (text) startReading(text);
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

/**
 * Create button with event propagation prevention
 * I stopPropagation to prevent clicks from accidentally hiding the container
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
 * Wrap each word in the selected range with spans for highlighting
 * I preserve whitespace by keeping text nodes for spaces
 */
function wrapWordsInRange(range: Range): HTMLElement[] {
  const fragment = range.cloneContents();
  const text = fragment.textContent || "";
  const words = text.split(/(\s+)/);

  const spans: HTMLElement[] = [];
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

  return spans;
}

/**
 * Highlight current word and scroll into view
 * I use smooth scrolling to maintain reading flow
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
 * Restore original DOM by replacing spans with text nodes
 * I normalize parents to merge adjacent text nodes back together
 */
function cleanupHighlights(): void {
  highlightedSpans.forEach((span) => {
    const parent = span.parentNode;
    if (parent) {
      parent.replaceChild(
        document.createTextNode(span.textContent || ""),
        span,
      );
      parent.normalize();
    }
  });
  highlightedSpans = [];
  originalRange = null;
}

/**
 * Main reading function
 * I handle the entire TTS flow including settings, highlighting, and history
 */
function startReading(text: string): void {
  if (isPlaying || isPaused || isLoading) return;
  isLoading = true;

  window.speechSynthesis.cancel();

  const selection = window.getSelection();
  if (highlightWordsEnabled && selection && !selection.isCollapsed) {
    originalRange = selection.getRangeAt(0).cloneRange();
    try {
      highlightedSpans = wrapWordsInRange(selection.getRangeAt(0));
    } catch {
      highlightedSpans = [];
    }
  }

  const utterance = new SpeechSynthesisUtterance(text);

  chrome.storage.sync.get("settings", (result) => {
    const settings = result.settings || {};

    utterance.rate = settings.rate ?? 1.0;
    utterance.pitch = settings.pitch ?? 1.0;
    utterance.volume = settings.volume ?? 1.0;

    if (settings.voiceId) {
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find((v) => v.voiceURI === settings.voiceId);
      if (match) utterance.voice = match;
    }

    let wordIndex = 0;
    utterance.onboundary = (e) => {
      if (e.name === "word") {
        highlightWord(wordIndex);
        wordIndex++;
      }
    };

    utterance.onstart = () => {
      isPlaying = true;
      isPaused = false;
      isLoading = false;
      renderButtons("playing");

      const c = getOrCreateContainer();
      if (!c.classList.contains("vocalix-visible")) {
        showContainerCentered();
      } else {
        c.classList.add("vocalix-visible");
      }

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
      if (isPaused) return;
      isPlaying = false;
      isPaused = false;
      isLoading = false;
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
    };

    utterance.onerror = () => {
      if (isPaused) return;
      isPlaying = false;
      isPaused = false;
      isLoading = false;
      renderButtons("idle");
      cleanupHighlights();
    };

    window.speechSynthesis.speak(utterance);
  });
}

function stopReading(): void {
  window.speechSynthesis.cancel();
  isPlaying = false;
  isPaused = false;
  isLoading = false;
  renderButtons("idle");
  hideContainer();
  cleanupHighlights();
}

function pauseReading(): void {
  isPaused = true;
  window.speechSynthesis.pause();
  renderButtons("paused");
}

function resumeReading(): void {
  window.speechSynthesis.resume();
  isPaused = false;
  renderButtons("playing");
}

/**
 * Handle messages from popup, background, and keyboard shortcuts
 * I support read, stop, pause, resume, and toggle commands
 */
chrome.runtime.onMessage.addListener(
  (message: { type: string; payload?: string }) => {
    if (message.type === "READ_TEXT") {
      const text = message.payload || window.getSelection()?.toString().trim();
      if (text) {
        lastText = text;
        startReading(text);
      } else {
        showToast("No text selected");
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
 * Show button when text is selected
 * I use a 50ms delay to let the selection stabilize after mouseup
 */
document.addEventListener("mouseup", () => {
  setTimeout(() => {
    if (isPlaying || isPaused) return;

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
 * I check if the click target is inside the container to avoid accidental closure
 */
document.addEventListener("mousedown", (e) => {
  const target = e.target as HTMLElement;
  if (!target.closest("#vocalix-container") && !isPlaying && !isPaused) {
    hideContainer();
  }
});
