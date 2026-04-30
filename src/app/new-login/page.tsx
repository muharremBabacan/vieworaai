"use client";

import { new_auth, new_provider } from "@/lib/firebase/new_client";
import { signInWithRedirect } from "firebase/auth";

export default function Page() {
  const login = async () => {
    await signInWithRedirect(new_auth, new_provider);
  };

  return (
    <div style={{ padding: 50 }}>
      <button onClick={login}>
        GOOGLE LOGIN TEST
      </button>
    </div>
  );
}
