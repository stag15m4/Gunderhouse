import { notFound } from "next/navigation";
import { acceptInvitation } from "@/app/actions/members";
import { prisma } from "@/lib/prisma";
import { Field, FormError } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";
import { HOME_ROLE_SHORT, SYSTEM_ROLE_LABELS } from "@/lib/labels";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { home: { select: { name: true } } },
  });

  if (!invitation) notFound();

  const expired = invitation.expiresAt < new Date();
  if (invitation.acceptedAt || expired) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="card p-6">
          <h1 className="text-lg font-semibold text-[var(--text)]">
            This invitation is no longer valid
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {invitation.acceptedAt
              ? "It has already been used."
              : "It expired. Ask a household admin to send a new one."}
          </p>
        </div>
      </main>
    );
  }

  const accept = acceptInvitation.bind(null, token);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <Wordmark variant="lockup" className="max-w-[15rem]" />
        <h1 className="mt-4 text-xl font-medium text-[var(--text)]">
          Welcome, {invitation.name}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Choose a password for <strong>{invitation.email}</strong>.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-[var(--subtle)]">
          <li>{SYSTEM_ROLE_LABELS[invitation.systemRole]}</li>
          {invitation.home && invitation.homeRole ? (
            <li>
              {HOME_ROLE_SHORT[invitation.homeRole]} access to{" "}
              {invitation.home.name}
            </li>
          ) : null}
        </ul>
      </div>

      <FormError message={error} />

      <form action={accept} className="card space-y-4 p-6">
        <Field
          label="Password"
          name="password"
          type="password"
          required
          hint="At least 10 characters."
        />
        <Field
          label="Confirm password"
          name="confirmPassword"
          type="password"
          required
        />
        <button className="btn w-full" type="submit">
          Create account
        </button>
      </form>
    </main>
  );
}
