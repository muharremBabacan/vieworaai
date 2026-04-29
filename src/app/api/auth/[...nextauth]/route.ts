import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getAdminAuth } from "@/lib/firebase/admin-init";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // 1. İlk Giriş veya Tetikleyici Durumunda Firebase Senkronizasyonu
      if ((user && user.email) || (trigger === "signIn" && token.email) || (!token.firebaseUid && token.email)) {
        const targetEmail = (user?.email || token.email) as string;
        
        try {
          const adminAuth = getAdminAuth();
          let firebaseUser;
          try {
            firebaseUser = await adminAuth.getUserByEmail(targetEmail);
          } catch (e) {
            firebaseUser = await adminAuth.createUser({
              email: targetEmail,
              displayName: user?.name || undefined,
              photoURL: user?.image || undefined,
            });
          }
          
          console.log("🔥 JWT CALLBACK WORKING");
          // token.firebaseToken = await adminAuth.createCustomToken(firebaseUser.uid);
          token.firebaseUid = firebaseUser.uid;
          
          console.log(`✅ [NextAuth-JWT] Sync OK for: ${targetEmail}, UID: ${token.firebaseUid}`);
        } catch (error: any) {
          console.error("❌ [NextAuth-JWT] Firebase Error:", error.message);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.firebaseToken) {
        (session as any).firebaseToken = token.firebaseToken;
        (session as any).uid = token.firebaseUid; 
        if (session.user) {
          (session.user as any).id = token.firebaseUid;
        }
      }
      console.log("📡 [NextAuth-Session] Session data prepared for UID:", (session as any).uid);
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

