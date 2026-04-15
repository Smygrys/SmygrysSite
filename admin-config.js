import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

// ⚠️ SAME CONFIG AS IN config.js
const firebaseConfig = {
  apiKey: "AIzaSyBINzCHZw_VBSb1IDRhAdYdTe2kLtahPzg",
  authDomain: "trash-ae577.firebaseapp.com",
  projectId: "trash-ae577",
  storageBucket: "trash-ae577.firebasestorage.app",
  messagingSenderId: "369181453208",
  appId: "1:369181453208:web:c0635d99d85b53d08b59ed",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("✅ Admin Firebase initialized");