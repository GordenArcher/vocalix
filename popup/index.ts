import { DEFAULT_SETTINGS, SpeechSettings } from "../src/types/index";

/**
 * Popup UI elements - these control the settings panel users interact with
 */
const voiceSelect = document.getElementById(
  "voice-select",
) as HTMLSelectElement;
const rateInput = document.getElementById("rate") as HTMLInputElement;
const pitchInput = document.getElementById("pitch") as HTMLInputElement;
const volumeInput = document.getElementById("volume") as HTMLInputElement;
const rateValue = document.getElementById("rate-value") as HTMLSpanElement;
const pitchValue = document.getElementById("pitch-value") as HTMLSpanElement;
const volumeValue = document.getElementById("volume-value") as HTMLSpanElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const autoReadInput = document.getElementById("auto-read") as HTMLInputElement;
const highlightWordsInput = document.getElementById(
  "highlight-words",
) as HTMLInputElement;

const tabSettings = document.getElementById("tab-settings") as HTMLDivElement;
const tabHistory = document.getElementById("tab-history") as HTMLDivElement;
const historyList = document.getElementById("history-list") as HTMLUListElement;
const historyCount = document.getElementById(
  "history-count",
) as HTMLSpanElement;
const clearBtn = document.getElementById("clear-btn") as HTMLButtonElement;

/**
 * Tab switching between Settings and History views
 * I toggle visibility and load history on demand to save resources
 */
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

/**
 * Load saved settings from Chrome sync storage
 * I merge with defaults so new settings don't break existing installs
 */
chrome.storage.sync.get("settings", (result) => {
  const settings: SpeechSettings = {
    ...DEFAULT_SETTINGS,
    ...(result.settings || {}),
  };
  rateInput.value = String(settings.rate);
  pitchInput.value = String(settings.pitch);
  volumeInput.value = String(settings.volume);
  rateValue.textContent = String(settings.rate);
  pitchValue.textContent = String(settings.pitch);
  volumeValue.textContent = String(settings.volume);
  autoReadInput.checked = settings.autoRead;
  highlightWordsInput.checked = settings.highlightWords;
  loadVoices(settings.voiceId);
});

/**
 * Populate voice dropdown with available system voices
 * This is tricky because voices aren't always ready when the popup opens
 * I handle the async loading with onvoiceschanged and a retry fallback
 */
function loadVoices(savedVoiceId: string = ""): void {
  const voices = window.speechSynthesis.getVoices();

  if (voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      loadVoices(savedVoiceId);
    };
    setTimeout(() => {
      if (voiceSelect.options.length <= 1) loadVoices(savedVoiceId);
    }, 500);
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

/**
 * Live preview of slider values while dragging
 * Makes it feel more responsive than just showing numbers after save
 */
rateInput.addEventListener("input", () => {
  rateValue.textContent = rateInput.value;
});
pitchInput.addEventListener("input", () => {
  pitchValue.textContent = pitchInput.value;
});
volumeInput.addEventListener("input", () => {
  volumeValue.textContent = volumeInput.value;
});

/**
 * Save all settings to Chrome sync storage
 * I show a temporary "Saved" feedback so users know it worked
 */
saveBtn.addEventListener("click", () => {
  chrome.storage.sync.get("settings", (result) => {
    const existing: SpeechSettings = {
      ...DEFAULT_SETTINGS,
      ...(result.settings || {}),
    };
    const settings: SpeechSettings = {
      ...existing,
      voiceId: voiceSelect.value,
      rate: parseFloat(rateInput.value),
      pitch: parseFloat(pitchInput.value),
      volume: parseFloat(volumeInput.value),
      autoRead: autoReadInput.checked,
      highlightWords: highlightWordsInput.checked,
    };
    chrome.storage.sync.set({ settings }, () => {
      saveBtn.textContent = "Saved ✓";
      setTimeout(() => (saveBtn.textContent = "Save settings"), 1500);
    });
  });
});

/**
 * Load reading history from local storage
 * I use local (not sync) because history can get large and is device-specific
 * Each item shows text snippet, domain, and timestamp
 */
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
          <li class="history-item" data-id="${entry.id}" data-text="${encodeURIComponent(entry.text)}">
            <div class="history-item-top">
              <p class="history-text">${snippet}</p>
              <button class="history-delete" data-id="${entry.id}" title="Delete">✕</button>
            </div>
            <span class="history-meta">${host} · ${date} ${time}</span>
          </li>
        `;
        },
      )
      .join("");

    /**
     * Clicking a history item sends it to the content script for reading
     * I encodeURIComponent the text to handle special characters safely
     * Then close the popup immediately for better UX
     */
    historyList.querySelectorAll(".history-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).classList.contains("history-delete"))
          return;
        const text = decodeURIComponent(
          (item as HTMLElement).dataset.text || "",
        );
        if (!text) return;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: "READ_TEXT",
              payload: text,
            });
            window.close();
          }
        });
      });
    });

    /**
     * Individual delete buttons let users remove specific history items
     * I stopPropagation so the parent click handler doesn't trigger
     */
    historyList.querySelectorAll(".history-delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        chrome.storage.local.get("history", (result) => {
          const updated = (result.history || []).filter(
            (entry: { id: string }) => entry.id !== id,
          );
          chrome.storage.local.set({ history: updated }, () => loadHistory());
        });
      });
    });
  });
}

/**
 * Clear entire history when user clicks the clear button
 * I reload the UI after to show empty state
 */
clearBtn.addEventListener("click", () => {
  chrome.storage.local.remove("history", () => loadHistory());
});

const rereadBtn = document.getElementById("reread-btn") as HTMLButtonElement;

/**
 * Quick re-read of the most recent history item
 * If there's no history, show temporary feedback and revert after 1.5s
 * This is a convenience feature so users don't have to navigate to history tab
 */
rereadBtn.addEventListener("click", () => {
  chrome.storage.local.get("history", (result) => {
    const history = result.history || [];
    if (history.length === 0) {
      rereadBtn.textContent = "Nothing to re-read";
      setTimeout(() => (rereadBtn.textContent = "🔁 Re-read last"), 1500);
      return;
    }

    const last = history[0];
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "READ_TEXT",
          payload: last.text,
        });
        window.close();
      }
    });
  });
});
