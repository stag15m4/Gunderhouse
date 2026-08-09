import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { canEdit, requireUser, visibleHomes } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { buildForecast } from "@/lib/forecast";
import { sortProjects } from "@/lib/projects";
import { createProject } from "@/app/actions/projects";
import { AddProjectForm, ProjectList } from "@/components/ProjectList";
import { formatDate, formatDollars, formatMoney } from "@/lib/format";
import { APPLIANCE_CATEGORY_LABELS } from "@/lib/labels";
import {
  Empty,
  ForecastBadge,
  FormError,
  PageHeader,
  Section,
} from "@/components/ui";

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;

  const homes = await visibleHomes(user);
  const homeIds = homes.map((h) => h.id);
  const homeNames = new Map(homes.map((h) => [h.id, h.name]));
  const editableHomeIds = new Set(
    homes.filter((h) => canEdit(h.role)).map((h) => h.id),
  );

  const [appliances, projectRows] = await Promise.all([
    prisma.appliance.findMany({ where: { homeId: { in: homeIds } } }),
    prisma.project.findMany({ where: { homeId: { in: homeIds } } }),
  ]);

  const items = buildForecast(appliances);
  const flagged = items.filter((i) => i.status !== "OK");
  const replacementTotal = flagged.reduce(
    (sum, item) => sum + (item.estimatedCost ?? 0),
    0,
  );

  const planned = sortProjects(
    projectRows.filter((p) => p.status === ProjectStatus.PLANNED),
  );
  const done = projectRows
    .filter((p) => p.status === ProjectStatus.DONE)
    .sort(
      (a, b) =>
        (b.completedOn?.getTime() ?? 0) - (a.completedOn?.getTime() ?? 0),
    );

  // Unpriced projects are real to-do items but can't be forecast, so they're
  // listed and counted separately rather than silently treated as $0.
  const projectTotal = planned.reduce(
    (s, p) => s + (p.estimatedCostCents ?? 0),
    0,
  );
  const unpriced = planned.filter((p) => p.estimatedCostCents === null).length;
  const combined = replacementTotal * 100 + projectTotal;

  const untracked = appliances.filter(
    (a) => !a.installedOn && !a.modelYear,
  ).length;

  // Only offer the form for homes this person can actually add to.
  const writableHomes = homes.filter((h) => canEdit(h.role));

  return (
    <>
      <PageHeader
        title="Forecast"
        subtitle="What's likely coming, and what it's likely to cost. An estimate for planning, not a prediction."
      />

      <FormError message={error} />

      <Section
        title="Total planned spend"
        description="Replacement estimates for flagged appliances, plus every planned project."
      >
        {/* Whole dollars across the row: these are estimates, and cents next to
            a rounded replacement guess only imply precision that isn't there. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Figure
            label="Appliance replacements"
            value={formatDollars(replacementTotal)}
            sub={`${flagged.length} flagged`}
          />
          <Figure
            label="Planned projects"
            value={formatDollars(Math.round(projectTotal / 100))}
            sub={
              unpriced
                ? `${planned.length} planned · ${unpriced} not priced`
                : `${planned.length} planned`
            }
          />
          <Figure
            label="Combined"
            value={formatDollars(Math.round(combined / 100))}
            accent
            sub="if all of it happened"
            wide
          />
        </div>
      </Section>

      <Section
        title="Planned projects"
        description="Work you intend to do, with what you expect it to cost."
      >
        <ProjectList
          projects={planned}
          homeNames={homeNames}
          editableHomeIds={editableHomeIds}
          returnTo="/forecast"
          empty="Nothing planned yet. Add a project below."
        />
        <AddProjectForm
          action={createProject}
          homes={writableHomes}
          returnTo="/forecast"
        />
      </Section>

      <Section
        title="Appliances coming due"
        description={
          flagged.length
            ? `${flagged.length} items · roughly ${formatDollars(replacementTotal)} if all were replaced`
            : undefined
        }
      >
        {flagged.length === 0 ? (
          <Empty>Nothing is inside its replacement window right now.</Empty>
        ) : (
          <ForecastTable items={flagged} homeNames={homeNames} />
        )}
      </Section>

      <Section title="Everything else">
        {items.length === flagged.length ? (
          <Empty>No other items with a model year or in-service date.</Empty>
        ) : (
          <ForecastTable
            items={items.filter((i) => i.status === "OK")}
            homeNames={homeNames}
          />
        )}
        {untracked > 0 ? (
          <p className="mt-3 text-xs text-[var(--subtle)]">
            {untracked} {untracked === 1 ? "item has" : "items have"} neither a
            model year nor an in-service date, so{" "}
            {untracked === 1 ? "it isn't" : "they aren't"} forecast.
          </p>
        ) : null}
      </Section>

      {done.length > 0 ? (
        <Section title="Completed projects">
          <ul className="divide-y divide-[var(--border)]">
            {done.map((project) => (
              <li
                key={project.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="text-sm text-[var(--muted)]">
                    {project.title}
                  </div>
                  <div className="text-xs text-[var(--faint)]">
                    {homeNames.get(project.homeId) ?? "—"}
                    {project.completedOn
                      ? ` · ${formatDate(project.completedOn)}`
                      : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm text-[var(--text)]">
                    {project.actualCostCents !== null
                      ? formatMoney(project.actualCostCents)
                      : "—"}
                  </div>
                  <div className="text-xs text-[var(--faint)]">
                    est. {formatMoney(project.estimatedCostCents)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

function Figure({
  label,
  value,
  sub,
  accent,
  wide,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  /** Fills the second row on narrow screens instead of sitting half-width. */
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--border)] p-3 ${wide ? "col-span-2 sm:col-span-1" : ""}`}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--subtle)]">
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-medium ${accent ? "text-[var(--accent)]" : "text-[var(--text)]"}`}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-xs text-[var(--faint)]">{sub}</div>
      ) : null}
    </div>
  );
}

function ForecastTable({
  items,
  homeNames,
}: {
  items: ReturnType<typeof buildForecast>;
  homeNames: Map<string, string>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table min-w-[36rem]">
        <thead>
          <tr>
            <th>Item</th>
            <th>Status</th>
            <th>Home</th>
            <th>In service</th>
            <th>Age</th>
            <th>Expected life</th>
            <th>Window opens</th>
            <th>Est. cost</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.applianceId}>
              <td>
                <Link
                  className="font-medium text-[var(--text)] hover:underline"
                  href={`/homes/${item.homeId}/appliances/${item.applianceId}`}
                >
                  {item.name}
                </Link>
                <div className="text-xs text-[var(--subtle)]">
                  {APPLIANCE_CATEGORY_LABELS[item.category]}
                  {item.location ? ` · ${item.location}` : ""}
                </div>
              </td>
              <td>
                <ForecastBadge status={item.status} />
              </td>
              <td className="text-xs">{homeNames.get(item.homeId) ?? "—"}</td>
              <td className="whitespace-nowrap">
                {formatDate(item.installedOn)}
                {item.ageBasis === "MODEL_YEAR" ? (
                  <div className="text-xs text-[var(--faint)]">
                    {item.modelYear} model
                  </div>
                ) : null}
              </td>
              <td>{item.ageYears} yrs</td>
              <td className="whitespace-nowrap">
                {item.lifespanLow}–{item.lifespanHigh} yrs
              </td>
              <td>{item.expectedReplacementYear}</td>
              <td>{formatDollars(item.estimatedCost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
