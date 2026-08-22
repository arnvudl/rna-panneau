export function resolveCityPrefix(city: string, prefixes: { city: string; prefix: string }[]): string {
  const match = prefixes.find((p) => p.city.toLowerCase() === city.toLowerCase())
  return match ? match.prefix : city.slice(0, 3).toUpperCase()
}

export function generateReference({
  sequence,
  city,
  prefixes,
}: {
  sequence: number
  city: string
  prefixes: { city: string; prefix: string }[]
}): string {
  const padded = String(sequence).padStart(3, '0')
  return `ANM ${padded} ${resolveCityPrefix(city, prefixes)}`
}
