const { pool } = require('../src/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function main() {
    // Create users with different roles
    const users = [
        { email: 'admin@tenderiq.com', password: 'admin123', name: 'TenderIQ Admin', role: 'admin' },
        { email: 'manager@tenderiq.com', password: 'manager123', name: 'Rajesh Kumar', role: 'manager' },
        { email: 'analyst@tenderiq.com', password: 'analyst123', name: 'Priya Sharma', role: 'analyst' },
        { email: 'viewer@tenderiq.com', password: 'viewer123', name: 'Amit Patel', role: 'viewer' },
    ];

    for (const u of users) {
        const passwordHash = await bcrypt.hash(u.password, 12);
        const userId = uuidv4();
        await pool.execute(
            `INSERT IGNORE INTO users (id, email, password_hash, full_name, role, is_active, is_email_verified, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [userId, u.email, passwordHash, u.name, u.role, 1, 1]
        );
        console.log(`User created: ${u.email} (${u.role})`);
    }

    // Create tender sources
    const sources = [
        { name: 'GeM', baseUrl: 'https://bidplus.gem.gov.in', adapterType: 'gem', priority: 10, config: null },
        { name: 'CPPP', baseUrl: 'https://eprocure.gov.in', adapterType: 'cppp', priority: 5, config: null },
        { name: 'IREPS', baseUrl: 'https://ireps.gov.in', adapterType: 'ireps', priority: 3, config: null },
        { name: 'VOC Port Trust', baseUrl: 'https://etenders.gov.in', adapterType: 'etenders', priority: 8, config: JSON.stringify({ org: 'V.O.Chidambaranar Port Trust', location: 'Tuticorin', state: 'Tamil Nadu' }) },
        { name: 'Vizag Port Trust', baseUrl: 'https://etenders.gov.in', adapterType: 'etenders', priority: 8, config: JSON.stringify({ org: 'Visakhapatnam Port Trust', location: 'Visakhapatnam', state: 'Andhra Pradesh' }) },
        { name: 'Indian Port Rail Corp', baseUrl: 'https://etenders.gov.in', adapterType: 'etenders', priority: 6, config: JSON.stringify({ org: 'Indian Port Rail Corporation Ltd.', location: 'India', state: '' }) },
        { name: 'Vadhvan Port', baseUrl: 'https://etenders.gov.in', adapterType: 'etenders', priority: 6, config: JSON.stringify({ org: 'Vadhvan Port Project Limited', location: 'Maharashtra', state: 'Maharashtra' }) },
    ];

    for (const source of sources) {
        await pool.execute(
            `INSERT IGNORE INTO tender_sources (id, name, base_url, adapter_type, priority, config, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
            [uuidv4(), source.name, source.baseUrl, source.adapterType, source.priority, source.config]
        );
    }

    // Create keywords
    const includeKeywords = [
        'construction', 'infrastructure', 'highway', 'road', 'bridge',
        'railway', 'building', 'water supply', 'smart city', 'metro',
        'port', 'jetty', 'wharf', 'breakwater', 'harbour', 'harbor',
        'dredging', 'maritime', 'dock', 'berth', 'shipping', 'cargo',
        'vessel', 'tugboat', 'tug', 'navigation', 'lighthouse',
        'coastal', 'waterway', 'shipbuilding', 'ship repair',
    ];
    const excludeKeywords = ['cancelled', 'withdrawn', 'corrigendum'];

    for (const keyword of includeKeywords) {
        await pool.execute(
            `INSERT IGNORE INTO keywords (id, keyword, category, is_active, created_at, updated_at)
             VALUES (?, ?, ?, 1, NOW(), NOW())`,
            [uuidv4(), keyword, 'include']
        );
    }

    for (const keyword of excludeKeywords) {
        await pool.execute(
            `INSERT IGNORE INTO keywords (id, keyword, category, is_active, created_at, updated_at)
             VALUES (?, ?, ?, 1, NOW(), NOW())`,
            [uuidv4(), keyword, 'exclude']
        );
    }

    console.log('Seed data created successfully');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => pool.end());
