// config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { 
  getFirestore, 
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
  limit 
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBINzCHZw_VBSb1IDRhAdYdTe2kLtahPzg",
  authDomain: "trash-ae577.firebaseapp.com",
  projectId: "trash-ae577",
  storageBucket: "trash-ae577.firebasestorage.app",
  messagingSenderId: "369181453208",
  appId: "1:369181453208:web:c0635d99d85b53d08b59ed",
};

let db;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log("✅ Firebase initialized successfully");
} catch (error) {
  console.error("❌ Firebase error:", error);
}

export {
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
  limit
};