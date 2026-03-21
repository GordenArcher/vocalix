import { SpeechSettings, DEFAULT_SETTINGS, HistoryEntry } from "../types";

export async function getSettings(): Promise<SpeechSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get("settings", (result) => {
      resolve({ ...DEFAULT_SETTINGS, ...(result.settings || {}) });
    });
  });
}

export async function saveSettings(settings: SpeechSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, resolve);
  });
}

export async function getHistory(): Promise<HistoryEntry[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get("history", (result) => {
      resolve(result.history || []);
    });
  });
}

export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  const history = await getHistory();
  const updated = [entry, ...history].slice(0, 50); // cap at 50
  return new Promise((resolve) => {
    chrome.storage.local.set({ history: updated }, resolve);
  });
}

export async function clearHistory(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove("history", resolve);
  });
}
