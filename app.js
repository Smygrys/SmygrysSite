import {
  db,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
  collection,
  orderBy,
  query,
  limit,
} from "./config.js";

console.log("✅ app.js loaded");
console.log("✅ db object:", db);

// ========== PUSH NOTIFICATIONS FUNCTIONS ==========

function notificationsSupported() {
  return "Notification" in window && "serviceWorker" in navigator;
}

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

function saveNotificationPreference(enabled) {
  localStorage.setItem("notificationsEnabled", enabled ? "true" : "false");
}

function getNotificationPreference() {
  return localStorage.getItem("notificationsEnabled") !== "false";
}

async function scheduleDaily10PMNotification(myName, schedule) {
  if (!notificationsSupported() || !getNotificationPreference()) {
    console.log("📢 Notifications disabled or not supported");
    return;
  }

  console.log("⏰ Notification scheduler started for:", myName);

  checkAndNotify(myName, schedule);
  setInterval(() => checkAndNotify(myName, schedule), 60000);
}

function checkAndNotify(myName, schedule) {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  if (hours === 22 && minutes === 0) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = tomorrow.toISOString().split("T")[0];

    const tomorrowPerson = schedule[tomorrowKey];

    if (tomorrowPerson === myName) {
      showPhoneNotification(
        "🗑️ Your Turn Tomorrow!",
        `You're responsible for trash tomorrow (${getDayName(tomorrow)})`,
        "🗑️",
      );
    }

    if (tomorrowPerson && tomorrowPerson !== myName) {
      console.log(`📢 Tomorrow is ${tomorrowPerson}'s turn`);
    }
  }
}

function getDayName(date) {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days[date.getDay()];
}

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
        badge: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect fill='%23a855f7' width='192' height='192' rx='45'/><text x='96' y='96' font-size='100' text-anchor='middle' dominant-baseline='middle'>${icon}</text></svg>`,
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

function sendTestNotification() {
  showPhoneNotification(
    "🗑️ Test Notification",
    "This is a test. You'll get a real notification at 10 PM when it's your turn!",
    "✅",
  );
}

// ========== APP STATE ==========

const appState = {
  members: {},
  myName: "",
  currentLanguage: "en",
  currentSchedule: {},
  unsubscribers: [],
  loading: false,
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const translations = {
  en: {
    appTitle: "Trash Rotation",
    membersTitle: "Members",
    todayLabel: "TODAY'S TURN",
    weekTitle: "This Week",
    proposalsTitle: "Pending Changes",
    historyTitle: "History",
    markDoneBtn: "Done ✓",
    noProposals: "No pending changes",
    votesNeeded: "votes needed",
    voted: "Voted ✓",
    iAgree: "I Agree",
    change: "Change",
    selectDays: "Select days to continue",
    enableNotifications: "Enable push notifications at 10 PM",
  },
  pl: {
    appTitle: "Rotacja Śmieci",
    membersTitle: "Członkowie",
    todayLabel: "DZISIAJ",
    weekTitle: "Ten Tydzień",
    proposalsTitle: "Oczekujące Zmiany",
    historyTitle: "Historia",
    markDoneBtn: "Zrobione ✓",
    noProposals: "Brak oczekujących zmian",
    votesNeeded: "głosów potrzebnych",
    voted: "Zagłosowałem ✓",
    iAgree: "Zgadzam się",
    change: "Zmień",
    selectDays: "Wybierz dni aby kontynuować",
    enableNotifications: "Włącz powiadomienia push o 22:00",
  },
  uk: {
    appTitle: "Ротація Сміття",
    membersTitle: "Учасники",
    todayLabel: "СЬОГОДНІ",
    weekTitle: "Цей Тиждень",
    proposalsTitle: "Очікуючі Зміни",
    historyTitle: "Історія",
    markDoneBtn: "Виконано ✓",
    noProposals: "Немає очікуючих змін",
    votesNeeded: "голосів потрібно",
    voted: "Проголосував ✓",
    iAgree: "Я згідний",
    change: "Змінити",
    selectDays: "Виберіть дні для продовження",
    enableNotifications: "Увімкнути push-сповіщення о 22:00",
  },
};

function t(key) {
  return translations[appState.currentLanguage]?.[key] || key;
}

function updateTexts() {
  document.getElementById("title").textContent = "🗑️ " + t("appTitle");
}

function showWelcomeModal() {
  document.getElementById("welcomeModal").classList.remove("hidden");
  document.getElementById("nameInput").value = "";
  document.getElementById("langSelect").value = appState.currentLanguage;
  document
    .querySelectorAll(".day-checkbox input")
    .forEach((cb) => (cb.checked = false));
  document.getElementById("enableNotifications").checked =
    getNotificationPreference();
}

function hideWelcomeModal() {
  document.getElementById("welcomeModal").classList.add("hidden");
}

function showMainApp() {
  document.getElementById("welcomeModal").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");
}

// ========== JOIN NOW ==========
async function joinNow() {
  if (appState.loading) return;

  const name = document.getElementById("nameInput").value.trim();
  const lang = document.getElementById("langSelect").value;
  const enableNotif = document.getElementById("enableNotifications").checked;

  if (!name) {
    alert("❌ Please enter your name");
    return;
  }

  if (appState.members[name]) {
    alert(`❌ "${name}" is already taken. Please choose another name.`);
    return;
  }

  const dayCheckboxes = document.querySelectorAll(
    ".day-checkbox input:checked",
  );
  const days = Array.from(dayCheckboxes).map((cb) => cb.value);

  if (days.length === 0) {
    alert("❌ Select days to continue");
    return;
  }

  appState.loading = true;
  console.log(
    "🚀 User joining with name:",
    name,
    "days:",
    days,
    "notifications:",
    enableNotif,
  );

  try {
    appState.myName = name;
    appState.currentLanguage = lang;

    localStorage.setItem("myName", name);
    localStorage.setItem("language", lang);

    saveNotificationPreference(enableNotif);

    if (enableNotif) {
      await requestNotificationPermission();
    }

    const configRef = doc(db, "appSettings", "config");
    const configDoc = await getDoc(configRef);

    let members = {};
    if (configDoc.exists()) {
      members = configDoc.data().members || {};
    }

    members[name] = {
      days: days,
      joinedAt: new Date().toISOString(),
    };

    console.log("📝 Saving members:", members);
    await setDoc(configRef, { members }, { merge: true });

    console.log("✅ Member added successfully");

    hideWelcomeModal();
    showMainApp();
    updateTexts();

    loadMembers();
    loadSchedule();
    loadProposals();
    loadHistory();
    listenToAdminNotifications();

    setTimeout(() => {
      scheduleDaily10PMNotification(name, appState.currentSchedule);
    }, 1000);

    appState.loading = false;
  } catch (error) {
    appState.loading = false;
    console.error("❌ Join error:", error);
    alert("❌ Error: " + error.message);
  }
}

// ========== LOAD MEMBERS ==========
function loadMembers() {
  const unsubscribe = onSnapshot(
    doc(db, "appSettings", "config"),
    (docSnap) => {
      if (docSnap.exists()) {
        appState.members = docSnap.data().members || {};
      }
      renderMembers();
      regenerateSchedule();
    },
    (error) => console.error("❌ Error loading members:", error),
  );
  appState.unsubscribers.push(unsubscribe);
}

function renderMembers() {
  const container = document.getElementById("membersList");
  container.innerHTML = "";

  const entries = Object.entries(appState.members);

  if (entries.length === 0) {
    container.innerHTML =
      '<p style="text-align:center;color:#9ca3af;padding:2rem">No members yet. Be first to join!</p>';
    return;
  }

  entries.forEach(([name, data]) => {
    const days = data.days || [];
    const div = document.createElement("div");
    div.className = "member-card";

    const isMe = name === appState.myName;
    const youLabel = isMe ? " (you)" : "";

    const daysHtml =
      days.length > 0
        ? days
            .map(
              (d) => `<span class="day-tag assigned">${d.slice(0, 3)}</span>`,
            )
            .join("")
        : '<span class="day-tag">Random</span>';

    div.innerHTML = `
      <div class="member-header">
        <div class="member-name">${name}${youLabel}</div>
        <div class="member-count">#${entries.length}</div>
      </div>
      <div class="member-days">${daysHtml}</div>
    `;
    container.appendChild(div);
  });
}

// ========== REGENERATE SCHEDULE ==========
function regenerateSchedule() {
  const monday = getMonday();
  const weekKey = monday.toISOString().split("T")[0];
  const schedule = {};
  const members = Object.entries(appState.members);

  if (members.length === 0) {
    setDoc(doc(db, "schedules", weekKey), {});
    return;
  }

  for (let i = 0; i < 5; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dateKey = day.toISOString().split("T")[0];
    const dayName = DAYS[i];

    const preferring = members.filter(
      ([, data]) => data.days && data.days.includes(dayName),
    );

    if (preferring.length > 0) {
      schedule[dateKey] =
        preferring[Math.floor(Math.random() * preferring.length)][0];
    } else {
      schedule[dateKey] =
        members[Math.floor(Math.random() * members.length)][0];
    }
  }

  try {
    setDoc(doc(db, "schedules", weekKey), schedule);
  } catch (error) {
    console.error("Error saving schedule:", error);
  }
}

function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// ========== LOAD SCHEDULE ==========
function loadSchedule() {
  const monday = getMonday();
  const weekKey = monday.toISOString().split("T")[0];

  const unsubscribe = onSnapshot(
    doc(db, "schedules", weekKey),
    (docSnap) => {
      appState.currentSchedule = docSnap.exists() ? docSnap.data() : {};
      renderToday();
      renderWeek();
      renderCalendarWidget();
    },
    (error) => console.error("❌ Error loading schedule:", error),
  );
  appState.unsubscribers.push(unsubscribe);
}

function renderToday() {
  const today = new Date().toISOString().split("T")[0];
  const person = appState.currentSchedule[today] || "—";
  document.getElementById("todayPerson").textContent = person;

  const options = { weekday: "long", month: "long", day: "numeric" };
  document.getElementById("todayDate").textContent =
    new Date().toLocaleDateString("en-US", options);
}

function renderWeek() {
  const container = document.getElementById("weekList");
  container.innerHTML = "";

  const today = new Date().toISOString().split("T")[0];
  const monday = getMonday();

  for (let i = 0; i < 5; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const key = day.toISOString().split("T")[0];
    const isToday = key === today;
    const person = appState.currentSchedule[key] || "—";

    const div = document.createElement("div");
    div.className = `week-card ${isToday ? "today" : "other"}`;

    const dayName = day.toLocaleDateString("en-US", { weekday: "short" });

    div.innerHTML = `
      <div class="week-card-day">${dayName}</div>
      <div class="week-card-date">${day.getDate()}</div>
      <div class="week-card-person">${person}</div>
      <button class="week-card-btn" onclick="window.proposeChange('${key}', '${person}')">Change</button>
    `;

    container.appendChild(div);
  }
}

// ========== RENDER CALENDAR WIDGET ==========
function renderCalendarWidget() {
  const container = document.getElementById("calendarWidget");
  if (!container) return;

  container.innerHTML = "";

  const today = new Date().toISOString().split("T")[0];
  const monday = getMonday();

  for (let i = 0; i < 5; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const key = day.toISOString().split("T")[0];
    const isToday = key === today;
    const person = appState.currentSchedule[key] || "—";

    const div = document.createElement("div");
    div.className = `calendar-day ${isToday ? "today" : ""}`;

    const dayName = day.toLocaleDateString("en-US", { weekday: "short" });

    div.innerHTML = `
      <div class="calendar-day-name">${dayName}</div>
      <div class="calendar-day-date">${day.getDate()}</div>
      <div class="calendar-day-person">${person}</div>
    `;

    container.appendChild(div);
  }
}

function proposeChange(dateKey, currentPerson) {
  const memberNames = Object.keys(appState.members);
  const others = memberNames.filter((m) => m !== currentPerson);

  if (others.length === 0) {
    alert("No other members");
    return;
  }

  const newPerson = prompt(
    `Change ${currentPerson} to?\n${others.join(" / ")}`,
    others[0],
  );

  if (!newPerson || !memberNames.includes(newPerson)) return;

  try {
    addDoc(collection(db, "proposals"), {
      dateKey,
      fromPerson: currentPerson,
      toPerson: newPerson,
      votes: [appState.myName],
      createdAt: serverTimestamp(),
      status: "pending",
    });
  } catch (error) {
    console.error("❌ Error proposing change:", error);
  }
}

function loadProposals() {
  const q = query(collection(db, "proposals"), orderBy("createdAt", "desc"));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const container = document.getElementById("proposalsList");
      container.innerHTML = "";

      const pending = snapshot.docs.filter(
        (d) => d.data().status === "pending",
      );

      if (pending.length === 0) {
        container.innerHTML = `<p style="text-align:center;color:#9ca3af;padding:2rem">No pending changes</p>`;
        return;
      }

      const memberCount = Object.keys(appState.members).length;

      pending.forEach((docSnap) => {
        const p = docSnap.data();
        const votes = p.votes || [];
        const votesNeeded = memberCount - votes.length;
        const hasVoted = votes.includes(appState.myName);

        const div = document.createElement("div");
        div.className = "proposal-card";

        const dateObj = new Date(p.dateKey);
        const dayName = dateObj.toLocaleDateString("en-US", {
          weekday: "short",
        });

        div.innerHTML = `
        <div class="proposal-content">
          <div class="proposal-info">
            <div class="proposal-date">${dayName}</div>
            <div class="proposal-change">
              <span class="proposal-from">${p.fromPerson}</span>
              <span>→</span>
              <span class="proposal-to">${p.toPerson}</span>
            </div>
            <div class="proposal-votes">${votesNeeded} ${t("votesNeeded")}</div>
          </div>
          <div class="proposal-action">
            ${!hasVoted ? `<button class="btn-vote" onclick="window.voteProposal('${docSnap.id}')">I Agree</button>` : `<div class="voted-badge">Voted ✓</div>`}
          </div>
        </div>
      `;

        container.appendChild(div);

        if (votes.length >= memberCount) {
          applyProposal(docSnap.id, p);
        }
      });
    },
    (error) => console.error("❌ Error loading proposals:", error),
  );

  appState.unsubscribers.push(unsubscribe);
}

function voteProposal(proposalId) {
  try {
    updateDoc(doc(db, "proposals", proposalId), {
      votes: arrayUnion(appState.myName),
    });
  } catch (error) {
    console.error("❌ Error voting:", error);
  }
}

async function applyProposal(proposalId, proposal) {
  try {
    const weekKey = getMonday(new Date(proposal.dateKey))
      .toISOString()
      .split("T")[0];
    const scheduleRef = doc(db, "schedules", weekKey);
    const scheduleDoc = await getDoc(scheduleRef);

    if (scheduleDoc.exists()) {
      let schedule = scheduleDoc.data();
      schedule[proposal.dateKey] = proposal.toPerson;
      await setDoc(scheduleRef, schedule);
    }

    await updateDoc(doc(db, "proposals", proposalId), { status: "applied" });
    renderToday();
    renderWeek();
    renderCalendarWidget();
  } catch (error) {
    console.error("❌ Error applying proposal:", error);
  }
}

function markDone() {
  const today = new Date().toISOString().split("T")[0];
  const person = appState.currentSchedule[today];

  if (!person || person === "—") {
    alert("No one assigned today");
    return;
  }

  try {
    addDoc(collection(db, "history"), {
      date: serverTimestamp(),
      person: person,
      markedBy: appState.myName,
    });

    alert("✅ Done!");
    loadHistory();
  } catch (error) {
    console.error("❌ Error marking done:", error);
  }
}

function loadHistory() {
  const q = query(
    collection(db, "history"),
    orderBy("date", "desc"),
    limit(100),
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      let count = {};
      Object.keys(appState.members).forEach((m) => (count[m] = 0));

      snapshot.forEach((d) => {
        const person = d.data().person;
        if (count.hasOwnProperty(person)) count[person]++;
      });

      const statsContainer = document.getElementById("stats");
      statsContainer.innerHTML = Object.entries(count)
        .map(
          ([name, cnt]) =>
            `<div class="stat-card"><div class="stat-number">${cnt}</div><div class="stat-name">${name}</div></div>`,
        )
        .join("");

      const historyContainer = document.getElementById("historyList");
      historyContainer.innerHTML = snapshot.docs
        .map((d) => {
          const data = d.data();
          const date = data.date
            ? new Date(data.date.seconds * 1000)
            : new Date();
          return `<div class="history-item"><div class="history-person">${data.person}</div><div class="history-date">${date.toLocaleDateString()}</div></div>`;
        })
        .join("");
    },
    (error) => console.error("❌ Error loading history:", error),
  );

  appState.unsubscribers.push(unsubscribe);
}

function listenToAdminNotifications() {
  const q = query(
    collection(db, "adminNotifications"),
    orderBy("createdAt", "desc"),
    limit(1),
  );

  onSnapshot(q, (snapshot) => {
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      if (data.createdAt) {
        const createdTime = new Date(data.createdAt.seconds * 1000);
        const now = new Date();
        const timeDiff = now - createdTime;

        if (timeDiff < 5000) {
          showUserNotification(data.message, data.color, data.icon);
        }
      }
    });
  });
}

function showUserNotification(message, color = "success", icon = "✅") {
  let display = document.getElementById("notificationDisplay");

  if (!display) {
    const div = document.createElement("div");
    div.id = "notificationDisplay";
    div.className = "notification-display";
    document.body.appendChild(div);
    display = div;
  }

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
  }, 4000);
}

function switchTab(tab) {
  const contentHome = document.getElementById("contentHome");
  const contentHistory = document.getElementById("contentHistory");
  const tabHomeBtn = document.getElementById("tabHomeBtn");
  const tabHistoryBtn = document.getElementById("tabHistoryBtn");

  if (tab === "home" || tab === 0) {
    contentHome.classList.remove("hidden");
    contentHistory.classList.add("hidden");
    tabHomeBtn.classList.add("nav-active");
    tabHomeBtn.classList.remove("text-gray-500");
    tabHistoryBtn.classList.remove("nav-active");
    tabHistoryBtn.classList.add("text-gray-500");
  } else {
    contentHome.classList.add("hidden");
    contentHistory.classList.remove("hidden");
    tabHomeBtn.classList.remove("nav-active");
    tabHomeBtn.classList.add("text-gray-500");
    tabHistoryBtn.classList.add("nav-active");
    tabHistoryBtn.classList.remove("text-gray-500");
    loadHistory();
  }
}

// ========== EVENT LISTENERS ==========
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("joinBtn").addEventListener("click", joinNow);
  document
    .getElementById("settingsBtn")
    .addEventListener("click", showWelcomeModal);
  document.getElementById("markDoneBtn").addEventListener("click", markDone);
  document
    .getElementById("tabHomeBtn")
    .addEventListener("click", () => switchTab("home"));
  document
    .getElementById("tabHistoryBtn")
    .addEventListener("click", () => switchTab("history"));

  loadSettings();
});

// ========== GLOBAL FUNCTIONS (for onclick) ==========
window.proposeChange = proposeChange;
window.voteProposal = voteProposal;
window.switchTab = switchTab;
window.showWelcomeModal = showWelcomeModal;
window.sendTestNotification = sendTestNotification;

async function loadSettings() {
  const d = await getDoc(doc(db, "appSettings", "config"));
  if (d.exists()) {
    users = d.data().users || users;
  }

  myName = localStorage.getItem("myName");
  currentLanguage = localStorage.getItem("language") || "en";

  if (!myName) {
    showWelcomeModal();
  } else {
    hideWelcomeModal();
    updateTexts();
    loadSchedule();
    loadProposals();
    loadHistory();
    listenToAdminNotifications();
  }
}
