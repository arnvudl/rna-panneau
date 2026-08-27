# Multi-photo, Permissions USER, Export PDF du parc

## 1. Multi-photo

### Modèle de données

Nouveau modèle `BillboardPhoto`:

```prisma
model BillboardPhoto {
  id          String    @id @default(cuid())
  billboardId String
  filename    String    @unique
  createdAt   DateTime  @default(now())

  billboard Billboard @relation(fields: [billboardId], references: [id], onDelete: Cascade)

  @@index([billboardId])
}
```

Suppression du champ `currentPhotoUrl` de `Billboard`. Ajout de la relation `photos BillboardPhoto[]`.

### Stockage

- Fichiers stockés dans un volume Docker monté sur `/app/uploads/photos/`
- Nom de fichier : `{cuid}.{ext}` (pas de collision, pas d'info sensible)
- Servis via `GET /api/uploads/[filename]` (lecture du fichier + Content-Type)

### API

- `POST /api/billboards/[id]/photos` — upload multipart (un fichier), tout rôle authentifié peut ajouter
- `DELETE /api/billboards/[id]/photos/[photoId]` — USER → approbation (`DELETE_PHOTO`), ADMIN/DEV → suppression directe (fichier + row)

### UI (page détail panneau)

- Grille de photos (remplace l'image unique actuelle)
- Bouton "Ajouter une photo" avec `<input type="file" accept="image/*">`
- Bouton supprimer (×) par photo, visible pour tous mais USER passe par approbation
- État vide inchangé (icône ImageOff + "Aucune photo")

## 2. Permissions USER

### Règle

USER peut **créer** (panneaux, photos). Ne peut jamais **modifier** ni **supprimer** directement — tout passe par approbation.

### Changements par route

| Route | Avant | Après |
|---|---|---|
| `POST /api/billboards` | 403 | direct |
| `PATCH /api/billboards/[id]` (damaged, note, etc.) | direct pour champs non-restreints | approbation (`EDIT_BILLBOARD`) |
| `DELETE /api/billboards/[id]` | approbation | inchangé |
| `POST /api/billboards/[id]/photos` | n'existe pas | direct |
| `DELETE /api/billboards/[id]/photos/[photoId]` | n'existe pas | approbation (`DELETE_PHOTO`) |
| `POST /api/clients` | 403 | 403 (inchangé) |
| `PATCH /api/clients/[id]` | 403 | approbation (`EDIT_CLIENT`) |
| `DELETE /api/clients/[id]` | approbation | inchangé |
| `POST /api/occupancies` | approbation | inchangé |
| `PATCH /api/occupancies/[id]` | approbation | inchangé |

### Nouveaux ApprovalType

```prisma
enum ApprovalType {
  CREATE_OCCUPANCY
  EDIT_OCCUPANCY
  DELETE_BILLBOARD
  DELETE_CLIENT
  EDIT_BILLBOARD    // nouveau
  EDIT_CLIENT       // nouveau
  DELETE_PHOTO      // nouveau
}
```

### Payload des nouvelles approbations

- `EDIT_BILLBOARD`: `{ billboardId: string, ...fieldsToUpdate }`
- `EDIT_CLIENT`: `{ clientId: string, ...fieldsToUpdate }`
- `DELETE_PHOTO`: `{ photoId: string, billboardId: string }`

### Application côté ApprovalRequest

`applyApproval` dans `src/app/api/approvals/[id]/route.ts` gère les 3 nouveaux types :
- `EDIT_BILLBOARD` : `prisma.billboard.update()`
- `EDIT_CLIENT` : `prisma.client.update()`
- `DELETE_PHOTO` : supprime le fichier du disque + `prisma.billboardPhoto.delete()`

## 3. Export PDF du parc

### API

`GET /api/billboards/pdf?mode=summary|full` — accepte les mêmes query params de filtre que `GET /api/billboards` (status, city, dimension, damaged, clientId).

### Modes

- **summary** : tableau récapitulatif (identifiant, ville, dimension, statut, client actif, taxe communale). Paginé A4 paysage.
- **full** : une page A4 portrait par panneau avec première photo + tous les détails (comme le PDF individuel existant).

### UI

Bouton "Exporter PDF" sur la page `/billboards` avec menu déroulant :
- "Récapitulatif (tableau)"
- "Détaillé (une page par panneau)"

Les filtres actifs dans la FilterBar s'appliquent à l'export.

### Composants React-PDF

- `ParkSummaryPdf` — tableau multi-colonnes
- `ParkFullPdf` — réutilise la structure de `BillboardPdfDocument` en boucle sur tous les panneaux
