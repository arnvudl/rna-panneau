import { describe, it, expect } from 'vitest'
import { getPermission } from './permissions'

describe('getPermission', () => {
  it('allows DEV and ADMIN to do everything', () => {
    for (const role of ['DEV', 'ADMIN']) {
      expect(getPermission(role, 'delete_client')).toBe('allowed')
      expect(getPermission(role, 'create_client')).toBe('allowed')
      expect(getPermission(role, 'view_approvals')).toBe('allowed')
    }
  })

  it('routes USER edits/deletes through approval', () => {
    expect(getPermission('USER', 'edit_billboard')).toBe('requires_approval')
    expect(getPermission('USER', 'delete_billboard')).toBe('requires_approval')
    expect(getPermission('USER', 'edit_client')).toBe('requires_approval')
    expect(getPermission('USER', 'delete_client')).toBe('requires_approval')
    expect(getPermission('USER', 'create_occupancy')).toBe('requires_approval')
    expect(getPermission('USER', 'edit_occupancy')).toBe('requires_approval')
    expect(getPermission('USER', 'delete_photo')).toBe('requires_approval')
  })

  it('forbids USER from client creation, approvals, and notification management', () => {
    expect(getPermission('USER', 'create_client')).toBe('forbidden')
    expect(getPermission('USER', 'view_approvals')).toBe('forbidden')
    expect(getPermission('USER', 'manage_notifications')).toBe('forbidden')
    expect(getPermission('USER', 'view_settings')).toBe('forbidden')
  })

  it('allows USER to create billboards and photos directly', () => {
    expect(getPermission('USER', 'create_billboard')).toBe('allowed')
    expect(getPermission('USER', 'create_photo')).toBe('allowed')
  })
})
