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
