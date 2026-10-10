const timestamp=value=>{const t=Date.parse(value);return Number.isFinite(t)?t:null}
// Historical reanalysis is not a forecast that could have been used before a race.
export function usableWeather(snapshot,scheduledStart){
  const start=timestamp(scheduledStart);if(start==null)return null
  const available=timestamp(snapshot?.availableAt||snapshot?.collectedAt)
  const initialized=timestamp(snapshot?.initializedAt)
  if(available==null||available>=start)return null
  if(initialized!=null&&initialized>=available)return null
  if(!['live_forecast','single_run_forecast'].includes(snapshot?.kind))return null
  if(snapshot.kind==='single_run_forecast'&&initialized==null)return null
  const hour=new Date(Math.floor(start/3600000)*3600000).toISOString().slice(0,16)
  const index=snapshot.hourly?.time?.indexOf(hour);if(index==null||index<0)return null
  const read=key=>{const n=snapshot.hourly[key]?.[index];return typeof n==='number'&&Number.isFinite(n)?n:null}
  return {temperatureC:read('temperature_2m'),precipitationMm:read('precipitation'),windKmh:read('wind_speed_10m'),humidity:read('relative_humidity_2m'),validHourUTC:hour,availableAt:new Date(available).toISOString(),locationScope:snapshot.location?.scope||'unknown'}
}
export function marketBenchmark(race,capturedAt,scheduledStart){
  const capture=timestamp(capturedAt),start=timestamp(scheduledStart)
  if(capture==null||start==null||capture>=start)return null
  const runners=race.horses||[],shares=runners.map(h=>h.marketShare)
  // Partial AGF and zero/missing AGF are not evidence of a favorite.
  if(!runners.length||!shares.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)||shares.reduce((a,b)=>a+b,0)<=0)return null
  const sorted=runners.toSorted((a,b)=>b.marketShare-a.marketShare||Number(a.no)-Number(b.no))
  if(sorted.length>1&&sorted[0].marketShare===sorted[1].marketShare)return null
  return {source:'market_prestart',capturedAt,scheduledStart,picks:sorted.map(h=>({horseName:h.name,horseNo:h.no,marketShare:h.marketShare}))}
}
