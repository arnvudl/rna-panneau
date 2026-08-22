export function formatContactInfo(phone: string | null, email: string | null): string {
  return [phone, email].filter(Boolean).join(' · ') || '—'
}
