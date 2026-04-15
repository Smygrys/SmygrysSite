import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

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

  // Enable offline persistence
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      console.log("Multiple tabs open, persistence disabled");
    } else if (err.code === "unimplemented") {
      console.log("Persistence not supported");
    }
  });

  console.log("✅ Firebase initialized successfully");
} catch (error) {
  console.error("❌ Firebase initialization error:", error);
}

export { db };
