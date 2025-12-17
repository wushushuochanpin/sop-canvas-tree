import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// --- 关键：引入认证模块 ---
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  // 这里填你自己的配置（之前你发给我的那个）
  apiKey: "AIzaSyAMUJ5jzF1X6IfQdvDVUGrYSshNQ0ew7qQ",
  authDomain: "sop2026-8f002.firebaseapp.com",
  projectId: "sop2026-8f002",
  storageBucket: "sop2026-8f002.firebasestorage.app",
  messagingSenderId: "776763124018",
  appId: "1:776763124018:web:0a7af1ae91656cb91ccf2b",
};

const app = initializeApp(firebaseConfig);

// 导出数据库
export const db = getFirestore(app);

// --- 关键：导出认证实例 ---
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
