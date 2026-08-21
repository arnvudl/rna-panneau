import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export async function requireRole(roles: ('DEV' | 'ADMIN' | 'USER')[]) {
  const session = await auth()
  if (!session || !roles.includes(session.user.role)) {
    redirect('/map')
  }
  return session
}
