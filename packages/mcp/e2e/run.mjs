#!/usr/bin/env node
/**
 * Tests an MCP endpoint the way a developer consuming the @qnx/* packages would.
 *
 *   node packages/mcp/e2e/run.mjs https://qnx-mcp-server.vercel.app/mcp
 *
 * It creates a temporary project, installs the published packages from npm, and runs consumer.mjs.
 * Everything under test comes from the endpoint's responses: nothing is imported from this repo.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [url, ...flags] = process.argv.slice(2)
if (!url) {
    console.error('Usage: node run.mjs <mcp-url> [--keep] [--json=<file>]')
    process.exit(2)
}

const here = dirname(fileURLToPath(import.meta.url))
const project = mkdtempSync(join(tmpdir(), 'qnx-mcp-consumer-'))
writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'qnx-mcp-consumer', private: true, type: 'module' }))
copyFileSync(join(here, 'consumer.mjs'), join(project, 'consumer.mjs'))

console.error(`Installing test tooling in ${project}`)
execFileSync('npm', ['install', '--no-audit', '--no-fund', '--silent', '@modelcontextprotocol/sdk@1', 'typescript@5', '@types/node@22', '@types/express@5'], { cwd: project, stdio: 'inherit' })

const { status } = spawnSync(process.execPath, ['consumer.mjs', url, ...flags], { cwd: project, stdio: 'inherit' })

if (flags.includes('--keep')) console.error(`Kept ${project}`)
else rmSync(project, { recursive: true, force: true })
process.exit(status ?? 1)
