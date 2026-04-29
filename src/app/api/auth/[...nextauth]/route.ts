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
    async jwt({ token, user }) {
      // SADECE İLK LOGIN
      if (user && user.email) {
        try {
          const adminAuth = getAdminAuth();

          let firebaseUser;

          try {
            firebaseUser = await adminAuth.getUserByEmail(user.email);
          } catch {
            firebaseUser = await adminAuth.createUser({
              email: user.email,
              displayName: user.name || undefined,
              photoURL: user.image || undefined,
            });
          }

          token.firebaseUid = firebaseUser.uid;

        } catch (e) {
          console.error("🔥 ADMIN ERROR:", e);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token.firebaseUid) {
        (session as any).uid = token.firebaseUid;

        if (session.user) {
          (session.user as any).id = token.firebaseUid;
        }
      }

      return session;
    },
  },

  secret: process.env.AUTH_SECRET,
});

export { handler as GET, handler as POST };