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

window.appState = {
  members: {},
  myName: "",
  currentLanguage: "en",
  currentSchedule: {},
  unsubscribers: []
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const translations = {
  en: { appTitle: "Trash Rotation", membersTitle: "Members", todayLabel: "TODAY'S TURN", weekTitle: "This Week", proposalsTitle: "Pending Changes", historyTitle: "History", markDoneBtn: "Done ✓", noProposals: "No pending changes", votesNeeded: "votes needed", voted: "Voted ✓", iAgree: "I Agree", change: "Change" },
  pl: { appTitle: "Rotacja Śmieci", membersTitle: "Członkowie", todayLabel: "DZISIAJ", weekTitle: "Ten Tydzień", proposalsTitle: "Oczekujące Zmiany", historyTitle: "Historia", markDoneBtn: "Zrobione ✓", noProposals: "Brak oczekujących zmian", votesNeeded: "głosów potrzebnych", voted: "Zagłosowałem ✓", iAgree: "Zgadzam się", change: "Zmień" },
  uk: { appTitle: "Ротація Сміття", membersTitle: "Учасники", todayLabel: "СЬОГОДНІ", weekTitle: "Цей Тиждень", proposalsTitle: "Очікуючі Зміни", historyTitle: "Історія", markDoneBtn: "Виконано ✓", noProposals: "Немає очікуючих змін", votesNeeded: "голосів потрібно", voted: "Проголосував ✓", iAgree: "Я згідний", change: "Змінити" }
};

function t(key) {
  return translations[window.appState.currentLanguage]?.[key] || key;
}

function updateTexts() {
  document.getElementById("title").textContent = "🗑️ " + t("appTitle");
  document.querySelector(".section-title").textContent = t("membersTitle");
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

// ========== JOIN NOW ==========
window.joinNow = async () => {
  const name = document.getElementById("nameInput").value.trim();
  const lang = document.getElementById("langSelect").value;

  if (!name) {
    alert("Enter your name");
    return;
  }

  const dayCheckboxes = document.querySelectorAll(".day-checkbox input:checked");
  const days = Array.from(dayCheckboxes).map(cb => cb.value);

  if (days.length === 0) {
    alert("Select at least one day");
    return;
  }

  window.appState.myName = name;
  window.appState.currentLanguage = lang;

  localStorage.setItem("myName", name);
  localStorage.setItem("language", lang);

  try {
    const configRef = doc(db, "appSettings", "config");
    const configDoc = await getDoc(configRef);

    const members = configDoc.exists() ? (configDoc.data().members || {}) : {};
    members[name] = { days: days, joinedAt: serverTimestamp() };

    await setDoc(configRef, { members });

    hideWelcomeModal();
    showMainApp();
    updateTexts();
    loadMembers();
    loadSchedule();
    loadProposals();
    loadHistory();
  } catch (error) {
    console.error("Error:", error);
    alert("Error: " + error.message);
  }
};

// ========== LOAD MEMBERS ==========
function loadMembers() {
  const unsubscribe = onSnapshot(
    doc(db, "appSettings", "config"),
    (docSnap) => {
      window.appState.members = docSnap.exists() ? (docSnap.data().members || {}) : {};
      renderMembers();
      regenerateSchedule();
    },
    (error) => console.error("Error loading members:", error)
  );
  window.appState.unsubscribers.push(unsubscribe);
}

function renderMembers() {
  const container = document.getElementById("membersList");
  container.innerHTML = "";

  const entries = Object.entries(window.appState.members);

  if (entries.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:2rem">No members yet</p>';
    return;
  }

  entries.forEach(([name, data]) => {
    const days = data.days || [];
    const div = document.createElement("div");
    div.className = "member-card";

    const daysHtml = days.map(d => `<span class="day-tag assigned">${d.slice(0,3)}</span>`).join("");

    div.innerHTML = `
      <div class="member-header">
        <div class="member-name">${name}</div>
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
  const members = Object.entries(window.appState.members);

  if (members.length === 0) {
    setDoc(doc(db, "schedules", weekKey), {});
    return;
  }

  for (let i = 0; i < 5; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dateKey = day.toISOString().split("T")[0];
    const dayName = DAYS[i];

    const preferring = members.filter(([, data]) => data.days && data.days.includes(dayName));

    if (preferring.length > 0) {
      schedule[dateKey] = preferring[0][0];
    } else {
      schedule[dateKey] = members[Math.floor(Math.random() * members.length)][0];
    }
  }

  setDoc(doc(db, "schedules", weekKey), schedule);
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
      window.appState.currentSchedule = docSnap.exists() ? docSnap.data() : {};
      renderToday();
      renderWeek();
    },
    (error) => console.error("Error:", error)
  );
  window.appState.unsubscribers.push(unsubscribe);
}

function renderToday() {
  const today = new Date().toISOString().split("T")[0];
  const person = window.appState.currentSchedule[today] || "—";
  document.getElementById("todayPerson").textContent = person;

  const options = { weekday: "long", month: "long", day: "numeric" };
  document.getElementById("todayDate").textContent = new Date().toLocaleDateString("en-US", options);
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
    const person = window.appState.currentSchedule[key] || "—";

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

window.proposeChange = (dateKey, currentPerson) => {
  const memberNames = Object.keys(window.appState.members);
  const others = memberNames.filter(m => m !== currentPerson);

  if (others.length === 0) {
    alert("No other members");
    return;
  }

  const newPerson = prompt(`Change ${currentPerson} to?\n${others.join(" / ")}`, others[0]);

  if (!newPerson || !memberNames.includes(newPerson)) return;

  addDoc(collection(db, "proposals"), {
    dateKey,
    fromPerson: currentPerson,
    toPerson: newPerson,
    votes: [window.appState.myName],
    createdAt: serverTimestamp(),
    status: "pending"
  });
};

function loadProposals() {
  const q = query(collection(db, "proposals"), orderBy("createdAt", "desc"));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const container = document.getElementById("proposalsList");
    container.innerHTML = "";

    const pending = snapshot.docs.filter(d => d.data().status === "pending");

    if (pending.length === 0) {
      container.innerHTML = `<p style="text-align:center;color:#9ca3af;padding:2rem">${t("noProposals")}</p>`;
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
            <div class="proposal-votes">${votesNeeded} votes needed</div>
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
  });

  window.appState.unsubscribers.push(unsubscribe);
}

window.voteProposal = (proposalId) => {
  updateDoc(doc(db, "proposals", proposalId), {
    votes: arrayUnion(window.appState.myName)
  });
};

async function applyProposal(proposalId, proposal) {
  const weekKey = getMonday(new Date(proposal.dateKey)).toISOString().split("T")[0];
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
}

window.markDone = () => {
  const today = new Date().toISOString().split("T")[0];
  const person = window.appState.currentSchedule[today];

  if (!person || person === "—") {
    alert("No one assigned today");
    return;
  }

  addDoc(collection(db, "history"), {
    date: serverTimestamp(),
    person: person,
    markedBy: window.appState.myName
  });

  alert("✅ Done!");
  loadHistory();
};

function loadHistory() {
  const q = query(collection(db, "history"), orderBy("date", "desc"), limit(100));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    let count = {};
    Object.keys(window.appState.members).forEach(m => count[m] = 0);

    snapshot.forEach(d => {
      const person = d.data().person;
      if (count.hasOwnProperty(person)) count[person]++;
    });

    const statsContainer = document.getElementById("stats");
    statsContainer.innerHTML = Object.entries(count)
      .map(([name, cnt]) => `<div class="stat-card"><div class="stat-number">${cnt}</div><div class="stat-name">${name}</div></div>`)
      .join("");

    const historyContainer = document.getElementById("historyList");
    historyContainer.innerHTML = snapshot.docs
      .map(d => {
        const data = d.data();
        const date = data.date ? new Date(data.date.seconds * 1000) : new Date();
        return `<div class="history-item"><div class="history-person">${data.person}</div><div class="history-date">${date.toLocaleDateString()}</div></div>`;
      })
      .join("");
  });

  window.appState.unsubscribers.push(unsubscribe);
}

window.switchTab = (tab) => {
  const contentHome = document.getElementById("contentHome");
  const contentHistory = document.getElementById("contentHistory");
  const tabHome = document.querySelectorAll(".nav-btn")[0];
  const tabHistory = document.querySelectorAll(".nav-btn")[1];

  if (tab === "home") {
    contentHome.classList.remove("hidden");
    contentHistory.classList.add("hidden");
    tabHome.classList.add("active");
    tabHistory.classList.remove("active");
  } else {
    contentHome.classList.add("hidden");
    contentHistory.classList.remove("hidden");
    tabHome.classList.remove("active");
    tabHistory.classList.add("active");
    loadHistory();
  }
};

async function initializeApp() {
  const savedName = localStorage.getItem("myName");
  const savedLang = localStorage.getItem("language") || "en";

  window.appState.currentLanguage = savedLang;
  updateTexts();

  try {
    const configDoc = await getDoc(doc(db, "appSettings", "config"));
    window.appState.members = configDoc.exists() ? (configDoc.data().members || {}) : {};
  } catch (error) {
    console.error("Error:", error);
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
}

window.addEventListener("DOMContentLoaded", initializeApp);