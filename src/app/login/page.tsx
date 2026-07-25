import { redirect } from "next/navigation";
import { currentUser } from "@/lib/access";
import { signInWithPassword } from "@/app/actions/auth";
import { Field, FormError } from "@/components/ui";

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
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-stone-900">Gunderhouse</h1>
        <p className="mt-1 text-sm text-stone-500">
          Homes, appliances, maintenance, and documents.
        </p>
      </div>

      {notice ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
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
