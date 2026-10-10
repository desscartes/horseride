import {horseIdentity} from './data-quality.mjs'
export function raceEnvironment(race,date){
  const environment=race.environment||race.horses?.map(h=>h.sourceData?.tjk?.raceEnvironment).find(e=>e?.date===date)
  if(!environment||environment.date!==date)return {missing:true,temperature:0,humidity:0,rain:0,wet:0,going:0,missingTemperature:1,missingHumidity:1}
  const normalize=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toUpperCase().replace(/İ/g,'I')
  const weather=normalize(environment.weather)
  const temperatureMatch=weather.match(/(-?\d+(?:[.,]\d+)?)\s*[°'’]?\s*C\b/)||weather.match(/SICAKLIK\s*:?\s*(-?\d+(?:[.,]\d+)?)\s*DERECE/)
  const humidityMatch=weather.match(/NEM\s*[%&]?\s*(\d+(?:[.,]\d+)?)/)
  const temperature=temperatureMatch?Number(temperatureMatch[1].replace(',','.')):null
  const humidity=humidityMatch?Number(humidityMatch[1].replace(',','.')):null
  const validTemperature=temperature!=null&&temperature>=-30&&temperature<=60
  const validHumidity=humidity!=null&&humidity>=0&&humidity<=100
  const track=environment.tracks?.find(t=>horseIdentity(t.surface)===horseIdentity(race.surface))
  const condition=normalize(track?.condition)
  const going=condition.match(/\b([2-9][.,]\d)\b/)
  return {missing:!weather&&!condition,temperature:validTemperature?temperature:0,humidity:validHumidity?humidity:0,rain:+/YAG|SAGANAK|KAR/.test(weather),wet:+/ISLAK|AGIR|YUMUSAK|SULU/.test(condition),going:going?Number(going[1].replace(',','.')):0,missingTemperature:+!validTemperature,missingHumidity:+!validHumidity}
}
export function workoutTime(value,distance){
  const text=String(value||'').trim(),match=text.match(/^(\d+)[.:](\d{2})[.:](\d{1,2})$/)
  if(match&&Number(match[2])>=60)return null
  const seconds=match?Number(match[1])*60+Number(match[2])+Number(match[3].padEnd(2,'0'))/100:Number(text.replace(',','.'))
  // Missing/malformed split is unknown, never an exceptionally fast workout.
  return Number.isFinite(seconds)&&seconds>=distance/20&&seconds<=distance/5?seconds:null
}
