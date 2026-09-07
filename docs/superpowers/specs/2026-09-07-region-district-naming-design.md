# Référence panneau par Région/District — Design

**Goal:** Remplacer le champ `city` (texte libre) et le système de préfixe par ville par une détection 100% automatique du district (et de la commune) d'un panneau à partir de ses coordonnées GPS, avec la région dérivée automatiquement du district, et générer sa référence sous la forme `CODE_REGION-0000`.

**Architecture:** Une liste fixe et non éditable de 23 régions (codes officiels fournis par l'utilisateur), et deux nouvelles tables de référence (`District`, `Commune`) seedées depuis les frontières administratives officielles de Madagascar (geoBoundaries, niveaux ADM2/ADM3). La détection primaire se fait au niveau district (frontières propres, aucune fusion) ; la région est dérivée du district via un lien calculé une fois au seed. À la création ou à la modification des coordonnées d'un panneau, le serveur détermine district/commune par recherche point-dans-polygone.

**Tech Stack:** Next.js 14 (API routes), Prisma/PostgreSQL, Turf.js (`@turf/boolean-point-in-polygon`) pour la géométrie, données geoBoundaries (licence CC-BY 3.0 IGO).

---

## 1. Les 23 régions — liste fixe, non éditable

Contrairement aux échanges initiaux de ce brainstorm, les régions ne sont **plus éditables et n'ont plus de page Réglages dédiée**. La liste ci-dessous (fournie par l'utilisateur, codes officiels) est seedée telle quelle et affichée en lecture seule uniquement :

| Région | Code |
|---|---|
| Alaotra-Mangoro | ALM |
| Amoron'i Mania | AMN |
| Analamanga | ANL |
| Analanjirofo | ALJ |
| Androy | ADR |
| Anosy | ANS |
| Atsimo-Atsinanana | ASN |
| Atsinanana | ATN |
| Atsimo-Andrefana | AAF |
| Betsiboka | BTB |
| Boeny | BOE |
| Bongolava | BGL |
| Diana | DIA |
| Fitovinany | FTV |
| Haute Matsiatra | HMA |
| Ihorombe | IHO |
| Itasy | ITS |
| Melaky | MLK |
| Menabe | MNB |
| Sava | SAV |
| Sofia | SOF |
| Vakinankaratra | VAK |
| Vatovavy | VTV |

## 2. Source de données géographiques (districts et communes)

[geoBoundaries](https://www.geoboundaries.org) fournit les frontières administratives de Madagascar en GeoJSON, avec un nom (`shapeName`) déjà renseigné sur chaque entité — aucune saisie manuelle de notre part pour les noms :

- **ADM2 (district)** — 119 entités. URL : `https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/{commit}/releaseData/gbOpen/MDG/ADM2/geoBoundaries-MDG-ADM2.geojson`
- **ADM3 (commune)** — même schéma d'URL avec `/ADM3/`, volume nettement plus élevé (non compté précisément, de l'ordre de plusieurs centaines à ~1600)

On n'utilise **pas** les frontières ADM1 (région) de geoBoundaries : elles fusionnent Vatovavy et Fitovinany en une seule zone, incompatible avec les 23 codes fixes ci-dessus. La région d'un panneau est déterminée **indirectement**, via son district (voir section 3).

**Aucune donnée géographique n'est envoyée au navigateur.** Les fichiers GeoJSON sont utilisés uniquement côté serveur (seed + recherche point-dans-polygone à la création d'un panneau).

## 3. Rattachement district → région

Chaque district (ADM2) est rattaché une fois pour toutes à l'une des 23 régions, au moment du seed :

- **114 districts** : rattachement automatique par test géométrique — centroïde du district testé contre les 22 polygones ADM1 de geoBoundaries, avec renommage statique "Matsiatra Ambony" → "Haute Matsiatra" pour faire correspondre les noms.
- **5 districts exceptions** (zone fusionnée "Vatovavy-Fitovinany" de geoBoundaries, répartie manuellement selon l'appartenance historique) :
  - `Ifanadiana`, `Nosy-Varika`, `Mananjary` → **Vatovavy**
  - `Manakara Atsimo`, `Ikongo` → **Fitovinany**

Ce rattachement est une table de correspondance figée dans le script de seed (pas une donnée éditable en base au-delà du seed initial).

## 4. Modèle de données

```prisma
model Region {
  id       String    @id @default(cuid())
  name     String    @unique
  code     String    @unique
  districts District[]
  billboards Billboard[]
}

model District {
  id       String   @id @default(cuid())
  name     String
  regionId String
  region   Region   @relation(fields: [regionId], references: [id])
  communes Commune[]
  billboards Billboard[]

  @@unique([regionId, name])
}

model Commune {
  id         String   @id @default(cuid())
  name       String
  districtId String
  district   District @relation(fields: [districtId], references: [id])
  billboards Billboard[]

  @@unique([districtId, name])
}
```

`Billboard` :
- Suppression du champ `city` (String, texte libre)
- Ajout de `regionId String` (obligatoire, FK `Region`) — toujours dérivé du district, jamais choisi indépendamment
- Ajout de `districtId String` (obligatoire, FK `District`)
- Ajout de `communeId String?` (optionnel, FK `Commune`) — la commune est la granularité la plus fine et la plus susceptible de ne pas être trouvée en bordure de frontière ; son absence ne bloque pas la création du panneau.

`Region.code` : les 23 valeurs fixes de la section 1, seedées une fois, non modifiables via l'app.

## 5. Génération de la référence

Format : `{Region.code}-{sequence}` avec séquence sur 4 chiffres (`0001`, `0002`, …), comptée **par région** (remplace le comptage par ville actuel dans `generateReference()` / `src/lib/reference.ts`).

Exemple : 3e panneau créé dans la région Diana → `DIA-0003`.

District et commune ne participent pas au nom — uniquement des attributs de filtrage/affichage (voir section 7).

## 6. Flux de création / modification d'un panneau

1. L'utilisateur clique (ou clic droit) sur la carte pour positionner le panneau → `lat`/`lng` comme aujourd'hui.
2. À la soumission (`POST /api/billboards`), le serveur détermine le **district** par recherche point-dans-polygone contre les 119 zones ADM2 chargées en mémoire, puis en déduit la **région** via le lien `district.regionId` calculé au seed (section 3). La **commune** est déterminée indépendamment par la même recherche contre les zones ADM3.
3. **Cas nominal :** district trouvé → région automatiquement connue, le panneau est créé, la référence générée automatiquement. Commune trouvée ou non, sans incidence.
4. **Cas d'échec (district introuvable — points en mer, imprécision de frontière) :** le serveur renvoie une erreur explicite. Le formulaire affiche alors des menus déroulants pour sélectionner manuellement la région (parmi les 23 fixes) puis le district (liste filtrée par la région choisie), et l'utilisateur peut resoumettre avec ces valeurs explicites.
5. **Modification des coordonnées d'un panneau existant (`PATCH`) :** si `lat`/`lng` changent, district/région/commune sont recalculés selon la même logique (même comportement qu'à la création). La référence, elle, n'est jamais régénérée après création (cohérent avec le comportement actuel où l'édition de `city` ne touchait pas la référence).

Le calcul point-dans-polygone est fait **uniquement côté serveur** (pas de duplication de la logique ni des données géographiques côté client) — le flux de correction manuelle (étape 4) est un aller-retour explicite avec le serveur, pas une pré-validation côté navigateur.

## 7. Impact sur le reste de l'application

Tout usage de `city` est remplacé par région/district/commune :

- **Formulaire d'ajout/édition** (`src/components/billboard/BillboardForm.tsx`) : suppression du champ Ville, ajout de l'affichage région/district (lecture seule, calculé automatiquement) + le repli manuel décrit en section 6.
- **Filtres** (`src/components/table/FilterBar.tsx`) : filtre par région, district et commune à la place du filtre ville.
- **Tableau et fiche panneau** (`src/components/table/BillboardTable.tsx`, `src/components/billboard/BillboardDrawer.tsx`) : affichage région/district/commune à la place de ville.
- **Exports PDF** (`ParkFullPdf.tsx`, `ParkSummaryPdf.tsx`, `BillboardPdfDocument.tsx`) : idem.
- **Approbations** (`EDIT_BILLBOARD` payload) : les champs `regionId`/`districtId`/`communeId` remplacent `city` dans le payload JSON stocké et rejoué à l'approbation.
- **Réglages** : la page `/settings/city-prefixes` est supprimée. Une nouvelle page en lecture seule liste les 23 régions et leur code (pas d'édition possible).

## 8. Migration des données existantes

Script ponctuel (`scripts/`, suivant le pattern de `scripts/import-billboards.ts`) qui, pour chaque panneau existant :
1. Recalcule district/région/commune à partir de `lat`/`lng` (même logique point-dans-polygone que la création).
2. Génère la nouvelle référence (`CODE_REGION-0000`), en respectant l'ordre chronologique existant (`createdAt`) pour la numérotation par région.
3. Écrit le résultat en base.

Les données `city` et la table `CityPrefix` sont supprimées après migration. Les panneaux dont les coordonnées ne matchent aucun district devront être corrigés manuellement après migration (liste des cas en échec affichée en sortie du script).

## Hors périmètre

- Toute édition des régions ou de leurs codes via l'app (liste fixe, en lecture seule).
- Réglage manuel de préfixe pour district ou commune (non utilisés dans la référence).
