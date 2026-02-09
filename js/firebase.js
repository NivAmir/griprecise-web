import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { 
    getDatabase, 
    ref, set, get, child, update, onValue 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCEfC3U-uayfY6baND6ih7JtiXcMmFC6aM",
  authDomain: "griprecise.firebaseapp.com",
  projectId: "griprecise",
  storageBucket: "griprecise.firebasestorage.app",
  messagingSenderId: "894056135732",
  appId: "1:894056135732:web:4a15fbac8ad6cc4a9ade61",
  measurementId: "G-QK6T63H5RV"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);


export { 
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    ref, set, get, child, update, onValue 
};