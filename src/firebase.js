import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyD4jUECZ7sRJE88-wmlfIga9yycIWzfMRQ",
  authDomain: "finance-tracker-37fa5.firebaseapp.com",
  databaseURL: "https://finance-tracker-37fa5-default-rtdb.firebaseio.com",
  projectId: "finance-tracker-37fa5",
  storageBucket: "finance-tracker-37fa5.firebasestorage.app",
  messagingSenderId: "319234562638",
  appId: "1:319234562638:web:3b8eadcc67198cf7df411f",
  measurementId: "G-WQHQMXRJQG",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export function saveData(data) {
  set(ref(db, "finance"), data);
}

export function onDataChange(callback) {
  return onValue(ref(db, "finance"), (snapshot) => {
    const val = snapshot.val();
    if (val) callback(val);
  });
}
