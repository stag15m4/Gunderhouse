import type { SystemRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      systemRole: SystemRole;
      /** Epoch ms of the account's password at the time this session was issued. */
      passwordChangedAt?: number;
    } & DefaultSession["user"];
  }

  interface User {
    systemRole?: SystemRole;
    passwordChangedAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    systemRole?: SystemRole;
    pwdAt?: number;
  }
}
