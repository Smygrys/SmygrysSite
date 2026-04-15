import { auth, db } from "./admin-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  deleteField,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  updateDoc,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

window.adminState = {
  isAdmin: false,
  members: {},
  schedule: {},
  notifications: []
};

// ========== LOGIN ==========
window.adminLogin = async () => {
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;
  const errorEl = document.getElementById("loginError");

  if (!email || !password) {
    errorEl.textContent = "❌ Enter email and password";
    return;
  }

  try {
    errorEl.textContent = "🔄 Logging in...";
    console.log("🔐 Attempting login with:", email);
    await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Login successful!");
    errorEl.textContent = "";
  } catch (error) {
    console.error("❌ Login error:", error.code, error.message);
    
    if (error.code === "auth/user-not-found") {
      errorEl.textContent = "❌ User not found";
    } else if (error.code === "auth/wrong-password") {
      errorEl.textContent = "❌ Wrong password";
    } else if (error.code === "auth/invalid-email") {
      errorEl.textContent = "❌ Invalid email";
    } else {
      errorEl.textContent = "❌ " + error.message;
    }
  }
};

// ========== LOGOUT ==========
window.adminLogout = async () => {
  try {
    await signOut(auth);
    console.log("✅ Logged out");
    document.getElementById("loginScreen").classList.remove("hidden");
    document.getElementById("adminDashboard").classList.add("hidden");
    document.getElementById("adminEmail").value = "";
    document.getElementById("adminPassword").value = "";
    document.getElementById("loginError").textContent = "";
  } catch (error) {
    console.error("❌ Logout error:", error);
  }
};

// ========== AUTH STATE LISTENER ==========
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("✅ Admin logged in:", user.email);
    window.adminState.isAdmin = true;
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("adminDashboard").classList.remove("hidden");
    loadAdminData();
    listenToNotifications();
  } else {
    console.log("🔒 Admin logged out");
    window.adminState.isAdmin = false;
    document.getElementById("loginScreen").classList.remove("hidden");
    document.getElementById("adminDashboard").classList.add("hidden");
  }
});

// ========== LOAD ADMIN DATA ==========
function loadAdminData() {
  console.log("📥 Loading admin data...");
  onSnapshot(doc(db, "appSettings", "config"), (docSnap) => {
    if (docSnap.exists()) {
      window.adminState.members = docSnap.data().members || {};
      console.log("✅ Members loaded:", window.adminState.members);
    } else {
      console.log("ℹ️ No members yet");
      window.adminState.members = {};
    }
    renderUsers();
    loadSchedule();
  });
}

// ========== RENDER USERS ==========
function renderUsers() {
  const container = document.getElementById("usersList");
  container.innerHTML = "";

  const entries = Object.entries(window.adminState.members);

  if (entries.length === 0) {
    container.innerHTML = "<p style='text-align:center;color:#9ca3af;padding:2rem'>No users yet</p>";
    return;
  }

  entries.forEach(([name, data]) => {
    const days = data.days || [];

    const div = document.createElement("div");
    div.className = "user-card";

    const daysHtml = days.length > 0
      ? days.map(d => `<span class="user-day assigned">${d}</span>`).join("")
      : '<span class="user-day">No preference</span>';

    div.innerHTML = `
      <div class="user-header">
        <div class="user-name">${name}</div>
        <div class="user-badge">#${entries.length}</div>
      </div>
      <div class="user-days">${daysHtml}</div>
      <div class="user-actions">
        <button class="btn-edit" onclick="window.editUser('${name}')">✏️ Edit</button>
        <button class="btn-delete" onclick="window.deleteUserConfirm('${name}')">🗑️ Delete</button>
      </div>
    `;

    container.appendChild(div);
  });
}

// ========== EDIT USER ==========
window.editUser = (name) => {
  const data = window.adminState.members[name];
  const days = data.days || [];

  const newDaysStr = prompt(
    `Edit days for ${name}:\n\n(comma separated, or leave empty for random)\n\nCurrent: ${days.length > 0 ? days.join(", ") : "Random"}\n\nOptions: Monday, Tuesday, Wednesday, Thursday, Friday`,
    days.join(",")
  );

  if (newDaysStr === null) return;

  const newDays = newDaysStr.split(",").map(d => d.trim()).filter(d => d);

  const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const validNewDays = newDays.filter(d => validDays.includes(d));

  if (newDaysStr !== "" && validNewDays.length === 0) {
    alert("❌ Invalid days. Use: Monday, Tuesday, Wednesday, Thursday, Friday");
    return;
  }

  updateUserDays(name, validNewDays.length > 0 ? validNewDays : []);
};

async function updateUserDays(name, newDays) {
  try {
    const configRef = doc(db, "appSettings", "config");
    const configDoc = await getDoc(configRef);
    let members = configDoc.exists() ? (configDoc.data().members || {}) : {};

    members[name] = {
      ...members[name],
      days: newDays
    };

    await setDoc(configRef, { members });
    showNotification(`✏️ Updated ${name}'s days`, "success", "✅");
  } catch (error) {
    console.error("❌ Error updating:", error);
    showNotification("❌ Error updating user", "error", "⚠️");
  }
}

// ========== DELETE USER ==========
window.deleteUserConfirm = (name) => {
  if (confirm(`⚠️ Are you sure you want to DELETE ${name}?\n\nThis cannot be undone!`)) {
    deleteUser(name);
  }
};

async function deleteUser(name) {
  try {
    const configRef = doc(db, "appSettings", "config");
    const configDoc = await getDoc(configRef);
    let members = configDoc.exists() ? (configDoc.data().members || {}) : {};

    delete members[name];

    await setDoc(configRef, { members });
    showNotification(`🗑️ Deleted ${name}`, "success", "✅");
    renderUsers();
    loadSchedule();
  } catch (error) {
    console.error("❌ Error deleting:", error);
    showNotification("❌ Error deleting user", "error", "⚠️");
  }
}

// ========== SEND NOTIFICATION ==========
window.sendNotification = async () => {
  const message = document.getElementById("notifyMessage").value.trim();
  const color = document.querySelector("input[name='notifyColor']:checked").value;
  const icon = document.getElementById("notifyIcon").value.trim() || "📢";

  if (!message) {
    alert("❌ Enter notification message");
    return;
  }

  try {
    console.log("📤 Sending notification:", message);
    await addDoc(collection(db, "adminNotifications"), {
      message,
      color,
      icon,
      createdAt: serverTimestamp()
    });

    document.getElementById("notifyMessage").value = "";
    document.getElementById("notifyIcon").value = "";

    showNotification("📤 Notification sent to all users!", "success", "✅");
    loadNotificationHistory();
  } catch (error) {
    console.error("❌ Error sending:", error);
    showNotification("❌ Error sending notification", "error", "⚠️");
  }
};

function listenToNotifications() {
  const q = query(
    collection(db, "adminNotifications"),
    orderBy("createdAt", "desc"),
    limit(10)
  );

  onSnapshot(q, (snapshot) => {
    console.log("📬 Notifications updated:", snapshot.size);
  });
}

function loadNotificationHistory() {
  const q = query(
    collection(db, "adminNotifications"),
    orderBy("createdAt", "desc"),
    limit(10)
  );

  onSnapshot(q, (snapshot) => {
    const container = document.getElementById("notifyHistory");
    container.innerHTML = "<h3 style='margin-bottom:1rem'>Recent Notifications</h3>";

    if (snapshot.empty) {
      container.innerHTML += "<p style='color:#9ca3af'>No notifications sent yet</p>";
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const date = data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date();
      const timeStr = date.toLocaleTimeString();
      const dateStr = date.toLocaleDateString();

      const div = document.createElement("div");
      div.className = "history-item";

      div.innerHTML = `
        <div class="history-icon">${data.icon}</div>
        <div class="history-text">
          <div>${data.message}</div>
          <div class="history-time">${dateStr} at ${timeStr}</div>
        </div>
      `;

      container.appendChild(div);
    });
  });
}

// ========== LOAD SCHEDULE ==========
function loadSchedule() {
  const monday = getMonday();
  const weekKey = monday.toISOString().split("T")[0];

  onSnapshot(doc(db, "schedules", weekKey), (docSnap) => {
    window.adminState.schedule = docSnap.exists() ? docSnap.data() : {};
    renderSchedule();
  });
}

function renderSchedule() {
  const container = document.getElementById("scheduleContainer");
  container.innerHTML = "";

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const monday = getMonday();

  for (let i = 0; i < 5; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dateKey = day.toISOString().split("T")[0];
    const dayName = days[i];
    const person = window.adminState.schedule[dateKey] || "—";

    const div = document.createElement("div");
    div.className = "day-schedule";

    div.innerHTML = `
      <div class="day-header">${dayName} (${day.getDate()})</div>
      <div class="day-assigned">
        <span class="assigned-person">${person}</span>
        <button class="btn-change-person" onclick="window.changeSchedulePerson('${dateKey}', '${person}')">Change</button>
      </div>
    `;

    container.appendChild(div);
  }
}

window.changeSchedulePerson = (dateKey, currentPerson) => {
  const members = Object.keys(window.adminState.members);

  if (members.length === 0) {
    alert("❌ No members to assign");
    return;
  }

  const newPerson = prompt(
    `Change ${currentPerson} to?\n\n${members.join(", ")}`,
    currentPerson
  );

  if (!newPerson || !members.includes(newPerson)) return;

  updateSchedulePerson(dateKey, currentPerson, newPerson);
};

async function updateSchedulePerson(dateKey, oldPerson, newPerson) {
  try {
    const monday = getMonday();
    const weekKey = monday.toISOString().split("T")[0];
    const scheduleRef = doc(db, "schedules", weekKey);

    const scheduleDoc = await getDoc(scheduleRef);
    let schedule = scheduleDoc.exists() ? scheduleDoc.data() : {};

    schedule[dateKey] = newPerson;

    await setDoc(scheduleRef, schedule);
    showNotification(`📅 Changed to ${newPerson}`, "success", "✅");
    renderSchedule();
  } catch (error) {
    console.error("❌ Error updating schedule:", error);
    showNotification("❌ Error updating schedule", "error", "⚠️");
  }
}

// ========== PRANK FUNCTIONS ==========

// Clear all history
window.clearAllHistory = async () => {
  if (!confirm("⚠️ This will DELETE ALL HISTORY for EVERYONE!\n\n Are you SURE?")) return;
  if (!confirm("🎉 Really? This is permanent!")) return;

  try {
    showNotification("🔄 Clearing all history...", "warning", "⏳");
    
    const historyCollection = collection(db, "history");
    const snapshot = await onSnapshot(historyCollection, async (docs) => {
      docs.forEach(async (doc) => {
        await deleteDoc(doc.ref);
      });
    });

    setTimeout(() => {
      showNotification("✅ All history cleared! Users will be confused! 😂", "success", "🎉");
      sendAdminNotification("📊 History cleared!", "info", "🧹");
    }, 1000);
  } catch (error) {
    console.error("❌ Error:", error);
    showNotification("❌ Error clearing history", "error", "⚠️");
  }
};

// Swap two users' days
window.swapUserDays = async () => {
  const members = Object.keys(window.adminState.members);
  if (members.length < 2) {
    alert("❌ Need at least 2 users");
    return;
  }

  const user1 = prompt(`Select first user:\n\n${members.join("\n")}`, members[0]);
  if (!user1 || !members.includes(user1)) return;

  const user2 = prompt(`Select second user:\n\n${members.join("\n")}`, members[1]);
  if (!user2 || !members.includes(user2) || user1 === user2) return;

  try {
    const monday = getMonday();
    const weekKey = monday.toISOString().split("T")[0];
    const scheduleRef = doc(db, "schedules", weekKey);
    const scheduleDoc = await getDoc(scheduleRef);
    let schedule = scheduleDoc.exists() ? scheduleDoc.data() : {};

    // Swap all days
    for (const [dateKey, person] of Object.entries(schedule)) {
      if (person === user1) schedule[dateKey] = user2;
      else if (person === user2) schedule[dateKey] = user1;
    }

    await setDoc(scheduleRef, schedule);
    showNotification(`🔄 Swapped ${user1} and ${user2}!`, "success", "✅");
    sendAdminNotification(`🔄 Your schedule swapped with ${user1}!`, "warning", "🔄");
    renderSchedule();
  } catch (error) {
    console.error("❌ Error:", error);
    showNotification("❌ Error swapping", "error", "⚠️");
  }
};

// Randomize schedule
window.randomizeSchedule = async () => {
  if (!confirm("🎲 Randomize the entire week schedule?")) return;

  try {
    const members = Object.keys(window.adminState.members);
    if (members.length === 0) {
      alert("❌ No members");
      return;
    }

    const monday = getMonday();
    const weekKey = monday.toISOString().split("T")[0];
    const scheduleRef = doc(db, "schedules", weekKey);
    let newSchedule = {};

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    for (let i = 0; i < 5; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const dateKey = day.toISOString().split("T")[0];
      newSchedule[dateKey] = members[Math.floor(Math.random() * members.length)];
    }

    await setDoc(scheduleRef, newSchedule);
    showNotification("🎲 Schedule randomized!", "success", "✅");
    sendAdminNotification("🎲 Schedule randomized! Check it out!", "warning", "🎲");
    renderSchedule();
  } catch (error) {
    console.error("❌ Error:", error);
    showNotification("❌ Error randomizing", "error", "⚠️");
  }
};

// Assign all days to one person
window.assignAllToOne = async () => {
  const members = Object.keys(window.adminState.members);
  if (members.length === 0) {
    alert("❌ No members");
    return;
  }

  const luckyPerson = prompt(`Who gets ALL the trash days?\n\n${members.join("\n")}`, members[0]);
  if (!luckyPerson || !members.includes(luckyPerson)) return;

  if (!confirm(`⚠️ Really assign ALL days to ${luckyPerson}?`)) return;

  try {
    const monday = getMonday();
    const weekKey = monday.toISOString().split("T")[0];
    const scheduleRef = doc(db, "schedules", weekKey);
    let newSchedule = {};

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    for (let i = 0; i < 5; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const dateKey = day.toISOString().split("T")[0];
      newSchedule[dateKey] = luckyPerson;
    }

    await setDoc(scheduleRef, newSchedule);
    showNotification(`😈 All days assigned to ${luckyPerson}!`, "error", "😈");
    sendAdminNotification(`😈 ${luckyPerson} got ALL the trash days this week! Good luck!`, "error", "😈");
    renderSchedule();
  } catch (error) {
    console.error("❌ Error:", error);
    showNotification("❌ Error assigning", "error", "⚠️");
  }
};

// Double everyone's history count
window.doubleHistory = async () => {
  if (!confirm("📊 Double everyone's trash counts?")) return;

  try {
    showNotification("📊 Doubling history counts...", "warning", "⏳");

    const historyCollection = collection(db, "history");
    const snapshot = await onSnapshot(historyCollection, async (docs) => {
      const newEntries = [];
      docs.forEach((doc) => {
        const data = doc.data();
        newEntries.push({
          date: serverTimestamp(),
          person: data.person,
          markedBy: "Admin"
        });
      });

      for (const entry of newEntries) {
        await addDoc(collection(db, "history"), entry);
      }
    });

    setTimeout(() => {
      showNotification("✅ All counts doubled! 😂", "success", "📊");
      sendAdminNotification("📊 History counts have doubled! (Admin action)", "info", "📊");
    }, 1500);
  } catch (error) {
    console.error("❌ Error:", error);
    showNotification("❌ Error doubling", "error", "⚠️");
  }
};

// Reset everything
window.resetEverything = async () => {
  if (!confirm("⚠️ Reset EVERYTHING to original state?")) return;
  if (!confirm("🔄 This will clear history AND reset schedule. Sure?")) return;

  try {
    showNotification("🔄 Resetting...", "warning", "⏳");

    // Clear history
    const historyCollection = collection(db, "history");
    await onSnapshot(historyCollection, async (docs) => {
      docs.forEach(async (doc) => {
        await deleteDoc(doc.ref);
      });
    });

    // Clear schedule
    const monday = getMonday();
    const weekKey = monday.toISOString().split("T")[0];
    await setDoc(doc(db, "schedules", weekKey), {});

    setTimeout(() => {
      showNotification("✅ Everything reset!", "success", "↩️");
      sendAdminNotification("↩️ Everything has been reset to original state!", "info", "↩️");
      renderSchedule();
      loadAdminData();
    }, 1500);
  } catch (error) {
    console.error("❌ Error:", error);
    showNotification("❌ Error resetting", "error", "⚠️");
  }
};

function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// ========== TAB SWITCHING ==========
window.switchAdminTab = (tab) => {
  const tabs = document.querySelectorAll(".admin-tab");
  const navButtons = document.querySelectorAll(".nav-tab");

  tabs.forEach(t => t.classList.add("hidden"));
  navButtons.forEach(b => b.classList.remove("active"));

  if (tab === "users") {
    document.getElementById("usersTab").classList.remove("hidden");
    navButtons[0].classList.add("active");
  } else if (tab === "notify") {
    document.getElementById("notifyTab").classList.remove("hidden");
    navButtons[1].classList.add("active");
    loadNotificationHistory();
  } else if (tab === "schedule") {
    document.getElementById("scheduleTab").classList.remove("hidden");
    navButtons[2].classList.add("active");
  } else if (tab === "prank") {
    document.getElementById("prankTab").classList.remove("hidden");
    navButtons[3].classList.add("active");
  }
};

// ========== SHOW NOTIFICATION ==========
function showNotification(message, color = "success", icon = "✅") {
  const display = document.getElementById("notificationDisplay");
  
  if (!display) {
    const div = document.createElement("div");
    div.id = "notificationDisplay";
    div.className = "notification-display";
    document.body.appendChild(div);
  }

  const display2 = document.getElementById("notificationDisplay");
  display2.classList.remove("hidden");

  const box = document.createElement("div");
  box.className = `notification-box ${color}`;

  box.innerHTML = `
    <span class="notification-icon">${icon}</span>
    <span class="notification-text">${message}</span>
    <button class="notification-close" onclick="this.parentElement.remove()">✕</button>
  `;

  display2.appendChild(box);

  setTimeout(() => {
    if (box.parentElement) {
      box.remove();
    }
  }, 4000);
}

// Send notification to users
async function sendAdminNotification(message, color, icon) {
  try {
    await addDoc(collection(db, "adminNotifications"), {
      message,
      color,
      icon,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}

// ========== ON PAGE LOAD ==========
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Admin panel loaded and ready");
  
  // Add Enter key to login
  document.getElementById("adminPassword").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      window.adminLogin();
    }
  });
});