import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", req.url));
  }

  try {
    // 1. Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
        console.error("❌ Google Token Exchange Failed:", tokenData);
        return NextResponse.redirect(new URL("/login?error=token_exchange_failed", req.url));
    }

    // 2. Fetch User Profile from Google
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    
    const profile = await profileResponse.json();

    // 3. 🔥 GET REAL FIREBASE UID (Sync with existing account)
    const { getAdminDb, getAdminAuth } = await import("@/lib/firebase/admin-init");
    const db = getAdminDb();
    const adminAuth = getAdminAuth();
    
    let firebaseUser;
    try {
      // Check if user already exists in Firebase Auth by email
      firebaseUser = await adminAuth.getUserByEmail(profile.email);
      console.log("✅ Existing Firebase user found:", firebaseUser.uid);
    } catch (e) {
      // If not, create a new Firebase user
      console.log("🆕 Creating new Firebase user for:", profile.email);
      firebaseUser = await adminAuth.createUser({
        email: profile.email,
        emailVerified: true,
        displayName: profile.name,
        photoURL: profile.picture,
      });
    }

    const uid = firebaseUser.uid;

    // 4. Ensure User document exists in Firestore with the CORRECT UID
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      console.log("🆕 Initializing user document for UID:", uid);
      const now = new Date().toISOString();
      const newUser = {
        id: uid,
        email: profile.email,
        name: profile.name || "İsimsiz Sanatçı",
        photoURL: profile.picture || null,
        auro_balance: 0,
        pix_balance: 20, 
        current_xp: 0,
        level_name: 'Neuner',
        tier: 'start',
        total_analyses_count: 0,
        emailVerified: true,
        onboarded: false,
        createdAt: now,
        provider: 'google',
        lastLoginAt: now
      };
      await userRef.set(newUser);
      
      await db.collection("public_profiles").doc(uid).set({
        id: uid,
        name: newUser.name,
        email: newUser.email,
        photoURL: newUser.photoURL,
        level_name: 'Neuner'
      });
    } else {
      // Update existing document (keeps admin status and balances!)
      await userRef.update({ 
        lastLoginAt: new Date().toISOString(),
        emailVerified: true
      });
    }

    // 5. Generate Custom Token with the CORRECT UID
    const customToken = await adminAuth.createCustomToken(uid);

    // 6. Redirect to Frontend Callback
    const currentLocale = req.url.split('/')[3] || 'tr';
    return NextResponse.redirect(new URL(`/${currentLocale}/auth/callback?token=${customToken}`, req.url));

  } catch (error) {
    console.error("❌ OAuth Callback Error:", error);
    return NextResponse.redirect(new URL("/login?error=auth_failed", req.url));
  }
}
