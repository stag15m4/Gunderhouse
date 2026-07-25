import type { Appliance, ApplianceCategory } from "@prisma/client";
import { lifespanFor } from "./lifespans";

export type ForecastStatus = "OVERDUE" | "DUE_SOON" | "WATCH" | "OK";

export type ForecastItem = {
  applianceId: string;
  homeId: string;
  name: string;
  category: ApplianceCategory;
  location: string | null;
  installedOn: Date;
  ageYears: number;
  lifespanLow: number;
  lifespanHigh: number;
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

/**
 * Classify one appliance against its expected lifespan.
 *
 * - OVERDUE:  past the high end of the range
 * - DUE_SOON: at or past the low end (i.e. inside the replacement window)
 * - WATCH:    within two years of the low end
 * - OK:       everything else
 *
 * Appliances with no in-service date can't be forecast and are skipped.
 */
export function forecastAppliance(
  appliance: Pick<
    Appliance,
    | "id"
    | "homeId"
    | "name"
    | "category"
    | "location"
    | "installedOn"
    | "warrantyExpiresOn"
  >,
  now: Date = new Date(),
): ForecastItem | null {
  if (!appliance.installedOn) return null;

  const { low, high, replacementCost } = lifespanFor(appliance.category);
  const ageYears = yearsBetween(appliance.installedOn, now);
  const yearsRemaining = low - ageYears;

  let status: ForecastStatus;
  if (ageYears >= high) status = "OVERDUE";
  else if (ageYears >= low) status = "DUE_SOON";
  else if (yearsRemaining <= 2) status = "WATCH";
  else status = "OK";

  const expectedReplacement = new Date(appliance.installedOn);
  expectedReplacement.setFullYear(expectedReplacement.getFullYear() + low);

  return {
    applianceId: appliance.id,
    homeId: appliance.homeId,
    name: appliance.name,
    category: appliance.category,
    location: appliance.location,
    installedOn: appliance.installedOn,
    ageYears: Math.round(ageYears * 10) / 10,
    lifespanLow: low,
    lifespanHigh: high,
    expectedReplacementYear: expectedReplacement.getFullYear(),
    yearsRemaining: Math.round(yearsRemaining * 10) / 10,
    status,
    estimatedCost: replacementCost ?? null,
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
  appliances: Parameters<typeof forecastAppliance>[0][],
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
