import { DEFAULT_SETTINGS, SpeechSettings } from "../src/types/index";

const voiceSelect = document.getElementById(
  "voice-select",
) as HTMLSelectElement;
const rateInput = document.getElementById("rate") as HTMLInputElement;
const pitchInput = document.getElementById("pitch") as HTMLInputElement;
const rateValue = document.getElementById("rate-value") as HTMLSpanElement;
const pitchValue = document.getElementById("pitch-value") as HTMLSpanElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;

const tabSettings = document.getElementById("tab-settings") as HTMLDivElement;
const tabHistory = document.getElementById("tab-history") as HTMLDivElement;
const historyList = document.getElementById("history-list") as HTMLUListElement;
const historyCount = document.getElementById(
  "history-count",
) as HTMLSpanElement;
const clearBtn = document.getElementById("clear-btn") as HTMLButtonElement;

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    const target = (tab as HTMLElement).dataset.tab;
    tabSettings.classList.toggle("hidden", target !== "settings");
    tabHistory.classList.toggle("hidden", target !== "history");

    if (target === "history") loadHistory();
  });
});

chrome.storage.sync.get("settings", (result) => {
  const settings: SpeechSettings = {
    ...DEFAULT_SETTINGS,
    ...(result.settings || {}),
  };
  rateInput.value = String(settings.rate);
  pitchInput.value = String(settings.pitch);
  rateValue.textContent = String(settings.rate);
  pitchValue.textContent = String(settings.pitch);
  loadVoices(settings.voiceId);
});

function loadVoices(savedVoiceId: string = ""): void {
  const voices = window.speechSynthesis.getVoices();

  if (voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => loadVoices(savedVoiceId);
    return;
  }

  voiceSelect.innerHTML = "";
  voices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (voice.voiceURI === savedVoiceId) option.selected = true;
    voiceSelect.appendChild(option);
  });
}

rateInput.addEventListener("input", () => {
  rateValue.textContent = rateInput.value;
});

pitchInput.addEventListener("input", () => {
  pitchValue.textContent = pitchInput.value;
});

saveBtn.addEventListener("click", () => {
  const settings: SpeechSettings = {
    ...DEFAULT_SETTINGS,
    voiceId: voiceSelect.value,
    rate: parseFloat(rateInput.value),
    pitch: parseFloat(pitchInput.value),
  };

  chrome.storage.sync.set({ settings }, () => {
    saveBtn.textContent = "Saved ✓";
    setTimeout(() => (saveBtn.textContent = "Save settings"), 1500);
  });
});

function loadHistory(): void {
  chrome.storage.local.get("history", (result) => {
    const history = result.history || [];
    historyCount.textContent = `${history.length} item${history.length !== 1 ? "s" : ""}`;

    if (history.length === 0) {
      historyList.innerHTML = `<li class="empty">No history yet</li>`;
      return;
    }

    historyList.innerHTML = history
      .map(
        (entry: {
          id: string;
          text: string;
          url: string;
          timestamp: number;
        }) => {
          const date = new Date(entry.timestamp).toLocaleDateString();
          const time = new Date(entry.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          const host = (() => {
            try {
              return new URL(entry.url).hostname;
            } catch {
              return entry.url;
            }
          })();
          const snippet =
            entry.text.length > 80 ? entry.text.slice(0, 80) + "…" : entry.text;

          return `
          <li class="history-item">
            <p class="history-text">${snippet}</p>
            <span class="history-meta">${host} · ${date} ${time}</span>
          </li>
        `;
        },
      )
      .join("");
  });
}

clearBtn.addEventListener("click", () => {
  chrome.storage.local.remove("history", () => {
    loadHistory();
  });
});
