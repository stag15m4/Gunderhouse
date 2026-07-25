import { redirect } from "next/navigation";
import { currentUser } from "@/lib/access";
import { signInWithPassword } from "@/app/actions/auth";
import { Field, FormError, Notice } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    welcome?: string;
    reset?: string;
    updated?: string;
  }>;
}) {
  // Uses the same check the app pages do. Trusting the raw cookie here would
  // bounce anyone holding a rejected-but-well-formed token in a loop.
  const { user } = await currentUser();
  if (user) redirect("/homes");

  const { error, welcome, reset, updated } = await searchParams;
  const notice = welcome
    ? "Your account is set up. Sign in below."
    : reset
      ? "Password set. Sign in with it below."
      : updated
        ? "Password changed. Sign in again with your new password."
        : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <Wordmark size="lg" />
        <p className="mt-3 text-sm text-[var(--subtle)]">
          Homes, appliances, maintenance, and documents.
        </p>
      </div>

      {notice ? <Notice>{notice}</Notice> : null}
      <FormError message={error} />

      <form action={signInWithPassword} className="card space-y-4 p-6">
        <Field label="Email" name="email" type="email" required />
        <Field label="Password" name="password" type="password" required />
        <button className="btn w-full" type="submit">
          Sign in
        </button>
      </form>
    </main>
  );
}
