import { completePasswordReset } from "@/app/actions/members";
import { prisma } from "@/lib/prisma";
import { Field, FormError } from "@/components/ui";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const reset = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: { select: { name: true, email: true } } },
  });

  // An unknown token gets the same panel as a spent one. Issuing a fresh link
  // deletes the previous row, so "never existed" and "superseded" are the same
  // situation to the person holding the link — and it gives nothing away about
  // which tokens are real.
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="card p-6">
          <h1 className="text-lg font-semibold text-stone-900">
            This reset link is no longer valid
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            {reset?.usedAt
              ? "It has already been used. Ask a household admin for a new one."
              : "It may have expired, or been replaced by a newer link. Ask a household admin for a new one."}
          </p>
        </div>
      </main>
    );
  }

  const complete = completePasswordReset.bind(null, token);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">
          Set a new password
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          For <strong>{reset.user.email}</strong>.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Anyone still signed in as {reset.user.name} will be signed out.
        </p>
      </div>

      <FormError message={error} />

      <form action={complete} className="card space-y-4 p-6">
        <Field
          label="New password"
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
          Set password
        </button>
      </form>
    </main>
  );
}
