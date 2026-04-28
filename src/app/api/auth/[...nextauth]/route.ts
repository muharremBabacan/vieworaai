import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getAdminAuth } from "@/lib/firebase/admin-init";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user && user.email) {
        try {
          const adminAuth = getAdminAuth();
          let firebaseUser;
          try {
            firebaseUser = await adminAuth.getUserByEmail(user.email);
          } catch (e) {
            firebaseUser = await adminAuth.createUser({
              email: user.email,
              displayName: user.name || undefined,
              photoURL: user.image || undefined,
            });
          }
          const firebaseToken = await adminAuth.createCustomToken(firebaseUser.uid);
          token.firebaseToken = firebaseToken;
        } catch (error) {
          console.error("Firebase custom token error:", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.firebaseToken) {
        (session as any).firebaseToken = token.firebaseToken;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };

