# Inventaire, permissions USER, export Excel — Design

**Goal:** Une série d'améliorations indépendantes identifiées par l'utilisateur : compteur de panneaux, suppression unitaire/en masse, comparatif avant/après sur les approbations, permissions USER strictes et lisibles, export Excel, et deux corrections sur la page Clients.

**Architecture:** Chaque point ci-dessous est une modification ciblée sur l'existant — pas de nouveau sous-système partagé, à l'exception d'un helper de permissions centralisé (section 4) qui remplace les vérifications `role !== 'USER'` dispersées dans le code.

**Tech Stack:** Next.js 14 (App Router, API routes), Prisma/PostgreSQL, `exceljs` (nouvelle dépendance, export .xlsx).

---

## 1. Compteur de panneaux sur l'Inventaire

Sur `/database`, à côté du titre "Base de données", afficher le nombre de panneaux **après application des filtres actifs** (pas le total global). Recalculé côté client à partir de `billboards.length` (le hook `useBillboards` a déjà les données filtrées) — aucun appel API supplémentaire nécessaire.

Exemple : "134 panneaux". Le nombre affiché reflète toujours le filtre courant (134 sur un total de 1247 si un filtre réduit la liste, 1247 si aucun filtre n'est actif).

## 2. Suppression de panneaux (unitaire et en masse)

**Constat :** l'API `DELETE /api/billboards/[id]` existe déjà (avec passage en demande d'approbation pour un USER), mais aucun bouton ne l'appelle dans l'interface aujourd'hui.

**Ajouts :**
- Sur la fiche panneau (`BillboardDrawer` ou page `/billboards/[id]`) : un bouton "Supprimer" (visible seulement si l'utilisateur a le droit d'au moins déclencher l'action — voir section 4), avec confirmation avant envoi.
- Sur le tableau de l'Inventaire (`BillboardTable`) : une colonne de cases à cocher permettant de sélectionner plusieurs panneaux, avec un bouton "Supprimer la sélection (n)" qui apparaît dès qu'au moins une ligne est cochée.
- La suppression en masse envoie une requête `DELETE` par panneau sélectionné (pas de nouvel endpoint bulk côté serveur — réutilise l'API existante panneau par panneau). Pour un USER, chaque suppression devient une demande d'approbation individuelle (comportement actuel de l'API, inchangé) ; un résumé du type "3 demandes de suppression envoyées" s'affiche après coup.

**Suppression de préfixe :** retirée de la demande initiale — n'a plus de sens puisque les régions deviennent une liste fixe non éditable (voir `2026-09-07-region-district-naming-design.md`).

## 3. Comparatif avant/après sur les demandes d'approbation

**Constat :** `ApprovalQueue` affiche aujourd'hui uniquement les valeurs proposées (`payload`), sans montrer l'état actuel de l'entité concernée — impossible de voir en un coup d'œil ce qui change.

**Changement API (`GET /api/approvals`) :** pour les types `EDIT_BILLBOARD`, `EDIT_OCCUPANCY` et `EDIT_CLIENT`, charger en plus l'état actuel de l'entité ciblée (billboard / occupancy / client, selon l'id présent dans le payload) et l'exposer sous une clé `before` à côté de `payload` (qui devient implicitement le "after"). Pour les types de création/suppression (`CREATE_OCCUPANCY`, `DELETE_*`, `DELETE_PHOTO`), pas de `before` à calculer — l'affichage reste tel quel (proposition simple, ou état à supprimer affiché comme aujourd'hui).

**Changement UI (`ApprovalQueue`) :** pour une demande avec un `before`, afficher pour chaque champ modifié une ligne "Champ : ancienne valeur → nouvelle valeur" (uniquement les champs qui diffèrent réellement entre `before` et `payload`, pas la liste complète) plutôt que la simple liste actuelle de `payload`.

## 4. Permissions USER strictes et lisibles

**Problème actuel :** les vérifications de rôle (`role !== 'USER'`) sont dispersées dans une douzaine de fichiers, avec des comportements inconsistants — certaines actions sont interdites (403 sec), d'autres redirigées vers une demande d'approbation, sans que l'interface distingue clairement les deux cas ni prévienne l'utilisateur avant qu'il agisse.

**Nouveau modèle, centralisé dans `src/lib/permissions.ts` :** pour chaque action (`create_client`, `edit_billboard`, `delete_billboard`, `edit_client`, `delete_client`, etc.), une fonction retourne un statut à trois valeurs selon le rôle :
- `'allowed'` — l'utilisateur agit directement (ADMIN/DEV pour la plupart des actions).
- `'requires_approval'` — l'action est visible et cliquable, mais avant l'envoi un message explicite s'affiche : *"Vous n'êtes pas autorisé à faire cette action directement, une demande d'approbation sera envoyée à l'Admin."* (toast ou confirmation avant soumission, pas seulement après comme aujourd'hui).
- `'forbidden'` — l'action n'existe pas dans l'interface pour ce rôle : le bouton n'est simplement pas affiché.

**Migration :** les composants et routes API listés dans la recherche (`Nav.tsx`, `NotificationBell.tsx`, `ClientsPage`, tous les fichiers `route.ts` sous `api/`) sont progressivement basculés sur ce helper partagé au lieu de leur propre test `role !== 'USER'` inline, pour garantir la cohérence entre ce que l'UI montre et ce que l'API accepte.

**Non couvert ici :** la définition exacte de quelle action est `allowed`/`requires_approval`/`forbidden` pour le rôle USER reprend les règles déjà en place aujourd'hui (ex: créer un panneau = allowed, créer un client = forbidden, modifier/supprimer un panneau = requires_approval) — ce point ne change **pas** les règles métier existantes, seulement leur clarté et leur cohérence dans l'interface.

## 5. Export Excel de la base

Ajout d'une option "Export Excel" dans le menu déroulant existant à côté de "Export PDF" (`ExportParkPdfButton`, ou un composant sœur dédié) sur `/database`. **Le PDF est conservé** — l'Excel vient en complément, pas en remplacement.

- Nouvelle route `GET /api/billboards/xlsx` (même filtre en query params que `/api/billboards/pdf`), qui génère un fichier `.xlsx` avec `exceljs` : une feuille listant les panneaux filtrés avec leurs colonnes principales (référence, région, district, commune, dimension, faces, statut, client(s) actif(s), dates de contrat, notes).
- Téléchargement direct (pas d'ouverture dans un nouvel onglet comme le PDF — un fichier Excel n'a pas de rendu navigateur utile).

## 6. Page Clients : défilement cassé

**Bug :** `/clients` (`src/app/clients/page.tsx`) utilise un conteneur à hauteur fixe (`h-[calc(100vh-56px)]`) mais sans `overflow-auto` sur la zone de liste — contrairement à `/database` qui a résolu ce problème avec un conteneur scrollable dédié. Résultat : une longue liste de clients pousse toute la page au lieu de défiler dans son propre cadre, ce qui produit des rendus étranges (pied de page qui semble apparaître au milieu du contenu).

**Fix :** appliquer le même pattern que `/database` — le conteneur de la liste (`<ul>` et son wrapper) reçoit `overflow-y-auto` avec une hauteur contrainte, la recherche (`Input`) reste fixe en haut, la page ne grandit plus au-delà du viewport.

## 7. Lien "Voir photo" depuis l'historique des contrats d'un client

Sur la fiche client (`/clients/[id]`), chaque ligne de l'historique des contrats affiche aujourd'hui la référence du panneau et les infos de contrat, sans accès direct à ses photos. Ajout d'un lien/bouton "Voir photo" sur chaque ligne qui ouvre la galerie de photos du panneau concerné (réutilise le composant `PhotoGallery` existant, dans une modale/dialog plutôt qu'une navigation complète vers `/billboards/[id]`, pour rester sur la fiche client).

## Hors périmètre

- Redéfinition des règles métier de permissions par rôle (section 4 ne fait que centraliser et clarifier l'existant).
- Suppression en masse via un seul appel API bulk (reste panneau par panneau, réutilisant l'endpoint existant).
- Filtres/tri sur l'export Excel au-delà de ceux déjà appliqués dans l'Inventaire au moment de l'export.
