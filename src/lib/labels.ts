import type {
  ApplianceCategory,
  DocumentCategory,
  HomeRole,
  HomeType,
  SystemRole,
} from "@prisma/client";

export const HOME_TYPE_LABELS: Record<HomeType, string> = {
  PRIMARY_RESIDENCE: "Primary residence",
  RENTAL: "Rental",
};

export const HOME_ROLE_LABELS: Record<HomeRole, string> = {
  ADMIN: "Admin — full control of this home, including who has access",
  MEMBER: "Member — can add appliances, log maintenance, upload documents",
  VIEWER: "Viewer — read only",
};

export const HOME_ROLE_SHORT: Record<HomeRole, string> = {
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

export const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  OWNER: "Household admin — every home, plus managing people",
  MEMBER: "Household member — only the homes they're given access to",
};

export const APPLIANCE_CATEGORY_LABELS: Record<ApplianceCategory, string> = {
  WATER_HEATER: "Water heater (tank)",
  WATER_HEATER_TANKLESS: "Water heater (tankless)",
  FURNACE: "Furnace",
  AIR_CONDITIONER: "Air conditioner",
  HEAT_PUMP: "Heat pump",
  BOILER: "Boiler",
  ROOF: "Roof",
  DISHWASHER: "Dishwasher",
  REFRIGERATOR: "Refrigerator",
  FREEZER: "Freezer",
  RANGE_OVEN: "Range / oven",
  MICROWAVE: "Microwave",
  WASHER: "Washer",
  DRYER: "Dryer",
  GARBAGE_DISPOSAL: "Garbage disposal",
  WATER_SOFTENER: "Water softener",
  SUMP_PUMP: "Sump pump",
  WELL_PUMP: "Well pump",
  SEPTIC_SYSTEM: "Septic system",
  GARAGE_DOOR_OPENER: "Garage door opener",
  GENERATOR: "Generator",
  OTHER: "Other",
};

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  INSURANCE: "Insurance",
  WARRANTY: "Warranty",
  MANUAL: "Manual",
  RECEIPT: "Receipt",
  LEASE: "Lease",
  TAX: "Tax",
  INSPECTION: "Inspection",
  OTHER: "Other",
};

export function enumOptions<T extends string>(
  labels: Record<T, string>,
): Array<{ value: T; label: string }> {
  return (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }));
}
