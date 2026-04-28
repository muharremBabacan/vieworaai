import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    console.error("❌ Google OAuth Config Missing:", {
      hasClientId: !!clientId,
      hasRedirectUri: !!redirectUri,
      env: process.env.NODE_ENV
    });
    return NextResponse.json(
      { 
        error: "OAuth config missing", 
        details: `Missing: ${!clientId ? 'GOOGLE_CLIENT_ID ' : ''}${!redirectUri ? 'GOOGLE_REDIRECT_URI' : ''}`.trim()
      },
      { status: 500 }
    );
  }

  // 🔐 state üret (CSRF koruma)
  const state = crypto.randomBytes(16).toString("hex");

  const options = {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "openid",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "offline",
    prompt: "select_account",
    state,
  };

  const qs = new URLSearchParams(options);
  const url = `${rootUrl}?${qs.toString()}`;

  const res = NextResponse.redirect(url);

  // 🍪 state cookie
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });

  return res;
}