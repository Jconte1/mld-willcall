import { Location } from "./types";

export type PickupLocation = Location;

const SALT_LAKE_HQ_WAREHOUSES = new Set([
  "SALT LAKE APPLIANCES",
  "SALT LAKE HARDWARE",
  "SALT LAKE PLUMBING",
  "SALT LAKE INSTALL",
]);

const SALT_LAKE_OUTLET_WAREHOUSES = new Set([
  "SALT LAKE CLOSEOUT",
  "SALT LAKE SHOWROOM",
  "ROTH CONSIGNMENT",
]);

const BOISE_WAREHOUSES = new Set([
  "BOISE SHOWROOM",
  "BOISE WAREHOUSE",
]);

const JACKSON_WAREHOUSES = new Set(["JACKSON SHOWROOM"]);

const PROVO_WAREHOUSES = new Set(["PROVO SHOWROOM"]);

export const pickupLocations: PickupLocation[] = [
  {
    id: "slc-hq",
    name: "SALT LAKE HQ",
    address: "5167 W 1730 S, Salt Lake City, UT 84104",
    instructions: "Entrance is in the NorthEast corner of the building. Our team will assist you with loading.",
  },
  {
    id: "slc-outlet",
    name: "SALT LAKE OUTLET",
    address: "2345 S. Main Street, Salt Lake City, UT 84115",
    instructions: "Check in at the front desk when you arrive. Our team will assist you with loading.",
  },
  {
    id: "boise-willcall",
    name: "BOISE WILL CALL",
    address: "627 N. Dupont Ave. Boise, ID 83713",
    instructions: "Check in at the front desk when you arrive. Our team will assist you with loading.",
  },
  {
    id: "jackson-willcall",
    name: "JACKSON WILL CALL",
    address: "TBD",
    instructions: "Check in at the front desk when you arrive. Our team will assist you with loading.",
  },
  {
    id: "provo-willcall",
    name: "PROVO WILL CALL",
    address: "TBD",
    instructions: "Check in at the front desk when you arrive. Our team will assist you with loading.",
  },
];

export function resolvePickupLocationIds(warehouses: string[]) {
  const ids = new Set<string>();
  const unknown: string[] = [];

  for (const raw of warehouses) {
    const key = String(raw || "").trim().toUpperCase();
    if (!key) continue;
    if (SALT_LAKE_HQ_WAREHOUSES.has(key)) {
      ids.add("slc-hq");
      continue;
    }
    if (SALT_LAKE_OUTLET_WAREHOUSES.has(key)) {
      ids.add("slc-outlet");
      continue;
    }
    if (BOISE_WAREHOUSES.has(key)) {
      ids.add("boise-willcall");
      continue;
    }
    if (JACKSON_WAREHOUSES.has(key)) {
      ids.add("jackson-willcall");
      continue;
    }
    if (PROVO_WAREHOUSES.has(key)) {
      ids.add("provo-willcall");
      continue;
    }
    unknown.push(key);
  }

  return { locationIds: Array.from(ids), unknownWarehouses: unknown };
}
