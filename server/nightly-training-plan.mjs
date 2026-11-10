const countryByWeekday = [null, 'TR', 'US', 'GB', 'FR', 'ZA', 'AU']

export function nightlyTrainingPlan(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day + 'T12:00:00Z'))) throw Error('Invalid training day')
  const weekday = new Date(day + 'T12:00:00Z').getUTCDay()
  const sundayCycle = Math.floor(Date.parse(day + 'T12:00:00Z') / (7 * 86400000)) % 2
  return {
    dailyCandidates: ['TR', 'US'],
    intelligenceCountry: countryByWeekday[weekday],
    pedigreeExperiment: weekday === 0 && sundayCycle === 0,
    overseasExperiment: weekday === 0 && sundayCycle === 1,
  }
}
