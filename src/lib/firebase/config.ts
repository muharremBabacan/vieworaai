/**
 * Firebase Client Configuration
 * 
 * Handles environment-specific variables for Firebase initialization.
 */

const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

// Debug logs are only active in development or if explicitly needed
if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'development') {
  console.log("🛠️ [FirebaseConfig] Auth Domain:", authDomain);
  console.log("🛠️ [FirebaseConfig] App URL:", appUrl);
}

// Ensure critical variables are present in production
if (process.env.NODE_ENV === 'production' && !authDomain) {
  throw new Error("CRITICAL: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is missing in production environment.");
}

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCIyLeBksCYIYDkUdq522hlMnvSKBq3VZw",
  authDomain: "viewora.ai", // Optimized for PWA & Custom Domain stability
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-8632782825-fce99",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-8632782825-fce99.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1093513393552",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1093513393552:web:73dcc66ac9684e5237ef15"
};