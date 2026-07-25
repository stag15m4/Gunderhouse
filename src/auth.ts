import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { SystemRole } from "@prisma/client";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          systemRole: user.systemRole,
          passwordChangedAt: user.passwordChangedAt.getTime(),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.systemRole = (user as { systemRole?: SystemRole }).systemRole;
        // Stamps when this session was issued relative to the account's
        // password. requireUser() rejects the token if the password has
        // changed since.
        token.pwdAt = (user as { passwordChangedAt?: number }).passwordChangedAt;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        // Standing is carried for convenience only — requireUser() re-reads it
        // from the database, which is what authorization actually trusts.
        session.user.systemRole = token.systemRole as SystemRole;
        session.user.passwordChangedAt = token.pwdAt as number | undefined;
      }
      return session;
    },
  },
});
