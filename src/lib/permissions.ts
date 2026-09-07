export type PermissionStatus = 'allowed' | 'requires_approval' | 'forbidden'

export type PermissionAction =
  | 'create_billboard'
  | 'edit_billboard'
  | 'delete_billboard'
  | 'create_client'
  | 'edit_client'
  | 'delete_client'
  | 'create_occupancy'
  | 'edit_occupancy'
  | 'create_photo'
  | 'delete_photo'
  | 'view_approvals'
  | 'manage_notifications'
  | 'view_settings'

// Actions a USER can request but not perform directly — the API turns these
// into an ApprovalRequest instead of applying them.
const REQUIRES_APPROVAL_FOR_USER = new Set<PermissionAction>([
  'edit_billboard',
  'delete_billboard',
  'edit_client',
  'delete_client',
  'create_occupancy',
  'edit_occupancy',
  'delete_photo',
])

// Actions a USER cannot perform or request at all.
const FORBIDDEN_FOR_USER = new Set<PermissionAction>([
  'create_client',
  'view_approvals',
  'manage_notifications',
  'view_settings',
])

/**
 * Central answer to "can this role do this action?" — DEV/ADMIN can always
 * act directly. USER gets 'requires_approval' (visible, but routed through
 * an ApprovalRequest) or 'forbidden' (not shown at all) per the two lists
 * above; anything not listed defaults to 'allowed' for USER too (e.g.
 * creating a billboard or a photo).
 */
export function getPermission(role: string, action: PermissionAction): PermissionStatus {
  if (role !== 'USER') return 'allowed'
  if (FORBIDDEN_FOR_USER.has(action)) return 'forbidden'
  if (REQUIRES_APPROVAL_FOR_USER.has(action)) return 'requires_approval'
  return 'allowed'
}

export const APPROVAL_WARNING_MESSAGE =
  "Vous n'êtes pas autorisé à faire cette action directement, une demande d'approbation sera envoyée à l'Admin."
