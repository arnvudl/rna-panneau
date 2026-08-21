const CITY_CODES: Record<string, string> = {
  Antananarivo: 'TNR',
  Toamasina: 'TOA',
  Fianarantsoa: 'FIA',
  Mahajanga: 'MJN',
  Toliara: 'TLE',
  Antsiranana: 'DIE',
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
  const padded = String(sequence).padStart(3, '0')
  return `ANM ${padded} ${cityCode(city)}`
}
