let button: HTMLButtonElement | null = null;

function getOrCreateButton(): HTMLButtonElement {
  if (button) return button;

  button = document.createElement("button");
  button.id = "vocalix-btn";
  button.textContent = "▶ Read";
  document.body.appendChild(button);

  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Vocalix: read button clicked");
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

document.addEventListener("mouseup", () => {
  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (!text || text.length < 2) {
      hideButton();
      return;
    }

    const range = selection!.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    showButton(rect.right, rect.bottom);
  }, 50);
});

document.addEventListener("mousedown", (e) => {
  const target = e.target as HTMLElement;
  if (target.id !== "vocalix-btn") {
    hideButton();
  }
});
