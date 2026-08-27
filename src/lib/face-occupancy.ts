export type OccupancyFace = 'FACE_1' | 'FACE_2' | 'BOTH'

/** True if `requestedFace` does not overlap any already-active face. */
export function isFaceAvailable(
  requestedFace: OccupancyFace,
  activeOccupancies: { face: OccupancyFace }[]
): boolean {
  if (activeOccupancies.some((o) => o.face === 'BOTH')) return false
  if (requestedFace === 'BOTH') return activeOccupancies.length === 0
  return !activeOccupancies.some((o) => o.face === requestedFace)
}
