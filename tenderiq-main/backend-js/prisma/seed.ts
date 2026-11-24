import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@tenderiq.com' },
    update: {},
    create: {
      email: 'admin@tenderiq.com',
      passwordHash,
      fullName: 'TenderIQ Admin',
      role: 'admin',
      isActive: true,
      isEmailVerified: true,
    },
  });

  // Create tender sources
  const sources = [
    { name: 'GeM', baseUrl: 'https://bidplus.gem.gov.in', adapterType: 'gem', priority: 10 },
    { name: 'CPPP', baseUrl: 'https://eprocure.gov.in', adapterType: 'cppp', priority: 5 },
    { name: 'IREPS', baseUrl: 'https://ireps.gov.in', adapterType: 'ireps', priority: 3 },
    // Port & Jetty Sources
    { name: 'VOC Port Trust', baseUrl: 'https://etenders.gov.in', adapterType: 'etenders', priority: 8, config: { org: 'V.O.Chidambaranar Port Trust', location: 'Tuticorin', state: 'Tamil Nadu' } },
    { name: 'Vizag Port Trust', baseUrl: 'https://etenders.gov.in', adapterType: 'etenders', priority: 8, config: { org: 'Visakhapatnam Port Trust', location: 'Visakhapatnam', state: 'Andhra Pradesh' } },
    { name: 'Indian Port Rail Corp', baseUrl: 'https://etenders.gov.in', adapterType: 'etenders', priority: 6, config: { org: 'Indian Port Rail Corporation Ltd.', location: 'India', state: '' } },
    { name: 'Vadhvan Port', baseUrl: 'https://etenders.gov.in', adapterType: 'etenders', priority: 6, config: { org: 'Vadhvan Port Project Limited', location: 'Maharashtra', state: 'Maharashtra' } },
  ];

  for (const source of sources) {
    await prisma.tenderSource.upsert({
      where: { name: source.name },
      update: {},
      create: source,
    });
  }

  // Create keywords
  const includeKeywords = [
    'construction', 'infrastructure', 'highway', 'road', 'bridge',
    'railway', 'building', 'water supply', 'smart city', 'metro',
    // Port & Jetty keywords
    'port', 'jetty', 'wharf', 'breakwater', 'harbour', 'harbor',
    'dredging', 'maritime', 'dock', 'berth', 'shipping', 'cargo',
    'vessel', 'tugboat', 'tug', 'navigation', 'lighthouse',
    'coastal', 'waterway', 'shipbuilding', 'ship repair',
  ];
  const excludeKeywords = ['cancelled', 'withdrawn', 'corrigendum'];

  for (const keyword of includeKeywords) {
    await prisma.keyword.upsert({
      where: { keyword_category: { keyword, category: 'include' } },
      update: {},
      create: { keyword, category: 'include', isActive: true },
    });
  }

  for (const keyword of excludeKeywords) {
    await prisma.keyword.upsert({
      where: { keyword_category: { keyword, category: 'exclude' } },
      update: {},
      create: { keyword, category: 'exclude', isActive: true },
    });
  }

  console.log('Seed data created successfully');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
