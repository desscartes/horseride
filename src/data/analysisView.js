export function orderAnalysisHorses(horses, prediction) {
  const byName = new Map(horses.map((horse) => [horse.name, horse]))
  const picked = (prediction?.picks || []).filter((pick) => byName.has(pick.horseName))
  const names = new Set(picked.map((pick) => pick.horseName))
  return [
    ...picked.map((pick, index) => ({ ...byName.get(pick.horseName), aiRank: index + 1, aiReason: pick.reason })),
    ...horses.filter((horse) => !names.has(horse.name)).map((horse) => ({ ...horse, aiRank: null })),
  ].map((horse, index) => ({ ...horse, rank: index + 1 }))
}

export function findRacePrediction(predictions, race) {
  return predictions?.find((item) => item.city === race.city && Number(item.raceNo) === Number(race.no)) || null
}
