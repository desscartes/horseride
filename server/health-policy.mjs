export function recentOwner(lock,now=Date.now(),bootAt=0){
  const heartbeat=Date.parse(lock?.heartbeatAt||lock?.startedAt)
  return Number.isSafeInteger(lock?.pid)&&lock.pid>0&&Number.isFinite(heartbeat)&&heartbeat>=bootAt&&heartbeat<=now&&now-heartbeat<120000
}
export function shouldRestartOwnedApi({owned,healthy,failures}){return Boolean(owned&&!healthy&&failures>=3)}
