"use strict";

/**
 * Category Detection Service
 * Auto-detects tender categories based on keywords in title/description
 */

const CATEGORY_RULES = [
  // Port & Maritime categories
  { keywords: ["port", "port authority", "port trust"], category: "Port", color: "blue" },
  { keywords: ["jetty", "jetties"], category: "Jetty", color: "cyan" },
  { keywords: ["wharf", "wharves"], category: "Wharf", color: "teal" },
  { keywords: ["breakwater", "break water"], category: "Breakwater", color: "indigo" },
  { keywords: ["harbour", "harbor"], category: "Harbour", color: "sky" },
  { keywords: ["dredging", "dredge", "dredger"], category: "Dredging", color: "amber" },
  { keywords: ["maritime"], category: "Maritime", color: "blue" },
  { keywords: ["dock", "docking", "dry dock", "drydock"], category: "Dock", color: "slate" },
  { keywords: ["berth", "berthing"], category: "Berth", color: "violet" },
  { keywords: ["shipping", "shipment"], category: "Shipping", color: "emerald" },
  { keywords: ["cargo", "freight"], category: "Cargo", color: "orange" },
  { keywords: ["vessel", "vessels"], category: "Vessel", color: "purple" },
  { keywords: ["tugboat", "tug boat", "tug ", "tugs "], category: "Tugboat", color: "rose" },
  { keywords: ["navigation", "navigational", "channel"], category: "Navigation", color: "lime" },
  { keywords: ["lighthouse", "light house"], category: "Lighthouse", color: "yellow" },
  { keywords: ["coastal", "coastline", "coast "], category: "Coastal", color: "cyan" },
  { keywords: ["waterway", "waterways", "inland water"], category: "Waterway", color: "blue" },
  { keywords: ["shipbuilding", "ship building", "ship construction"], category: "Shipbuilding", color: "fuchsia" },
  { keywords: ["ship repair", "ship-repair", "vessel repair"], category: "Ship Repair", color: "pink" },
  // Infrastructure categories
  { keywords: ["road", "highway", "flyover", "overpass"], category: "Road", color: "gray" },
  { keywords: ["bridge"], category: "Bridge", color: "stone" },
  { keywords: ["railway", "rail ", "siding", "track "], category: "Railway", color: "red" },
  { keywords: ["building", "construction", "civil work"], category: "Construction", color: "orange" },
  { keywords: ["electrical", "power", "transformer", "substation"], category: "Electrical", color: "yellow" },
  { keywords: ["pipeline", "pipe line", "pipe laying", "pipelaying", "laying of pipe", "subsea pipe"], category: "Pipeline", color: "slate" },
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

function detectCategories(text) {
  if (!text) return [];
  const lowerText = text.toLowerCase();
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
  "Dredging", "Port", "Jetty", "Wharf", "Breakwater", "Harbour", "Berth", "Dock",
  "Maritime", "Coastal", "Waterway", "Navigation", "Pipeline",
  "Shipping", "Cargo", "Vessel", "Tugboat", "Shipbuilding", "Ship Repair", "Lighthouse",
];

module.exports = {
  PRIORITY_CATEGORIES,
  detectCategories,
  getPrimaryCategory,
  getCategoryString,
};
