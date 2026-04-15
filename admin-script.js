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
    errorEl.textContent = "Enter email and password";
    return;
  }

  try {
    errorEl.textContent = "Logging in...";
    await signInWithEmailAndPassword(auth, email, password);
    errorEl.textContent = "";
  } catch (error) {
    console.error("Login error:", error);
    errorEl.textContent = "❌ Invalid credentials";
  }
};

// ========== LOGOUT ==========
window.adminLogout = async () => {
  try {
    await signOut(auth);
    document.getElementById("loginScreen").classList.remove("hidden");
    document.getElementById("adminDashboard").classList.add("hidden");
  } catch (error) {
    console.error("Logout error:", error);
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
  onSnapshot(doc(db, "appSettings", "config"), (docSnap) => {
    if (docSnap.exists()) {
      window.adminState.members = docSnap.data().members || {};
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

  const newDaysStr = prompt(`Edit days for ${name}:\n(comma separated: Monday,Tuesday,etc)\nCurrent: ${days.join(", ")}`, days.join(","));

  if (newDaysStr === null) return;

  const newDays = newDaysStr.split(",").map(d => d.trim()).filter(d => d);

  const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const validNewDays = newDays.filter(d => validDays.includes(d));

  if (validNewDays.length === 0) {
    alert("❌ Invalid days. Use: Monday, Tuesday, Wednesday, Thursday, Friday");
    return;
  }

  updateUserDays(name, validNewDays);
};

async function updateUserDays(name, newDays) {
  try {
    const configRef = doc(db, "appSettings", "config");
    const configDoc = await getDoc(configRef);
    let members = configDoc.data().members || {};

    members[name] = {
      ...members[name],
      days: newDays
    };

    await setDoc(configRef, { members });
    showNotification(`✅ Updated ${name}'s days`, "success", "✏️");
  } catch (error) {
    console.error("Error updating:", error);
    showNotification("❌ Error updating user", "error", "⚠️");
  }
}

// ========== DELETE USER ==========
window.deleteUserConfirm = (name) => {
  if (confirm(`⚠️ Are you sure you want to delete ${name}?\n\nThis cannot be undone.`)) {
    deleteUser(name);
  }
};

async function deleteUser(name) {
  try {
    const configRef = doc(db, "appSettings", "config");
    const configDoc = await getDoc(configRef);
    let members = configDoc.data().members || {};

    delete members[name];

    await setDoc(configRef, { members });
    showNotification(`🗑️ Deleted ${name}`, "success", "✅");
    renderUsers();
  } catch (error) {
    console.error("Error deleting:", error);
    showNotification("❌ Error deleting user", "error", "⚠️");
  }
}

// ========== SEND NOTIFICATION ==========
window.sendNotification = async () => {
  const message = document.getElementById("notifyMessage").value.trim();
  const color = document.querySelector("input[name='notifyColor']:checked").value;
  const icon = document.getElementById("notifyIcon").value.trim() || "📢";

  if (!message) {
    alert("Enter notification message");
    return;
  }

  try {
    await addDoc(collection(db, "adminNotifications"), {
      message,
      color,
      icon,
      createdAt: serverTimestamp()
    });

    document.getElementById("notifyMessage").value = "";
    document.getElementById("notifyIcon").value = "";

    showNotification("📤 Notification sent to all users", "success", "✅");
    loadNotificationHistory();
  } catch (error) {
    console.error("Error sending:", error);
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
    loadNotificationHistory();
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

    snapshot.forEach((doc) => {
      const data = doc.data();
      const date = data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date();
      const timeStr = date.toLocaleTimeString();

      const div = document.createElement("div");
      div.className = "history-item";

      div.innerHTML = `
        <div class="history-icon">${data.icon}</div>
        <div class="history-text">
          <div>${data.message}</div>
          <div class="history-time">${timeStr}</div>
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

  const newPerson = prompt(
    `Change ${currentPerson} to?\n${members.join(" / ")}`,
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
    let schedule = scheduleDoc.data() || {};

    schedule[dateKey] = newPerson;

    await setDoc(scheduleRef, schedule);
    showNotification(`📅 Changed ${dateKey} to ${newPerson}`, "success", "✅");
    renderSchedule();
  } catch (error) {
    console.error("Error:", error);
  }
}

function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// ========== TAB SWITCHING ==========
window.switchAdminTab = (tab) => {
  document.querySelectorAll(".admin-tab").forEach(t => t.classList.add("hidden"));
  document.querySelectorAll(".nav-tab").forEach(b => b.classList.remove("active"));

  if (tab === "users") {
    document.getElementById("usersTab").classList.remove("hidden");
    document.querySelectorAll(".nav-tab")[0].classList.add("active");
  } else if (tab === "notify") {
    document.getElementById("notifyTab").classList.remove("hidden");
    document.querySelectorAll(".nav-tab")[1].classList.add("active");
    loadNotificationHistory();
  } else if (tab === "schedule") {
    document.getElementById("scheduleTab").classList.remove("hidden");
    document.querySelectorAll(".nav-tab")[2].classList.add("active");
  }
};

// ========== SHOW NOTIFICATION ==========
function showNotification(message, color = "success", icon = "✅") {
  const display = document.getElementById("notificationDisplay");
  display.classList.remove("hidden");

  const box = document.createElement("div");
  box.className = `notification-box ${color}`;

  box.innerHTML = `
    <span class="notification-icon">${icon}</span>
    <span class="notification-text">${message}</span>
    <button class="notification-close" onclick="this.parentElement.remove()">✕</button>
  `;

  display.appendChild(box);

  setTimeout(() => {
    if (box.parentElement) {
      box.remove();
    }
  }, 3000);
}

// ========== ON PAGE LOAD ==========
window.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Admin panel loaded");
});