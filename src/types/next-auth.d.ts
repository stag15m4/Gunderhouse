import type { SystemRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      systemRole: SystemRole;
    } & DefaultSession["user"];
  }

  interface User {
    systemRole?: SystemRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    systemRole?: SystemRole;
  }
}
