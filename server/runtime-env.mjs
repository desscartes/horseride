import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'

// Resolve against the project, so direct starts do not depend on the shell cwd.
export function loadProjectEnvironment(url = new URL('../.env', import.meta.url)) {
  try {
    loadEnvFile(fileURLToPath(url))
    return { loaded: true }
  } catch (error) {
    if (error.code === 'ENOENT') return { loaded: false }
    throw error
  }
}
loadProjectEnvironment()
