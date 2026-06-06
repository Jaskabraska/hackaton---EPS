// Static generation metadata derived from the dataset (static/gens.csv + buses.csv).
// The fleet at each bus is fixed across every hourly snapshot, so this mapping is
// safe to embed client-side. Only the live MW output (from /map) changes per hour.

export type GenType =
  | "solar"
  | "wind"
  | "hydro"
  | "biomass"
  | "geothermal"
  | "combined_cycle_gas"
  | "combustion_gas"
  | "internal_combustion_gas"
  | "steam_gas"
  | "combustion_oil"
  | "steam_coal"
  | "steam_other"

// Canonical palette, matching the generated energy icons.
export const TYPE_COLOUR: Record<GenType, string> = {
  solar: "#f59e0b",
  wind: "#0ea5e9",
  hydro: "#2563eb",
  biomass: "#16a34a",
  geothermal: "#dc2626",
  combustion_gas: "#f97316",
  combined_cycle_gas: "#0d9488",
  steam_gas: "#0891b2",
  internal_combustion_gas: "#9a3412",
  combustion_oil: "#475569",
  steam_coal: "#1f2937",
  steam_other: "#64748b"
}

export const TYPE_LABEL: Record<GenType, string> = {
  solar: "Solar",
  wind: "Wind",
  hydro: "Hydro",
  biomass: "Biomass",
  geothermal: "Geothermal",
  combined_cycle_gas: "Combined cycle gas",
  combustion_gas: "Combustion gas",
  internal_combustion_gas: "Internal combustion gas",
  steam_gas: "Steam gas",
  combustion_oil: "Combustion oil",
  steam_coal: "Steam coal",
  steam_other: "Steam other"
}

// Order used for the legend (renewables first, then thermal).
export const TYPE_ORDER: GenType[] = [
  "solar",
  "wind",
  "hydro",
  "biomass",
  "geothermal",
  "combined_cycle_gas",
  "combustion_gas",
  "internal_combustion_gas",
  "steam_gas",
  "combustion_oil",
  "steam_coal",
  "steam_other"
]

export const REGION_LABEL: Record<string, string> = {
  r1: "Region 1 · West",
  r2: "Region 2 · Central",
  r3: "Region 3 · East"
}

export const REGION_TINT: Record<string, string> = {
  r1: "#22d3ee",
  r2: "#a78bfa",
  r3: "#fb923c"
}

export type BusGen = { region: string; types: GenType[]; icon: string }

// bus_name -> generation fleet present at that bus.
export const BUS_GENERATION: Record<string, BusGen> = {
  bus_012: { region: "r1", types: ["biomass", "combined_cycle_gas"], icon: "biomass+combined_cycle_gas" },
  bus_103: { region: "r3", types: ["biomass", "combined_cycle_gas"], icon: "biomass+combined_cycle_gas" },
  bus_034: { region: "r2", types: ["biomass", "combined_cycle_gas", "hydro", "internal_combustion_gas"], icon: "biomass+combined_cycle_gas+hydro+internal_combustion_gas" },
  bus_074: { region: "r1", types: ["combined_cycle_gas"], icon: "combined_cycle_gas" },
  bus_112: { region: "r3", types: ["combined_cycle_gas", "combustion_gas", "hydro", "internal_combustion_gas", "solar"], icon: "combined_cycle_gas+combustion_gas+hydro+internal_combustion_gas+solar" },
  bus_107: { region: "r3", types: ["combined_cycle_gas", "combustion_gas"], icon: "combined_cycle_gas+combustion_gas" },
  bus_036: { region: "r2", types: ["combined_cycle_gas", "combustion_gas", "hydro"], icon: "combined_cycle_gas+combustion_gas+hydro" },
  bus_066: { region: "r2", types: ["combined_cycle_gas", "hydro"], icon: "combined_cycle_gas+hydro" },
  bus_046: { region: "r2", types: ["combined_cycle_gas", "hydro"], icon: "combined_cycle_gas+hydro" },
  bus_049: { region: "r2", types: ["combined_cycle_gas", "combustion_gas", "hydro"], icon: "combined_cycle_gas+combustion_gas+hydro" },
  bus_025: { region: "r1", types: ["combined_cycle_gas", "combustion_gas", "steam_gas"], icon: "combined_cycle_gas+combustion_gas+steam_gas" },
  bus_113: { region: "r1", types: ["combined_cycle_gas"], icon: "combined_cycle_gas" },
  bus_026: { region: "r1", types: ["combined_cycle_gas", "combustion_gas", "combustion_oil"], icon: "combined_cycle_gas+combustion_gas+combustion_oil" },
  bus_010: { region: "r1", types: ["combined_cycle_gas", "combustion_gas", "combustion_oil"], icon: "combined_cycle_gas+combustion_gas+combustion_oil" },
  bus_004: { region: "r1", types: ["combined_cycle_gas", "combustion_gas"], icon: "combined_cycle_gas+combustion_gas" },
  bus_100: { region: "r3", types: ["combined_cycle_gas", "combustion_gas", "solar", "wind"], icon: "combined_cycle_gas+combustion_gas+solar+wind" },
  bus_089: { region: "r3", types: ["combined_cycle_gas"], icon: "combined_cycle_gas" },
  bus_090: { region: "r3", types: ["combined_cycle_gas", "combustion_gas"], icon: "combined_cycle_gas+combustion_gas" },
  bus_087: { region: "r3", types: ["combined_cycle_gas"], icon: "combined_cycle_gas" },
  bus_065: { region: "r2", types: ["combined_cycle_gas", "hydro", "internal_combustion_gas"], icon: "combined_cycle_gas+hydro+internal_combustion_gas" },
  bus_018: { region: "r1", types: ["combined_cycle_gas", "combustion_gas", "solar", "steam_coal"], icon: "combined_cycle_gas+combustion_gas+solar+steam_coal" },
  bus_006: { region: "r1", types: ["combustion_gas"], icon: "combustion_gas" },
  bus_008: { region: "r1", types: ["combustion_gas"], icon: "combustion_gas" },
  bus_085: { region: "r3", types: ["combustion_gas"], icon: "combustion_gas" },
  bus_091: { region: "r3", types: ["combustion_gas"], icon: "combustion_gas" },
  bus_040: { region: "r2", types: ["combustion_gas"], icon: "combustion_gas" },
  bus_062: { region: "r2", types: ["combustion_gas", "hydro"], icon: "combustion_gas+hydro" },
  bus_055: { region: "r2", types: ["combustion_gas", "geothermal", "solar"], icon: "combustion_gas+geothermal+solar" },
  bus_111: { region: "r3", types: ["combustion_gas"], icon: "combustion_gas" },
  bus_042: { region: "r2", types: ["combustion_gas", "hydro"], icon: "combustion_gas+hydro" },
  bus_054: { region: "r2", types: ["combustion_oil", "solar"], icon: "combustion_oil+solar" },
  bus_056: { region: "r2", types: ["hydro", "internal_combustion_gas"], icon: "hydro+internal_combustion_gas" },
  bus_076: { region: "r2", types: ["hydro", "solar"], icon: "hydro+solar" },
  bus_059: { region: "r2", types: ["hydro"], icon: "hydro" },
  bus_061: { region: "r2", types: ["hydro"], icon: "hydro" },
  bus_077: { region: "r2", types: ["hydro", "internal_combustion_gas"], icon: "hydro+internal_combustion_gas" },
  bus_099: { region: "r2", types: ["hydro"], icon: "hydro" },
  bus_080: { region: "r2", types: ["hydro"], icon: "hydro" },
  bus_032: { region: "r1", types: ["hydro", "solar"], icon: "hydro+solar" },
  bus_116: { region: "r2", types: ["hydro"], icon: "hydro" },
  bus_092: { region: "r3", types: ["solar", "steam_gas"], icon: "solar+steam_gas" },
  bus_015: { region: "r1", types: ["solar"], icon: "solar" },
  bus_104: { region: "r3", types: ["solar"], icon: "solar" },
  bus_110: { region: "r3", types: ["solar"], icon: "solar" },
  bus_105: { region: "r3", types: ["solar", "steam_gas"], icon: "solar+steam_gas" },
  bus_019: { region: "r1", types: ["solar", "steam_gas"], icon: "solar+steam_gas" },
  bus_070: { region: "r1", types: ["steam_gas"], icon: "steam_gas" },
  bus_072: { region: "r1", types: ["steam_gas"], icon: "steam_gas" },
  bus_024: { region: "r1", types: ["steam_gas", "steam_other", "wind"], icon: "steam_gas+steam_other+wind" },
  bus_027: { region: "r1", types: ["wind"], icon: "wind" },
  bus_031: { region: "r1", types: ["wind"], icon: "wind" },
  bus_082: { region: "r3", types: ["wind"], icon: "wind" }
}

// Single-type buses use the type icon, multi-type buses use the combination icon.
export function iconPath(bus: string): string | null {
  const gen = BUS_GENERATION[bus]
  if (!gen) return null
  const dir = gen.types.length === 1 ? "types" : "combinations"
  return `/icons/${dir}/${gen.icon}.svg`
}

export function dominantType(bus: string): GenType | null {
  const gen = BUS_GENERATION[bus]
  return gen ? gen.types[0] : null
}
