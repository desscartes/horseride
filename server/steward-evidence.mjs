import {horseIdentity} from './data-quality.mjs'
export function matchStewardEvents(race,horse,events){
  return events.filter(e=>e.date===race.date&&horseIdentity(e.city)===horseIdentity(race.city)&&e.raceNo===race.no&&e.horseNo===horse.no&&horseIdentity(e.horseName)===horseIdentity(horse.name))
}
