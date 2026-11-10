export function meetingHighlight(facts) {
  const candidates = (facts?.races ?? [])
    .filter(race => Number.isFinite(race.leadMargin) && race.leadMargin > 0 && race.horses?.length >= 2)
    .map(race => ({ race, note: race.horses[0].lastRun || race.horses[0].workout || null }))
    .filter(item => item.note)
    .sort((a, b) => b.race.leadMargin - a.race.leadMargin || a.race.raceNo - b.race.raceNo)
  if (!candidates.length) return null
  const { race, note } = candidates[0]
  const first = race.horses[0], second = race.horses[1]
  return `Model yorumu: ${race.raceNo}. koşuda ilk sıradaki ${first.name} ile ikinci ${second.name} arasındaki puan farkı, bu gönderideki koşuların en yükseği. ${note}`
}
