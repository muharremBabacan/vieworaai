import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin-init";

/**
 * 🛰️ Async User Sync
 * Handles Firestore document creation in the background to not block login.
 */
export async function POST(req: Request) {
  try {
    const user = await req.json();
    if (!user || !user.uid) return NextResponse.json({ ok: false });

    const db = getAdminDb();
    const userRef = db.collection("users").doc(user.uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      const now = new Date().toISOString();
      const newUser = {
        id: user.uid,
        email: user.email,
        name: user.name || "İsimsiz Sanatçı",
        photoURL: user.picture || null,
        auro_balance: 0,
        pix_balance: 20,
        current_xp: 0,
        level_name: 'Neuner',
        tier: 'start',
        emailVerified: true,
        onboarded: false,
        createdAt: now,
        lastLoginAt: now,
        provider: 'google'
      };
      await userRef.set(newUser);
      await db.collection("public_profiles").doc(user.uid).set({
        id: user.uid,
        name: newUser.name,
        email: newUser.email,
        photoURL: newUser.photoURL,
        level_name: 'Neuner'
      });
    } else {
      await userRef.update({ lastLoginAt: new Date().toISOString() });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ Background Sync Error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
