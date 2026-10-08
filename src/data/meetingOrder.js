export function clockMinutes(time) {
  const match = String(time || '').match(/^(\d{1,2})[.:](\d{2})$/)
  return match && +match[1] < 24 && +match[2] < 60 ? +match[1] * 60 + +match[2] : Infinity
}

export function orderMeetings(meetings, races = []) {
  return meetings.map(meeting => {
    const firstRace = races.filter(race => race.city === meeting.city && Number.isFinite(clockMinutes(race.time)))
      .sort((a, b) => Number(a.no) - Number(b.no))[0]
    const firstRaceTime = firstRace?.time || (Number.isFinite(clockMinutes(meeting.firstRaceTime)) ? meeting.firstRaceTime : null)
    return { ...meeting, firstRaceTime }
  }).sort((a, b) => clockMinutes(a.firstRaceTime) - clockMinutes(b.firstRaceTime) || a.city.localeCompare(b.city, 'tr'))
}
