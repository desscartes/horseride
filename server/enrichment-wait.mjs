export async function waitForEnrichment(promise, timeoutMs = 10000) {
  let timer
  try {
    return await Promise.race([
      Promise.resolve(promise).then(() => ({ready:true}), error => ({ready:false,error:error.message})),
      new Promise(resolve => { timer=setTimeout(() => resolve({ready:false,timedOut:true}),timeoutMs) }),
    ])
  } finally { clearTimeout(timer) }
}
