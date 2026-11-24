const axios = require('axios');
const cheerio = require('cheerio');

async function main() {
  // Test eTenders detail page
  const url = 'https://etenders.gov.in/eprocure/app?component=%24DirectLink&page=FrontEndLatestActiveTendersOrgwise&service=direct&session=T&sp=SmtDl9m5jGxXmYIZvDfysrQ%3D%3D';
  try {
    console.log('Fetching eTenders detail page...');
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });
    const $ = cheerio.load(res.data);
    console.log('Tables found:', $('table').length);
    let count = 0;
    $('table tr').each((i, el) => {
      const cells = $(el).find('td');
      if (cells.length >= 2 && count < 30) {
        const key = cells.eq(0).text().trim().substring(0, 40);
        const val = cells.eq(1).text().trim().substring(0, 100);
        if (key && val && val !== '--') {
          console.log(`  ${key} | ${val}`);
          count++;
        }
      }
    });
    if (count === 0) console.log('  No table data found - page may need session');
  } catch (e) {
    console.log('eTenders error:', e.message);
  }

  // Test CPPP detail page
  const cpppUrl = 'https://eprocure.gov.in/cppp/tendersfullview/MTM2Mjk2NjU=A13h1OGQ2NzAxYTMwZTJhNTIxMGNiNmEwM2EzNmNhYWZhODk=A13h1OGQ2NzAxYTMwZTJhNTIxMGNiNmEwM2EzNmNhYWZhODk=A13h1MTc3NDI2MTgxMA==A13h1MzAwOS8yMDI1LTIwMjYvRTMzMzI2A13h1MjAyNl9GQUNUXzkwMzM2NF8x';
  try {
    console.log('\nFetching CPPP detail page...');
    const res = await axios.get(cpppUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });
    const $ = cheerio.load(res.data);
    console.log('Tables found:', $('table').length);
    if (res.data.includes('Invalid Url')) {
      console.log('  CPPP returned "Invalid Url" - needs active session');
    }
    let count = 0;
    $('table tr').each((i, el) => {
      const cells = $(el).find('td');
      if (cells.length >= 2 && count < 30) {
        const key = cells.eq(0).text().trim().substring(0, 40);
        const val = cells.eq(1).text().trim().substring(0, 100);
        if (key && val && val !== '--' && val !== 'NA') {
          console.log(`  ${key} | ${val}`);
          count++;
        }
      }
    });
    if (count === 0) console.log('  No table data found');
  } catch (e) {
    console.log('CPPP error:', e.message);
  }
}

main();
