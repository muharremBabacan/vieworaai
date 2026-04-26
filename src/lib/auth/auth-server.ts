import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase/admin-init';

/**
 * 🕵️ Server-only Auth utilities.
 * These can ONLY be imported in Server Components, Layouts, or API Routes.
 */
export const AuthServer = {
  /**
   * Gets the user identity from the server-side session cookie.
   */
  async getUserFromSession() {
    try {
      const cookieStore = await cookies();
      const session = cookieStore.get("session")?.value;
      if (!session) return null;

      const adminAuth = getAdminAuth();
      // Only accept real Firebase Session Cookies
      const decodedClaims = await adminAuth.verifySessionCookie(session, true);
      return decodedClaims;
    } catch (error) {
      // If verification fails, the user is not authenticated
      return null;
    }
  }
};
