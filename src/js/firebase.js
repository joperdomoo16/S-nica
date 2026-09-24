import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  onSnapshot, 
  serverTimestamp,
  documentId,
  writeBatch,
  increment
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  uploadBytesResumable, 
  getDownloadURL 
} from 'firebase/storage';

export const firebaseConfig = {
  projectId: "gen-lang-client-0419375849",
  appId: "1:1006389300671:web:4e69120e711301c31e650a",
  apiKey: "AIzaSyCPN6LLGCcgIf44VyTnAC6HUBst4hVqFok",
  authDomain: "xn--snica-0ta.com",
  firestoreDatabaseId: "ai-studio-8496b64b-dc71-4766-8cd3-b0d2b0727d19",
  storageBucket: "gen-lang-client-0419375849.firebasestorage.app",
  messagingSenderId: "1006389300671",
  measurementId: ""
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Auth & Storage
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  documentId,
  writeBatch,
  increment,
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL
};
