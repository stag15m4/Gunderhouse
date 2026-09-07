import Link from "next/link";
import { redirect } from "next/navigation";
import {
  HomeType,
  LienSource,
  LienType,
  ValuationSource,
} from "@prisma/client";
import { canAdminister, requireHome } from "@/lib/access";
import { budgetAccessFor, visibleCategoryWhere } from "@/lib/budget-access";
import { prisma } from "@/lib/prisma";
import {
  LIEN_TYPE_LABELS,
  VALUATION_SOURCE_LABELS,
  buildEquity,
  formatBps,
  isOpen,
  valuationAgeMonths,
} from "@/lib/equity";
import { buildRent, maintenanceRunRate, rentForCashFlow } from "@/lib/rental";
import { buildCategoryLine, monthlyReserveCents } from "@/lib/budget";
import {
  addValuation,
  createLien,
  deleteValuation,
  setLendingAssumption,
  setRentalTerms,
} from "@/app/actions/property";
import { dateInputValue, formatDate, formatMoney } from "@/lib/format";
import {
  Badge,
  Empty,
  Field,
  FormError,
  Notice,
  PageHeader,
  Section,
  SelectField,
  TextareaField,
} from "@/components/ui";

export default async function HomeFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { homeId } = await params;
  const { error } = await searchParams;
  const { home, role, user } = await requireHome(homeId);

  // Reading what a house is worth and what's owed is financial information, so
  // it rides on budget access rather than on home access alone. Someone who
  // maintains the house has no business seeing the mortgage by default.
  const budget = budgetAccessFor(user);
  if (!budget.canView) redirect(`/homes/${homeId}`);
  // Recording a valuation or a lien is household-admin work, not home-admin
  // work — see requirePropertyAdmin in actions/property.ts.
  const editable = budget.canAdminister && canAdminister(role);

  const now = new Date();
  const thisMonth = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };

  const [valuations, liens, appliances, maintenance, homeCategories] =
    await Promise.all([
      prisma.valuation.findMany({
        where: { homeId },
        orderBy: { valuedOn: "desc" },
      }),
      prisma.lien.findMany({ where: { homeId } }),
      prisma.appliance.findMany({ where: { homeId } }),
      prisma.maintenanceEntry.findMany({ where: { homeId } }),
      prisma.budgetCategory.findMany({
        where: { homeId, archived: false, ...visibleCategoryWhere(user) },
        include: { recurring: true },
      }),
    ]);

  const equity = buildEquity({ home, valuations, liens });
  const ageMonths = valuationAgeMonths(equity.basis, now);

  // Insurance, taxes, HOA — whatever budget categories are bound to this house.
  const carryingCostCents = homeCategories.reduce(
    (sum, c) => sum + buildCategoryLine(c, [], thisMonth).actualCents,
    0,
  );
  const rent = buildRent({
    home,
    liens,
    carryingCostCents,
    reserveCents: monthlyReserveCents(appliances),
    maintenanceRunRateCents: maintenanceRunRate(maintenance, 12, now),
  });

  const isRental = home.type === HomeType.RENTAL;

  return (
    <>
      <PageHeader
        title="Value & financing"
        subtitle={home.name}
        backHref={`/homes/${homeId}`}
        backLabel={home.name}
      />

      <FormError message={error} />

      {equity.unvalued ? (
        <Notice>
          Nothing has been valued yet, so there&apos;s no equity to calculate.
          Add a value below — a tax assessment or purchase price is a fine
          start.
        </Notice>
      ) : null}

      {/* ---- equity --------------------------------------------------- */}
      <Section
        title="Equity"
        description={
          equity.basis
            ? `Against the ${VALUATION_SOURCE_LABELS[equity.basis.source].toLowerCase()} of ${formatDate(equity.basis.valuedOn)}.`
            : undefined
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="Value" value={formatMoney(equity.valueCents)} />
          <Figure label="Owed" value={formatMoney(equity.totalOwedCents)} />
          <Figure
            label="Equity"
            value={formatMoney(equity.grossEquityCents)}
            accent
          />
          <Figure
            label="Loan to value"
            value={equity.ltvBps === null ? "—" : formatBps(equity.ltvBps)}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] p-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--subtle)]">
              Available today
            </div>
            <div className="mt-1 text-xl font-medium tabular-nums text-[var(--accent)]">
              {formatMoney(equity.undrawnCreditCents)}
            </div>
            <p className="mt-1.5 text-xs text-[var(--subtle)]">
              Undrawn credit lines. Spendable now, nothing to apply for.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--subtle)]">
              Could still borrow
            </div>
            <div className="mt-1 text-xl font-medium tabular-nums text-[var(--text)]">
              {formatMoney(equity.borrowingHeadroomCents)}
            </div>
            <p className="mt-1.5 text-xs text-[var(--subtle)]">
              Headroom to {formatBps(equity.maxCombinedLtvBps)} combined LTV.
              Means originating a loan, not moving money today.
            </p>
          </div>
        </div>

        {ageMonths !== null && ageMonths >= 18 ? (
          <p className="mt-3 text-xs text-[#fbbf24]">
            That valuation is {ageMonths} months old. Everything above is only
            as good as it is.
          </p>
        ) : null}
      </Section>

      {/* ---- liens ------------------------------------------------------ */}
      <Section
        title="Loans & liens"
        description="Anything secured against the property. Ones filed through Legal sync in and are managed there."
      >
        {equity.liens.length === 0 ? (
          <Empty>Nothing recorded against this property.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[42rem]">
              <thead>
                <tr>
                  <th>Lien</th>
                  <th className="text-right">Balance</th>
                  <th className="text-right">Limit</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Payment</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {equity.liens.map((lien) => (
                  <tr key={lien.id} className={isOpen(lien) ? "" : "opacity-50"}>
                    <td>
                      <div className="flex items-center gap-2">
                        {/* The lender name is the way in to editing — a
                            balance changes every month, so this needs to be
                            the obvious click, not a secondary control. */}
                        {editable && lien.source === LienSource.MANUAL ? (
                          <Link
                            className="font-medium text-[var(--text)] hover:underline"
                            href={`/homes/${homeId}/liens/${lien.id}`}
                          >
                            {lien.lender}
                          </Link>
                        ) : (
                          <span className="font-medium text-[var(--text)]">
                            {lien.lender}
                          </span>
                        )}
                        {lien.source === LienSource.LEGAL ? (
                          <Badge tone="neutral">From Legal</Badge>
                        ) : null}
                        {!isOpen(lien) ? (
                          <Badge tone="green">Closed</Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-[var(--subtle)]">
                        {LIEN_TYPE_LABELS[lien.type]}
                        {lien.position ? ` · position ${lien.position}` : ""}
                        {lien.balanceAsOf
                          ? ` · as of ${formatDate(lien.balanceAsOf)}`
                          : ""}
                      </div>
                    </td>
                    <td className="text-right tabular-nums">
                      {formatMoney(lien.currentBalanceCents)}
                    </td>
                    <td className="text-right tabular-nums">
                      {lien.creditLimitCents === null
                        ? "—"
                        : formatMoney(lien.creditLimitCents)}
                    </td>
                    <td className="text-right tabular-nums">
                      {lien.interestRateBps === null
                        ? "—"
                        : formatBps(lien.interestRateBps)}
                    </td>
                    <td className="text-right tabular-nums">
                      {lien.monthlyPaymentCents === null
                        ? "—"
                        : formatMoney(lien.monthlyPaymentCents)}
                    </td>
                    <td className="text-right">
                      {editable && lien.source === LienSource.MANUAL ? (
                        <Link
                          className="text-xs text-[var(--subtle)] hover:text-[var(--text)]"
                          href={`/homes/${homeId}/liens/${lien.id}`}
                        >
                          Edit
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editable ? (
          <details className="mt-4 border-t border-[var(--border-soft)] pt-4">
            <summary className="cursor-pointer text-sm font-medium text-[var(--muted)]">
              Add a loan or lien
            </summary>
            <form
              action={createLien.bind(null, homeId)}
              className="mt-4 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Lender" name="lender" required placeholder="Regions Bank" />
                <SelectField
                  label="Type"
                  name="type"
                  defaultValue={LienType.FIRST_MORTGAGE}
                  options={Object.entries(LIEN_TYPE_LABELS).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label="Balance owed"
                  name="currentBalance"
                  required
                  placeholder="184000"
                />
                <Field
                  label="Balance as of"
                  name="balanceAsOf"
                  type="date"
                  hint="Amortising debt goes stale."
                />
                <Field
                  label="Credit limit"
                  name="creditLimit"
                  placeholder="For a HELOC"
                  hint="The undrawn part is cash available now."
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Rate %" name="interestRate" placeholder="6.25" />
                <Field
                  label="Monthly payment"
                  name="monthlyPayment"
                  placeholder="1420"
                />
                <Field label="Position" name="position" type="number" placeholder="1" />
              </div>
              <TextareaField label="Notes" name="notes" rows={2} />
              <button className="btn" type="submit">
                Add lien
              </button>
            </form>
          </details>
        ) : null}
      </Section>

      {/* ---- rent ------------------------------------------------------- */}
      {isRental ? (
        <Section
          title="Rent"
          description="What the property costs to hold, and what it has to earn to cover it."
        >
          {/* Two columns only — no min-width, so it fits a phone without
              scrolling sideways. */}
          <table className="table w-full">
              <tbody>
                <CostRow label="Debt service" cents={rent.debtServiceCents} />
                <CostRow
                  label="Insurance, taxes, HOA"
                  cents={rent.carryingCostCents}
                  hint="From budget categories tied to this house"
                />
                <CostRow
                  label="Replacement reserve"
                  cents={rent.reserveCents}
                  hint="What the appliances and systems accrue"
                />
                <CostRow
                  label="Upkeep run rate"
                  cents={rent.maintenanceRunRateCents}
                  hint="Trailing 12-month average from the log"
                />
                <tr className="border-t border-[var(--border)]">
                  <td className="font-medium text-[var(--text)]">
                    Fixed costs
                  </td>
                  <td className="text-right font-medium tabular-nums text-[var(--text)]">
                    {formatMoney(rent.fixedCostCents)}
                  </td>
                </tr>
              </tbody>
          </table>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure
              label="Break-even rent"
              value={
                rent.breakEvenRentCents === null
                  ? "—"
                  : formatMoney(rent.breakEvenRentCents)
              }
              accent
            />
            <Figure
              label="Charging"
              value={
                rent.rentCents === null ? "—" : formatMoney(rent.rentCents)
              }
            />
            <Figure
              label="Cash flow"
              value={
                rent.monthlyCashFlowCents === null
                  ? "—"
                  : formatMoney(rent.monthlyCashFlowCents)
              }
              tone={
                rent.monthlyCashFlowCents !== null &&
                rent.monthlyCashFlowCents < 0
                  ? "bad"
                  : undefined
              }
            />
            <Figure
              label="Margin"
              value={rent.marginBps === null ? "—" : formatBps(rent.marginBps)}
            />
          </div>

          <p className="mt-3 text-xs text-[var(--subtle)]">
            Break-even is solved, not added up: {formatBps(rent.vacancyRateBps)}{" "}
            vacancy and {formatBps(rent.managementFeeBps)} management come off
            the top, so rent has to cover the fixed costs{" "}
            <em>and</em> those shares. For {formatMoney(500_00)} a month of
            profit you&apos;d need{" "}
            {formatMoney(rentForCashFlow(rent, 500_00) ?? 0)}.
          </p>

          {editable ? (
            <form
              action={setRentalTerms.bind(null, homeId)}
              className="mt-4 space-y-4 border-t border-[var(--border-soft)] pt-4"
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label="Monthly rent"
                  name="monthlyRent"
                  defaultValue={
                    home.monthlyRentCents !== null
                      ? (home.monthlyRentCents / 100).toFixed(2)
                      : ""
                  }
                  hint="Blank to see break-even only."
                />
                <Field
                  label="Vacancy %"
                  name="vacancyRate"
                  defaultValue={(home.vacancyRateBps / 100).toString()}
                  hint="Share of the year assumed empty."
                />
                <Field
                  label="Management %"
                  name="managementFee"
                  defaultValue={(home.managementFeeBps / 100).toString()}
                  hint="0 if you manage it."
                />
              </div>
              <button className="btn" type="submit">
                Save rent terms
              </button>
            </form>
          ) : null}
        </Section>
      ) : (
        <Section title="Rent">
          <Empty>
            Set this home&apos;s type to Rental to work out what it needs to
            earn.
          </Empty>
        </Section>
      )}

      {/* ---- valuations -------------------------------------------------- */}
      <Section
        title="Value history"
        description="Sources disagree and go stale. The most recent one drives the equity above."
      >
        {valuations.length === 0 ? (
          <Empty>No valuations recorded yet.</Empty>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {valuations.map((v, index) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text)]">
                      {formatMoney(v.amountCents)}
                    </span>
                    {index === 0 ? <Badge tone="accent">In use</Badge> : null}
                  </div>
                  <div className="text-xs text-[var(--subtle)]">
                    {VALUATION_SOURCE_LABELS[v.source]} ·{" "}
                    {formatDate(v.valuedOn)}
                    {v.notes ? ` · ${v.notes}` : ""}
                  </div>
                </div>
                {editable ? (
                  <form action={deleteValuation.bind(null, homeId, v.id)}>
                    <button
                      className="text-xs text-[var(--faint)] hover:text-[#f87171]"
                      type="submit"
                    >
                      Remove
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {editable ? (
          <form
            action={addValuation.bind(null, homeId)}
            className="mt-4 space-y-4 border-t border-[var(--border-soft)] pt-4"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Value" name="amount" required placeholder="410000" />
              <Field
                label="Valued on"
                name="valuedOn"
                type="date"
                required
                defaultValue={dateInputValue(now)}
              />
              <SelectField
                label="Source"
                name="source"
                defaultValue={ValuationSource.OWNER_ESTIMATE}
                options={Object.entries(VALUATION_SOURCE_LABELS).map(
                  ([value, label]) => ({ value, label }),
                )}
              />
            </div>
            <Field label="Notes" name="notes" placeholder="Optional" />
            <button className="btn" type="submit">
              Record value
            </button>
          </form>
        ) : null}
      </Section>

      {editable ? (
        <Section
          title="Lending assumption"
          description="The combined loan-to-value a lender is assumed to allow. Only affects “could still borrow”."
        >
          <form
            action={setLendingAssumption.bind(null, homeId)}
            className="flex items-end gap-3"
          >
            <div className="w-40">
              <Field
                label="Max combined LTV %"
                name="maxCombinedLtv"
                defaultValue={(home.maxCombinedLtvBps / 100).toString()}
              />
            </div>
            <button className="btn-secondary" type="submit">
              Save
            </button>
          </form>
        </Section>
      ) : null}
    </>
  );
}

function CostRow({
  label,
  cents,
  hint,
}: {
  label: string;
  cents: number;
  hint?: string;
}) {
  return (
    <tr>
      <td>
        {label}
        {hint ? (
          <div className="text-xs text-[var(--subtle)]">{hint}</div>
        ) : null}
      </td>
      <td className="text-right tabular-nums">{formatMoney(cents)}</td>
    </tr>
  );
}

function Figure({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "bad";
}) {
  const colour =
    tone === "bad"
      ? "text-[#f87171]"
      : accent
        ? "text-[var(--accent)]"
        : "text-[var(--text)]";
  return (
    <div className="rounded-xl border border-[var(--border)] p-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--subtle)]">
        {label}
      </div>
      <div className={`mt-1 text-lg font-medium tabular-nums ${colour}`}>
        {value}
      </div>
    </div>
  );
}
