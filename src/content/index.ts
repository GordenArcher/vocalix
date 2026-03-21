let button: HTMLButtonElement | null = null;
let isPlaying = false;

let highlightedSpans: HTMLElement[] = [];
let originalRange: Range | null = null;

function getOrCreateButton(): HTMLButtonElement {
  if (button) return button;

  button = document.createElement("button");
  button.id = "vocalix-btn";
  button.textContent = "▶ Read";
  document.body.appendChild(button);

  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPlaying) {
      stopReading();
    } else {
      const text = window.getSelection()?.toString().trim();
      if (text) startReading(text);
    }
  });

  return button;
}

function showButton(x: number, y: number): void {
  const btn = getOrCreateButton();

  const margin = 8;
  let left = x + margin;
  let top = y + margin;

  if (left + 90 > window.innerWidth) left = x - 100;
  if (top + 40 > window.innerHeight) top = y - 44;

  btn.style.left = `${left}px`;
  btn.style.top = `${top}px`;
  btn.classList.add("vocalix-visible");
}

function hideButton(): void {
  button?.classList.remove("vocalix-visible");
}

function setButtonState(playing: boolean): void {
  if (!button) return;
  if (playing) {
    button.textContent = "⏹ Stop";
    button.classList.add("vocalix-playing");
  } else {
    button.textContent = "▶ Read";
    button.classList.remove("vocalix-playing");
  }
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
  window.speechSynthesis.cancel();

  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) {
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
      setButtonState(true);

      const entry = {
        id: Date.now().toString(),
        text: text.slice(0, 200),
        url: location.href,
        timestamp: Date.now(),
      };
      chrome.storage.local.get("history", (result) => {
        const history = result.history || [];
        const updated = [entry, ...history].slice(0, 50);
        chrome.storage.local.set({ history: updated });
      });
    };

    utterance.onend = () => {
      isPlaying = false;
      setButtonState(false);
      hideButton();
      cleanupHighlights();
    };

    utterance.onerror = () => {
      isPlaying = false;
      setButtonState(false);
      cleanupHighlights();
    };

    window.speechSynthesis.speak(utterance);
  });
}

function stopReading(): void {
  window.speechSynthesis.cancel();
  isPlaying = false;
  setButtonState(false);
  hideButton();
  cleanupHighlights();
}

chrome.runtime.onMessage.addListener(
  (message: { type: string; payload?: string }) => {
    if (message.type === "READ_TEXT") {
      const text = message.payload || window.getSelection()?.toString().trim();
      if (text) startReading(text);
    }

    if (message.type === "STOP") {
      stopReading();
    }
  },
);

document.addEventListener("mouseup", () => {
  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (!text || text.length < 2) {
      if (!isPlaying) hideButton();
      return;
    }

    const range = selection!.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    showButton(rect.right, rect.bottom);
  }, 50);
});

document.addEventListener("mousedown", (e) => {
  const target = e.target as HTMLElement;
  if (target.id !== "vocalix-btn" && !isPlaying) {
    hideButton();
  }
});
