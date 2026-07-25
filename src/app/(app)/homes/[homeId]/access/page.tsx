import { HomeRole, SystemRole } from "@prisma/client";
import { requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  removeHomeMembership,
  setHomeMembership,
} from "@/app/actions/members";
import { enumOptions, HOME_ROLE_LABELS, HOME_ROLE_SHORT } from "@/lib/labels";
import {
  Badge,
  Empty,
  FormError,
  PageHeader,
  SelectField,
  Section,
} from "@/components/ui";

export default async function HomeAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { homeId } = await params;
  const { error } = await searchParams;
  const { home } = await requireHome(homeId, HomeRole.ADMIN);

  const [memberships, owners, unassigned] = await Promise.all([
    prisma.homeMembership.findMany({
      where: { homeId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { systemRole: SystemRole.OWNER },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        systemRole: SystemRole.MEMBER,
        memberships: { none: { homeId } },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const grant = setHomeMembership.bind(null, homeId);

  return (
    <>
      <PageHeader
        title="Access"
        subtitle={`Who can see and change ${home.name}`}
        backHref={`/homes/${homeId}`}
        backLabel={home.name}
      />

      <FormError message={error} />

      <Section
        title="Household admins"
        description="Full access to every home. Managed on the Household page."
      >
        <ul className="space-y-1 text-sm text-stone-700">
          {owners.map((owner) => (
            <li key={owner.id}>
              {owner.name}{" "}
              <span className="text-stone-400">{owner.email}</span>{" "}
              <Badge tone="green">Admin</Badge>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="People with access to this home">
        {memberships.length === 0 ? (
          <Empty>
            Nobody outside the household admins has access to this home yet.
          </Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {memberships.map((membership) => (
                <tr key={membership.id}>
                  <td>
                    {membership.user.name}
                    <div className="text-xs text-stone-500">
                      {membership.user.email}
                    </div>
                  </td>
                  <td>
                    <form action={grant} className="flex items-end gap-2">
                      <input
                        type="hidden"
                        name="userId"
                        value={membership.user.id}
                      />
                      <div className="w-56">
                        <SelectField
                          label=""
                          name="role"
                          defaultValue={membership.role}
                          options={enumOptions(HOME_ROLE_SHORT)}
                        />
                      </div>
                      <button className="btn-secondary" type="submit">
                        Save
                      </button>
                    </form>
                  </td>
                  <td className="text-right">
                    <form
                      action={removeHomeMembership.bind(
                        null,
                        homeId,
                        membership.user.id,
                      )}
                    >
                      <button
                        className="text-xs text-red-600 hover:text-red-800"
                        type="submit"
                      >
                        Remove access
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Give someone access"
        description="Household members only see the homes listed here."
      >
        {unassigned.length === 0 ? (
          <Empty>
            Everyone in the household already has access to this home. Invite
            someone new from the Household page.
          </Empty>
        ) : (
          <form action={grant} className="grid gap-4 sm:grid-cols-3 sm:items-end">
            <SelectField
              label="Household member"
              name="userId"
              options={unassigned.map((u) => ({
                value: u.id,
                label: `${u.name} (${u.email})`,
              }))}
            />
            <SelectField
              label="Role on this home"
              name="role"
              defaultValue={HomeRole.VIEWER}
              options={enumOptions(HOME_ROLE_LABELS)}
            />
            <button className="btn" type="submit">
              Grant access
            </button>
          </form>
        )}
      </Section>
    </>
  );
}
