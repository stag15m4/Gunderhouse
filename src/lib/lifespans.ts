import type { ApplianceCategory } from "@prisma/client";

/**
 * Typical service life, in years, per appliance/system category.
 *
 * This is a lookup table on purpose. The forecast is meant to answer "what is
 * probably coming due soon" — it is not a reliability model, and there is no
 * reason for it to become one. To adjust an estimate, edit the numbers here.
 *
 * `low`/`high` bracket the usual range; `typical` is the midpoint used for
 * ordering the forecast.
 */
export type Lifespan = {
  low: number;
  high: number;
  /** Rough replacement cost in dollars, used only as a planning hint. */
  replacementCost?: number;
};

export const LIFESPANS: Record<ApplianceCategory, Lifespan> = {
  WATER_HEATER: { low: 10, high: 12, replacementCost: 2000 },
  WATER_HEATER_TANKLESS: { low: 18, high: 20, replacementCost: 4500 },
  FURNACE: { low: 15, high: 20, replacementCost: 5500 },
  AIR_CONDITIONER: { low: 15, high: 20, replacementCost: 6000 },
  HEAT_PUMP: { low: 12, high: 15, replacementCost: 7000 },
  BOILER: { low: 20, high: 30, replacementCost: 8000 },
  ROOF: { low: 20, high: 25, replacementCost: 15000 },
  DISHWASHER: { low: 9, high: 10, replacementCost: 900 },
  REFRIGERATOR: { low: 12, high: 15, replacementCost: 1800 },
  FREEZER: { low: 12, high: 16, replacementCost: 900 },
  RANGE_OVEN: { low: 13, high: 16, replacementCost: 1400 },
  MICROWAVE: { low: 9, high: 10, replacementCost: 400 },
  WASHER: { low: 10, high: 12, replacementCost: 900 },
  DRYER: { low: 12, high: 14, replacementCost: 800 },
  GARBAGE_DISPOSAL: { low: 10, high: 12, replacementCost: 350 },
  WATER_SOFTENER: { low: 10, high: 15, replacementCost: 1500 },
  SUMP_PUMP: { low: 7, high: 10, replacementCost: 600 },
  WELL_PUMP: { low: 10, high: 15, replacementCost: 2500 },
  SEPTIC_SYSTEM: { low: 25, high: 40, replacementCost: 12000 },
  GARAGE_DOOR_OPENER: { low: 10, high: 15, replacementCost: 700 },
  GENERATOR: { low: 15, high: 20, replacementCost: 6000 },
  OTHER: { low: 12, high: 15 },
};

export function lifespanFor(category: ApplianceCategory): Lifespan {
  return LIFESPANS[category] ?? LIFESPANS.OTHER;
}
