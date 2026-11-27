"use strict";

/**
 * Category Detection Service
 * Auto-detects tender categories based on keywords in title/description
 */

const CATEGORY_RULES = [
  // Port & Maritime categories
  { keywords: ["port", "ports", "port authority", "port trust", "seaport", "sea port", "port expansion", "port development"], category: "Port", color: "blue" },
  { keywords: ["jetty", "jetties"], category: "Jetty", color: "cyan" },
  { keywords: ["wharf", "wharves"], category: "Wharf", color: "teal" },
  { keywords: ["quay", "quays", "quay wall"], category: "Quay", color: "teal" },
  { keywords: ["breakwater", "break water"], category: "Breakwater", color: "indigo" },
  { keywords: ["harbour", "harbor"], category: "Harbour", color: "sky" },
  { keywords: ["dredging", "dredge", "dredger", "capital dredging", "maintenance dredging"], category: "Dredging", color: "amber" },
  // Company focus areas (dredging & marine works list, Nov 2026)
  { keywords: ["reclamation", "land reclamation", "reclaimed land"], category: "Reclamation", color: "amber" },
  { keywords: ["marine structure", "marine works", "marine work", "marine construction", "marine civil"], category: "Marine Structures", color: "blue" },
  { keywords: ["container terminal", "cargo terminal", "cruise terminal", "passenger terminal", "fishing harbour", "fishing harbor", "fishing port", "fishing jetty", "ro-ro terminal", "multipurpose terminal", "multi-purpose terminal", "liquid terminal", "bulk terminal", "lng terminal", "oil terminal", "marine terminal"], category: "Terminal", color: "sky" },
  { keywords: ["offshore", "nearshore", "offshore works", "offshore marine"], category: "Offshore", color: "indigo" },
  { keywords: ["piling", "pile foundation", "marine foundation", "bored pile", "sheet pile", "sheet piling", "dolphin", "mooring dolphin", "berthing dolphin"], category: "Piling & Foundations", color: "slate" },
  { keywords: ["desilting", "de-silting", "desiltation", "silt removal", "sediment removal", "reservoir dredging", "reservoir desilting", "dam desilting", "sediment management"], category: "Desilting", color: "amber" },
  { keywords: ["outfall", "water intake", "raw water intake", "river intake", "intake pipeline", "outfall pipeline", "intake well", "intake structure", "intake pump house", "intake channel", "intake jetty", "cooling water", "seawater intake", "sea water intake"], category: "Intake & Outfall", color: "cyan" },
  // (plain "tunnel" would also catch "tunnel cooler / oven / dryer")
  { keywords: ["tunnelling", "tunneling", "tbm", "tunnel boring", "micro tunnelling", "microtunnelling", "subsea tunnel", "undersea tunnel", "marine tunnel", "tunnel construction", "construction of tunnel", "tunnel lining", "tunnel excavation", "tunnel works", "road tunnel", "rail tunnel", "railway tunnel", "metro tunnel", "utility tunnel", "cable tunnel", "water tunnel"], category: "Tunnelling", color: "stone" },
  { keywords: ["trenching", "trench", "cable trenching", "pipeline trenching", "marine trenching"], category: "Trenching", color: "stone" },
  // (plain "HDD" is usually a computer hard disk in GeM bids)
  { keywords: ["horizontal directional drilling", "directional drilling", "trenchless", "hdd crossing", "hdd method", "hdd works", "hdd drilling", "by hdd", "through hdd", "hdd technique", "hdd technology"], category: "HDD", color: "orange" },
  { keywords: ["subsea cable", "submarine cable", "undersea cable", "marine cable", "offshore cable", "duct bank", "cable landing"], category: "Subsea Cable", color: "violet" },
  { keywords: ["hydrographic", "hydrographic survey", "bathymetric", "bathymetry", "marine geotechnical", "geotechnical investigation", "offshore geotechnical", "marine survey", "seabed survey", "side scan sonar"], category: "Marine Survey", color: "lime" },
  { keywords: ["mld", "million litres per day", "million liters per day", "million litre per day"], category: "MLD", color: "blue" },
  { keywords: ["maritime"], category: "Maritime", color: "blue" },
  { keywords: ["dock", "docking", "dry dock", "drydock"], category: "Dock", color: "slate" },
  { keywords: ["berth", "berthing"], category: "Berth", color: "violet" },
  { keywords: ["shipping", "shipment"], category: "Shipping", color: "emerald" },
  { keywords: ["cargo", "freight"], category: "Cargo", color: "orange" },
  { keywords: ["vessel", "vessels"], category: "Vessel", color: "purple" },
  { keywords: ["tugboat", "tug boat", "tug ", "tugs "], category: "Tugboat", color: "rose" },
  { keywords: ["navigation", "navigational", "channel"], category: "Navigation", color: "lime" },
  { keywords: ["lighthouse", "light house"], category: "Lighthouse", color: "yellow" },
  { keywords: ["coastal", "coastline", "coast ", "shore protection", "coastal protection", "coast protection", "sea wall", "seawall", "revetment", "groyne", "anti-sea erosion", "anti sea erosion", "beach nourishment"], category: "Coastal", color: "cyan" },
  { keywords: ["waterway", "waterways", "inland water"], category: "Waterway", color: "blue" },
  { keywords: ["shipbuilding", "ship building", "ship construction"], category: "Shipbuilding", color: "fuchsia" },
  { keywords: ["ship repair", "ship-repair", "vessel repair"], category: "Ship Repair", color: "pink" },
  // Infrastructure categories
  { keywords: ["road", "highway", "flyover", "overpass"], category: "Road", color: "gray" },
  { keywords: ["bridge"], category: "Bridge", color: "stone" },
  { keywords: ["railway", "rail ", "siding", "track "], category: "Railway", color: "red" },
  { keywords: ["building", "construction", "civil work"], category: "Construction", color: "orange" },
  { keywords: ["electrical", "power", "transformer", "substation"], category: "Electrical", color: "yellow" },
  { keywords: ["pipeline", "pipe line", "pipe laying", "pipelaying", "laying of pipe", "subsea pipe", "marine pipeline", "subsea pipeline", "submarine pipeline", "offshore pipeline", "undersea pipeline"], category: "Pipeline", color: "slate" },
  { keywords: ["water supply", "plumbing", "drainage", "sewage"], category: "Water/Plumbing", color: "blue" },
  { keywords: ["maintenance", "repair", "renovation", "restoration"], category: "Maintenance", color: "green" },
  { keywords: ["security", "surveillance", "cctv", "guard"], category: "Security", color: "red" },
  { keywords: ["software", "it ", "computer", "digital", "website", "application"], category: "IT/Software", color: "violet" },
  { keywords: ["consultancy", "consultant", "advisory", "feasibility"], category: "Consultancy", color: "indigo" },
  { keywords: ["procurement", "supply", "purchase", "equipment"], category: "Procurement", color: "emerald" },
];

/**
 * Detect categories from tender text (title + description + scope)
 * Returns all matching categories
 */
// Keywords match whole words only (plus simple plurals), so "port" no longer
// matches "portable"/"support"/"transport" and "it" no longer matches "kit"/"unit".
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const KEYWORD_PATTERNS = new Map();
function keywordPattern(keyword) {
  const key = keyword.trim().toLowerCase();
  if (!KEYWORD_PATTERNS.has(key)) {
    const body = escapeRegex(key).replace(/\s+/g, "[\\s-]+");
    // Allow plurals ("computers", "roads"), but not for very short keywords:
    // "it" + "s" would otherwise match the word "its".
    const plural = key.length > 3 ? "(s|es)?" : "";
    KEYWORD_PATTERNS.set(key, new RegExp(`(^|[^a-z0-9])${body}${plural}(?=[^a-z0-9]|$)`, "i"));
  }
  return KEYWORD_PATTERNS.get(key);
}

// Place names that contain a sector word ("Mazgaon Sewree Reclamation Estate" is an
// address, not reclamation work) — removed before matching
const PLACE_NAMES = /reclamation estates?|(sewree|sewri|mazgaon|colaba|wadala|haji bunder|frere) reclamation/gi;

function detectCategories(text) {
  if (!text) return [];
  const lowerText = text.toLowerCase().replace(PLACE_NAMES, ' ');
  const matched = [];
  const seen = new Set();
  for (const rule of CATEGORY_RULES) {
    if (seen.has(rule.category)) continue;
    for (const keyword of rule.keywords) {
      if (keywordPattern(keyword).test(lowerText)) {
        matched.push({ category: rule.category, color: rule.color });
        seen.add(rule.category);
        break;
      }
    }
  }
  return matched;
}

/**
 * Get the primary category (first match) from tender text
 */
function getPrimaryCategory(text) {
  const matches = detectCategories(text);
  return matches.length > 0 ? matches[0].category : null;
}

/**
 * Get all category names as a comma-separated string
 */
function getCategoryString(text) {
  const matches = detectCategories(text);
  return matches.map((m) => m.category).join(", ");
}

/**
 * First-priority categories (dredging, marine works, pipelines, shipping &
 * vessels): their tenders are listed first. See priority.service.js.
 */
const PRIORITY_CATEGORIES = [
  "Dredging", "Port", "Jetty", "Wharf", "Quay", "Breakwater", "Harbour", "Berth", "Dock",
  "Maritime", "Coastal", "Waterway", "Navigation", "Pipeline",
  "Shipping", "Cargo", "Vessel", "Tugboat", "Shipbuilding", "Ship Repair", "Lighthouse",
  "Reclamation", "Marine Structures", "Terminal", "Offshore", "Piling & Foundations", "Desilting",
  "Intake & Outfall", "Tunnelling", "Trenching", "HDD", "Subsea Cable", "Marine Survey", "MLD",
];

/**
 * Regex body (no flags) matching any keyword of a category as a whole word,
 * plurals allowed — usable in JavaScript and in MySQL / MariaDB / TiDB REGEXP
 * (no look-arounds). Match it against LOWER(text). null for unknown categories.
 */
function categoryRegexBody(category) {
  const rule = CATEGORY_RULES.find((r) => r.category.toLowerCase() === String(category || "").trim().toLowerCase());
  if (!rule) return null;
  const alts = [...new Set(rule.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))].map((k) => {
    const body = escapeRegex(k).replace(/[\s-]+/g, "[^a-z0-9]+");
    return k.length > 3 ? `${body}(s|es)?` : body;
  });
  return `(^|[^a-z0-9])(${alts.join("|")})([^a-z0-9]|$)`;
}

/** Sector names for the filter (in rule order). */
const CATEGORY_NAMES = CATEGORY_RULES.map((r) => r.category);

/**
 * The company's focus sectors, in the order of its keyword list (Nov 2026).
 * Shown at the top of the Sector filter, before all other sectors.
 */
const FOCUS_SECTORS = [
  "Dredging", "Reclamation", "Breakwater", "Marine Structures", "Coastal", "Berth", "Jetty", "Quay", "Wharf",
  "Port", "Terminal", "Offshore", "Piling & Foundations", "Desilting", "Intake & Outfall", "Pipeline",
  "Tunnelling", "Trenching", "HDD", "Subsea Cable", "Marine Survey", "MLD",
  // added to the top list later (Nov 2026)
  "Shipping", "Dock", "Harbour", "Bridge", "Water/Plumbing", "Vessel",
];
/** Next in the Sector filter (and in priority): the middle of the list. */
const MIDDLE_SECTORS = ["Procurement"];

module.exports = {
  CATEGORY_RULES,
  CATEGORY_NAMES,
  FOCUS_SECTORS,
  MIDDLE_SECTORS,
  PRIORITY_CATEGORIES,
  detectCategories,
  getPrimaryCategory,
  getCategoryString,
  categoryRegexBody,
};
