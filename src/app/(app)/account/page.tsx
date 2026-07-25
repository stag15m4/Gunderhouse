import { requireUser } from "@/lib/access";
import { changePassword } from "@/app/actions/members";
import { SYSTEM_ROLE_LABELS } from "@/lib/labels";
import { Field, FormError, Notice, PageHeader, Section } from "@/components/ui";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const user = await requireUser();
  const { error, updated } = await searchParams;

  return (
    <>
      <PageHeader title="Your account" subtitle={user.email} />

      <FormError message={error} />
      {updated ? (
        <Notice>Password updated.</Notice>
      ) : null}

      <Section title="Access">
        <p className="text-sm text-[var(--muted)]">
          {SYSTEM_ROLE_LABELS[user.systemRole]}
        </p>
      </Section>

      <Section title="Change password">
        <form action={changePassword} className="max-w-sm space-y-4">
          <Field
            label="Current password"
            name="currentPassword"
            type="password"
            required
          />
          <Field
            label="New password"
            name="newPassword"
            type="password"
            required
            hint="At least 10 characters."
          />
          <Field
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            required
          />
          <button className="btn" type="submit">
            Update password
          </button>
        </form>
      </Section>
    </>
  );
}
