import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signInWithPassword } from "@/app/actions/auth";
import { Field, FormError } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; welcome?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/homes");

  const { error, welcome } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-stone-900">Gunderhouse</h1>
        <p className="mt-1 text-sm text-stone-500">
          Homes, appliances, maintenance, and documents.
        </p>
      </div>

      {welcome ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Your account is set up. Sign in below.
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
