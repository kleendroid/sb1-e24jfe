// Initialize badge text
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ summaries: [] });
  chrome.action.setBadgeText({ text: '' });
  chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
});

// Handle badge updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateBadge') {
    chrome.action.setBadgeText({ text: message.count.toString() });
  }
  
  // Handle form filling message relay
  if (message.type === 'fillPumpForm') {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, message);
      }
    });
  }
});