import type { ApprovalType } from '@prisma/client'

// Shared between the API (notification messages) and the admin UI
// (ApprovalQueue) — keep this file free of server-only imports.
export const APPROVAL_LABELS: Record<ApprovalType, string> = {
  CREATE_OCCUPANCY: 'Créer un contrat',
  EDIT_OCCUPANCY: 'Modifier un contrat',
  DELETE_BILLBOARD: 'Supprimer un panneau',
  DELETE_CLIENT: 'Supprimer un client',
  EDIT_BILLBOARD: 'Modifier un panneau',
  EDIT_CLIENT: 'Modifier un client',
  DELETE_PHOTO: 'Supprimer une photo',
}
