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
  unsubscribers: [],
  loading: false
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const translations = {
  en: { appTitle: "Trash Rotation", membersTitle: "Members", todayLabel: "TODAY'S TURN", weekTitle: "This Week", proposalsTitle: "Pending Changes", historyTitle: "History", markDoneBtn: "Done ✓", noProposals: "No pending changes", votesNeeded: "votes needed", voted: "Voted ✓", iAgree: "I Agree", change: "Change", selectDays: "Select days to continue" },
  pl: { appTitle: "Rotacja Śmieci", membersTitle: "Członkowie", todayLabel: "DZISIAJ", weekTitle: "Ten Tydzień", proposalsTitle: "Oczekujące Zmiany", historyTitle: "Historia", markDoneBtn: "Zrobione ✓", noProposals: "Brak oczekujących zmian", votesNeeded: "głosów potrzebnych", voted: "Zagłosowałem ✓", iAgree: "Zgadzam się", change: "Zmień", selectDays: "Wybierz dni aby kontynuować" },
  uk: { appTitle: "Ротація Сміття", membersTitle: "Учасники", todayLabel: "СЬОГОДНІ", weekTitle: "Цей Тиждень", proposalsTitle: "Очікуючі Зміни", historyTitle: "Історія", markDoneBtn: "Виконано ✓", noProposals: "Немає очікуючих змін", votesNeeded: "голосів потрібно", voted: "Проголосував ✓", iAgree: "Я згідний", change: "Змінити", selectDays: "Виберіть дні для продовження" }
};

function t(key) {
  return translations[window.appState.currentLanguage]?.[key] || key;
}

function updateTexts() {
  document.getElementById("title").textContent = "🗑️ " + t("appTitle");
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

// ========== JOIN NOW (FIXED) ==========
window.joinNow = async () => {
  if (window.appState.loading) return;

  const name = document.getElementById("nameInput").value.trim();
  const lang = document.getElementById("langSelect").value;

  if (!name) {
    alert("❌ Please enter your name");
    return;
  }

  const dayCheckboxes = document.querySelectorAll(".day-checkbox input:checked");
  const days = Array.from(dayCheckboxes).map(cb => cb.value);

  if (days.length === 0) {
    alert("❌ " + t("selectDays"));
    return;
  }

  window.appState.loading = true;
  console.log("🚀 Joining with name:", name, "days:", days);

  try {
    window.appState.myName = name;
    window.appState.currentLanguage = lang;

    localStorage.setItem("myName", name);
    localStorage.setItem("language", lang);

    const configRef = doc(db, "appSettings", "config");
    
    // First, try to get existing config
    const configDoc = await getDoc(configRef);
    
    let members = {};
    if (configDoc.exists()) {
      members = configDoc.data().members || {};
    }

    // Add this new member
    members[name] = {
      days: days,
      joinedAt: new Date().toISOString()
    };

    console.log("📝 Saving members:", members);

    // Save to Firestore
    await setDoc(configRef, { members }, { merge: true });

    console.log("✅ Member added successfully");

    hideWelcomeModal();
    showMainApp();
    updateTexts();
    
    // Load data
    loadMembers();
    loadSchedule();
    loadProposals();
    loadHistory();

    window.appState.loading = false;
  } catch (error) {
    window.appState.loading = false;
    console.error("❌ Join error:", error);
    alert("❌ Error: " + error.message + "\n\nMake sure:\n1. Firebase is configured in config.js\n2. Firestore is enabled\n3. Rules allow read/write");
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
    (error) => {
      console.error("❌ Error loading members:", error);
    }
  );
  window.appState.unsubscribers.push(unsubscribe);
}

function renderMembers() {
  const container = document.getElementById("membersList");
  container.innerHTML = "";

  const entries = Object.entries(window.appState.members);

  if (entries.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:2rem">No members yet. Be first to join!</p>';
    return;
  }

  entries.forEach(([name, data]) => {
    const days = data.days || [];
    const div = document.createElement("div");
    div.className = "member-card";

    const daysHtml = days.length > 0 
      ? days.map(d => `<span class="day-tag assigned">${d.slice(0,3)}</span>`).join("")
      : '<span class="day-tag">Random</span>';

    div.innerHTML = `
      <div class="member-header">
        <div class="member-name">${name}${name === window.appState.myName ? " (you)" : ""}</div>
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

    // Find members who prefer this day
    const preferring = members.filter(([, data]) => 
      data.days && data.days.includes(dayName)
    );

    if (preferring.length > 0) {
      // Assign to first preferring member (or random if multiple)
      schedule[dateKey] = preferring[Math.floor(Math.random() * preferring.length)][0];
    } else {
      // Random from all members
      schedule[dateKey] = members[Math.floor(Math.random() * members.length)][0];
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
      window.appState.currentSchedule = docSnap.exists() ? docSnap.data() : {};
      renderToday();
      renderWeek();
    },
    (error) => console.error("❌ Error loading schedule:", error)
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
    alert("No other members to swap with");
    return;
  }

  const newPerson = prompt(
    `Change ${currentPerson} to?\n${others.join(" / ")}`,
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
    console.error("❌ Error proposing change:", error);
  }
};

function loadProposals() {
  const q = query(collection(db, "proposals"), orderBy("createdAt", "desc"));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const container = document.getElementById("proposalsList");
    container.innerHTML = "";

    const pending = snapshot.docs.filter(d => d.data().status === "pending");

    if (pending.length === 0) {
      container.innerHTML = `<p style="text-align:center;color:#9ca3af;padding:2rem">No pending changes</p>`;
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
  }, (error) => console.error("❌ Error loading proposals:", error));

  window.appState.unsubscribers.push(unsubscribe);
}

window.voteProposal = (proposalId) => {
  try {
    updateDoc(doc(db, "proposals", proposalId), {
      votes: arrayUnion(window.appState.myName)
    });
  } catch (error) {
    console.error("❌ Error voting:", error);
  }
};

async function applyProposal(proposalId, proposal) {
  try {
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
  } catch (error) {
    console.error("❌ Error applying proposal:", error);
  }
}

window.markDone = () => {
  const today = new Date().toISOString().split("T")[0];
  const person = window.appState.currentSchedule[today];

  if (!person || person === "—") {
    alert("No one assigned today");
    return;
  }

  try {
    addDoc(collection(db, "history"), {
      date: serverTimestamp(),
      person: person,
      markedBy: window.appState.myName
    });

    alert("✅ Done!");
    loadHistory();
  } catch (error) {
    console.error("❌ Error marking done:", error);
  }
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
  }, (error) => console.error("❌ Error loading history:", error));

  window.appState.unsubscribers.push(unsubscribe);
}

window.switchTab = (tab) => {
  const contentHome = document.getElementById("contentHome");
  const contentHistory = document.getElementById("contentHistory");
  const btns = document.querySelectorAll(".nav-btn");

  if (tab === "home") {
    contentHome.classList.remove("hidden");
    contentHistory.classList.add("hidden");
    btns[0].classList.add("active");
    btns[1].classList.remove("active");
  } else {
    contentHome.classList.add("hidden");
    contentHistory.classList.remove("hidden");
    btns[0].classList.remove("active");
    btns[1].classList.add("active");
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
    console.log("✅ Loaded members:", window.appState.members);
  } catch (error) {
    console.error("❌ Error initializing:", error);
  }

  if (savedName && window.appState.members[savedName]) {
    console.log("🔓 User already joined:", savedName);
    window.appState.myName = savedName;
    hideWelcomeModal();
    showMainApp();
    loadMembers();
    loadSchedule();
    loadProposals();
    loadHistory();
  } else {
    console.log("🔒 Showing welcome modal");
    showWelcomeModal();
  }
}

window.addEventListener("DOMContentLoaded", initializeApp);