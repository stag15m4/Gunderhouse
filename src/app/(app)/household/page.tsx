import { HomeRole, SystemRole } from "@prisma/client";
import { requireOwner } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  createPasswordReset,
  inviteMember,
  removeUser,
  revokeInvitation,
  revokePasswordReset,
  setSystemRole,
} from "@/app/actions/members";
import { formatDate } from "@/lib/format";
import {
  enumOptions,
  HOME_ROLE_LABELS,
  HOME_ROLE_SHORT,
  SYSTEM_ROLE_LABELS,
} from "@/lib/labels";
import {
  Badge,
  Empty,
  Field,
  FormError,
  Notice,
  PageHeader,
  SelectField,
  Section,
} from "@/components/ui";

export default async function HouseholdPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string; reset?: string }>;
}) {
  const actor = await requireOwner();
  const { error, invited, reset } = await searchParams;

  const [users, invitations, homes, passwordResets] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ systemRole: "asc" }, { name: "asc" }],
      include: {
        memberships: {
          include: { home: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.invitation.findMany({
      where: { acceptedAt: null },
      orderBy: { createdAt: "desc" },
      include: { home: { select: { name: true } } },
    }),
    prisma.home.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.passwordReset.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Household"
        subtitle="Who has an account, and what they can reach."
      />

      <FormError message={error} />
      {invited ? (
        <Notice>Invitation created. Copy its link below and send it to them.</Notice>
      ) : null}
      {reset ? (
        <Notice>Reset link created. Copy it from “Password resets” below and hand it
          over.</Notice>
      ) : null}

      <Section title="Members">
        <div className="overflow-x-auto">
            <table className="table min-w-[36rem]">
          <thead>
            <tr>
              <th>Person</th>
              <th>Household standing</th>
              <th>Homes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  {user.name}
                  <div className="text-xs text-[var(--subtle)]">{user.email}</div>
                </td>
                <td>
                  <form
                    action={setSystemRole.bind(null, user.id)}
                    className="flex items-end gap-2"
                  >
                    <div className="w-40">
                      <SelectField
                        label=""
                        name="systemRole"
                        defaultValue={user.systemRole}
                        options={[
                          { value: SystemRole.OWNER, label: "Household admin" },
                          { value: SystemRole.MEMBER, label: "Member" },
                        ]}
                      />
                    </div>
                    <button className="btn-secondary" type="submit">
                      Save
                    </button>
                  </form>
                </td>
                <td>
                  {user.systemRole === SystemRole.OWNER ? (
                    <Badge tone="green">All homes</Badge>
                  ) : user.memberships.length === 0 ? (
                    <span className="text-xs text-[var(--faint)]">None yet</span>
                  ) : (
                    <ul className="space-y-0.5 text-xs">
                      {user.memberships.map((m) => (
                        <li key={m.id}>
                          {m.home.name} — {HOME_ROLE_SHORT[m.role]}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="whitespace-nowrap text-right">
                  <form action={createPasswordReset.bind(null, user.id)}>
                    <button
                      className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
                      type="submit"
                    >
                      Reset password
                    </button>
                  </form>
                  {user.id === actor.id ? (
                    <span className="text-xs text-[var(--faint)]">You</span>
                  ) : (
                    <form className="mt-1" action={removeUser.bind(null, user.id)}>
                      <button
                        className="text-xs text-red-400 hover:text-red-300"
                        type="submit"
                      >
                        Remove
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
          </div>
        <p className="mt-3 text-xs text-[var(--subtle)]">
          {SYSTEM_ROLE_LABELS.OWNER}. Per-home roles are set on each home&apos;s
          Access tab.
        </p>
      </Section>

      <Section
        title="Password resets"
        description="Single-use links, valid 24 hours. Issuing a new one cancels any earlier link for that person."
      >
        {passwordResets.length === 0 ? (
          <Empty>
            No outstanding reset links. Use “Reset password” next to someone in
            the list above.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[36rem]">
            <thead>
              <tr>
                <th>Person</th>
                <th>Link</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {passwordResets.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    {entry.user.name}
                    <div className="text-xs text-[var(--subtle)]">
                      {entry.user.email}
                    </div>
                  </td>
                  <td>
                    <code className="block break-all rounded bg-[var(--surface-solid)] px-2 py-1 text-xs">
                      /reset/{entry.token}
                    </code>
                    <div className="mt-1 text-xs text-[var(--subtle)]">
                      Expires {formatDate(entry.expiresAt)}
                    </div>
                  </td>
                  <td className="text-right">
                    <form action={revokePasswordReset.bind(null, entry.id)}>
                      <button
                        className="text-xs text-red-400 hover:text-red-300"
                        type="submit"
                      >
                        Cancel
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Section>

      <Section
        title="Pending invitations"
        description="There's no email sending configured — send the link yourself."
      >
        {invitations.length === 0 ? (
          <Empty>No pending invitations.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[36rem]">
            <thead>
              <tr>
                <th>Person</th>
                <th>Access</th>
                <th>Link</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td>
                    {invitation.name}
                    <div className="text-xs text-[var(--subtle)]">
                      {invitation.email}
                    </div>
                  </td>
                  <td className="text-xs">
                    {invitation.systemRole === SystemRole.OWNER
                      ? "Household admin"
                      : "Member"}
                    {invitation.home && invitation.homeRole ? (
                      <div className="text-[var(--subtle)]">
                        {invitation.home.name} —{" "}
                        {HOME_ROLE_SHORT[invitation.homeRole]}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <code className="block break-all rounded bg-[var(--surface-solid)] px-2 py-1 text-xs">
                      /invite/{invitation.token}
                    </code>
                    <div className="mt-1 text-xs text-[var(--subtle)]">
                      Expires {formatDate(invitation.expiresAt)}
                    </div>
                  </td>
                  <td className="text-right">
                    <form action={revokeInvitation.bind(null, invitation.id)}>
                      <button
                        className="text-xs text-red-400 hover:text-red-300"
                        type="submit"
                      >
                        Revoke
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Section>

      <Section
        title="Invite someone"
        description="Creates a link they use to set a password. Home access can be granted now or later."
      >
        <form action={inviteMember} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" name="name" required placeholder="Ava" />
            <Field label="Email" name="email" type="email" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Household standing"
              name="systemRole"
              defaultValue={SystemRole.MEMBER}
              options={[
                { value: SystemRole.MEMBER, label: "Member" },
                { value: SystemRole.OWNER, label: "Household admin" },
              ]}
              hint="Admins get every home plus people management."
            />
            <SelectField
              label="Starting home access"
              name="homeId"
              includeBlank="None for now"
              options={homes.map((h) => ({ value: h.id, label: h.name }))}
            />
            <SelectField
              label="Role on that home"
              name="homeRole"
              defaultValue={HomeRole.VIEWER}
              options={enumOptions(HOME_ROLE_LABELS)}
            />
          </div>
          <button className="btn" type="submit">
            Create invitation
          </button>
        </form>
      </Section>
    </>
  );
}
