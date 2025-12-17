// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 你的配置信息
const firebaseConfig = {
  apiKey: "AIzaSyAMUJ5jzF1X6IfQdvDVUGrYSshNQ0ew7qQ",
  authDomain: "sop2026-8f002.firebaseapp.com",
  projectId: "sop2026-8f002",
  storageBucket: "sop2026-8f002.firebasestorage.app",
  messagingSenderId: "776763124018",
  appId: "1:776763124018:web:0a7af1ae91656cb91ccf2b",
};

// 1. 初始化 Firebase 应用
const app = initializeApp(firebaseConfig);

// 2. 初始化数据库并导出，给 App.js 使用
export const db = getFirestore(app);
