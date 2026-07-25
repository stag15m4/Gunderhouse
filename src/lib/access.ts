import { redirect } from "next/navigation";
import { HomeRole, type Home, type SystemRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Access model
 * ------------
 * Household standing (`User.systemRole`):
 *   OWNER  — peer household admin. Implicit ADMIN on every home, can create
 *            homes, invite people, and change anyone's roles.
 *   MEMBER — sees only the homes they hold a HomeMembership for.
 *
 * Per-home role (`HomeMembership.role`):
 *   VIEWER — read appliances, maintenance, documents, forecast.
 *   MEMBER — the above, plus add/edit appliances, log maintenance, upload docs.
 *   ADMIN  — the above, plus edit the home itself, delete documents, and manage
 *            who has access to that home.
 */

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  systemRole: SystemRole;
};

const RANK: Record<HomeRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
};

export function atLeast(role: HomeRole, minimum: HomeRole): boolean {
  return RANK[role] >= RANK[minimum];
}

export const canEdit = (role: HomeRole) => atLeast(role, HomeRole.MEMBER);
export const canAdminister = (role: HomeRole) => atLeast(role, HomeRole.ADMIN);

/**
 * Current user, or a redirect to the sign-in page.
 *
 * The session is a JWT, so everything inside it is a snapshot from sign-in
 * time. Authorization can't trust that: an account removed or demoted after
 * the token was issued would otherwise keep its old powers until the token
 * expired. So the account is re-read here on every request, and the session is
 * rejected outright if the account is gone or its password has changed since
 * the token was minted. One primary-key lookup per request is a fair price for
 * role and password changes taking effect immediately.
 */
export type SessionCheck =
  | { user: SessionUser; reason: null }
  | { user: null; reason: "anonymous" | "account-gone" | "password-changed" };

/**
 * Resolve the session against the database without redirecting.
 *
 * Both requireUser() and the sign-in page go through this, so they agree on
 * what counts as a usable session. If they disagreed — say the sign-in page
 * trusted a token that requireUser() rejects — the two would bounce a visitor
 * back and forth forever.
 */
export async function currentUser(): Promise<SessionCheck> {
  const session = await auth();
  if (!session?.user?.id) return { user: null, reason: "anonymous" };

  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      systemRole: true,
      passwordChangedAt: true,
    },
  });
  if (!account) return { user: null, reason: "account-gone" };

  const issuedAt = session.user.passwordChangedAt;
  // Compared at second resolution: the token carries epoch ms taken from this
  // same column, and rounding keeps sub-millisecond storage differences from
  // reading as a password change. A token predating this field entirely has no
  // stamp, and is treated as stale.
  if (
    issuedAt === undefined ||
    Math.floor(account.passwordChangedAt.getTime() / 1000) >
      Math.floor(issuedAt / 1000)
  ) {
    return { user: null, reason: "password-changed" };
  }

  return {
    user: {
      id: account.id,
      name: account.name,
      email: account.email,
      systemRole: account.systemRole,
    },
    reason: null,
  };
}

const REJECTION_MESSAGE: Record<
  Exclude<SessionCheck["reason"], null>,
  string | null
> = {
  anonymous: null,
  "account-gone": "That account no longer exists.",
  "password-changed": "Your password changed. Please sign in again.",
};

export async function requireUser(): Promise<SessionUser> {
  const { user, reason } = await currentUser();
  if (user) return user;

  const message = REJECTION_MESSAGE[reason];
  redirect(message ? `/login?error=${encodeURIComponent(message)}` : "/login");
}

/** Current user, restricted to household admins. */
export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.systemRole !== "OWNER") redirect("/homes");
  return user;
}

/** The user's effective role on a home, or null if they have no access. */
export async function roleForHome(
  user: SessionUser,
  homeId: string,
): Promise<HomeRole | null> {
  if (user.systemRole === "OWNER") return HomeRole.ADMIN;
  const membership = await prisma.homeMembership.findUnique({
    where: { userId_homeId: { userId: user.id, homeId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

export class AccessError extends Error {
  constructor(message = "You don't have access to that.") {
    super(message);
    this.name = "AccessError";
  }
}

/**
 * Load a home the current user can see, asserting a minimum role.
 *
 * Missing access and a missing home are both reported the same way, so this
 * never confirms the existence of a home the user can't see.
 */
export async function requireHome(
  homeId: string,
  minimum: HomeRole = HomeRole.VIEWER,
): Promise<{ user: SessionUser; home: Home; role: HomeRole }> {
  const user = await requireUser();
  const home = await prisma.home.findUnique({ where: { id: homeId } });
  if (!home) throw new AccessError("Home not found.");

  const role = await roleForHome(user, homeId);
  if (!role || !atLeast(role, minimum)) throw new AccessError();

  return { user, home, role };
}

/** Every home the user can see, with their role on each. */
export async function visibleHomes(
  user: SessionUser,
): Promise<Array<Home & { role: HomeRole }>> {
  if (user.systemRole === "OWNER") {
    const homes = await prisma.home.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });
    return homes.map((home) => ({ ...home, role: HomeRole.ADMIN }));
  }

  const memberships = await prisma.homeMembership.findMany({
    where: { userId: user.id },
    include: { home: true },
  });

  return memberships
    .map(({ home, role }) => ({ ...home, role }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

/** IDs of homes the user can see — for cross-home queries (forecast, search). */
export async function visibleHomeIds(user: SessionUser): Promise<string[]> {
  if (user.systemRole === "OWNER") {
    const homes = await prisma.home.findMany({ select: { id: true } });
    return homes.map((h) => h.id);
  }
  const memberships = await prisma.homeMembership.findMany({
    where: { userId: user.id },
    select: { homeId: true },
  });
  return memberships.map((m) => m.homeId);
}
