// Instagram Likes Extractor - Background Service Worker

// Installation and setup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("Instagram Likes Extractor installed");

  try {
    // Set default settings
    await chrome.storage.local.set({
      extractPreference: "likes",
      limitPreference: 25,
      isEnabled: true,
      installDate: Date.now(),
      version: "1.0.0",
    });

    console.log("Default settings saved");
  } catch (error) {
    console.error("Error setting default settings:", error);
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    switch (message.action) {
      case "checkPlatform":
        handleCheckPlatform(sender.tab, sendResponse);
        return true;

      case "extractLikesData":
        // This will be handled by content script, just acknowledge
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, message: "Unknown action" });
    }
  } catch (error) {
    console.error("Error handling message:", error);
    sendResponse({ success: false, error: error.message });
  }
});

// Platform detection
function handleCheckPlatform(tab, sendResponse) {
  const url = tab.url;
  let platform = null;

  if (url.includes("instagram.com")) {
    platform = "instagram";
  }

  sendResponse({
    platform: platform,
    supported: platform !== null,
    url: url,
  });
}
