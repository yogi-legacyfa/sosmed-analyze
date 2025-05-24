// Instagram Likes Extractor - Popup JavaScript

let currentLimit = 25;
let currentProfile = null;
let currentContentType = null;
let extractedData = [];

document.addEventListener("DOMContentLoaded", async () => {
  await initializePopup();
  setupEventListeners();
});

async function initializePopup() {
  const platformInfo = document.getElementById("platform-info");
  const detectionInfo = document.getElementById("detection-info");
  const processBtn = document.getElementById("process-btn");

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const url = tab.url;

    if (url.includes("instagram.com")) {
      const detection = await detectInstagramContent(tab);

      if (detection.isProfile) {
        platformInfo.textContent = "📷 Instagram Profile Detected";
        platformInfo.style.background = "rgba(76, 175, 80, 0.2)";

        // Show detection details
        detectionInfo.style.display = "block";
        document.getElementById("profile-name").textContent =
          detection.profileName || "Unknown Profile";
        document.getElementById(
          "content-type"
        ).textContent = `${detection.contentType} available for extraction`;

        currentProfile = detection.profileName;
        currentContentType = detection.contentType;

        processBtn.disabled = false;
        processBtn.textContent = `🚀 Process ${detection.contentType} Likes`;
      } else {
        platformInfo.textContent =
          "❌ Please navigate to Instagram profile page";
        platformInfo.style.background = "rgba(255, 87, 51, 0.2)";
        processBtn.disabled = true;
        processBtn.textContent = "❌ Profile page required";
      }
    } else {
      platformInfo.textContent = "❌ Please navigate to Instagram";
      platformInfo.style.background = "rgba(255, 87, 51, 0.2)";
      processBtn.disabled = true;
      processBtn.textContent = "❌ Instagram required";
    }
  } catch (error) {
    console.error("Error initializing popup:", error);
    platformInfo.textContent = "Error detecting platform";
    processBtn.disabled = true;
  }
}

async function detectInstagramContent(tab) {
  try {
    // Inject detection script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        // Check if we're on a profile page
        const isProfile =
          window.location.pathname.match(/^\/[^\/]+\/?$/) ||
          window.location.pathname.includes("/profilecard/");

        if (!isProfile) {
          return { isProfile: false };
        }

        // Extract profile name from URL or page
        let profileName = window.location.pathname.replace(/^\/|\/$/g, "");
        if (!profileName) {
          // Try to get from page content
          const profileElement =
            document.querySelector("h2") ||
            document.querySelector('[data-testid="user-name"]') ||
            document.querySelector("header h1");
          profileName = profileElement?.textContent?.trim() || "unknown";
        }

        // Detect content type based on current tab/URL
        let contentType = "Posts";
        if (
          window.location.pathname.includes("/reels/") ||
          window.location.href.includes("reels")
        ) {
          contentType = "Reels";
        } else if (document.querySelector('[href*="reels"]')) {
          // Check if reels tab is active
          const reelsTab = document.querySelector('[href*="reels"]');
          if (reelsTab && reelsTab.getAttribute("aria-selected") === "true") {
            contentType = "Reels";
          }
        }

        return {
          isProfile: true,
          profileName: profileName,
          contentType: contentType,
        };
      },
    });

    return results[0].result;
  } catch (error) {
    console.error("Error detecting Instagram content:", error);
    return { isProfile: false };
  }
}

function setupEventListeners() {
  // Limit dropdown functionality
  const limitBtn = document.getElementById("limit-btn");
  const limitDropdown = document.getElementById("limit-dropdown");

  limitBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    limitDropdown.classList.toggle("show");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", () => {
    limitDropdown.classList.remove("show");
  });

  // Limit options
  document.querySelectorAll(".limit-option").forEach((option) => {
    option.addEventListener("click", (e) => {
      const limit = e.target.dataset.limit;
      currentLimit = limit === "all" ? "all" : parseInt(limit);

      // Update button text
      const limitText = currentLimit === "all" ? "All Available" : currentLimit;
      limitBtn.textContent = `Latest ${limitText} Items ▼`;

      // Update active state
      document
        .querySelectorAll(".limit-option")
        .forEach((o) => o.classList.remove("active"));
      option.classList.add("active");

      limitDropdown.classList.remove("show");
    });
  });

  // Process button
  document
    .getElementById("process-btn")
    .addEventListener("click", processLikesData);

  // Export button
  document.getElementById("export-btn").addEventListener("click", exportCSV);
}

async function processLikesData() {
  if (!currentProfile || !currentContentType) return;

  const processBtn = document.getElementById("process-btn");
  const exportBtn = document.getElementById("export-btn");
  const progress = document.getElementById("progress");
  const progressText = document.getElementById("progress-text");
  const progressFill = document.getElementById("progress-fill");

  try {
    // Update UI to show processing
    processBtn.disabled = true;
    processBtn.textContent = "⏳ Processing...";
    progress.style.display = "block";
    exportBtn.style.display = "none";

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Inject content script if not already injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
    } catch (e) {
      // Script might already be injected
    }

    // Start data extraction
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "extractLikesData",
      profile: currentProfile,
      contentType: currentContentType,
      limit: currentLimit,
    });

    if (response.success) {
      extractedData = response.data;

      // Update progress to 100%
      progressFill.style.width = "100%";
      progressText.textContent = "100%";

      // Show success and export option
      setTimeout(() => {
        progress.style.display = "none";
        processBtn.textContent = "✅ Processing Complete!";
        exportBtn.style.display = "block";

        // Update status
        document.getElementById("status").textContent = `🎉 Extracted ${
          extractedData.length
        } ${currentContentType.toLowerCase()} with likes data!`;
      }, 1000);
    } else {
      throw new Error(response.error || "Failed to extract data");
    }
  } catch (error) {
    console.error("Error processing likes data:", error);

    // Show error state
    progress.style.display = "none";
    processBtn.textContent = "❌ Processing Failed";
    processBtn.disabled = false;

    document.getElementById("status").textContent =
      "❌ Failed to extract data. Please try again.";
  }
}

function exportCSV() {
  if (!extractedData.length) return;

  let csvContent = "";
  let filename = "";

  if (currentContentType === "Reels") {
    // Reels CSV format: Profile, Reel URL, Views, Likes, Comments
    csvContent = "Profile,Reel,Views,Likes,Comments\n";
    extractedData.forEach((item) => {
      csvContent += `${currentProfile},${item.url},${item.views},${item.likes},${item.comments}\n`;
    });
    filename = `instagram_reels_${currentProfile}_${
      new Date().toISOString().split("T")[0]
    }.csv`;
  } else {
    // Posts CSV format: Profile, Post, Create Date, Likes, Comments, Captions
    csvContent = "Profile,Post,Create Date,Likes,Comments,Captions\n";
    extractedData.forEach((item) => {
      const caption = (item.caption || "").replace(/"/g, '""'); // Escape quotes
      csvContent += `${currentProfile},${item.url},${item.createDate},${item.likes},${item.comments},"${caption}"\n`;
    });
    filename = `instagram_posts_${currentProfile}_${
      new Date().toISOString().split("T")[0]
    }.csv`;
  }

  // Create and download CSV
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Update button text
  document.getElementById("export-btn").textContent = "✅ CSV Downloaded!";
  setTimeout(() => {
    document.getElementById("export-btn").textContent = "📥 Export CSV File";
  }, 2000);
}
