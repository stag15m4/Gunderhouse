import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { canAdminister, canEdit, requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { buildForecast, upcomingOnly } from "@/lib/forecast";
import { sortProjects } from "@/lib/projects";
import {
  buildCategoryLine,
  buildHomeMonth,
  monthEnd,
  monthLabel,
  monthStart,
  projectsCompletedIn,
} from "@/lib/budget";
import { setHomeBudget } from "@/app/actions/budget";
import { budgetAccessFor, visibleCategoryWhere } from "@/lib/budget-access";
import { createProject } from "@/app/actions/projects";
import { AddProjectForm, ProjectList } from "@/components/ProjectList";
import { formatAddress, formatDate, formatMoney } from "@/lib/format";
import {
  APPLIANCE_CATEGORY_LABELS,
  HOME_ROLE_SHORT,
  HOME_TYPE_LABELS,
} from "@/lib/labels";
import {
  Badge,
  Empty,
  Field,
  ForecastBadge,
  PageHeader,
  Section,
} from "@/components/ui";

export default async function HomeOverviewPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
  const { home, role, user } = await requireHome(homeId);
  const budget = budgetAccessFor(user);

  const thisMonth = { year: new Date().getUTCFullYear(), month: new Date().getUTCMonth() + 1 };
  const [
    appliances,
    recentMaintenance,
    spend,
    documentCount,
    projectRows,
    doneProjects,
    homeCategories,
  ] = await Promise.all([
    prisma.appliance.findMany({
      where: { homeId },
      select: {
        id: true,
        homeId: true,
        name: true,
        category: true,
        location: true,
        installedOn: true,
        modelYear: true,
        warrantyExpiresOn: true,
        expectedLifeLowYears: true,
        expectedLifeHighYears: true,
      },
    }),
    prisma.maintenanceEntry.findMany({
      where: { homeId },
      orderBy: { performedOn: "desc" },
      take: 5,
      include: { appliance: { select: { name: true } } },
    }),
    prisma.maintenanceEntry.aggregate({
      where: {
        homeId,
        performedOn: { gte: new Date(new Date().getFullYear(), 0, 1) },
      },
      _sum: { costCents: true },
    }),
    prisma.document.count({ where: { homeId } }),
    prisma.project.findMany({
      where: { homeId, status: ProjectStatus.PLANNED },
    }),
    prisma.project.findMany({
      where: { homeId, status: ProjectStatus.DONE },
    }),
    // Restricted categories are excluded here too, or a house's total would
    // leak the mortgage to someone who can't see the mortgage.
    prisma.budgetCategory.findMany({
      where: { homeId, archived: false, ...visibleCategoryWhere(user) },
      include: { recurring: true },
    }),
  ]);

  const upcoming = upcomingOnly(buildForecast(appliances)).slice(0, 5);
  const projects = sortProjects(projectRows);

  const monthMaintenance = await prisma.maintenanceEntry.findMany({
    where: {
      homeId,
      performedOn: { gte: monthStart(thisMonth), lt: monthEnd(thisMonth) },
    },
  });
  const homeMonth = buildHomeMonth({
    home,
    maintenance: monthMaintenance,
    projects: projectsCompletedIn(doneProjects, thisMonth),
    categoryLines: homeCategories.map((c) => buildCategoryLine(c, [], thisMonth)),
    appliances,
  });
  const editable = canEdit(role);
  const address = formatAddress(home);

  return (
    <>
      <PageHeader
        title={home.name}
        subtitle={address || undefined}
        backHref="/homes"
        backLabel="Homes"
        actions={
          canAdminister(role) ? (
            <Link className="btn-secondary" href={`/homes/${homeId}/edit`}>
              Edit home
            </Link>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Type" value={HOME_TYPE_LABELS[home.type]} />
        <Stat label="Appliances & systems" value={String(appliances.length)} />
        <Stat
          label={`Maintenance spend, ${new Date().getFullYear()}`}
          value={formatMoney(spend._sum.costCents ?? 0)}
        />
        <Stat label="Documents" value={String(documentCount)} />
      </div>

      <Section
        title="Coming due"
        description="Based on in-service date versus typical service life."
        actions={
          <Link
            className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
            href="/forecast"
          >
            Full forecast →
          </Link>
        }
      >
        {upcoming.length === 0 ? (
          <Empty>
            Nothing flagged. Appliances without an in-service date aren&apos;t
            forecast.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[36rem]">
            <thead>
              <tr>
                <th>Item</th>
                <th>Status</th>
                <th>In service</th>
                <th>Expected life</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((item) => (
                <tr key={item.applianceId}>
                  <td>
                    <Link
                      className="font-medium text-[var(--text)] hover:underline"
                      href={`/homes/${homeId}/appliances/${item.applianceId}`}
                    >
                      {item.name}
                    </Link>
                    <div className="text-xs text-[var(--subtle)]">
                      {APPLIANCE_CATEGORY_LABELS[item.category]}
                    </div>
                  </td>
                  <td>
                    <ForecastBadge status={item.status} />
                  </td>
                  <td>
                    {formatDate(item.installedOn)}
                    <div className="text-xs text-[var(--subtle)]">
                      {item.ageYears} yrs old
                    </div>
                  </td>
                  <td>
                    {item.lifespanLow}–{item.lifespanHigh} yrs
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Section>

      <Section
        title="Projects"
        description="Work planned for this house, and what it's expected to cost."
      >
        <ProjectList
          projects={projects}
          editableHomeIds={editable ? new Set([homeId]) : new Set()}
          returnTo={`/homes/${homeId}`}
          empty="Nothing on the list for this house yet."
        />
        <AddProjectForm
          action={createProject}
          homes={editable ? [{ id: homeId, name: home.name }] : []}
          returnTo={`/homes/${homeId}`}
        />
      </Section>

      {budget.canView ? (
      <Section
        title="Monthly cost"
        description={`What this house is costing in ${monthLabel(thisMonth)}, and what it should be putting aside.`}
        actions={
          <Link
            className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
            href="/budget"
          >
            Full budget →
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="This month" value={formatMoney(homeMonth.totalCents)} />
          <Stat
            label="Monthly budget"
            value={
              homeMonth.budgetCents === null
                ? "—"
                : formatMoney(homeMonth.budgetCents)
            }
          />
          <Stat
            label="Difference"
            value={
              homeMonth.varianceCents === null
                ? "—"
                : formatMoney(homeMonth.varianceCents)
            }
          />
          <Stat
            label="Set aside / mo"
            value={formatMoney(homeMonth.reserveCents)}
          />
        </div>
        <p className="mt-3 text-xs text-[var(--subtle)]">
          The set-aside is what the appliances and systems here accrue each
          month against eventual replacement — {formatMoney(homeMonth.reserveCents * 12)} a
          year. Saving, not spending.
        </p>
        {canAdminister(role) ? (
          <form
            action={setHomeBudget.bind(null, homeId)}
            className="mt-4 flex items-end gap-3 border-t border-[var(--border-soft)] pt-4"
          >
            <div className="w-48">
              <Field
                label="Monthly budget"
                name="monthlyBudget"
                defaultValue={
                  home.monthlyBudgetCents !== null
                    ? (home.monthlyBudgetCents / 100).toFixed(2)
                    : ""
                }
                hint="Blank to track without a target."
              />
            </div>
            <button className="btn-secondary" type="submit">
              Save
            </button>
          </form>
        ) : null}
      </Section>
      ) : null}

      <Section
        title="Recent maintenance"
        actions={
          <Link
            className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
            href={`/homes/${homeId}/maintenance`}
          >
            Full log →
          </Link>
        }
      >
        {recentMaintenance.length === 0 ? (
          <Empty>No maintenance logged yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[36rem]">
            <thead>
              <tr>
                <th>Date</th>
                <th>What</th>
                <th>Vendor</th>
                <th className="text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {recentMaintenance.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap">
                    {formatDate(entry.performedOn)}
                  </td>
                  <td>
                    {entry.description}
                    <div className="text-xs text-[var(--subtle)]">
                      {entry.appliance?.name ?? "Home-level"}
                    </div>
                  </td>
                  <td>{entry.vendor ?? "—"}</td>
                  <td className="text-right">{formatMoney(entry.costCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Section>

      {home.notes ? (
        <Section title="Notes">
          <p className="whitespace-pre-wrap text-sm text-[var(--muted)]">
            {home.notes}
          </p>
        </Section>
      ) : null}

      <div className="grid grid-cols-2 gap-3 text-sm text-[var(--muted)] sm:grid-cols-3">
        <Fact label="Year built" value={home.yearBuilt?.toString()} />
        <Fact
          label="Square feet"
          value={home.squareFeet?.toLocaleString("en-US")}
        />
        <Fact label="Purchased" value={formatDate(home.purchasedOn)} />
      </div>

      <p className="text-xs text-[var(--subtle)]">
        Your access to this home: <Badge>{HOME_ROLE_SHORT[role]}</Badge>
      </p>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--subtle)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-[var(--text)]">{value}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-[var(--subtle)]">{label}: </span>
      <span>{value || "—"}</span>
    </div>
  );
}
