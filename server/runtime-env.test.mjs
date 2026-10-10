import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

test('direct entry loads project environment from a different cwd without exposing secrets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'horseride-env-'))
  try {
    const url = new URL('./runtime-env.mjs', import.meta.url).href
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(url)});console.log(JSON.stringify({configured:Boolean(process.env.OPENAI_API_KEY)}))`], {cwd: directory, encoding: 'utf8'})
    assert.equal(result.status, 0, result.stderr)
    assert.equal(typeof JSON.parse(result.stdout).configured, 'boolean')
    const file = join(directory, 'sample.env')
    writeFileSync(file, 'HORSERIDE_ENV_TEST=from_file\n')
    const code = `const {loadProjectEnvironment}=await import(${JSON.stringify(url)});loadProjectEnvironment(new URL(${JSON.stringify(pathToFileURL(file).href)}));console.log(process.env.HORSERIDE_ENV_TEST)`
    const loaded = spawnSync(process.execPath, ['--input-type=module', '-e', code], {cwd: directory, env: {...process.env, HORSERIDE_ENV_TEST: 'from_process'}, encoding: 'utf8'})
    assert.equal(loaded.status, 0, loaded.stderr)
    assert.equal(loaded.stdout.trim(), 'from_process')
    const cleanEnv = {...process.env}; delete cleanEnv.HORSERIDE_ENV_TEST
    const fromFile = spawnSync(process.execPath, ['--input-type=module', '-e', code], {cwd: directory, env: cleanEnv, encoding: 'utf8'})
    assert.equal(fromFile.status, 0, fromFile.stderr)
    assert.equal(fromFile.stdout.trim(), 'from_file')
  } finally { rmSync(directory, {recursive:true, force:true}) }
})
