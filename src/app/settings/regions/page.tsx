import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/shared/PageShell'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/card'

// This page reads the database and must not be statically prerendered at
// build time — Railway (and any environment where DATABASE_URL is only
// injected at runtime, not during the Docker build) would fail the build.
export const dynamic = 'force-dynamic'

export default async function RegionsPage() {
  const regions = await prisma.region.findMany({ orderBy: { name: 'asc' } })

  return (
    <PageShell fill>
      <PageHeader
        breadcrumbs={[
          { label: 'Accueil', href: '/dashboard' },
          { label: 'Réglages' },
          { label: 'Régions' },
        ]}
        title="Régions"
      />
      <p className="max-w-2xl text-sm text-muted-foreground">
        Liste fixe des 23 régions de Madagascar utilisée pour générer l&apos;identifiant des panneaux
        (ex: DIA-0001). Cette liste n&apos;est pas modifiable.
      </p>
      {/* Capped for measure, not for page width: this is a fixed 23-row
          name/code list, and stretching two short columns across a wide
          monitor would leave a river of empty space between them. The page
          gutter and width still come from PageShell. The list scrolls inside
          this one card (PageShell's `fill` mode) instead of growing the page
          taller than the viewport. */}
      <Card className="max-w-2xl min-h-0 flex-1 overflow-y-auto py-0">
        <ul className="divide-y divide-border">
          {regions.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>{r.name}</span>
              <span className="w-24 text-right font-mono">{r.code}</span>
            </li>
          ))}
        </ul>
      </Card>
    </PageShell>
  )
}
