"use client";

import { new_auth, new_provider } from "@/lib/firebase/new_client";
import { signInWithRedirect } from "firebase/auth";

export default function NewLoginPage() {
  const handleLogin = async () => {
    await signInWithRedirect(new_auth, new_provider);
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Yeni Login (Test)</h2>
      <button onClick={handleLogin}>
        Google ile Giriş Yap
      </button>
    </div>
  );
}
