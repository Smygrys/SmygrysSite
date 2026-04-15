// ========== PUSH NOTIFICATIONS MANAGER ==========

// Check if notifications are supported
function notificationsSupported() {
  return "Notification" in window && "serviceWorker" in navigator;
}

// Request notification permission
async function requestNotificationPermission() {
  if (!notificationsSupported()) {
    console.log("❌ Notifications not supported");
    return false;
  }

  if (Notification.permission === "granted") {
    console.log("✅ Notifications already enabled");
    return true;
  }

  if (Notification.permission !== "denied") {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        console.log("✅ Notifications enabled");
        return true;
      }
    } catch (error) {
      console.error("❌ Notification permission error:", error);
    }
  }

  return false;
}

// Save notification preference
function saveNotificationPreference(enabled) {
  localStorage.setItem("notificationsEnabled", enabled ? "true" : "false");
}

// Get notification preference
function getNotificationPreference() {
  return localStorage.getItem("notificationsEnabled") !== "false";
}

// Schedule daily notification at 10 PM
async function scheduleDaily10PMNotification(myName, schedule) {
  if (!notificationsSupported() || !getNotificationPreference()) {
    console.log("📢 Notifications disabled or not supported");
    return;
  }

  console.log("⏰ Notification scheduler started for:", myName);

  // Check time every minute
  checkAndNotify(myName, schedule);
  
  // Set interval to check every minute
  setInterval(() => checkAndNotify(myName, schedule), 60000);
}

function checkAndNotify(myName, schedule) {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Check if it's 10 PM (22:00)
  if (hours === 22 && minutes === 0) {
    // Get tomorrow's date to find whose day it is
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = tomorrow.toISOString().split("T")[0];

    const tomorrowPerson = schedule[tomorrowKey];

    if (tomorrowPerson === myName) {
      // It's YOUR day tomorrow!
      showPhoneNotification(
        "🗑️ Your Turn Tomorrow!",
        `You're responsible for trash tomorrow (${getDayName(tomorrow)})`,
        "🗑️"
      );
    }

    if (tomorrowPerson && tomorrowPerson !== myName) {
      console.log(`📢 Tomorrow is ${tomorrowPerson}'s turn`);
    }
  }
}

function getDayName(date) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[date.getDay()];
}

// Show phone notification
function showPhoneNotification(title, message, icon) {
  if (!notificationsSupported() || !getNotificationPreference()) {
    console.log("📢 Notifications not enabled");
    return;
  }

  if (Notification.permission === "granted") {
    try {
      const notification = new Notification(title, {
        body: message,
        icon: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect fill='%23a855f7' width='192' height='192' rx='45'/><text x='96' y='96' font-size='100' text-anchor='middle' dominant-baseline='middle'>${icon}</text></svg>`,
        tag: "trash-rotation-notification",
        requireInteraction: true,
        badge: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect fill='%23a855f7' width='192' height='192' rx='45'/><text x='96' y='96' font-size='100' text-anchor='middle' dominant-baseline='middle'>${icon}</text></svg>`
      });

      notification.onclick = () => {
        window.focus();
        window.parent.focus();
        notification.close();
      };

      console.log("✅ Notification sent:", title);
    } catch (error) {
      console.error("❌ Error showing notification:", error);
    }
  }
}

// Initialize notifications on app load
async function initNotifications() {
  if (!notificationsSupported()) {
    console.log("ℹ️ Notifications not supported on this device");
    return;
  }

  if (Notification.permission === "denied") {
    console.log("📢 User denied notifications");
    localStorage.setItem("notificationsEnabled", "false");
    return;
  }

  if (Notification.permission === "default" && getNotificationPreference()) {
    const granted = await requestNotificationPermission();
    if (!granted) {
      localStorage.setItem("notificationsEnabled", "false");
    }
  }

  console.log("✅ Notifications initialized");
}

// Test notification
function sendTestNotification() {
  showPhoneNotification(
    "🗑️ Test Notification",
    "This is a test. You'll get a real notification at 10 PM when it's your turn!",
    "✅"
  );
}

// Make functions global
window.requestNotificationPermission = requestNotificationPermission;
window.saveNotificationPreference = saveNotificationPreference;
window.getNotificationPreference = getNotificationPreference;
window.scheduleDaily10PMNotification = scheduleDaily10PMNotification;
window.initNotifications = initNotifications;
window.sendTestNotification = sendTestNotification;