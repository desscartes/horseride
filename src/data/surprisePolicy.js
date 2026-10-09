// AGF affects only the surprise label, never the trained ranking or normal picks.
export function surpriseCandidates(race, picks = []) {
  const horses = race?.horses || []
  if (horses.length < 3 || !horses.every(h => typeof h.marketShare === 'number' && Number.isFinite(h.marketShare) && h.marketShare >= 0)) return []
  const shares = horses.map(h => h.marketShare).sort((a,b) => b-a)
  if (shares[0] <= 0) return []
  const main = new Set(picks.slice(0,2).map(p => typeof p === 'string' ? p : p.horseName))
  // Exclude everyone tied with the second favorite, rather than breaking a tie by number.
  return horses.filter(h => h.marketShare < shares[1] && !main.has(h.name)).map(h => h.name)
}
export function validSurprise(race, prediction) {
  const surprise = prediction?.surprise
  return surprise && surpriseCandidates(race,prediction.picks).includes(surprise.horseName) ? surprise : null
}
