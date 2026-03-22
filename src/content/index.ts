let container: HTMLDivElement | null = null;
let isPlaying = false;
let isPaused = false;
let isLoading = false;
let autoRead = false;
let highlightWordsEnabled = true;
let minLength = 2;

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

  if (left + 220 > window.innerWidth) left = x - 230;
  if (top + 44 > window.innerHeight) top = y - 50;

  c.style.left = `${left}px`;
  c.style.top = `${top}px`;
  c.classList.add("vocalix-visible");
}

function showContainerCentered(): void {
  const c = getOrCreateContainer();
  c.style.left = `${window.innerWidth / 2 - 110}px`;
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
      const text = window.getSelection()?.toString().trim();
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

      // If container isn't visible (e.g. triggered via shortcut), show it centered at top
      const c = getOrCreateContainer();
      if (!c.classList.contains("vocalix-visible")) {
        showContainerCentered();
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
      isPlaying = false;
      isPaused = false;
      isLoading = false;
      renderButtons("idle");
      hideContainer();
      cleanupHighlights();
    };

    utterance.onerror = () => {
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
  window.speechSynthesis.pause();
  isPaused = true;
  renderButtons("paused");
}

function resumeReading(): void {
  window.speechSynthesis.resume();
  isPaused = false;
  renderButtons("playing");
}

chrome.runtime.onMessage.addListener(
  (message: { type: string; payload?: string }) => {
    if (message.type === "READ_TEXT") {
      const text = message.payload || window.getSelection()?.toString().trim();
      if (text) startReading(text);
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
      startReading(text);
    } else {
      renderButtons("idle");
      showContainer(rect.right, rect.bottom);
    }
  }, 50);
});

document.addEventListener("mousedown", (e) => {
  const target = e.target as HTMLElement;
  if (!target.closest("#vocalix-container") && !isPlaying && !isPaused) {
    hideContainer();
  }
});
