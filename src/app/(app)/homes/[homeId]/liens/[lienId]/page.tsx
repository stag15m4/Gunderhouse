import { notFound, redirect } from "next/navigation";
import { LienSource, LienType } from "@prisma/client";
import { canAdminister, requireHome } from "@/lib/access";
import { budgetAccessFor } from "@/lib/budget-access";
import { prisma } from "@/lib/prisma";
import { LIEN_TYPE_LABELS, isOpen } from "@/lib/equity";
import {
  closeLien,
  deleteLien,
  reopenLien,
  updateLien,
} from "@/app/actions/property";
import { dateInputValue, formatDate, formatMoney } from "@/lib/format";
import {
  Field,
  FormError,
  Notice,
  PageHeader,
  Section,
  SelectField,
  TextareaField,
} from "@/components/ui";

export default async function LienPage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string; lienId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { homeId, lienId } = await params;
  const { error } = await searchParams;
  const { home, role, user } = await requireHome(homeId);

  const budget = budgetAccessFor(user);
  if (!budget.canView) redirect(`/homes/${homeId}`);
  const editable = budget.canAdminister && canAdminister(role);

  const lien = await prisma.lien.findUnique({ where: { id: lienId } });
  if (!lien || lien.homeId !== homeId) notFound();

  const fromLegal = lien.source === LienSource.LEGAL;
  const update = updateLien.bind(null, homeId, lienId);
  const close = closeLien.bind(null, homeId, lienId);
  const reopen = reopenLien.bind(null, homeId, lienId);
  const remove = deleteLien.bind(null, homeId, lienId);
  const open = isOpen(lien);

  return (
    <>
      <PageHeader
        title={lien.lender}
        subtitle={`${LIEN_TYPE_LABELS[lien.type]} · ${home.name}`}
        backHref={`/homes/${homeId}/finance`}
        backLabel="Value & financing"
      />

      <FormError message={error} />

      {fromLegal ? (
        <Notice>
          This one is synced from the Legal app, which is the system of record
          for it. Change it there and it updates here on the next sync — editing
          it in both places is how the two stop agreeing.
        </Notice>
      ) : null}

      {!open ? (
        <Notice>
          Marked paid off {formatDate(lien.closedOn)}. It no longer counts
          against the property&apos;s equity.
        </Notice>
      ) : null}

      {editable && !fromLegal ? (
        <Section
          title="Details"
          description="The balance is what equity is calculated from, so it's worth keeping current."
        >
          <form action={update} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Lender"
                name="lender"
                required
                defaultValue={lien.lender}
              />
              <SelectField
                label="Type"
                name="type"
                defaultValue={lien.type}
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
                defaultValue={(lien.currentBalanceCents / 100).toFixed(2)}
              />
              <Field
                label="Balance as of"
                name="balanceAsOf"
                type="date"
                defaultValue={dateInputValue(lien.balanceAsOf)}
                hint="Amortising debt goes stale."
              />
              <Field
                label="Credit limit"
                name="creditLimit"
                defaultValue={
                  lien.creditLimitCents !== null
                    ? (lien.creditLimitCents / 100).toFixed(2)
                    : ""
                }
                hint="For a line of credit. The undrawn part is cash available now."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Rate %"
                name="interestRate"
                defaultValue={
                  lien.interestRateBps !== null
                    ? (lien.interestRateBps / 100).toString()
                    : ""
                }
              />
              <Field
                label="Monthly payment"
                name="monthlyPayment"
                defaultValue={
                  lien.monthlyPaymentCents !== null
                    ? (lien.monthlyPaymentCents / 100).toFixed(2)
                    : ""
                }
                hint="Feeds the rent maths on a rental."
              />
              <Field
                label="Position"
                name="position"
                type="number"
                defaultValue={lien.position?.toString() ?? ""}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Original amount"
                name="originalAmount"
                defaultValue={
                  lien.originalAmountCents !== null
                    ? (lien.originalAmountCents / 100).toFixed(2)
                    : ""
                }
              />
              <Field
                label="Opened"
                name="openedOn"
                type="date"
                defaultValue={dateInputValue(lien.openedOn)}
              />
              <Field
                label="Matures"
                name="maturesOn"
                type="date"
                defaultValue={dateInputValue(lien.maturesOn)}
              />
            </div>

            <TextareaField
              label="Notes"
              name="notes"
              rows={2}
              defaultValue={lien.notes}
            />
            <button className="btn" type="submit">
              Save changes
            </button>
          </form>
        </Section>
      ) : (
        <Section title="Details">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Fact label="Balance" value={formatMoney(lien.currentBalanceCents)} />
            <Fact
              label="Balance as of"
              value={formatDate(lien.balanceAsOf)}
            />
            <Fact
              label="Credit limit"
              value={
                lien.creditLimitCents === null
                  ? "—"
                  : formatMoney(lien.creditLimitCents)
              }
            />
            <Fact
              label="Rate"
              value={
                lien.interestRateBps === null
                  ? "—"
                  : `${lien.interestRateBps / 100}%`
              }
            />
            <Fact
              label="Monthly payment"
              value={
                lien.monthlyPaymentCents === null
                  ? "—"
                  : formatMoney(lien.monthlyPaymentCents)
              }
            />
            <Fact label="Position" value={lien.position?.toString() ?? "—"} />
          </dl>
          {lien.notes ? (
            <p className="mt-4 whitespace-pre-wrap text-sm text-[var(--muted)]">
              {lien.notes}
            </p>
          ) : null}
        </Section>
      )}

      {editable && !fromLegal ? (
        <Section
          title={open ? "Paid off" : "Reopen"}
          description={
            open
              ? "Zeroes the balance and drops it out of the equity maths. The record stays."
              : "Puts it back in the equity maths. You'll want to set the balance again after."
          }
        >
          <form action={open ? close : reopen} className="space-y-4">
            {open ? (
              <div className="w-56">
                <Field
                  label="Paid off on"
                  name="closedOn"
                  type="date"
                  hint="Defaults to today."
                />
              </div>
            ) : null}
            <button
              className={open ? "btn" : "btn-secondary"}
              type="submit"
            >
              {open ? "Mark paid off" : "Reopen it"}
            </button>
          </form>
        </Section>
      ) : null}

      {editable && !fromLegal ? (
        <Section
          title="Delete"
          description="Removes the record entirely. If it was simply paid off, mark it paid off instead — that keeps the history."
        >
          <form action={remove}>
            <button className="btn-danger" type="submit">
              Delete this lien
            </button>
          </form>
        </Section>
      ) : null}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--subtle)]">
        {label}
      </dt>
      <dd className="text-[var(--text)]">{value}</dd>
    </div>
  );
}
