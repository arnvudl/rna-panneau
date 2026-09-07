# Référence panneau par Région/District — Design

**Goal:** Remplacer le champ `city` (texte libre) et le système de préfixe par ville par une détection 100% automatique de la région, du district et de la commune d'un panneau à partir de ses coordonnées GPS, et générer sa référence sous la forme `PREFIXE_REGION-0000`.

**Architecture:** Trois nouvelles tables de référence (`Region`, `District`, `Commune`) seedées une fois depuis les frontières administratives officielles de Madagascar (geoBoundaries, niveaux ADM1/ADM2/ADM3). À la création ou à la modification des coordonnées d'un panneau, le serveur détermine la région/district/commune par recherche point-dans-polygone. La référence n'utilise que le préfixe de région + une séquence ; district et commune ne servent qu'à l'affichage et au filtrage.

**Tech Stack:** Next.js 14 (API routes), Prisma/PostgreSQL, Turf.js (`@turf/boolean-point-in-polygon`) pour la géométrie, données geoBoundaries (licence CC-BY 3.0 IGO).

---

## 1. Source de données géographiques

[geoBoundaries](https://www.geoboundaries.org) fournit les frontières administratives de Madagascar en GeoJSON, avec un nom (`shapeName`) déjà renseigné sur chaque entité — aucune saisie manuelle de notre part pour les noms :

- **ADM1 (région)** — 22 entités. URL : `https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/{commit}/releaseData/gbOpen/MDG/ADM1/geoBoundaries-MDG-ADM1.geojson`
- **ADM2 (district)** — 119 entités, même schéma d'URL avec `/ADM2/`
- **ADM3 (commune)** — même schéma d'URL avec `/ADM3/`, volume nettement plus élevé (non compté précisément, de l'ordre de plusieurs centaines à ~1600)

**Écart connu avec la liste officielle à 23 régions :** geoBoundaries fusionne Vatovavy et Fitovinany en une seule région ("Vatovavy-Fitovinany"), et nomme une région "Matsiatra Ambony" (malgache) au lieu de "Haute Matsiatra" (français). Décision validée : on accepte les 22 régions telles quelles, avec un renommage statique "Matsiatra Ambony" → "Haute Matsiatra" au moment du seed.

**Liens parent-enfant absents des données.** Ni ADM2 ni ADM3 ne référencent leur région/district parent — ce lien est calculé une fois, au moment du seed, par test géométrique (centroïde du district/de la commune contenu dans le polygone du parent).

**Aucune donnée géographique n'est envoyée au navigateur.** Les fichiers GeoJSON sont utilisés uniquement côté serveur (seed + recherche point-dans-polygone à la création d'un panneau), donc leur volume (potentiellement plusieurs dizaines de Mo pour l'ADM3 brut) n'a pas d'impact sur le chargement de l'app. Une simplification (réduction du nombre de sommets, via `@turf/simplify` ou `mapshaper`) est appliquée au moment de l'ingestion si les fichiers bruts s'avèrent trop volumineux à charger en mémoire au démarrage du serveur.

## 2. Modèle de données

```prisma
model Region {
  id       String    @id @default(cuid())
  name     String    @unique
  prefix   String    @unique
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
- Ajout de `regionId String` (obligatoire, FK `Region`)
- Ajout de `districtId String` (obligatoire, FK `District`)
- Ajout de `communeId String?` (optionnel, FK `Commune`) — la commune est la granularité la plus fine et la plus susceptible de ne pas être trouvée en bordure de frontière ; son absence ne bloque pas la création du panneau.

**Préfixes** (`Region.prefix` uniquement — district et commune n'ont pas de préfixe, ils ne sont pas utilisés dans la référence) :
- Règle de génération par défaut : 3 dernières lettres du nom, en majuscules, caractères non-alphabétiques ignorés (ex: "Amoron'i Mania" → "NIA").
- En cas de collision entre deux régions (rare vu qu'il n'y en a que 22, mais possible), extension automatique à 4 lettres pour départager.
- Modifiable ensuite manuellement via Réglages (voir section 5).

## 3. Génération de la référence

Format : `{Region.prefix}-{sequence}` avec séquence sur 4 chiffres (`0001`, `0002`, …), comptée **par région** (remplace le comptage par ville actuel dans `generateReference()` / `src/lib/reference.ts`).

Exemple : 3e panneau créé dans la région Diana → `DIA-0003`.

District et commune ne participent plus au nom, contrairement aux échanges initiaux de ce brainstorm — ils restent uniquement des attributs de filtrage/affichage (voir section 6).

## 4. Flux de création / modification d'un panneau

1. L'utilisateur clique (ou clic droit) sur la carte pour positionner le panneau → `lat`/`lng` comme aujourd'hui.
2. À la soumission (`POST /api/billboards`), le serveur calcule région + district + commune par recherche point-dans-polygone contre les trois jeux de frontières chargés en mémoire (ADM1 → ADM2 → ADM3, indépendamment les uns des autres, chaque jeu couvrant l'intégralité de Madagascar).
3. **Cas nominal :** région et district trouvés → le panneau est créé, la référence générée automatiquement. Commune trouvée ou non, sans incidence.
4. **Cas d'échec (région ou district introuvable — points en mer, imprécision de frontière) :** le serveur renvoie une erreur explicite. Le formulaire affiche alors des menus déroulants pour sélectionner manuellement la région puis le district (liste filtrée par la région choisie), et l'utilisateur peut resoumettre avec ces valeurs explicites.
5. **Modification des coordonnées d'un panneau existant (`PATCH`) :** si `lat`/`lng` changent, région/district/commune sont recalculés selon la même logique (même comportement qu'à la création). La référence, elle, n'est jamais régénérée après création (cohérent avec le comportement actuel où l'édition de `city` ne touchait pas la référence).

Le calcul point-dans-polygone est fait **uniquement côté serveur** (pas de duplication de la logique ni des données géographiques côté client) — le flux de correction manuelle (étape 4) est un aller-retour explicite avec le serveur, pas une pré-validation côté navigateur.

## 5. Réglages

La page `/settings/city-prefixes` est remplacée par une page listant les 22 régions et leur préfixe (auto-généré au seed), modifiable par un ADMIN/DEV — même pattern d'édition que l'actuelle page (liste + input par ligne, sauvegarde au blur). Pas de gestion de préfixe pour district/commune (non utilisés dans la référence).

## 6. Impact sur le reste de l'application

Tout usage de `city` est remplacé par région/district/commune :

- **Formulaire d'ajout/édition** (`src/components/billboard/BillboardForm.tsx`) : suppression du champ Ville, ajout de l'affichage région/district (lecture seule, calculé automatiquement) + le repli manuel décrit en section 4.
- **Filtres** (`src/components/table/FilterBar.tsx`) : filtre par région, district et commune à la place du filtre ville.
- **Tableau et fiche panneau** (`src/components/table/BillboardTable.tsx`, `src/components/billboard/BillboardDrawer.tsx`) : affichage région/district/commune à la place de ville.
- **Exports PDF** (`ParkFullPdf.tsx`, `ParkSummaryPdf.tsx`, `BillboardPdfDocument.tsx`) : idem.
- **Approbations** (`EDIT_BILLBOARD` payload) : les champs `regionId`/`districtId`/`communeId` remplacent `city` dans le payload JSON stocké et rejoué à l'approbation.

## 7. Migration des données existantes

Script ponctuel (`scripts/`, suivant le pattern de `scripts/import-billboards.ts`) qui, pour chaque panneau existant :
1. Recalcule région/district/commune à partir de `lat`/`lng` (même logique point-dans-polygone que la création).
2. Génère la nouvelle référence (`PREFIXE_REGION-0000`), en respectant l'ordre chronologique existant (`createdAt`) pour la numérotation par région.
3. Écrit le résultat en base.

Les données `city` et la table `CityPrefix` sont supprimées après migration. Les panneaux dont les coordonnées ne matchent aucune région/district devront être corrigés manuellement après migration (liste des cas en échec affichée en sortie du script).

## Hors périmètre

- Réglage manuel de préfixe pour district ou commune (non utilisés dans la référence).
- Support d'une 23e région distincte (Vatovavy/Fitovinany reste fusionnée).
- Détection automatique du "type de zone" (urbain/rural) au-delà de la simple présence/absence de commune.
