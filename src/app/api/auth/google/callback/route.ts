import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const backendStart = performance.now();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  
  const cookieHeader = req.headers.get("cookie") || "";
  const savedState = cookieHeader.split("; ").find(c => c.startsWith("oauth_state="))?.split("=")[1];

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  if (!code || state !== savedState) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", baseUrl));
  }

  try {
    // ⚡️ STEP 1: Single Token Exchange
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
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

    const data = await tokenRes.json();
    if (!data.id_token) {
      console.error("Token Exchange Error Response:", data);
      throw new Error(`Token Exchange Failed: ${data.error_description || data.error || 'No id_token'}`);
    }

    // ⚡️ STEP 2: Fast Local Parse
    const payload = JSON.parse(Buffer.from(data.id_token.split(".")[1], "base64").toString());
    const email = payload.email;

    // ⚡️ STEP 3: Sync with CORRECT Firebase UID (Fast Admin Call)
    const { getAdminAuth } = await import("@/lib/firebase/admin-init");
    const adminAuth = getAdminAuth();
    
    let uid;
    try {
      // Find existing user (Admin account)
      const existingUser = await adminAuth.getUserByEmail(email);
      uid = existingUser.uid;
      console.log("✅ Linked to existing UID:", uid);
    } catch (e) {
      // Create new if not exists
      const newUser = await adminAuth.createUser({
        email,
        emailVerified: true,
        displayName: payload.name,
        photoURL: payload.picture
      });
      uid = newUser.uid;
    }

    // ⚡️ STEP 4: Generate Custom Token for Background Sign-in
    const customToken = await adminAuth.createCustomToken(uid);

    const sessionData = {
      uid,
      email,
      name: payload.name,
      picture: payload.picture,
      customToken,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7),
    };

    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString("base64");
    
    // 🌍 Correct Locale Detection (Don't use segments from /api/...)
    const cookieStore = req.headers.get("cookie") || "";
    const localeCookie = cookieStore.split("; ").find(c => c.startsWith("NEXT_LOCALE="))?.split("=")[1];
    const currentLocale = localeCookie || "tr";

    const res = NextResponse.redirect(new URL(`/${currentLocale}/auth/callback?token=${encodeURIComponent(customToken)}`, baseUrl));
    
    // Session cookie is kept as a backup for server-side checks
    res.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    res.cookies.delete("oauth_state");
    
    const backendDuration = performance.now() - backendStart;
    console.log(`🚀 [BACKEND] Google Callback Finished in: ${backendDuration.toFixed(2)}ms`);
    
    return res;
  } catch (error: any) {
    console.error("🚀 Final Auth Fix Failure:", error);
    const errMsg = encodeURIComponent(error?.message || "Unknown error");
    return NextResponse.redirect(new URL(`/login?error=auth_error&details=${errMsg}`, baseUrl));
  }
}
