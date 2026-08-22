export type ContractFace = 'FACE_1' | 'FACE_2' | 'BOTH'

/** True if `requestedFace` does not overlap any already-active face. */
export function isFaceAvailable(
  requestedFace: ContractFace,
  activeContracts: { face: ContractFace }[]
): boolean {
  if (activeContracts.some((c) => c.face === 'BOTH')) return false
  if (requestedFace === 'BOTH') return activeContracts.length === 0
  return !activeContracts.some((c) => c.face === requestedFace)
}
