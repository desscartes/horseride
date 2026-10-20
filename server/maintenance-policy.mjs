export function localDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const value = name => parts.find(p => p.type === name).value
  return `${value('year')}-${value('month')}-${value('day')}`
}
export function shiftDay(day, offset) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + offset * 86400000).toISOString().slice(0,10)
}
export function collectionDates(today, lastDate) {
  const first = lastDate && lastDate < today ? (shiftDay(lastDate, 1) > shiftDay(today, -7) ? shiftDay(lastDate, 1) : shiftDay(today, -7)) : shiftDay(today, -3)
  const days = new Set()
  for (let day = first; day < today; day = shiftDay(day, 1)) days.add(day)
  // Revisit recent days because foreign meetings can finish after midnight.
  for (let i = 1; i <= 3; i++) days.add(shiftDay(today, -i))
  return [...days].sort()
}
export function promotionAllowed(report) {
  const e = report.evaluation,proof=report.prospectiveEvidence
  if(report.fullRuntimeFeatureParity!==true||report.evaluationRole!=='prospective_prestart_paired'||!proof||proof.method!==report.method||proof.pairedPrestartVerified!==true||!/^([a-f0-9]{64})$/.test(report.verifiedArtifactSha256||'')||proof.modelSha256!==report.verifiedArtifactSha256)return false
  return Boolean(e && e.races >= 300 && e.days >= 21 && e.testFrom > e.candidateTrainedThrough && e.testFrom > e.incumbentTrainedThrough
    && e.improvementPoints >= 2 && e.dayBootstrap95?.[0] > 0
    && e.candidate.brier < e.incumbent.brier && e.candidate.winnerInTopThree >= e.incumbent.winnerInTopThree)
}
