import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase/admin-init";

/**
 * 🔐 API Route to create a server-side session cookie using Firebase Auth ID Token.
 * This solves session loss issues in PWAs and Safari (Browser Isolation).
 */
export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Missing ID Token" }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    
    // 1. Verify the ID Token
    await adminAuth.verifyIdToken(idToken);

    // 2. Create a Session Cookie (Expires in 5 days)
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    // 3. Set the cookie securely
    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: true, // SameSite "none" requires Secure
      sameSite: "none", // 🔥 Required for some cross-site auth flows
      path: "/",
    });

    console.log("✅ [SessionAPI] Session cookie created successfully.");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ [SessionAPI] Error:", error.message);
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }
}

/**
 * 🔓 API Route to clear the session cookie.
 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  return NextResponse.json({ success: true });
}
