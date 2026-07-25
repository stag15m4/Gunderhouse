import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Set an account's password directly, for when nobody can get in through the
 * UI — a locked-out sole admin, say. The in-app reset button covers every
 * other case.
 *
 *   RESET_EMAIL=you@example.com RESET_PASSWORD='new-password' \
 *     npx tsx prisma/reset-password.ts
 */
const prisma = new PrismaClient();

async function main() {
  const email = (process.env.RESET_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.RESET_PASSWORD ?? "";

  if (!email || !password) {
    throw new Error("Set RESET_EMAIL and RESET_PASSWORD.");
  }
  if (password.length < 10) {
    throw new Error("RESET_PASSWORD must be at least 10 characters.");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const known = await prisma.user.findMany({ select: { email: true } });
    throw new Error(
      `No account for ${email}. Existing accounts: ${
        known.map((u) => u.email).join(", ") || "(none — run the seed instead)"
      }`,
    );
  }

  await prisma.user.update({
    where: { email },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      // Ends any session opened with the old password.
      passwordChangedAt: new Date(),
    },
  });

  console.log(`Password updated for ${email}. Any existing sessions are now signed out.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
