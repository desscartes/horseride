// Share source work between simultaneous clients; failed loads are never cached.
export function createProgramCache({ ttlMs = 60_000, maxEntries = 100, now = Date.now } = {}) {
  const entries = new Map()
  const pending = new Map()
  const load = async function (key, fetchProgram) {
    const entry = entries.get(key)
    if (entry && now() - entry.at < ttlMs) return structuredClone(entry.value)
    if (!pending.has(key)) {
      const promise = Promise.resolve().then(fetchProgram).then(value => {
        entries.delete(key)
        entries.set(key, { at: now(), value: structuredClone(value) })
        while (entries.size > maxEntries) entries.delete(entries.keys().next().value)
        return value
      }).finally(() => pending.delete(key))
      pending.set(key, promise)
    }
    return structuredClone(await pending.get(key))
  }
  load.peek = key => {
    const entry = entries.get(key)
    return entry && now() - entry.at < ttlMs ? structuredClone(entry.value) : null
  }
  return load
}
