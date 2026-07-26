import type { Appliance, ApplianceCategory } from "@prisma/client";
import { lifespanFor } from "./lifespans";

export type ForecastStatus = "OVERDUE" | "DUE_SOON" | "WATCH" | "OK";

/** Which date the age was measured from. */
export type AgeBasis = "MODEL_YEAR" | "IN_SERVICE";

export type ForecastItem = {
  applianceId: string;
  homeId: string;
  name: string;
  category: ApplianceCategory;
  location: string | null;
  installedOn: Date | null;
  modelYear: number | null;
  /** The date the age was actually measured from. */
  agedFrom: Date;
  ageBasis: AgeBasis;
  ageYears: number;
  lifespanLow: number;
  lifespanHigh: number;
  /** True when this unit's expected life was set by hand, not by its category. */
  lifespanOverridden: boolean;
  /** Year the unit reaches the low end of its expected life. */
  expectedReplacementYear: number;
  yearsRemaining: number;
  status: ForecastStatus;
  estimatedCost: number | null;
  warrantyExpiresOn: Date | null;
};

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function yearsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_YEAR;
}

type ForecastInput = Pick<
  Appliance,
  | "id"
  | "homeId"
  | "name"
  | "category"
  | "location"
  | "installedOn"
  | "modelYear"
  | "warrantyExpiresOn"
  | "expectedLifeLowYears"
  | "expectedLifeHighYears"
>;

/**
 * Classify one appliance against its expected lifespan.
 *
 * - OVERDUE:  past the high end of the range
 * - DUE_SOON: at or past the low end (i.e. inside the replacement window)
 * - WATCH:    within two years of the low end
 * - OK:       everything else
 *
 * Age is measured from the unit's model year when one is recorded, and only
 * otherwise from its in-service date. A second-hand machine is as old as it is,
 * regardless of when it arrived here — dating it from the install would make
 * every used purchase look brand new.
 *
 * An item with neither a model year nor an in-service date can't be forecast
 * and is skipped.
 */
export function forecastAppliance(
  appliance: ForecastInput,
  now: Date = new Date(),
): ForecastItem | null {
  const agedFrom = appliance.modelYear
    ? new Date(Date.UTC(appliance.modelYear, 0, 1))
    : appliance.installedOn;
  if (!agedFrom) return null;

  const ageBasis: AgeBasis = appliance.modelYear ? "MODEL_YEAR" : "IN_SERVICE";

  const table = lifespanFor(appliance.category);
  const low = appliance.expectedLifeLowYears ?? table.low;
  const high = appliance.expectedLifeHighYears ?? table.high;
  const lifespanOverridden =
    appliance.expectedLifeLowYears !== null ||
    appliance.expectedLifeHighYears !== null;

  const ageYears = yearsBetween(agedFrom, now);
  const yearsRemaining = low - ageYears;

  let status: ForecastStatus;
  if (ageYears >= high) status = "OVERDUE";
  else if (ageYears >= low) status = "DUE_SOON";
  else if (yearsRemaining <= 2) status = "WATCH";
  else status = "OK";

  const expectedReplacement = new Date(agedFrom);
  expectedReplacement.setUTCFullYear(expectedReplacement.getUTCFullYear() + low);

  return {
    applianceId: appliance.id,
    homeId: appliance.homeId,
    name: appliance.name,
    category: appliance.category,
    location: appliance.location,
    installedOn: appliance.installedOn,
    modelYear: appliance.modelYear,
    agedFrom,
    ageBasis,
    ageYears: Math.round(ageYears * 10) / 10,
    lifespanLow: low,
    lifespanHigh: high,
    lifespanOverridden,
    expectedReplacementYear: expectedReplacement.getUTCFullYear(),
    yearsRemaining: Math.round(yearsRemaining * 10) / 10,
    status,
    estimatedCost: table.replacementCost ?? null,
    warrantyExpiresOn: appliance.warrantyExpiresOn,
  };
}

const STATUS_ORDER: Record<ForecastStatus, number> = {
  OVERDUE: 0,
  DUE_SOON: 1,
  WATCH: 2,
  OK: 3,
};

/** Forecast a set of appliances, most urgent first. */
export function buildForecast(
  appliances: ForecastInput[],
  now: Date = new Date(),
): ForecastItem[] {
  return appliances
    .map((a) => forecastAppliance(a, now))
    .filter((item): item is ForecastItem => item !== null)
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.yearsRemaining - b.yearsRemaining,
    );
}

/** Items worth surfacing on a dashboard — anything not comfortably OK. */
export function upcomingOnly(items: ForecastItem[]): ForecastItem[] {
  return items.filter((i) => i.status !== "OK");
}

/** True when the unit predates its arrival here — i.e. it was bought used. */
export function boughtUsed(appliance: {
  modelYear: number | null;
  installedOn: Date | null;
}): boolean {
  if (!appliance.modelYear || !appliance.installedOn) return false;
  return appliance.modelYear < appliance.installedOn.getUTCFullYear();
}
