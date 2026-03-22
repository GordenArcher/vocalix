/**
 * Vocalix Background Script
 * Handles extension lifecycle, context menus, keyboard shortcuts,
 * and communication with content scripts.
 */

/**
 * Create context menu when extension is installed/updated
 * Only appears when text is selected on a page
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "vocalix-read",
    title: "Read aloud with Vocalix",
    contexts: ["selection"],
  });
});

/**
 * Send message to content script with automatic injection fallback
 * If content script isn't loaded yet (fresh page), inject it first
 */
async function sendToTab(tabId: number, message: object): Promise<void> {
  chrome.tabs.sendMessage(tabId, message, () => {
    if (chrome.runtime.lastError) {
      // Content script not loaded - inject it and retry
      chrome.scripting.executeScript(
        { target: { tabId }, files: ["src/content/index.js"] },
        () => {
          setTimeout(() => chrome.tabs.sendMessage(tabId, message), 300);
        },
      );
    }
  });
}

/**
 * Handle context menu clicks
 * Send selected text to content script for reading
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "vocalix-read" && tab?.id) {
    sendToTab(tab.id, { type: "READ_TEXT", payload: info.selectionText });
  }
});

/**
 * Handle keyboard shortcuts
 * Commands defined in manifest.json
 */
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === "read-selection") sendToTab(tab.id, { type: "READ_TEXT" });
  if (command === "stop-reading") sendToTab(tab.id, { type: "STOP" });
  if (command === "pause-resume") sendToTab(tab.id, { type: "PAUSE_RESUME" });
});
