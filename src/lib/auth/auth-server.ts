import { cookies } from 'next/headers';

/**
 * 🕵️ High-Performance Session Provider
 * Zero database calls on session verification.
 */
export const AuthServer = {
  async getUserFromSession() {
    try {
      const cookieStore = await cookies();
      const session = cookieStore.get("session")?.value;
      if (!session) return null;

      // 🔥 Instant local decode
      const userData = JSON.parse(Buffer.from(session, "base64").toString("utf-8"));
      
      // Expired check
      if (userData.exp < Math.floor(Date.now() / 1000)) return null;
      
      return userData;
    } catch (error) {
      return null;
    }
  }
};
