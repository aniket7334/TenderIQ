// Every country / territory with an ISO 3166-1 alpha-2 code.
// Names come from the browser's built-in Intl data (English) and flags are
// built from the code, so this list never needs hand-maintained names.
const ISO_CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT ' +
  'MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG ' +
  'UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'
).split(' ');

const flagFor = (code) =>
  String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

let displayNames = null;
try {
  displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
} catch {
  // very old browsers: fall back to the code itself
}

/** [{ value, label, flag, code }] sorted by name. `value` is the country name. */
export const ALL_COUNTRIES = ISO_CODES.map((code) => {
  const name = (displayNames && displayNames.of(code)) || code;
  return { value: name, label: name, flag: flagFor(code), code };
}).sort((a, b) => a.label.localeCompare(b.label));

/** Multilateral funders that publish tenders but aren't countries. */
// UN tenders (UNGM) are not available: UNGM blocks automated access. Kept empty on purpose.
export const INTERNATIONAL_REGIONS = [];

/* Europe: tenders for these regions are shown live from TED (the EU's official
   tender journal) by the API — nothing is stored. Must match the backend's
   list in backend-js/src/sources/ted.js. */
export const EUROPE = 'Europe';
export const EUROPE_COUNTRY_NAMES = [
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France',
  'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Latvia', 'Liechtenstein', 'Lithuania',
  'Luxembourg', 'Malta', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia',
  'Spain', 'Sweden', 'Switzerland',
];
export const isEuropeRegion = (v) => v === EUROPE || EUROPE_COUNTRY_NAMES.includes(v);

/* United Kingdom: shown live from Find a Tender (the UK government's tender
   service) — nothing is stored. Must match backend-js/src/sources/fts.js. */
export const UK = 'United Kingdom';
export const UK_NATIONS = ['England', 'Scotland', 'Wales', 'Northern Ireland'];
export const isUkRegion = (v) => v === UK || UK_NATIONS.includes(v);

/* Worldwide: World Bank procurement notices, shown live (not stored).
   'World Bank' = all countries; 'World Bank: <country>' = one country. */
export const WORLD_BANK = 'World Bank';
export const WORLD_BANK_PREFIX = 'World Bank: ';
export const isWorldBankRegion = (v) => v === WORLD_BANK || String(v || '').startsWith(WORLD_BANK_PREFIX);

/** Regions served live by the API (not from the database). */
export const isLiveRegion = (v) => isEuropeRegion(v) || isUkRegion(v) || isWorldBankRegion(v);
