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

// ========== STATE ==========
let users = ["Ivan", "Kamil", "Wojtek"];
let myName = "";
let currentLanguage = "en";
let currentSchedule = {};
let currentTab = 0;

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
    change: "Change"
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
    change: "Zmień"
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
    change: "Змінити"
  }
};

function t(key) {
  return translations[currentLanguage]?.[key] || key;
}

function updateTexts() {
  document.getElementById("appTitle").textContent = t("appTitle");
  document.getElementById("headerSubtitle").textContent = t("headerSubtitle");
  document.getElementById("todayLabel").textContent = t("todayLabel");
  document.getElementById("weekTitle").textContent = t("weekTitle");
  document.getElementById("proposalsTitle").textContent = t("proposalsTitle");
  document.getElementById("historyTitle").textContent = t("historyTitle");
  document.getElementById("markDoneBtn").textContent = t("markDoneBtn");
}

// ========== WELCOME MODAL ==========
function showWelcomeModal() {
  const modal = document.getElementById("welcomeModal");
  modal.classList.remove("hidden");
  initWelcomeSelectors();
}

function hideWelcomeModal() {
  const modal = document.getElementById("welcomeModal");
  modal.classList.add("hidden");
}

function initWelcomeSelectors() {
  const nameInput = document.getElementById("welcomeNameInput");
  nameInput.value = myName || "";
  nameInput.focus();
  document.getElementById("welcomeLanguageSelect").value = currentLanguage;
}

window.startApp = () => {
  const nameInput = document.getElementById("welcomeNameInput").value.trim();

  if (!nameInput) {
    alert("Please enter your name");
    return;
  }

  myName = nameInput;
  currentLanguage = document.getElementById("welcomeLanguageSelect").value;
  localStorage.setItem("myName", myName);
  localStorage.setItem("language", currentLanguage);
  hideWelcomeModal();
  updateTexts();
  loadSchedule();
  loadProposals();
  loadHistory();
};

// ========== INITIALIZE ==========
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
  }
}

// ========== GET MONDAY ==========
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

// ========== LOAD SCHEDULE ==========
function loadSchedule() {
  const monday = getMonday(new Date());
  const weekKey = monday.toISOString().split("T")[0];

  getDoc(doc(db, "schedules", weekKey)).then((docSnap) => {
    currentSchedule = docSnap.exists()
      ? docSnap.data()
      : generateSchedule(monday, weekKey);
    renderToday();
    renderWeek();
  });
}

// ========== GENERATE SCHEDULE ==========
function generateSchedule(monday, weekKey) {
  const schedule = {};
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const key = day.toISOString().split("T")[0];
    const weekday = day.getDay();

    if (weekday === 1) schedule[key] = users[0];
    else if (weekday === 2) schedule[key] = users[1];
    else if (weekday === 3) schedule[key] = users[2];
    else schedule[key] = users[Math.floor(Math.random() * 3)];
  }

  setDoc(doc(db, "schedules", weekKey), schedule);
  return schedule;
}

// ========== RENDER TODAY ==========
function renderToday() {
  const todayKey = new Date().toISOString().split("T")[0];
  document.getElementById("todayPerson").textContent =
    currentSchedule[todayKey] || "—";

  const options = { weekday: "long", month: "long", day: "numeric" };
  document.getElementById("todayDate").textContent = new Date().toLocaleDateString(
    currentLanguage === "pl" ? "pl-PL" : currentLanguage === "uk" ? "uk-UA" : "en-US",
    options
  );
}

// ========== RENDER WEEK ==========
function renderWeek() {
  const container = document.getElementById("weekList");
  container.innerHTML = "";

  Object.keys(currentSchedule)
    .sort()
    .forEach((key) => {
      const date = new Date(key);
      const isToday = key === new Date().toISOString().split("T")[0];
      const person = currentSchedule[key];

      const div = document.createElement("div");
      div.className = `week-card ${isToday ? "today" : "other"}`;

      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });

      div.innerHTML = `
        <div class="week-card-day">${dayName}</div>
        <div class="week-card-date">${date.getDate()}</div>
        <div class="week-card-person">${person}</div>
        <button class="week-card-btn" onclick="proposeChange('${key}', '${person}')">${t("change")}</button>
      `;

      container.appendChild(div);
    });
}

// ========== PROPOSE CHANGE ==========
window.proposeChange = (dateKey, currentPerson) => {
  const otherUsers = users.filter((u) => u !== currentPerson);
  const newPerson = prompt(
    `Change ${currentPerson} to who?\n${otherUsers.join(" / ")}`,
    otherUsers[0]
  );

  if (!newPerson || !users.includes(newPerson)) return;

  addDoc(collection(db, "proposals"), {
    dateKey,
    fromPerson: currentPerson,
    toPerson: newPerson,
    votes: [myName],
    createdAt: serverTimestamp()
  });
};

// ========== LOAD PROPOSALS ==========
function loadProposals() {
  const q = query(collection(db, "proposals"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    const container = document.getElementById("proposalsList");
    container.innerHTML = "";

    const activeProposals = snapshot.docs.filter(
      (d) => d.data().status !== "applied"
    );

    if (activeProposals.length === 0) {
      container.innerHTML = `<p style="text-align: center; color: #9ca3af; padding: 2rem 0;">${t("noProposals")}</p>`;
      return;
    }

    activeProposals.forEach((docSnap) => {
      const p = docSnap.data();
      const votesNeeded = 3 - (p.votes ? p.votes.length : 0);

      const div = document.createElement("div");
      div.className = "proposal-card";

      const dateObj = new Date(p.dateKey);
      const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });

      const hasVoted = (p.votes || []).includes(myName);

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
                ? `<button class="btn-vote" onclick="voteProposal('${docSnap.id}')">${t("iAgree")}</button>`
                : `<div class="voted-badge">${t("voted")}</div>`
            }
          </div>
        </div>
      `;

      container.appendChild(div);

      if ((p.votes || []).length >= 3) {
        applyProposal(docSnap.id, p);
      }
    });
  });
}

// ========== VOTE ==========
window.voteProposal = (proposalId) => {
  updateDoc(doc(db, "proposals", proposalId), { votes: arrayUnion(myName) });
};

// ========== APPLY PROPOSAL ==========
async function applyProposal(proposalId, proposal) {
  const weekKey = getMonday(new Date(proposal.dateKey))
    .toISOString()
    .split("T")[0];
  const scheduleRef = doc(db, "schedules", weekKey);
  const scheduleDoc = await getDoc(scheduleRef);

  if (scheduleDoc.exists()) {
    let schedule = scheduleDoc.data();
    schedule[proposal.dateKey] = proposal.toPerson;
    await setDoc(scheduleRef, schedule);
    await updateDoc(doc(db, "proposals", proposalId), { status: "applied" });
    currentSchedule = schedule;
    renderToday();
    renderWeek();
  }
}

// ========== MARK AS DONE ==========
window.markDone = () => {
  const todayKey = new Date().toISOString().split("T")[0];
  const person = currentSchedule[todayKey];

  if (!person) {
    alert("No person assigned for today");
    return;
  }

  addDoc(collection(db, "history"), {
    date: serverTimestamp(),
    person: person,
    markedBy: myName
  });

  alert("✅ Marked as done!");
  loadHistory();
};

// ========== LOAD HISTORY ==========
function loadHistory() {
  const q = query(
    collection(db, "history"),
    orderBy("date", "desc"),
    limit(50)
  );

  onSnapshot(q, (snapshot) => {
    let count = {};
    users.forEach((u) => (count[u] = 0));

    snapshot.forEach((d) => {
      const person = d.data().person;
      count[person] = (count[person] || 0) + 1;
    });

    const statsContainer = document.getElementById("stats");
    statsContainer.innerHTML = users
      .map(
        (name) => `
      <div class="stat-card">
        <div class="stat-number">${count[name]}</div>
        <div class="stat-name">${name}</div>
      </div>
    `
      )
      .join("");

    const historyContainer = document.getElementById("historyList");
    historyContainer.innerHTML = snapshot.docs
      .map((d) => {
        const data = d.data();
        const date = data.date ? new Date(data.date.seconds * 1000) : new Date();

        const options = { year: "numeric", month: "short", day: "numeric" };
        const formattedDate = date.toLocaleDateString(
          currentLanguage === "pl" ? "pl-PL" : currentLanguage === "uk" ? "uk-UA" : "en-US",
          options
        );

        return `
          <div class="history-item">
            <div class="history-person">${data.person}</div>
            <div class="history-date">${formattedDate}</div>
          </div>
        `;
      })
      .join("");
  });
}

// ========== TAB SWITCHING ==========
window.showTab = (n) => {
  currentTab = n;

  const tab0 = document.getElementById("tab0");
  const tab1 = document.getElementById("tab1");
  const content = document.querySelector(".content");

  if (n === 0) {
    tab0.classList.add("active");
    tab1.classList.remove("active");
    content.scrollTop = 0;
  } else {
    tab0.classList.remove("active");
    tab1.classList.add("active");
    loadHistory();
    content.scrollTop = 0;
  }
};

// ========== INITIALIZE ==========
window.addEventListener("load", loadSettings);