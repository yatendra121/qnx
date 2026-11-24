#!/usr/bin/env node
// Command line for @qnx/crypto. Run `npx @qnx/crypto --help`.
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import * as lib from '../dist/crypto.mjs'
import { run } from './cli.mjs'

const interactive = Boolean(process.stdin.isTTY && process.stderr.isTTY)
// Cursor control redraws answered questions as one line. Colors follow https://no-color.org.
const ansi = interactive && process.env.TERM !== 'dumb'
const color = process.env.FORCE_COLOR
  ? process.env.FORCE_COLOR !== '0'
  : ansi && !('NO_COLOR' in process.env)
let rl

const io = {
  argv: process.argv.slice(2),
  stdout: process.stdout,
  stderr: process.stderr,
  interactive,
  ansi,
  color,
  stdoutIsTerminal: Boolean(process.stdout.isTTY),
  async ask(question) {
    // Prompts go to stderr, so `> file` captures only the .env lines.
    rl ??= createInterface({ input: process.stdin, output: process.stderr })
    const controller = new AbortController()
    const cancel = () => controller.abort()
    rl.once('SIGINT', cancel)
    rl.once('close', cancel)
    try {
      return await rl.question(question, { signal: controller.signal })
    } catch {
      return null
    } finally {
      rl.off('SIGINT', cancel)
      rl.off('close', cancel)
    }
  },
  exists: existsSync,
  write(path, text, { secret }) {
    mkdirSync(dirname(resolve(path)), { recursive: true })
    // Private keys are readable by the owner only.
    writeFileSync(path, text, { mode: secret ? 0o600 : 0o644 })
    // The mode only applies to a new file, so tighten an existing one too.
    if (secret) chmodSync(path, 0o600)
  },
  isUnignoredInGit(path) {
    // 0: ignored, 1: not ignored, 128: not in a git repository. Anything else, including no git: don't warn.
    const result = spawnSync('git', ['check-ignore', '-q', '--', resolve(path)], {
      cwd: dirname(resolve(path))
    })
    return result.status === 1
  }
}

try {
  process.exitCode = await run(lib, io)
} finally {
  rl?.close()
}
