import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

async function main() {
  const users = [
    { email: 'dev@rna.mg', password: 'xK9m2pLq', role: 'DEV' as const },
    { email: 'admin@rna.mg', password: 'Rn4wJ7hB', role: 'ADMIN' as const },
    { email: 'user@rna.mg', password: 'Tz6vF3cY', role: 'USER' as const },
  ]

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10)
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, passwordHash, role: u.role },
    })
  }

  await seedSampleData()
  await seedCityPrefixes()
}

async function seedSampleData() {
  const client = await prisma.client.upsert({
    where: { id: 'seed-client-orange' },
    update: {},
    create: { id: 'seed-client-orange', name: 'Orange Madagascar', email: 'contact@orange.mg' },
  })

  const billboard = await prisma.billboard.upsert({
    where: { reference: 'TNR 001' },
    update: {},
    create: {
      reference: 'TNR 001',
      lat: -18.8792,
      lng: 47.5079,
      city: 'Antananarivo',
      dimension: 'D4X3',
      sides: 2,
    },
  })

  await prisma.occupancy.upsert({
    where: { id: 'seed-occupancy-1' },
    update: {},
    create: {
      id: 'seed-occupancy-1',
      billboardId: billboard.id,
      clientId: client.id,
      contractRef: 'Contrat-Orange-2026.pdf',
      endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    },
  })
}

async function seedCityPrefixes() {
  // Extracted from the client's "base de donnée.xlsx" and "Sucettes YAS.xlsx".
  // Two collisions existed in their own data and were resolved by picking the
  // higher-frequency usage; the loser gets a distinct fallback code (flagged
  // below). Editable afterwards via /settings/city-prefixes.
  const entries: { city: string; prefix: string }[] = [
    { city: 'Antananarivo', prefix: 'TNR' },
    { city: 'Tana', prefix: 'TNR' },
    { city: 'Toamasina', prefix: 'TMM' },
    { city: 'Tamatave', prefix: 'TMM' },
    { city: 'Fianarantsoa', prefix: 'WFI' },
    { city: 'Mahajanga', prefix: 'MJN' },
    { city: 'Majunga', prefix: 'MJN' },
    { city: 'Toliara', prefix: 'TLE' },
    { city: 'Tulear', prefix: 'TLE' },
    { city: 'Antsiranana', prefix: 'DIE' },
    { city: 'Diego', prefix: 'DIE' },
    { city: 'Ambanja', prefix: 'IVA' },
    { city: 'Ambatondrazaka', prefix: 'WAM' },
    { city: 'Ambilobe', prefix: 'AMB' },
    // Collision with Antsohihy (WAI, 16 occurrences vs this city's 10) — was
    // WAI in the source data, reassigned. Confirm/rename via the admin UI.
    { city: 'Ambositra', prefix: 'AOT' },
    { city: 'Andapa', prefix: 'ZWA' },
    { city: 'Antalaha', prefix: 'ANM' },
    { city: 'Antsohihy', prefix: 'WAI' },
    { city: 'Arivonimamo', prefix: 'FMMA' },
    { city: 'Befandriana Nord', prefix: 'WBD' },
    // Collision with Tamatave (TMM is Tamatave's real IATA code, and it has
    // more occurrences) — was TMM in the source data, reassigned. Likely a
    // copy-paste error in the client's spreadsheet; confirm via admin UI.
    { city: 'Fenerive Est', prefix: 'FIE' },
    { city: 'Fort Dauphin', prefix: 'FTU' },
    { city: 'Maevatanana', prefix: 'FMNP' },
    { city: 'Mampikony', prefix: 'WMP' },
    { city: 'Mandritsara', prefix: 'WMA' },
    { city: 'Maroantsetra', prefix: 'WMN' },
    { city: 'Moramanga', prefix: 'OHB' },
    { city: 'Morondava', prefix: 'MOQ' },
    { city: 'Nosy Be', prefix: 'NOS' },
    { city: 'Port Berger', prefix: 'WPB' },
    { city: 'Sambava', prefix: 'SVB' },
    { city: 'Ste Marie', prefix: 'SMS' },
    { city: 'Vatomandry', prefix: 'VAT' },
    { city: 'Vohemar', prefix: 'VOH' },
  ]

  for (const e of entries) {
    await prisma.cityPrefix.upsert({
      where: { city: e.city },
      update: {},
      create: e,
    })
  }
}

main().finally(() => prisma.$disconnect())
