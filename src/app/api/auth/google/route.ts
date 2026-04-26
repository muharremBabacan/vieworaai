import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    console.error("❌ Missing GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI");
    return NextResponse.json(
      { error: "OAuth config missing" },
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
    prompt: "consent",
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