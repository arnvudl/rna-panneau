export function generateReference({
  sequence,
  regionCode,
}: {
  sequence: number
  regionCode: string
}): string {
  const padded = String(sequence).padStart(4, '0')
  return `${regionCode}-${padded}`
}

// Contrat.numero is required + unique. When the user leaves it blank we
// auto-generate one server-side — timestamp-based (with a short random
// suffix to avoid collisions on near-simultaneous requests) since there is
// no sequential numbering scheme for contrats yet.
export function generateContratNumero(): string {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `CT-${Date.now()}-${random}`
}
