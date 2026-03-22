import { SpeechSettings, DEFAULT_SETTINGS, HistoryEntry } from "../types";

/**
 * Wrapper around Chrome's storage API to provide Promise-based interface
 * I use this throughout the extension instead of callback-based chrome.storage
 * Makes async/await much cleaner across popup, options, and content scripts
 */

/**
 * Get user settings from sync storage
 * Sync storage ensures settings persist across user's Chrome profile
 * I merge with defaults so adding new settings doesn't break existing installs
 */
export async function getSettings(): Promise<SpeechSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get("settings", (result) => {
      resolve({ ...DEFAULT_SETTINGS, ...(result.settings || {}) });
    });
  });
}

/**
 * Save user settings to sync storage
 * Simple wrapper that resolves when save completes
 */
export async function saveSettings(settings: SpeechSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, resolve);
  });
}

/**
 * Get reading history from local storage
 * I use local (not sync) because history can get large and is device-specific
 * Users don't need their reading history synced across devices
 */
export async function getHistory(): Promise<HistoryEntry[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get("history", (result) => {
      resolve(result.history || []);
    });
  });
}

/**
 * Add a new entry to reading history
 * I cap at 50 entries to prevent storage bloat, oldest entries get pushed out
 */
export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  const history = await getHistory();
  const updated = [entry, ...history].slice(0, 50);
  return new Promise((resolve) => {
    chrome.storage.local.set({ history: updated }, resolve);
  });
}

/**
 * Clear all history entries
 * Used when user clicks the clear button in popup/history view
 */
export async function clearHistory(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove("history", resolve);
  });
}
