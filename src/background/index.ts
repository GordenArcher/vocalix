chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "vocalix-read",
    title: "Read aloud with Vocalix",
    contexts: ["selection"],
  });
});

async function sendToTab(tabId: number, message: object): Promise<void> {
  chrome.tabs.sendMessage(tabId, message, () => {
    if (chrome.runtime.lastError) {
      chrome.scripting.executeScript(
        { target: { tabId }, files: ["src/content/index.js"] },
        () => {
          setTimeout(() => chrome.tabs.sendMessage(tabId, message), 300);
        },
      );
    }
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "vocalix-read" && tab?.id) {
    sendToTab(tab.id, { type: "READ_TEXT", payload: info.selectionText });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const message =
    command === "read-selection" ? { type: "READ_TEXT" } : { type: "STOP" };

  sendToTab(tab.id, message);
});
