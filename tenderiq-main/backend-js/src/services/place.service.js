"use strict";
/**
 * Where a tender is: "Mumbai, India".
 *
 * Port and portal sources store their city (Mumbai, Visakhapatnam, Tuticorin …). GeM's
 * listing has no place at all (only ministry / department), so for those the city is taken
 * from the tender's own words — title, work, office, organisation, scope — using the list of
 * Indian cities and port towns below (old names map to today's: Bombay → Mumbai, Vizag →
 * Visakhapatnam …). No city named → just the country.
 */

// canonical name: [other spellings]
const CITIES = {
    // Metros & large cities
    'Mumbai': ['bombay', 'wadala', 'mazgaon', 'colaba', 'sewri', 'sewree'],
    'Navi Mumbai': ['nhava sheva', 'jnpt', 'jnpa', 'jawaharlal nehru port', 'vashi', 'belapur', 'nerul'],
    'Delhi': ['new delhi'], 'Kolkata': ['calcutta'], 'Chennai': ['madras', 'ennore', 'kamarajar'],
    'Bengaluru': ['bangalore'], 'Hyderabad': ['secunderabad'], 'Ahmedabad': [], 'Pune': ['poona'], 'Surat': ['hazira'],
    'Jaipur': [], 'Lucknow': [], 'Kanpur': [], 'Nagpur': [], 'Indore': [], 'Thane': [], 'Bhopal': [],
    'Visakhapatnam': ['vizag', 'vishakhapatnam', 'vishakapatnam'], 'Patna': [], 'Vadodara': ['baroda'], 'Ghaziabad': [],
    'Ludhiana': [], 'Agra': [], 'Nashik': ['nasik'], 'Faridabad': [], 'Meerut': [], 'Rajkot': [], 'Varanasi': ['benaras', 'banaras'],
    'Srinagar': [], 'Aurangabad': ['chhatrapati sambhajinagar'], 'Dhanbad': [], 'Amritsar': [], 'Prayagraj': ['allahabad'],
    'Ranchi': [], 'Howrah': [], 'Coimbatore': [], 'Jabalpur': [], 'Gwalior': [], 'Vijayawada': [], 'Jodhpur': [], 'Madurai': [],
    'Raipur': [], 'Kota': [], 'Guwahati': ['gauhati'], 'Chandigarh': [], 'Solapur': ['sholapur'], 'Bareilly': [], 'Mysuru': ['mysore'],
    'Tiruchirappalli': ['trichy', 'tiruchirapalli'], 'Tiruppur': ['tirupur'], 'Gurugram': ['gurgaon'], 'Aligarh': [], 'Jalandhar': [],
    'Bhubaneswar': [], 'Salem': [], 'Warangal': [], 'Thiruvananthapuram': ['trivandrum'], 'Bhiwandi': [], 'Saharanpur': [],
    'Guntur': [], 'Bikaner': [], 'Noida': ['greater noida'], 'Jamshedpur': [], 'Bhilai': [], 'Cuttack': [], 'Kochi': ['cochin', 'ernakulam'],
    'Udaipur': [], 'Bhavnagar': [], 'Dehradun': [], 'Asansol': [], 'Nanded': [], 'Ajmer': [], 'Jamnagar': ['sikka'], 'Ujjain': [],
    'Siliguri': [], 'Jhansi': [], 'Jammu': [], 'Mangaluru': ['mangalore', 'new mangalore', 'panambur'], 'Belagavi': ['belgaum'],
    'Tirunelveli': [], 'Gaya': [], 'Udupi': [], 'Kozhikode': ['calicut'], 'Kollam': ['quilon'], 'Thrissur': ['trichur'], 'Kannur': ['cannanore'],
    'Puducherry': ['pondicherry'], 'Panaji': ['panjim'], 'Shillong': [], 'Imphal': [], 'Agartala': [], 'Aizawl': [], 'Gangtok': [],
    'Itanagar': [], 'Kohima': [], 'Leh': [], 'Shimla': [], 'Haridwar': [], 'Gorakhpur': [], 'Durgapur': [], 'Bokaro': [],
    'Rourkela': [], 'Sambalpur': [], 'Berhampur': ['brahmapur'], 'Nellore': [], 'Tirupati': [], 'Kurnool': [], 'Rajahmundry': ['rajamahendravaram'],
    'Hubballi': ['hubli'], 'Ballari': ['bellary'], 'Vellore': [], 'Thanjavur': ['tanjore'], 'Nagercoil': [], 'Kolhapur': [], 'Sangli': [],
    'Satara': [], 'Ahmednagar': [], 'Jalgaon': [], 'Akola': [], 'Latur': [], 'Gandhinagar': [], 'Junagadh': [], 'Bharuch': [],
    'Valsad': [], 'Vapi': [], 'Navsari': [], 'Gandhidham': [], 'Bhuj': [], 'Silvassa': [], 'Daman': [], 'Diu': [], 'Port Blair': ['sri vijaya puram'],
    'Kavaratti': [], 'Alappuzha': ['alleppey'],
    // Port towns
    'Kakinada': [], 'Paradip': ['paradeep'], 'Haldia': [], 'Tuticorin': ['thoothukudi', 'thoothukkudi'], 'Kandla': ['deendayal port'],
    'Mundra': [], 'Okha': [], 'Porbandar': [], 'Veraval': [], 'Dahej': [], 'Ratnagiri': [], 'Karwar': [], 'Uran': [], 'Panvel': [],
    'Alibag': ['alibaug'], 'Palghar': ['dahanu', 'vadhavan', 'vadhvan', 'wadhwan'], 'Mormugao': ['marmugao', 'vasco da gama', 'vasco'],
    'Margao': ['madgaon'], 'Krishnapatnam': [], 'Gangavaram': [], 'Dhamra': [], 'Gopalpur': [], 'Pipavav': [], 'Hazira': [],
    'Karaikal': [], 'Cuddalore': [], 'Nagapattinam': [], 'Rameswaram': [], 'Vizhinjam': [], 'Beypore': [], 'Ponnani': [],
};
const STATES = new Set(['andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa', 'gujarat', 'haryana',
    'himachal pradesh', 'jharkhand', 'karnataka', 'kerala', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram',
    'nagaland', 'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana', 'tripura', 'uttar pradesh', 'uttarakhand',
    'west bengal', 'delhi', 'jammu and kashmir', 'ladakh', 'puducherry', 'chandigarh', 'andaman and nicobar islands', 'lakshadweep',
    'dadra and nagar haveli and daman and diu']);
const COUNTRIES = new Set(['india', 'global', 'worldwide']);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SPELLINGS = [];
for (const [city, alts] of Object.entries(CITIES)) for (const s of [city.toLowerCase(), ...alts]) SPELLINGS.push([s, city]);
// Longest first so "navi mumbai" / "new mangalore" win over shorter names
SPELLINGS.sort((a, b) => b[0].length - a[0].length);
const CITY_RE = new RegExp(`(^|[^a-z])(${SPELLINGS.map(([s]) => escapeRegex(s).replace(/\s+/g, '[\\s-]+')).join('|')})([^a-z]|$)`, 'i');
const BY_SPELLING = new Map(SPELLINGS.map(([s, c]) => [s.replace(/\s+/g, ' '), c]));

/** The first Indian city / port town named in these texts, or null. */
function cityFromText(...texts) {
    const s = texts.filter(Boolean).join(' . ');
    const m = s.match(CITY_RE);
    if (!m) return null;
    return BY_SPELLING.get(m[2].toLowerCase().replace(/[\s-]+/g, ' ')) || null;
}

/**
 * City for a stored tender: its stored location when that is a city (not a country / state),
 * otherwise the first city named in its text. Returns null when none is known.
 */
function cityForTender(t) {
    const loc = String(t.location || '').trim();
    if (loc && !COUNTRIES.has(loc.toLowerCase()) && !STATES.has(loc.toLowerCase())) {
        return cityFromText(loc) || loc;
    }
    return cityFromText(t.title, t.name_of_work, t.issued_by, t.client_name, t.scope_of_work);
}

module.exports = { cityFromText, cityForTender, CITIES };
