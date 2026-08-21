const CITY_CODES: Record<string, string> = {
  Antananarivo: 'TNR',
  Toamasina: 'TOA',
  Fianarantsoa: 'FIA',
  Mahajanga: 'MJN',
  Toliara: 'TLE',
  Antsiranda: 'DIE',
}

export function cityCode(city: string): string {
  return CITY_CODES[city] ?? city.slice(0, 3).toUpperCase()
}

export function generateReference({
  sequence,
  city,
}: {
  sequence: number
  city: string
}): string {
  const padded = sequence < 1000 ? String(sequence).padStart(3, '0') : String(sequence)
  return `ANM ${padded} ${cityCode(city)}`
}
