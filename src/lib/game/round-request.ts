// Older open tabs omit the ID; updated clients bind delayed actions to their original round.
export function matchesRequestedRound(requested: unknown, active: string | null) {
  return requested === undefined || (typeof requested === 'string' && requested === active)
}
