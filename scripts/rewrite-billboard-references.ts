// One-time script: recalculates every existing billboard's identifier using
// the new "{prefix} {sequence}" format (no more hardcoded "ANM"). Run once
// after Task 1's migration is applied: `npx tsx scripts/rewrite-billboard-references.ts`
import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { generateReference } from '@/lib/reference'

async function main() {
  const [billboards, prefixes] = await Promise.all([
    prisma.billboard.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.cityPrefix.findMany(),
  ])

  const seqByCity = new Map<string, number>()
  let renamed = 0

  for (const b of billboards) {
    const seq = (seqByCity.get(b.city) ?? 0) + 1
    seqByCity.set(b.city, seq)
    const newReference = generateReference({ sequence: seq, city: b.city, prefixes })
    if (newReference !== b.reference) {
      await prisma.billboard.update({ where: { id: b.id }, data: { reference: newReference } })
      console.log(`${b.reference} -> ${newReference}`)
      renamed++
    }
  }

  console.log(`Done. ${renamed}/${billboards.length} billboard(s) renamed.`)
}

main().finally(() => prisma.$disconnect())
