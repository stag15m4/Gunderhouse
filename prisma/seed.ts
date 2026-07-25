import { PrismaClient, SystemRole } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Creates the first household admin so there's an account to sign in with.
 * Safe to re-run: an existing account with the same email is left alone.
 */
const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_OWNER_EMAIL ?? "").trim().toLowerCase();
  const name = process.env.SEED_OWNER_NAME ?? "Owner";
  const password = process.env.SEED_OWNER_PASSWORD ?? "";

  if (!email || !password) {
    throw new Error(
      "Set SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD before running the seed.",
    );
  }
  if (password.length < 10) {
    throw new Error("SEED_OWNER_PASSWORD must be at least 10 characters.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`${email} already exists — nothing to do.`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 12),
      systemRole: SystemRole.OWNER,
    },
  });

  console.log(`Created household admin ${email}.`);
  console.log("Sign in and change the password from the account page.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
