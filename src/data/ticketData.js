const legMarkets = [
  { id: '3li', label: '3’lü Ganyan', legCount: 3 },
  { id: '4lu', label: '4’lü Ganyan', legCount: 4 },
  { id: '5li', label: '5’li Ganyan', legCount: 5 },
  { id: '6li', label: '6’lı Ganyan', legCount: 6 },
  { id: 'cifte', label: 'Çifte', legCount: 2 },
]

function getPrediction(predictions, race) {
  return predictions.find((prediction) => prediction.city === race.city && Number(prediction.raceNo) === Number(race.no)) || null
}

function getTicketConfidence(predictions) {
  const levels = predictions.map((prediction) => prediction?.confidence || 'low')
  if (levels.every((level) => level === 'high')) return 'Yüksek'
  if (levels.some((level) => level === 'low')) return 'Düşük'
  return 'Orta'
}

export function buildTicketMarkets(races, predictions, selectedRace) {
  if (!selectedRace) return []

  const meetingRaces = races
    .filter((race) => race.city === selectedRace.city)
    .sort((left, right) => Number(left.no) - Number(right.no))
  const startIndex = meetingRaces.findIndex((race) => Number(race.no) === Number(selectedRace.no))

  const makeLegMarket = ({ id, label, legCount }) => {
    const selectedRaces = meetingRaces.slice(startIndex, startIndex + legCount)
    if (selectedRaces.length !== legCount || selectedRaces.some((race, index) => Number(race.no) !== Number(selectedRace.no) + index)) {
      return { id, label, available: false, reason: `Bu koşudan başlayarak ${legCount} ardışık koşu yok.` }
    }

    const legs = selectedRaces.map((race) => {
      const prediction = getPrediction(predictions, race)
      return prediction ? { raceNo: race.no, horseNames: prediction.picks.slice(0, 3).map((pick) => pick.horseName) } : null
    })
    if (legs.some((leg) => !leg?.horseNames.length)) {
      return { id, label, available: false, reason: 'Bu ayaklar için AI analizi henüz yok.' }
    }

    return {
      id,
      label,
      available: true,
      city: selectedRace.city,
      legs,
      combinations: legs.reduce((total, leg) => total * leg.horseNames.length, 1),
      confidence: getTicketConfidence(selectedRaces.map((race) => getPrediction(predictions, race))),
    }
  }

  const selectedPrediction = getPrediction(predictions, selectedRace)
  const rankedHorses = (selectedPrediction?.picks || []).slice(0, 5).map((pick) => pick.horseName)
  const exactaPairs = rankedHorses.flatMap((first, firstIndex) => rankedHorses
    .filter((_, secondIndex) => firstIndex !== secondIndex)
    .map((second) => [first, second]))
  const tableSelections = rankedHorses.slice(0, 4)
  const isOrderedTicketAvailable = rankedHorses.length >= 5

  return [
    ...legMarkets.map(makeLegMarket),
    {
      id: 'sirali-ikili',
      label: 'Sıralı İkili',
      available: exactaPairs.length > 0,
      reason: 'Bu koşu için en az iki AI adayı gerekli.',
      city: selectedRace.city,
      raceNo: selectedRace.no,
      candidates: rankedHorses,
      orderedPairs: exactaPairs,
      combinations: exactaPairs.length,
      confidence: selectedPrediction ? getTicketConfidence([selectedPrediction]) : 'Düşük',
    },
    {
      id: 'sirali-5li',
      label: 'Sıralı 5’li',
      available: isOrderedTicketAvailable,
      reason: 'Sıralı 5’li için beş AI adayı gerekli.',
      city: selectedRace.city,
      raceNo: selectedRace.no,
      candidates: rankedHorses,
      combinations: isOrderedTicketAvailable ? 1 : 0,
      confidence: selectedPrediction ? getTicketConfidence([selectedPrediction]) : 'Düşük',
    },
    {
      id: 'tabela',
      label: 'Tabela',
      available: isOrderedTicketAvailable,
      reason: 'Tabela için en az beş AI adayı gerekli.',
      city: selectedRace.city,
      raceNo: selectedRace.no,
      candidates: tableSelections,
      combinations: isOrderedTicketAvailable ? 1 : 0,
      confidence: selectedPrediction ? getTicketConfidence([selectedPrediction]) : 'Düşük',
    },
  ]
}

export const budgetBetTypes = [
  { id: '3li-ganyan', label: '3’lü Ganyan', unitPrice: 2, mode: 'legs', legCount: 3 },
  { id: '4lu-ganyan', label: '4’lü Ganyan', unitPrice: 1.75, mode: 'legs', legCount: 4 },
  { id: '5li-ganyan', label: '5’li Ganyan', unitPrice: 1.5, mode: 'legs', legCount: 5 },
  { id: '6li-ganyan', label: '6’lı Ganyan', unitPrice: 1.25, mode: 'legs', legCount: 6 },
]

export function getBudgetUnitPrice(market, city) {
  const domesticCities = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Adana', 'Kocaeli', 'Antalya', 'Diyarbakır', 'Elazığ', 'Şanlıurfa']
  const reducedSixLegPrice = ['Diyarbakır', 'Elazığ', 'Şanlıurfa'].includes(city) || !domesticCities.includes(city)
  return market.id === '6li-ganyan' && reducedSixLegPrice ? 1 : market.unitPrice
}

function getRunnerCandidates(race, prediction) {
  const validHorses = new Set((race?.horses || []).map((horse) => horse.name.toLocaleLowerCase('tr-TR')))
  const raceHorses = new Map((race?.horses || []).map((horse) => [horse.name.toLocaleLowerCase('tr-TR'), horse]))
  const rankedHorses = (prediction?.picks || [])
    .filter((pick) => validHorses.has(pick.horseName.toLocaleLowerCase('tr-TR')))
    .slice(0, 5)
    .map((pick, index) => {
      const raceHorse = raceHorses.get(pick.horseName.toLocaleLowerCase('tr-TR'))
      return { name: pick.horseName, number: raceHorse.no, rankWeight: 1 / (index + 1), modelWeight: Math.max(0, Number(raceHorse.probability ?? raceHorse.baselineProbability) || 0) / 100 }
    })
  const surpriseName = prediction?.surprise?.horseName
  const surpriseHorse = surpriseName ? raceHorses.get(surpriseName.toLocaleLowerCase('tr-TR')) : null
  if (surpriseHorse && !rankedHorses.some((horse) => horse.name === surpriseHorse.name)) rankedHorses.push({ name: surpriseHorse.name, number: surpriseHorse.no, rankWeight: 1 / 5, modelWeight:Math.max(0,Number(surpriseHorse.probability)||0)/100 })
  const totalRankWeight = rankedHorses.reduce((total, horse) => total + horse.rankWeight, 0)
  const horses = rankedHorses.map((horse) => ({
    name: horse.name,
    number: horse.number,
    isSurprise: Boolean(surpriseHorse && horse.number === surpriseHorse.no),
    weight: race.rankingSource==='local_trained_model' ? horse.modelWeight : totalRankWeight > 0
      ? 0.6 * (horse.rankWeight / totalRankWeight) + 0.4 * horse.modelWeight
      : horse.rankWeight / totalRankWeight,
  }))
  const totalWeight = horses.reduce((total, horse) => total + horse.weight, 0)
  return { horses, totalWeight }
}

function getCommentaryCandidates(race, commentary) {
  const horseScores = new Map()
  const comments = (commentary?.comments || []).filter((item) => Number(item.raceNo) === Number(race?.no))

  for (const comment of comments) {
    const authorKey = comment.editorId ?? comment.author
    for (const pick of comment.horses || []) {
      const number = Number(pick.number)
      const raceHorse = (race?.horses || []).find((horse) => Number(horse.no) === number)
      if (!raceHorse) continue
      const entry = horseScores.get(number) || { name: raceHorse.name, number, score: 0, authors: new Set() }
      if (entry.authors.has(authorKey)) continue
      entry.authors.add(authorKey)
      entry.score += 1 / Math.sqrt(Math.max(1, Number(pick.rank) || 1))
      horseScores.set(number, entry)
    }
  }

  const horses = [...horseScores.values()].sort((left, right) => right.score - left.score || left.number - right.number)
  const totalScore = horses.reduce((total, horse) => total + horse.score, 0)
  return {
    horses: horses.map((horse) => ({ name: horse.name, number: horse.number, weight: horse.score / totalScore, authorCount: horse.authors.size })),
    authorCount: new Set(comments.map((comment) => comment.editorId ?? comment.author)).size,
  }
}

function chooseCombinations(runnerCount, selectionSize, rule) {
  if (rule === 'pool') return runnerCount
  if (runnerCount < selectionSize) return 0
  let result = 1
  for (let index = 0; index < selectionSize; index += 1) result *= runnerCount - index
  if (rule === 'unordered') {
    for (let index = 2; index <= selectionSize; index += 1) result /= index
  }
  return Math.round(result)
}

function listSelections(horses, selectionSize, ordered) {
  const selections = []

  function addSelections(selectedIndexes, nextIndex) {
    if (selectedIndexes.length === selectionSize) {
      selections.push(selectedIndexes.map((index) => horses[index]))
      return
    }

    for (let index = 0; index < horses.length; index += 1) {
      if (selectedIndexes.includes(index) || (!ordered && index < nextIndex)) continue
      addSelections([...selectedIndexes, index], ordered ? 0 : index + 1)
    }
  }

  addSelections([], 0)
  return selections
}

function scoreSelection(selection, ordered) {
  const outcomeScore = selection.reduce((total, horse) => total * horse.weight, 1)
  return ordered ? outcomeScore : outcomeScore * selection.reduce((total, _, index) => total * (index + 1), 1)
}

function buildTicketResult({ market, budget, legs, combinations, coverageScore, outcomes = null }) {
  if (!combinations || combinations * market.unitPrice > budget) return null
  const unitCost = combinations * market.unitPrice
  const multiples = Math.floor(budget / unitCost)
  const cost = Math.round(unitCost * multiples * 100) / 100
  return {
    available: true,
    marketId: market.id,
    marketLabel: market.label,
    marketMode: market.mode,
    selectionRule: market.selectionRule,
    unitPrice: market.unitPrice,
    budget,
    combinations,
    multiples,
    cost,
    remaining: Math.round((budget - cost) * 100) / 100,
    legs,
    outcomes,
    coverageScore,
    scoreLabel: 'AI sıralamasına göre kapsam',
  }
}

export function buildBudgetTicket(races, predictions, selectedRace, marketId, budget, commentary = null) {
  const market = budgetBetTypes.find((item) => item.id === marketId)
  if (!market) return { available: false, reason: 'Geçerli bahis türü seç.' }
  if (!Number.isFinite(budget) || budget < 20 || budget > 12_000 || budget % 10 !== 0) {
    return { available: false, reason: 'Bütçe 20 TL’den başlamalı ve 10 TL’nin katı olmalı.' }
  }
  if (!selectedRace) return { available: false, reason: 'Önce bir koşu seç.' }
  const unitPrice = getBudgetUnitPrice(market, selectedRace.city)
  const pricedMarket = { ...market, unitPrice }

  const getPrediction = (race) => predictions.find((prediction) => prediction.city === race.city && Number(prediction.raceNo) === Number(race.no))

  if (market.mode === 'single') {
    const prediction = getPrediction(selectedRace)
    const { horses, totalWeight } = getRunnerCandidates(selectedRace, prediction)
    if (!horses.length) return { available: false, reason: 'Bu koşu için AI adayları henüz hazır değil.' }

    if (market.selectionRule === 'pool') {
      const combinations = Math.min(horses.length, Math.floor(budget / unitPrice))
      if (!combinations) return { available: false, reason: 'Bütçede en az bir kombinasyon gerekli.' }
      const selected = horses.slice(0, combinations)
      const coverageScore = selected.reduce((total, horse) => total + horse.weight, 0) / totalWeight
      return buildTicketResult({
        market: pricedMarket,
        budget,
        legs: [{ raceNo: selectedRace.no, horseNames: selected.map((horse) => horse.name) }],
        combinations,
        coverageScore,
        outcomes: selected.map((horse) => ({ horseNames: [horse.name], horseNumbers: [horse.number], score: horse.weight })),
      })
    }
    const ordered = ['ordered', 'ai-order'].includes(market.selectionRule)
    const allOutcomes = listSelections(horses, market.selectionSize, ordered)
      .map((selection) => ({ selection, score: scoreSelection(selection, ordered) }))
      .sort((left, right) => right.score - left.score)
    const totalOutcomeScore = allOutcomes.reduce((total, outcome) => total + outcome.score, 0)
    const combinations = Math.min(allOutcomes.length, Math.floor(budget / unitPrice))
    if (!combinations || totalOutcomeScore === 0) return { available: false, reason: `Bu bahis için en az ${market.selectionSize} AI adayı ve bir kombinasyon gerekli.` }

    const selectedOutcomes = allOutcomes.slice(0, combinations)
    const selectedHorses = [...new Set(selectedOutcomes.flatMap((outcome) => outcome.selection.map((horse) => horse.name)))]
    const coverageScore = selectedOutcomes.reduce((total, outcome) => total + outcome.score, 0) / totalOutcomeScore
    return buildTicketResult({
      market: pricedMarket,
      budget,
      legs: [{ raceNo: selectedRace.no, horseNames: selectedHorses }],
      combinations,
      coverageScore,
      outcomes: selectedOutcomes.map((outcome) => ({ horseNames: outcome.selection.map((horse) => horse.name), horseNumbers: outcome.selection.map((horse) => horse.number), score: outcome.score / totalOutcomeScore })),
    })
  }

  const meetingRaces = races
    .filter((race) => race.city === selectedRace.city)
    .sort((left, right) => Number(left.no) - Number(right.no))
  const startIndex = meetingRaces.findIndex((race) => Number(race.no) === Number(selectedRace.no))
  const selectedRaces = meetingRaces.slice(startIndex, startIndex + market.legCount)
  if (selectedRaces.length !== market.legCount || selectedRaces.some((race, index) => Number(race.no) !== Number(selectedRace.no) + index)) {
    return { available: false, reason: `Bu koşudan başlayarak ${market.legCount} ardışık koşu yok.` }
  }

  const candidateGroups = selectedRaces.map((race) => getRunnerCandidates(race, getPrediction(race)))
  const commentaryGroups = selectedRaces.map((race) => getCommentaryCandidates(race, commentary))

  const maxCombinations = Math.floor(budget / unitPrice)
  function findBestCoupon(groups, returnAlternatives = false) {
    let best = null
    const alternatives = []
    function enumerate(legIndex, legs, combinations, probability) {
      if (legIndex === groups.length) {
        const coupon = { legs, combinations, probability }
        if (returnAlternatives) alternatives.push(coupon)
        if (!best || coupon.probability > best.probability || (coupon.probability === best.probability && coupon.combinations < best.combinations)) best = coupon
        return
      }
      for (let count = 1; count <= groups[legIndex].length; count += 1) {
        const nextCombinations = combinations * count
        if (nextCombinations > maxCombinations) break
        const selectedHorses = groups[legIndex].slice(0, count)
        const legProbability = selectedHorses.reduce((sum, horse) => sum + horse.weight, 0)
        enumerate(legIndex + 1, [...legs, selectedHorses], nextCombinations, probability * legProbability)
      }
    }
    if (groups.every((group) => group.length)) enumerate(0, [], 1, 1)
    return returnAlternatives ? alternatives.sort((a, b) => b.probability - a.probability || a.combinations - b.combinations) : best
  }

  const aiCandidatesAvailable = candidateGroups.every((group) => group.horses.length > 0)
  const aiOptions = aiCandidatesAvailable ? findBestCoupon(candidateGroups.map((group) => group.horses), true) : []
  const aiCoupons = aiOptions.slice(0, 2)
  const signature = (coupon) => coupon.legs.map((leg) => leg.map((horse) => horse.number).sort((a,b) => a-b).join(',')).join('|')
  const surpriseLeg = candidateGroups.findIndex((group) => group.horses.some((horse) => horse.isSurprise))
  const surpriseOption = surpriseLeg >= 0 ? findBestCoupon(candidateGroups.map((group, index) => index === surpriseLeg ? [...group.horses].sort((a,b) => Number(b.isSurprise) - Number(a.isSurprise)) : group.horses)) : null
  const thirdOption = [surpriseOption, ...aiOptions].find((option) => option && !aiCoupons.some((coupon) => signature(coupon) === signature(option)))
  if (thirdOption) aiCoupons.push(thirdOption)
  const missingCommentaryRaceIndex = commentaryGroups.findIndex((group) => !group.horses.length)
  const commentaryCoupon = missingCommentaryRaceIndex < 0
    ? findBestCoupon(commentaryGroups.map((group) => group.horses))
    : null
  const recommendedCoupons = [
    ...aiCoupons.map((coupon, index) => ({ ...coupon, source: 'ai', sourceLabel: ['AI · Ana seçenek', 'AI · Alternatif seçenek', thirdOption === surpriseOption ? 'AI · Sürprizli seçenek' : 'AI · Üçüncü seçenek'][index] })),
    ...(commentaryCoupon ? [{ ...commentaryCoupon, source: 'commentary', sourceLabel: 'At Yarışı editör yorumları' }] : []),
  ]
  if (!recommendedCoupons.length) {
    return { available: false, reason: aiCandidatesAvailable ? 'Seçilen bütçeyle kupon oluşturulamıyor.' : 'AI adayları ve tüm ayaklar için eşleşmiş editör yorumu henüz hazır değil.' }
  }

  const couponCost = (coupon) => Math.round(coupon.combinations * unitPrice * 100) / 100
  const maxCouponCost = Math.max(...recommendedCoupons.map(couponCost))

  return {
    available: true,
    marketId: market.id,
    marketLabel: market.label,
    marketMode: market.mode,
    budget,
    unitPrice,
    couponCount: recommendedCoupons.length,
    cost: maxCouponCost,
    remaining: Math.round((budget - maxCouponCost) * 100) / 100,
    coupons: recommendedCoupons.map((coupon, index) => ({
      number: index + 1,
      source: coupon.source,
      sourceLabel: coupon.sourceLabel,
      estimatedCoveragePercent: coupon.probability * 100,
      authorCount: coupon.source === 'commentary' ? commentaryGroups.reduce((total, group) => total + group.authorCount, 0) : 0,
      combinations: coupon.combinations,
      cost: couponCost(coupon),
      legs: coupon.legs.map((horses, legIndex) => ({
        raceNo: selectedRaces[legIndex].no,
        raceTime: selectedRaces[legIndex].time,
        horses: horses.map((horse) => ({
          name: horse.name,
          number: horse.number,
          isSurprise: getPrediction(selectedRaces[legIndex])?.surprise?.horseName === horse.name,
          authorCount: coupon.source === 'commentary'
            ? commentaryGroups[legIndex].horses.find((candidate) => candidate.number === horse.number)?.authorCount || 0
            : 0,
        })),
        authorCount: coupon.source === 'commentary' ? commentaryGroups[legIndex].authorCount : 0,
      })),
    })),
    commentaryUnavailableReason: commentaryCoupon ? null : commentary?.unavailableReason || (missingCommentaryRaceIndex >= 0
      ? `${selectedRaces[missingCommentaryRaceIndex].no}. koşu için at numarası içeren yorum yok.`
      : 'Yorum kuponu bu bütçeyle oluşturulamadı.'),
    commentarySourceUrl: commentary?.sourceUrl || 'https://www.atyarisi.com/tjk-at-yarisi-tahminleri',
    scoreLabel: 'AI sıralaması veya bağımsız editör sıralamalarına göre kapsam',
  }
}
