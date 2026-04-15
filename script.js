// ========== IMPORTS ==========
import { db } from "./config.js";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
  orderBy,
  query,
  limit
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

// ========== GLOBAL STATE ==========
window.appState = {
  members: {}, // { name: { days: ["Monday", "Tuesday"], joinedAt: timestamp }, ... }
  myName: "",
  currentLanguage: "en",
  currentSchedule: {}, // { date: name, ... }
  currentTab: "home",
  deferredPrompt: null,
  unsubscribers: []
};

// Days of week
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ========== TRANSLATIONS ==========
const translations = {
  en: {
    appTitle: "🗑️ Trash Bin",
    headerSubtitle: "Shared Rotation",
    todayLabel: "TODAY'S RESPONSIBLE",
    weekTitle: "This Week",
    proposalsTitle: "Pending Proposals",
    historyTitle: "History",
    markDoneBtn: "Mark as Done ✓",
    noProposals: "No pending proposals",
    votesNeeded: "votes needed",
    voted: "Voted ✓",
    iAgree: "I Agree",
    change: "Change",
    selectLanguageLabel: "LANGUAGE",
    yourNameLabel: "YOUR NAME",
    selectDaysLabel: "PICK YOUR DAYS (optional)",
    joinBtn: "Join Now",
    welcomeTitle: "Welcome to Smygrys Trash Rotation",
    membersTitle: "Members",
    pickDays: "Preferred Days:",
    random: "Random"
  },
  pl: {
    appTitle: "🗑️ Kosz na Śmieci",
    headerSubtitle: "Wspólna Rotacja",
    todayLabel: "DZISIAJ ODPOWIEDZIALNY",
    weekTitle: "Ten Tydzień",
    proposalsTitle: "Oczekujące Propozycje",
    historyTitle: "Historia",
    markDoneBtn: "Oznacz jako Zrobione ✓",
    noProposals: "Brak oczekujących propozycji",
    votesNeeded: "głosów potrzebnych",
    voted: "Zagłosowałem ✓",
    iAgree: "Zgadzam się",
    change: "Zmień",
    selectLanguageLabel: "JĘZYK",
    yourNameLabel: "TWOJE IMIĘ",
    selectDaysLabel: "WYBIERZ SWOJE DNI (opcjonalnie)",
    joinBtn: "Dołącz Teraz",
    welcomeTitle: "Witaj w Smygrys Trash Rotation",
    membersTitle: "Członkowie",
    pickDays: "Preferowane Dni:",
    random: "Losowo"
  },
  uk: {
    appTitle: "🗑️ Сміттєвий Кошик",
    headerSubtitle: "Спільна Ротація",
    todayLabel: "СЬОГОДНІ ВІДПОВІДАЛЬНИЙ",
    weekTitle: "Цей Тиждень",
    proposalsTitle: "Очікуючі Пропозиції",
    historyTitle: "Історія",
    markDoneBtn: "Позначити як Виконано ✓",
    noProposals: "Немає очікуючих пропозицій",
    votesNeeded: "голосів потрібно",
    voted: "Проголосував ✓",
    iAgree: "Я згідний",
    change: "Змінити",
    selectLanguageLabel: "МОВА",
    yourNameLabel: "ВАШЕ ІМЕНЕ",
    selectDaysLabel: "ВИБЕРІТЬ СВОЇ ДНІ (необов'язково)",
    joinBtn: "Приєднатися Зараз",
    welcomeTitle: "Ласкаво просимо до Smygrys Trash Rotation",
    membersTitle: "Учасники",
    pickDays: "Бажані Дні:",
    random: "Випадково"
  }
};

// ========== HELPERS ==========
function t(key) {
  return translations[window.appState.currentLanguage]?.[key] || key;
}

function showWelcomeModal() {
  document.getElementById("welcomeModal").classList.remove("hidden");
}

function hideWelcomeModal() {
  document.getElementById("welcomeModal").classList.add("hidden");
}

function showMainApp() {
  document.getElementById("welcomeModal").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");
}

// ========== UPDATE TEXTS ==========
function updateAllTexts() {
  document.getElementById("appTitle").textContent = t("appTitle");
  document.getElementById("headerSubtitle").textContent = t("headerSubtitle");
  document.getElementById("todayLabel").textContent = t("todayLabel");
  document.getElementById("weekTitle").textContent = t("weekTitle");
  document.getElementById("proposalsTitle").textContent = t("proposalsTitle");
  document.getElementById("historyTitle").textContent = t("historyTitle");
  document.getElementById("markDoneBtn").textContent = t("markDoneBtn");
  document.getElementById("welcomeTitle").textContent = t("welcomeTitle");
  document.getElementById("yourNameLabel").textContent = t("yourNameLabel");
  document.getElementById("selectLanguageLabel").textContent = t("selectLanguageLabel");
  document.getElementById("selectDaysLabel").textContent = t("selectDaysLabel");
  document.getElementById("joinBtn").textContent = t("joinBtn");
  document.getElementById("membersTitle").textContent = t("membersTitle");
}

// ========== JOIN APP ==========
window.joinApp = async () => {
  const nameInput = document.getElementById("joinName").value.trim();
  const langSelect = document.getElementById("welcomeLanguageSelect").value;

  if (!nameInput) {
    alert("Please enter your name");
    return;
  }

  // Get selected days
  const dayCheckboxes = document.querySelectorAll(".day-check:checked");
  const selectedDays = Array.from(dayCheckboxes).map(cb => cb.value);

  window.appState.myName = nameInput;
  window.appState.currentLanguage = langSelect;

  localStorage.setItem("myName", nameInput);
  localStorage.setItem("language", langSelect);

  try {
    // Add member to Firestore
    const memberData = {
      days: selectedDays,
      joinedAt: serverTimestamp()
    };

    const configRef = doc(db, "appSettings", "config");
    await updateDoc(configRef, {
      [`members.${nameInput}`]: memberData
    }).catch(async (err) => {
      if (err.code === "not-found") {
        // Create if doesn't exist
        await setDoc(configRef, {
          members: {
            [nameInput]: memberData
          }
        });
      }
    });

    hideWelcomeModal();
    showMainApp();
    updateAllTexts();
    loadMembers();
    loadSchedule();
    loadProposals();
    loadHistory();
  } catch (error) {
    console.error("Error joining:", error);
    alert("Error joining. Try again.");
  }
};

// ========== LOAD MEMBERS ==========
function loadMembers() {
  const unsubscribe = onSnapshot(
    doc(db, "appSettings", "config"),
    (docSnap) => {
      if (docSnap.exists()) {
        window.appState.members = docSnap.data().members || {};
      }
      renderMembers();
      regenerateSchedule();
    },
    (error) => console.error("Error loading members:", error)
  );

  window.appState.unsubscribers.push(unsubscribe);
}

// ========== RENDER MEMBERS ==========
function renderMembers() {
  const container = document.getElementById("membersList");
  container.innerHTML = "";

  const memberEntries = Object.entries(window.appState.members);

  if (memberEntries.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #9ca3af; padding: 2rem 0;">No members yet. Be the first to join!</p>';
    return;
  }

  memberEntries.forEach(([name, data]) => {
    const preferredDays = data.days || [];
    const isMe = name === window.appState.myName;

    const div = document.createElement("div");
    div.className = "member-card";

    let daysHTML = "";
    if (preferredDays.length > 0) {
      daysHTML = preferredDays.map(day => `<span class="day-tag assigned">${day}</span>`).join("");
    } else {
      daysHTML = `<span class="day-tag">${t("random")}</span>`;
    }

    div.innerHTML = `
      <div class="member-header">
        <div class="member-name">${name}${isMe ? " (you)" : ""}</div>
        <div class="member-count">#${memberEntries.length}</div>
      </div>
      <div class="member-days">
        ${daysHTML}
      </div>
    `;

    container.appendChild(div);
  });
}

// ========== REGENERATE SCHEDULE ==========
function regenerateSchedule() {
  const monday = getMonday();
  const weekKey = monday.toISOString().split("T")[0];

  const schedule = {};
  const members = Object.entries(window.appState.members);

  if (members.length === 0) {
    // No members yet
    setDoc(doc(db, "schedules", weekKey), {});
    return;
  }

  // For each day, find who's assigned
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dateKey = day.toISOString().split("T")[0];
    const dayName = DAYS[day.getDay() === 0 ? 6 : day.getDay() - 1]; // Adjust for Sunday

    // Find members who prefer this day
    const preferring = members.filter(([name, data]) => {
      return data.days && data.days.includes(dayName);
    });

    if (preferring.length > 0) {
      // Assign to first preferring member
      schedule[dateKey] = preferring[0][0];
    } else {
      // Random from all members
      const randomMember = members[Math.floor(Math.random() * members.length)];
      schedule[dateKey] = randomMember[0];
    }
  }

  try {
    setDoc(doc(db, "schedules", weekKey), schedule);
  } catch (error) {
    console.error("Error saving schedule:", error);
  }
}

// ========== GET MONDAY ==========
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
      window.appState.currentSchedule = docSnap.exists() ? docSnap.data() : {};
      renderToday();
      renderWeek();
    },
    (error) => console.error("Error loading schedule:", error)
  );

  window.appState.unsubscribers.push(unsubscribe);
}

// ========== RENDER TODAY ==========
function renderToday() {
  const todayKey = new Date().toISOString().split("T")[0];
  const person = window.appState.currentSchedule[todayKey] || "—";

  document.getElementById("todayPerson").textContent = person;

  const options = { weekday: "long", month: "long", day: "numeric" };
  const lang = window.appState.currentLanguage === "pl" ? "pl-PL" :
               window.appState.currentLanguage === "uk" ? "uk-UA" : "en-US";

  const dateStr = new Date().toLocaleDateString(lang, options);
  document.getElementById("todayDate").textContent = dateStr;
}

// ========== RENDER WEEK ==========
function renderWeek() {
  const container = document.getElementById("weekList");
  container.innerHTML = "";

  const todayKey = new Date().toISOString().split("T")[0];
  const monday = getMonday();

  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const key = day.toISOString().split("T")[0];
    const isToday = key === todayKey;
    const person = window.appState.currentSchedule[key] || "—";

    const div = document.createElement("div");
    div.className = `week-card ${isToday ? "today" : "other"}`;

    const dayName = day.toLocaleDateString("en-US", { weekday: "short" });

    div.innerHTML = `
      <div class="week-card-day">${dayName}</div>
      <div class="week-card-date">${day.getDate()}</div>
      <div class="week-card-person">${person}</div>
      <button class="week-card-btn" onclick="window.proposeChange('${key}', '${person}')">${t("change")}</button>
    `;

    container.appendChild(div);
  }
}

// ========== PROPOSE CHANGE ==========
window.proposeChange = (dateKey, currentPerson) => {
  const memberNames = Object.keys(window.appState.members);
  const others = memberNames.filter(m => m !== currentPerson);

  if (others.length === 0) {
    alert("No other members to swap with");
    return;
  }

  const newPerson = prompt(
    `Change ${currentPerson} to whom?\n${others.join(" / ")}`,
    others[0]
  );

  if (!newPerson || !memberNames.includes(newPerson)) return;

  try {
    addDoc(collection(db, "proposals"), {
      dateKey,
      fromPerson: currentPerson,
      toPerson: newPerson,
      votes: [window.appState.myName],
      createdAt: serverTimestamp(),
      status: "pending"
    });
  } catch (error) {
    console.error("Error proposing:", error);
  }
};

// ========== LOAD PROPOSALS ==========
function loadProposals() {
  const q = query(
    collection(db, "proposals"),
    orderBy("createdAt", "desc")
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const container = document.getElementById("proposalsList");
    container.innerHTML = "";

    const pending = snapshot.docs.filter(d => d.data().status === "pending");

    if (pending.length === 0) {
      container.innerHTML = `<p style="text-align: center; color: #9ca3af; padding: 2rem 0;">${t("noProposals")}</p>`;
      return;
    }

    const memberCount = Object.keys(window.appState.members).length;

    pending.forEach((docSnap) => {
      const p = docSnap.data();
      const votes = p.votes || [];
      const votesNeeded = memberCount - votes.length;
      const hasVoted = votes.includes(window.appState.myName);

      const div = document.createElement("div");
      div.className = "proposal-card";

      const dateObj = new Date(p.dateKey);
      const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });

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
            ${
              !hasVoted
                ? `<button class="btn-vote" onclick="window.voteProposal('${docSnap.id}')">${t("iAgree")}</button>`
                : `<div class="voted-badge">${t("voted")}</div>`
            }
          </div>
        </div>
      `;

      container.appendChild(div);

      if (votes.length >= memberCount) {
        applyProposal(docSnap.id, p);
      }
    });
  });

  window.appState.unsubscribers.push(unsubscribe);
}

// ========== VOTE ==========
window.voteProposal = (proposalId) => {
  try {
    updateDoc(doc(db, "proposals", proposalId), {
      votes: arrayUnion(window.appState.myName)
    });
  } catch (error) {
    console.error("Error voting:", error);
  }
};

// ========== APPLY PROPOSAL ==========
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

    await updateDoc(doc(db, "proposals", proposalId), {
      status: "applied"
    });

    renderToday();
    renderWeek();
  } catch (error) {
    console.error("Error applying:", error);
  }
}

// ========== MARK DONE ==========
window.markDone = () => {
  const todayKey = new Date().toISOString().split("T")[0];
  const person = window.appState.currentSchedule[todayKey];

  if (!person || person === "—") {
    alert("No one assigned for today");
    return;
  }

  try {
    addDoc(collection(db, "history"), {
      date: serverTimestamp(),
      person: person,
      markedBy: window.appState.myName
    });

    alert("✅ Marked as done!");
    loadHistory();
  } catch (error) {
    console.error("Error marking done:", error);
  }
};

// ========== LOAD HISTORY ==========
function loadHistory() {
  const q = query(
    collection(db, "history"),
    orderBy("date", "desc"),
    limit(100)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    let count = {};
    Object.keys(window.appState.members).forEach(m => count[m] = 0);

    snapshot.forEach(d => {
      const person = d.data().person;
      if (count.hasOwnProperty(person)) {
        count[person]++;
      }
    });

    const statsContainer = document.getElementById("stats");
    statsContainer.innerHTML = Object.entries(count)
      .map(([name, cnt]) => `
        <div class="stat-card">
          <div class="stat-number">${cnt}</div>
          <div class="stat-name">${name}</div>
        </div>
      `)
      .join("");

    const historyContainer = document.getElementById("historyList");
    historyContainer.innerHTML = snapshot.docs
      .map(d => {
        const data = d.data();
        const date = data.date ? new Date(data.date.seconds * 1000) : new Date();
        const options = { year: "numeric", month: "short", day: "numeric" };
        const lang = window.appState.currentLanguage === "pl" ? "pl-PL" :
                     window.appState.currentLanguage === "uk" ? "uk-UA" : "en-US";
        const dateStr = date.toLocaleDateString(lang, options);

        return `
          <div class="history-item">
            <div class="history-person">${data.person}</div>
            <div class="history-date">${dateStr}</div>
          </div>
        `;
      })
      .join("");
  });

  window.appState.unsubscribers.push(unsubscribe);
}

// ========== SWITCH TAB ==========
window.switchTab = (tab) => {
  window.appState.currentTab = tab;

  const tabHome = document.getElementById("tabHome");
  const tabHistory = document.getElementById("tabHistory");
  const contentHome = document.getElementById("contentHome");
  const contentHistory = document.getElementById("contentHistory");

  if (tab === "home") {
    tabHome.classList.add("active");
    tabHistory.classList.remove("active");
    contentHome.classList.remove("hidden");
    contentHistory.classList.add("hidden");
  } else {
    tabHome.classList.remove("active");
    tabHistory.classList.add("active");
    contentHome.classList.add("hidden");
    contentHistory.classList.remove("hidden");
    loadHistory();
  }
};

// ========== SHOW WELCOME (GLOBAL) ==========
window.showWelcomeModal = showWelcomeModal;

// ========== PWA ==========
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.appState.deferredPrompt = e;
  document.getElementById("installBtn").classList.remove("hidden");
});

window.showInstallPrompt = async () => {
  if (window.appState.deferredPrompt) {
    window.appState.deferredPrompt.prompt();
    const { outcome } = await window.appState.deferredPrompt.userChoice;
    console.log(`User response: ${outcome}`);
    window.appState.deferredPrompt = null;
    document.getElementById("installBtn").classList.add("hidden");
  }
};

window.addEventListener("appinstalled", () => {
  console.log("✅ PWA installed");
  window.appState.deferredPrompt = null;
});

function setupServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js")
      .then(() => console.log("✅ Service Worker registered"))
      .catch((err) => console.log("❌ Service Worker error:", err));
  }
}

// ========== INITIALIZE ==========
async function initializeApp() {
  const savedName = localStorage.getItem("myName");
  const savedLang = localStorage.getItem("language") || "en";

  window.appState.currentLanguage = savedLang;
  updateAllTexts();

  try {
    const configDoc = await getDoc(doc(db, "appSettings", "config"));
    window.appState.members = configDoc.exists() ? configDoc.data().members || {} : {};
  } catch (error) {
    console.error("Error loading config:", error);
  }

  if (savedName && window.appState.members[savedName]) {
    window.appState.myName = savedName;
    hideWelcomeModal();
    showMainApp();
    loadMembers();
    loadSchedule();
    loadProposals();
    loadHistory();
  } else {
    showWelcomeModal();
  }

  setupServiceWorker();
}

window.addEventListener("DOMContentLoaded", initializeApp);