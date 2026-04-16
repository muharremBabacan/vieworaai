import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyCIyLeBksCYIYDkUdq522hlMnvSKBq3VZw",
    authDomain: "studio-8632782825-fce99.firebaseapp.com",
    projectId: "studio-8632782825-fce99",
    storageBucket: "studio-8632782825-fce99.appspot.com",
    messagingSenderId: "1093513393552",
    appId: "1:1093513393552:web:73dcc66ac9684e5237ef15"
};

// 🔴 CRITICAL: duplicate init engelle
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// 🔥 servisler
const db = getFirestore(app);
const storage = getStorage(app);

export { app, db, storage };