// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// ================== FIREBASE CONFIG ==================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBINzCHZw_VBSb1IDRhAdYdTe2kLtahPzg",
  authDomain: "trash-ae577.firebaseapp.com",
  projectId: "trash-ae577",
  storageBucket: "trash-ae577.firebasestorage.app",
  messagingSenderId: "369181453208",
  appId: "1:369181453208:web:c0635d99d85b53d08b59ed",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);