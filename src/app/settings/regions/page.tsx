import { prisma } from '@/lib/prisma'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Card } from '@/components/ui/card'

// This page reads the database and must not be statically prerendered at
// build time — Railway (and any environment where DATABASE_URL is only
// injected at runtime, not during the Docker build) would fail the build.
export const dynamic = 'force-dynamic'

export default async function RegionsPage() {
  const regions = await prisma.region.findMany({ orderBy: { name: 'asc' } })

  return (
    <div>
      <Breadcrumbs segments={[{ label: 'Accueil', href: '/dashboard' }, { label: 'Réglages' }]} />
      <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-foreground">Régions</h1>
      <p className="text-sm text-muted-foreground">
        Liste fixe des 23 régions de Madagascar utilisée pour générer l&apos;identifiant des panneaux
        (ex: DIA-0001). Cette liste n&apos;est pas modifiable.
      </p>
      <Card className="py-0">
        <ul className="divide-y divide-border">
          {regions.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>{r.name}</span>
              <span className="w-24 text-right font-mono">{r.code}</span>
            </li>
          ))}
        </ul>
      </Card>
      </div>
    </div>
  )
}
