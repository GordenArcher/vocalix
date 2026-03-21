let button: HTMLButtonElement | null = null;
let isPlaying = false;

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

function startReading(text: string): void {
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.onstart = () => {
    isPlaying = true;
    setButtonState(true);
  };

  utterance.onend = () => {
    isPlaying = false;
    setButtonState(false);
    hideButton();
  };

  utterance.onerror = () => {
    isPlaying = false;
    setButtonState(false);
  };

  window.speechSynthesis.speak(utterance);
}

function stopReading(): void {
  window.speechSynthesis.cancel();
  isPlaying = false;
  setButtonState(false);
  hideButton();
}

// Show button when text is selected
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
