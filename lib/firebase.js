// lib/firebase.js
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// ใช้ firebaseConfig ของคุณที่ให้มา
const firebaseConfig = {
  apiKey: "AIzaSyCxefBxSRLRmCUO6MM2otNEdR_89sDj5yo",
  authDomain: "badwebfeeling.firebaseapp.com",
  projectId: "badwebfeeling",
  storageBucket: "badwebfeeling.firebasestorage.app",
  messagingSenderId: "303709029621",
  appId: "1:303709029621:web:de5f2046280c507593b1bc",
  measurementId: "G-0T7YE3CZTT"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Export Firestore database
const db = getFirestore(app)

export { db }
