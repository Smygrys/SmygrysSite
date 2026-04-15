import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

// ⚠️ PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
  apiKey: "AIzaSyBINzCHZw_VBSb1IDRhAdYdTe2kLtahPzg",
  authDomain: "trash-ae577.firebaseapp.com",
  projectId: "trash-ae577",
  storageBucket: "trash-ae577.firebasestorage.app",
  messagingSenderId: "369181453208",
  appId: "1:369181453208:web:c0635d99d85b53d08b59ed",
};

let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  
  console.log("✅ Firebase initialized successfully");
} catch (error) {
  console.error("❌ Firebase error:", error);
  alert("Firebase not configured. Check config.js");
}

export { db };