"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { HomeRole, SystemRole } from "@prisma/client";
import { AccessError, requireHome, requireOwner, requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { enumValue, optionalStr, requireText, str } from "@/lib/forms";
import { isRedirectError, withError } from "@/lib/action-utils";

const INVITE_TTL_DAYS = 14;

/**
 * Create an invitation. There's no mail sending configured — the action returns
 * a link the inviter passes along however they like (text, in person). That
 * keeps the household from depending on an email provider.
 */
export async function inviteMember(form: FormData) {
  try {
    const inviter = await requireOwner();

    const email = requireText(form, "email", "Email").toLowerCase();
    const name = requireText(form, "name", "Name");
    const systemRole = enumValue(
      form,
      "systemRole",
      SystemRole,
      SystemRole.MEMBER,
    );
    const homeId = optionalStr(form, "homeId");
    const homeRole = homeId
      ? enumValue(form, "homeRole", HomeRole, HomeRole.VIEWER)
      : null;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AccessError(`${email} already has an account.`);
    }

    await prisma.invitation.create({
      data: {
        email,
        name,
        systemRole,
        homeId,
        homeRole,
        token: randomBytes(24).toString("hex"),
        invitedById: inviter.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
      },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError("/household", error));
  }

  revalidatePath("/household");
  redirect("/household?invited=1");
}

export async function revokeInvitation(invitationId: string) {
  await requireOwner();
  await prisma.invitation.deleteMany({
    where: { id: invitationId, acceptedAt: null },
  });
  revalidatePath("/household");
}

/** Accept an invitation by setting a password. Creates the account. */
export async function acceptInvitation(token: string, form: FormData) {
  try {
    const password = str(form, "password");
    const confirm = str(form, "confirmPassword");

    if (password.length < 10) {
      throw new Error("Password must be at least 10 characters.");
    }
    if (password !== confirm) {
      throw new Error("Passwords don't match.");
    }

    const invitation = await prisma.invitation.findUnique({ where: { token } });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new Error("That invitation is no longer valid.");
    }

    const existing = await prisma.user.findUnique({
      where: { email: invitation.email },
    });
    if (existing) throw new Error("That email already has an account.");

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          name: invitation.name,
          passwordHash: await bcrypt.hash(password, 12),
          systemRole: invitation.systemRole,
        },
      });

      if (invitation.homeId && invitation.homeRole) {
        await tx.homeMembership.create({
          data: {
            userId: user.id,
            homeId: invitation.homeId,
            role: invitation.homeRole,
          },
        });
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(`/invite/${token}`, error));
  }

  redirect("/login?welcome=1");
}

export async function setSystemRole(userId: string, form: FormData) {
  try {
    const actor = await requireOwner();
    const systemRole = enumValue(form, "systemRole", SystemRole, SystemRole.MEMBER);

    if (actor.id === userId && systemRole !== SystemRole.OWNER) {
      throw new AccessError("You can't remove your own household admin access.");
    }
    if (systemRole !== SystemRole.OWNER) {
      const owners = await prisma.user.count({
        where: { systemRole: SystemRole.OWNER },
      });
      if (owners <= 1) {
        throw new AccessError("The household needs at least one admin.");
      }
    }

    await prisma.user.update({ where: { id: userId }, data: { systemRole } });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError("/household", error));
  }

  revalidatePath("/household");
  redirect("/household");
}

/** Grant or change someone's role on a single home. */
export async function setHomeMembership(homeId: string, form: FormData) {
  try {
    await requireHome(homeId, HomeRole.ADMIN);
    const userId = requireText(form, "userId", "Household member");
    const role = enumValue(form, "role", HomeRole, HomeRole.VIEWER);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true },
    });
    if (!user) throw new AccessError("That person isn't in the household.");
    if (user.systemRole === SystemRole.OWNER) {
      throw new AccessError(
        "Household admins already have full access to every home.",
      );
    }

    await prisma.homeMembership.upsert({
      where: { userId_homeId: { userId, homeId } },
      create: { userId, homeId, role },
      update: { role },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(`/homes/${homeId}/access`, error));
  }

  revalidatePath(`/homes/${homeId}/access`);
  redirect(`/homes/${homeId}/access`);
}

export async function removeHomeMembership(homeId: string, userId: string) {
  try {
    await requireHome(homeId, HomeRole.ADMIN);
    await prisma.homeMembership.deleteMany({ where: { homeId, userId } });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(`/homes/${homeId}/access`, error));
  }

  revalidatePath(`/homes/${homeId}/access`);
  redirect(`/homes/${homeId}/access`);
}

/** Change your own password. */
export async function changePassword(form: FormData) {
  try {
    const user = await requireUser();
    const current = str(form, "currentPassword");
    const next = str(form, "newPassword");
    const confirm = str(form, "confirmPassword");

    if (next.length < 10) throw new Error("Password must be at least 10 characters.");
    if (next !== confirm) throw new Error("Passwords don't match.");

    const record = await prisma.user.findUnique({ where: { id: user.id } });
    if (!record || !(await bcrypt.compare(current, record.passwordHash))) {
      throw new Error("Current password is incorrect.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(next, 12) },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError("/account", error));
  }

  redirect("/account?updated=1");
}

/** Remove a household member entirely. Their logged history is preserved. */
export async function removeUser(userId: string) {
  try {
    const actor = await requireOwner();
    if (actor.id === userId) {
      throw new AccessError("You can't remove your own account.");
    }
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError("/household", error));
  }

  revalidatePath("/household");
  redirect("/household");
}
