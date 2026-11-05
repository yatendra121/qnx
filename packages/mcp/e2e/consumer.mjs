/**
 * End-user scenarios. See run.mjs. A scenario passes only if a developer could finish the task using
 * the endpoint's output: commands it returns are really run, and code it returns is written to a file
 * in a fresh project, compiled with tsc --strict and executed against the packages from npm.
 */
import { spawn, spawnSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const [url, ...flags] = process.argv.slice(2)
const jsonOut = flags.find((flag) => flag.startsWith('--json='))?.slice(7)
const root = process.cwd()

// ─── Harness ────────────────────────────────────────────────────────────────

const results = []
let section = ''
const begin = (name) => { section = name; console.log(`\n## ${name}`) }

async function scenario(id, label, run) {
    let status = 'PASS'
    let detail = ''
    try {
        const outcome = await run()
        if (outcome !== true) { status = 'FAIL'; detail = String(outcome ?? 'returned nothing') }
    } catch (error) {
        status = 'FAIL'
        detail = String(error?.message ?? error)
    }
    detail = detail.replace(/\s+/g, ' ').slice(0, 200)
    results.push({ section, id, label, status, detail })
    console.log(`${status}  ${id.padEnd(10)} ${label}${detail ? `  [${detail}]` : ''}`)
}

const connect = async (endpoint = url) => {
    for (let attempt = 1; ; attempt++) {
        const client = new Client({ name: 'qnx-consumer-test', version: '1.0.0' })
        try {
            await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)))
            client.attempts = attempt
            return client
        } catch (error) {
            if (attempt >= 10) throw error
        }
    }
}

const client = await connect()
const connectAttempts = client.attempts

/**
 * Retries transport failures so a reliability problem doesn't hide every content result.
 * Reliability has its own scenarios, which don't retry.
 */
async function call(name, args = {}) {
    for (let attempt = 1; ; attempt++) {
        try {
            const result = await client.callTool({ name, arguments: args })
            return { text: result.content?.[0]?.text ?? '', isError: result.isError === true }
        } catch (error) {
            const transient = /Session not found|Error POSTing/.test(error.message)
            if (!transient || attempt >= 10) return { text: error.message, isError: true, protocolError: true }
        }
    }
}
const text = async (name, args) => (await call(name, args)).text
const json = async (name, args) => JSON.parse(await text(name, args))
const blocks = (markdown, languages = 'ts|typescript') =>
    [...markdown.matchAll(new RegExp('```(?:' + languages + ')\\n([\\s\\S]*?)```', 'g'))].map((match) => match[1])

// ─── A fresh project per task, as a developer would have ─────────────────────

function newProject(name) {
    const dir = join(root, 'projects', name)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: `consumer-${name}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'), private: true, type: 'module' }))
    return dir
}

/** Runs an install command exactly as the endpoint gave it. */
function runInstall(dir, command, extra = []) {
    const [tool, ...args] = command.trim().split(/\s+/)
    return spawnSync(tool, [...args, '--no-audit', '--no-fund', ...extra], { cwd: dir, encoding: 'utf8' })
}

const firstInstall = (markdown) => /^\s*(npm install [^\n`]+)$/m.exec(markdown)?.[1]

/** Runs a file with Node's built-in TypeScript support, so types can't hide a runtime failure. */
function runFile(dir, file, { env = {}, nodeArgs = [] } = {}) {
    return spawnSync(process.execPath, ['--no-warnings', ...nodeArgs, file], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 30_000 })
}

function typecheck(dir, files) {
    const config = { compilerOptions: { strict: true, noEmit: true, skipLibCheck: true, target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', types: ['node'], typeRoots: [resolve(root, 'node_modules/@types'), resolve(dir, 'node_modules/@types')] }, files }
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(config))
    const { stdout } = spawnSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], { cwd: dir, encoding: 'utf8' })
    return stdout.trim()
}

const freePort = () => new Promise((done) => {
    const probe = createServer().listen(0, () => {
        const { port } = probe.address()
        probe.close(() => done(port))
    })
})

async function startServer(dir, file, env = {}) {
    const child = spawn(process.execPath, ['--no-warnings', file], { cwd: dir, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    for (let i = 0; i < 100; i++) {
        if (/listening/.test(output)) return { stop: () => child.kill(), output: () => output }
        if (child.exitCode !== null) throw new Error(`Server exited: ${output}`)
        await new Promise((done) => setTimeout(done, 100))
    }
    child.kill()
    throw new Error(`Server did not start: ${output}`)
}

const request = async (base, method, path, { body, headers = {} } = {}) => {
    const response = await fetch(base + path, { method, headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...headers }, ...(body !== undefined && { body: JSON.stringify(body) }) })
    const raw = await response.text()
    let parsed
    try { parsed = JSON.parse(raw) } catch { parsed = undefined }
    return { status: response.status, body: parsed, raw }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** A project with the server-side packages installed from the endpoint's own install commands. */
let apiProject
async function getApiProject() {
    if (apiProject) return apiProject
    apiProject = newProject('api')
    // A missing command fails scenario I1. Falling back here lets the later scenarios test their own subject.
    const command = firstInstall((await call('get-package-info', { package: '@qnx/response' })).text) ?? firstInstall(await text('get-response-docs', { pattern: 'install' })) ?? 'npm install @qnx/response @qnx/errors express zod@4'
    const installed = runInstall(apiProject, command)
    if (installed.status !== 0) throw new Error(`"${command}" failed: ${installed.stderr}`)
    runInstall(apiProject, 'npm install @qnx/crypto jose uuid @qnx/client @qnx/winston winston winston-daily-rotate-file @qnx/log chalk')
    runInstall(apiProject, 'npm install -D @types/express@5 @types/node@22')
    return apiProject
}

// ─── 1. Connect and discover ────────────────────────────────────────────────

const PACKAGES = ['@qnx/client', '@qnx/core-helpers', '@qnx/crypto', '@qnx/errors', '@qnx/interfaces', '@qnx/log', '@qnx/message', '@qnx/response', '@qnx/winston']
const SCOPES = ['errors', 'response', 'client', 'crypto', 'winston', 'log']
const OLD_TOOLS = ['list-mcp-tools', 'get-crypto-docs', 'build-crypto-snippet', 'build-api-response', 'get-response-docs', 'transform-to-async-handler', 'get-file-logger-docs', 'build-file-log-entry', 'get-console-log-docs', 'build-console-log', 'build-api-error', 'get-error-class-docs', 'get-client-docs', 'build-client-response']

const info = client.getServerVersion()
console.log(`Endpoint: ${url}\nServer: ${info?.name} ${info?.version}\nConnection attempts needed: ${connectAttempts}`)

begin('Connect and discover')
await scenario('D1', 'Connects first time with the official SDK', () => connectAttempts === 1 || `needed ${connectAttempts} attempts`)
await scenario('D2', 'The server explains itself on connect (instructions)', () => Boolean(client.getInstructions()) || 'no instructions')
await scenario('D3', 'Makes clear it is the Node packages, not the QNX OS', async () => /operating system/i.test(client.getInstructions() ?? '') || 'not stated on connect')
await scenario('D4', 'Tells a new user which tool suits which task', async () => { const t = await text('list-mcp-tools'); return (t.includes('diagnose-error') && t.includes('search-docs')) || 'tool list has no task guidance' })
await scenario('D5', 'Every tool has a title and read-only annotation', async () => { const { tools } = await client.listTools(); const missing = tools.filter((tool) => !tool.title || tool.annotations?.readOnlyHint !== true); return missing.length === 0 || `${missing.length} of ${tools.length} missing` })
const catalogue = await call('get-package-info', { package: 'all' })
for (const name of PACKAGES) {
    await scenario('D6', `Discovers ${name}`, async () => (!catalogue.isError && catalogue.text.includes(name)) || (await text('search-docs', { query: name })).includes(name) || 'not mentioned anywhere')
}
await scenario('D7', 'Asking for Vue components or composables gets a straight answer', async () => /no UI components/i.test(await text('search-docs', { query: 'vue composable component' })) || 'no answer')
await scenario('D8', 'Every scoped endpoint connects and lists its package tools', async () => {
    for (const scope of SCOPES) {
        const scoped = await connect(`${url}/${scope}`)
        const { tools } = await scoped.listTools()
        const listed = await scoped.callTool({ name: 'list-mcp-tools', arguments: {} })
        await scoped.close()
        if (tools.length < 3) return `${scope}: ${tools.length} tools`
        if (!listed.content[0].text.includes(`@qnx/${scope}`)) return `${scope}: not described`
    }
    return true
})
await scenario('D9', 'Negotiates every protocol version, and falls back on an unknown one', async () => {
    for (const [version, expected] of [['2024-11-05', '2024-11-05'], ['2025-03-26', '2025-03-26'], ['2025-06-18', '2025-06-18'], ['2025-11-25', '2025-11-25'], ['1999-01-01', undefined]]) {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: version, capabilities: {}, clientInfo: { name: 'x', version: '1' } } }) })
        const raw = await response.text()
        const parsed = JSON.parse(raw.replace(/^event: message\ndata: /, ''))
        if (expected && parsed.result?.protocolVersion !== expected) return `${version} gave ${parsed.result?.protocolVersion}`
        if (!parsed.result?.protocolVersion) return `${version} failed`
    }
    return true
})
await scenario('D10', 'Works over plain HTTP with no handshake', async () => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list-mcp-tools', arguments: {} } }) })
    return response.status === 200 || `HTTP ${response.status}`
})

// ─── 2. Reliability ─────────────────────────────────────────────────────────

begin('Reliability')
const burst = async (count) => {
    const outcomes = await Promise.allSettled(Array.from({ length: count }, () => client.callTool({ name: 'get-console-log-docs', arguments: { topic: 'usage' } })))
    return outcomes.filter(({ status }) => status === 'fulfilled').length
}
for (const size of [2, 5, 10, 20]) {
    await scenario('R1', `${size} parallel calls, 3 rounds, no retries`, async () => {
        let ok = 0
        for (let round = 0; round < 3; round++) ok += await burst(size)
        return ok === size * 3 || `${ok}/${size * 3} succeeded`
    })
}
await scenario('R2', 'A realistic batch of 6 different calls, 4 rounds', async () => {
    const batch = [['get-response-docs', { pattern: 'async-handler' }], ['get-response-docs', { pattern: 'zod-validation' }], ['get-error-class-docs', { errorClass: 'all' }], ['get-client-docs', { topic: 'patterns' }], ['get-crypto-docs', { topic: 'auth-token' }], ['build-api-response', { type: 'unauthenticated' }]]
    let ok = 0
    for (let round = 0; round < 4; round++) ok += (await Promise.allSettled(batch.map(([name, args]) => client.callTool({ name, arguments: args })))).filter(({ status }) => status === 'fulfilled').length
    return ok === 24 || `${ok}/24 succeeded`
})
await scenario('R3', '60 calls in a row, no retries', async () => {
    let ok = 0
    for (let i = 0; i < 60; i++) ok += (await Promise.allSettled([client.callTool({ name: 'list-mcp-tools', arguments: {} })]))[0].status === 'fulfilled' ? 1 : 0
    return ok === 60 || `${ok}/60 succeeded`
})

// ─── 3. Install ─────────────────────────────────────────────────────────────

begin('Install each package using only the server\'s command')
for (const name of PACKAGES) {
    await scenario('I1', `${name}: command works without automatic peer install, and the import loads`, async () => {
        const docs = await call('get-package-info', { package: name })
        let command = docs.isError ? undefined : firstInstall(docs.text)
        if (!command) {
            const found = await text('search-docs', { query: `install ${name}` })
            command = (new RegExp(`npm install [^\\n\`]*${name}[^\\n\`]*`).exec(found))?.[0]
        }
        if (!command) return 'the server gives no install command'
        const dir = newProject(`install-${name}`)
        // --legacy-peer-deps is the strictest test: the command itself has to name every peer.
        const installed = runInstall(dir, command, ['--legacy-peer-deps'])
        if (installed.status !== 0) return `"${command}" failed: ${installed.stderr}`
        writeFileSync(join(dir, 'probe.mjs'), name === '@qnx/interfaces' ? `import { existsSync } from 'node:fs'\nif (!existsSync('node_modules/@qnx/interfaces/package.json')) process.exit(1)` : `const m = await import('${name}'); console.log(Object.keys(m).length)`)
        const probe = runFile(dir, 'probe.mjs')
        return probe.status === 0 || `import failed after "${command}": ${probe.stderr.split('\n').find((line) => /Error/.test(line))}`
    })
}

// ─── 4. Exports ─────────────────────────────────────────────────────────────

begin('Find every public export')
const allDocs = async (name) => {
    const sources = [await text('get-package-info', { package: name })]
    const byPackage = { '@qnx/response': ['get-response-docs', { pattern: 'all' }], '@qnx/errors': ['get-error-class-docs', { errorClass: 'all' }], '@qnx/client': ['get-client-docs', { topic: 'all' }], '@qnx/crypto': ['get-crypto-docs', { topic: 'all' }], '@qnx/winston': ['get-file-logger-docs', { topic: 'all' }], '@qnx/log': ['get-console-log-docs', { topic: 'all' }] }
    if (byPackage[name]) sources.push(await text(...byPackage[name]))
    return sources.join('\n')
}
for (const name of PACKAGES) {
    await scenario('E1', `${name}: every export in its published .d.ts is documented`, async () => {
        const dir = join(root, 'projects', `install-${name}`)
        const manifestPath = join(dir, 'node_modules', name, 'package.json')
        if (!existsSync(manifestPath)) {
            const fresh = newProject(`exports-${name}`)
            runInstall(fresh, `npm install ${name}`, ['--legacy-peer-deps'])
            return checkExports(fresh, name)
        }
        return checkExports(dir, name)
    })
}
async function checkExports(dir, name) {
    const manifest = JSON.parse(readFileSync(join(dir, 'node_modules', name, 'package.json'), 'utf8'))
    const declarations = readFileSync(join(dir, 'node_modules', name, manifest.types), 'utf8')
    const names = new Set()
    for (const [, exported] of declarations.matchAll(/^export (?:declare )?(?:const|function|class|type|interface) (\w+)/gm)) names.add(exported)
    for (const [, list] of declarations.matchAll(/^export \{([^}]*)\}/gm)) {
        for (const item of list.split(',')) {
            const alias = item.trim().split(/\s+as\s+/).pop()
            if (alias) names.add(alias)
        }
    }
    const docs = await allDocs(name)
    const missing = [...names].filter((exported) => !docs.includes(exported))
    return missing.length === 0 || `undocumented: ${missing.join(', ')}`
}
for (const [query, expected] of [['setCallback', 'setCallback'], ['errorApiResponse', 'errorApiResponse'], ['hasErrors', 'hasErrors'], ['setError replaces', 'setError'], ['asyncSubArrayGenerator', 'asyncSubArrayGenerator'], ['requiredField', 'requiredField'], ['typed req.user', 'user']]) {
    await scenario('E2', `search-docs finds "${query}"`, async () => (await text('search-docs', { query })).includes(expected) || 'not found')
}

// ─── 5. Practical tasks ─────────────────────────────────────────────────────

begin('Build features using only the server\'s output')

const JWT = generateKeyPairSync('ec', { namedCurve: 'P-256', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })

await scenario('T1', 'CRUD API: paste the guide, compile with --strict, run, and exercise every route', async () => {
    const guide = await call('get-guide', { topic: 'crud-api' })
    if (guide.isError) return 'no guide: tool or topic missing'
    const dir = await getApiProject()
    const [code] = blocks(guide.text)
    writeFileSync(join(dir, 'crud.ts'), `${code}\nconst port = Number(process.env.PORT)\napp.listen(port, () => console.log('listening'))\n`)
    const errors = typecheck(dir, ['crud.ts'])
    if (errors) return `tsc: ${errors}`
    const port = await freePort()
    const server = await startServer(dir, 'crud.ts', { PORT: String(port) })
    const base = `http://127.0.0.1:${port}`
    try {
        const checks = [
            [await request(base, 'GET', '/items'), 200],
            [await request(base, 'GET', '/items/99'), 404],
            [await request(base, 'POST', '/items', { body: { name: 'New' } }), 201],
            [await request(base, 'POST', '/items', { body: { name: '' } }), 400],
            [await request(base, 'PUT', '/items/1', { body: { name: 'Renamed' } }), 200],
            [await request(base, 'DELETE', '/items/1'), 200]
        ]
        const wrong = checks.filter(([response, status]) => response.status !== status)
        return wrong.length === 0 || `wrong statuses: ${wrong.map(([response, status]) => `${response.status} not ${status}`).join(', ')}`
    } finally { server.stop() }
})

await scenario('T2', 'Frontend: the documented client check classifies every real response', async () => {
    const docs = await text('get-client-docs', { topic: 'patterns' })
    const usesOk = /response\.ok/.test(docs)
    if (!usesOk) return 'the documented pattern is if (res.getError()), which misclassifies real 401, 409 and 500 responses'
    const guide = await call('get-guide', { topic: 'server-and-client' })
    if (guide.isError) return 'no guide'
    const dir = await getApiProject()
    const [helper] = blocks(guide.text)
    writeFileSync(join(dir, 'client-helper.ts'), helper)
    writeFileSync(join(dir, 'client-server.ts'), `import express from 'express'
import { asyncValidatorHandler as H, initializeApiResponse } from '@qnx/response'
import { ApiError, InvalidValueError, ServerError, UnauthenticatedUserError } from '@qnx/errors'
const app = express(); app.use(express.json())
app.get('/data', H(async () => ({ id: 1 })))
app.delete('/delete', H(async () => initializeApiResponse().setMessage('Deleted.')))
app.get('/validation', H(async () => { throw new InvalidValueError('Bad.', { key: 'email' }) }))
app.get('/401', H(async () => { throw new UnauthenticatedUserError('x') }))
app.get('/409', H(async () => { throw new ApiError('Conflict.', 409) }))
app.get('/500', H(async () => { throw new ServerError('Safe.') }))
app.get('/crash', H(async () => { throw new Error('secret') }))
app.get('/void', H(async () => undefined))
app.post('/echo', H(async (req) => req.body))
app.listen(Number(process.env.PORT), () => console.log('listening'))
`)
    const errors = typecheck(dir, ['client-helper.ts'])
    if (errors) return `tsc: ${errors}`
    const port = await freePort()
    const server = await startServer(dir, 'client-server.ts', { PORT: String(port) })
    writeFileSync(join(dir, 'client-run.ts'), `import { apiRequest } from './client-helper.ts'
const base = 'http://127.0.0.1:${port}'
const out: unknown[] = []
for (const [path, method] of [['/data', 'GET'], ['/delete', 'DELETE'], ['/validation', 'GET'], ['/401', 'GET'], ['/409', 'GET'], ['/500', 'GET'], ['/crash', 'GET'], ['/void', 'GET']]) out.push(await apiRequest(base + path, { method }))
out.push(await apiRequest(base + '/echo', { method: 'POST', body: JSON.stringify({ a: 1 }) }))
console.log(JSON.stringify(out))
`)
    try {
        const run = runFile(dir, 'client-run.ts')
        if (run.status !== 0) return run.stderr
        const out = JSON.parse(run.stdout)
        const oks = out.map(({ ok }) => ok)
        if (!same(oks, [true, true, false, false, false, false, false, false, true])) return `classified as ${oks}`
        if (out[6].message !== 'Something went wrong.') return 'shows server details to the user'
        return (out[8].data?.a === 1) || 'JSON body did not arrive'
    } finally { server.stop() }
})

await scenario('T3', 'Login: generate keys from the docs, then log in, use and end a session', async () => {
    const dir = await getApiProject()
    const setup = await call('get-crypto-docs', { topic: 'setup' })
    if (setup.isError) return 'no key setup docs'
    const [script] = blocks(setup.text, 'js')
    if (!script) return 'no key generation script'
    writeFileSync(join(dir, 'generate-keys.mjs'), script)
    const generated = runFile(dir, 'generate-keys.mjs')
    if (generated.status !== 0) return generated.stderr
    writeFileSync(join(dir, '.env'), generated.stdout)

    const guide = await call('get-guide', { topic: 'auth-session' })
    if (guide.isError) return 'no guide'
    const [code] = blocks(guide.text)
    const app = `declare function placeholder(): void
${code.replace('const SESSION_TTL_MS', `async function checkCredentials(_body: unknown) { return { id: 42 } }\nconst SESSION_TTL_MS`)}
const app = express()
app.use(express.json())
app.use(router)
app.post('/test/expire', (_req, res) => { for (const session of sessions.values()) session.expiresAt = 0; res.json({}) })
app.listen(Number(process.env.PORT), () => console.log('listening'))
`.replace('declare function placeholder(): void\n', '')
    writeFileSync(join(dir, 'auth.ts'), app)
    const errors = typecheck(dir, ['auth.ts'])
    if (errors) return `tsc: ${errors}`
    const port = await freePort()
    const child = spawn(process.execPath, ['--no-warnings', '--env-file=.env', 'auth.ts'], { cwd: dir, env: { ...process.env, PORT: String(port) } })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    for (let i = 0; i < 80 && !/listening/.test(output); i++) await new Promise((done) => setTimeout(done, 100))
    const base = `http://127.0.0.1:${port}`
    try {
        const login = async () => (await request(base, 'POST', '/login', { body: { user: 'a', password: 'b' } })).body?.data?.token
        const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } })
        const token = await login()
        if (!token) return `login failed: ${output}`
        const me = await request(base, 'GET', '/me', auth(token))
        if (me.status !== 200 || me.body?.data?.userId !== '42') return `/me gave ${me.status}`
        if ((await request(base, 'GET', '/me')).status !== 401) return 'no token was accepted'
        if ((await request(base, 'GET', '/me', auth('garbage'))).status !== 401) return 'a bad token was accepted'
        if ((await request(base, 'POST', '/logout', auth(token))).status !== 200) return 'logout failed'
        if ((await request(base, 'GET', '/me', auth(token))).status !== 401) return 'token works after logout'
        const second = await login()
        await request(base, 'POST', '/test/expire')
        return (await request(base, 'GET', '/me', auth(second))).status === 401 || 'an expired session was accepted'
    } finally { child.kill() }
})

const SNIPPETS = [
    ['HS256 sign', { operation: 'jwt-sign', keyType: 'symmetric', payload: { a: 1 }, expirationTime: '2h' }, 'token'],
    ['ES256 sign', { operation: 'jwt-sign', keyType: 'asymmetric', issuer: 'https://x', jti: 'j' }, 'token'],
    ['RS256 sign', { operation: 'jwt-sign', keyType: 'asymmetric', alg: 'RS256' }, 'token'],
    ['JWE encrypt', { operation: 'jwe-encrypt', plaintext: 'hi' }, 'jwe'],
    ['JWE encrypt, enc only', { operation: 'jwe-encrypt', plaintext: 'hi', enc: 'A128GCM' }, 'jwe'],
    ['A256KW encrypt', { operation: 'jwe-encrypt', plaintext: 'hi', alg: 'A256KW', enc: 'A256GCM' }, 'jwe'],
    ['Auth token', { operation: 'auth-token-generate', subject: 'u1' }, 'token']
]
const pem = { publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } }
const JWE = generateKeyPairSync('ec', { namedCurve: 'P-256', ...pem })
const RSA = generateKeyPairSync('rsa', { modulusLength: 2048, ...pem })
for (const [label, args, variable] of SNIPPETS) {
    await scenario('T4', `Crypto snippet: ${label} compiles with --strict and runs`, async () => {
        const dir = await getApiProject()
        const output = await call('build-crypto-snippet', args)
        if (output.isError) return output.text
        const { snippet } = JSON.parse(output.text)
        const file = `snippet-${label.replace(/\W+/g, '-')}.ts`
        writeFileSync(join(dir, file), `${snippet}\nconsole.log(typeof ${variable})\nexport {}\n`)
        const errors = typecheck(dir, [file])
        if (errors) return `tsc: ${errors.split('\n')[0]}`
        const run = runFile(dir, file, { env: { JWT_SECRET: 'x'.repeat(64), JWE_SECRET: 'k'.repeat(32), JWT_PRIVATE_KEY: label.startsWith('RS') ? RSA.privateKey : JWT.privateKey, JWE_PUBLIC_KEY: JWE.publicKey } })
        return (run.status === 0 && run.stdout.includes('string')) || run.stderr.split('\n').find((line) => /Error/.test(line))
    })
}

await scenario('T5', 'Logging: the previewed entry is what the logger really writes, with the stack', async () => {
    const dir = await getApiProject()
    const output = await json('build-file-log-entry', { level: 'error', message: 'Payment failed', errorMessage: 'card declined' })
    if (!output.snippet?.includes('err')) return 'no way to preview logging an Error'
    const call_ = /logger\.error\([^\n]+\)/.exec(output.snippet)[0]
    writeFileSync(join(dir, 'log-task.mjs'), `import { logger } from '@qnx/winston'\nconst err = new Error('card declined')\n${call_}\nsetTimeout(() => process.exit(0), 300)\n`)
    rmSync(join(dir, 'logs'), { recursive: true, force: true })
    const run = runFile(dir, 'log-task.mjs')
    if (run.status !== 0) return run.stderr
    const file = readdirSync(join(dir, 'logs')).find((name) => name.endsWith('.log'))
    const entry = readFileSync(join(dir, 'logs', file), 'utf8').trim().split('\n').map((line) => JSON.parse(line)).find((line) => String(line.message).startsWith('Payment failed'))
    if (!entry?.stack?.includes('card declined')) return `entry lost the error: ${JSON.stringify(entry)}`
    return entry.message === output.fileEntry.message || `preview "${output.fileEntry.message}", real "${entry.message}"`
})

await scenario('T6', 'Previews: build-api-response equals a real Express server, for 8 cases', async () => {
    const dir = await getApiProject()
    const cases = [
        ['/data', { type: 'success', data: { id: 1 }, message: 'Created.' }, `H(async () => initializeApiResponse().setData({ id: 1 }).setMessage('Created.'))`],
        ['/array', { type: 'success', data: [1, 2] }, `H(async () => [1, 2])`],
        ['/v', { type: 'validation-error', errors: { email: ['bad', 'worse'], name: ['short'] } }, `H(async () => { throw new ValidationError('x', { errRes: { errors: { email: ['bad', 'worse'], name: ['short'] } } }) })`],
        ['/empty', { type: 'validation-error', errors: {} }, `H(async () => { throw new ValidationError('x', { errRes: { errors: {} } }) })`],
        ['/iv', { type: 'invalid-value', field: 'email', error: 'bad' }, `H(async () => { throw new InvalidValueError('bad', { key: 'email' }) })`],
        ['/c', { type: 'custom-error', error: 'Conflict', statusCode: 409 }, `H(async () => { throw new ApiError('Conflict', 409) })`],
        ['/cf', { type: 'custom-error', error: 'Conflict', statusCode: 409, errors: { email: ['taken'] } }, `H(async () => { throw new ApiError('Conflict', 409, { errRes: { errors: { email: ['taken'] } } }) })`],
        ['/u', { type: 'unauthenticated' }, `H(async () => { throw new UnauthenticatedUserError('x') })`]
    ]
    writeFileSync(join(dir, 'preview-server.mjs'), `import express from 'express'
import { asyncValidatorHandler as H, initializeApiResponse } from '@qnx/response'
import { ApiError, InvalidValueError, UnauthenticatedUserError, ValidationError } from '@qnx/errors'
const app = express()
${cases.map(([path, , handler]) => `app.get('${path}', ${handler})`).join('\n')}
app.listen(Number(process.env.PORT), () => console.log('listening'))
`)
    const port = await freePort()
    const server = await startServer(dir, 'preview-server.mjs', { PORT: String(port) })
    try {
        for (const [path, args] of cases) {
            const preview = await json('build-api-response', args)
            const real = await request(`http://127.0.0.1:${port}`, 'GET', path)
            if (preview.statusCode !== real.status || !same(sorted(preview.body), sorted(real.body))) return `${path}: preview ${preview.statusCode} ${JSON.stringify(preview.body)}, real ${real.status} ${real.raw}`
        }
        return true
    } finally { server.stop() }
})
function sorted(value) {
    if (Array.isArray(value)) return value.map(sorted)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, sorted(nested)]))
    return value
}

await scenario('T7', 'Production: the documented way to hide errors from clients works', async () => {
    const docs = await call('get-response-docs', { pattern: 'server-error' })
    if (docs.isError) return 'no server-error topic'
    const dir = await getApiProject()
    const [code] = blocks(docs.text)
    writeFileSync(join(dir, 'safe.ts'), `${code}
import express from 'express'
const app = express()
app.get('/crash', safeHandler(async () => { throw new Error('password=hunter2') }))
app.get('/conflict', safeHandler(async () => { throw new ApiError('Conflict.', 409) }))
app.get('/ok', safeHandler(async () => ({ id: 1 })))
app.listen(Number(process.env.PORT), () => console.log('listening'))
`)
    const errors = typecheck(dir, ['safe.ts'])
    if (errors) return `tsc: ${errors}`
    const port = await freePort()
    const server = await startServer(dir, 'safe.ts', { PORT: String(port) })
    const base = `http://127.0.0.1:${port}`
    try {
        const crash = await request(base, 'GET', '/crash')
        if (crash.status !== 500 || crash.raw.includes('hunter2') || crash.raw.includes('stack')) return `leaks: ${crash.raw}`
        if ((await request(base, 'GET', '/conflict')).status !== 409) return 'hides intended errors too'
        return (await request(base, 'GET', '/ok')).status === 200 || 'breaks success'
    } finally { server.stop() }
})

await scenario('T8', 'Migration: a real route converted with the server\'s output keeps its behaviour', async () => {
    const dir = await getApiProject()
    const legacy = `router.post('/orders', async (req, res) => {
  try {
    const order = await Order.create(req.body)
    if (!order) return res.status(409).json({ error: 'Duplicate order' })
    res.status(201).json({ data: order, message: 'Order placed.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})`
    const output = await text('transform-to-async-handler', { pattern: 'callback-try-catch', code: legacy })
    const created = /return ApiResponse\.getInstance\(\)\.setStatusCode\(201\)\.setData\(order\)\.setMessage\('Order placed\.'\)/.exec(output)?.[0]
    const conflict = /throw new ApiError\('Duplicate order', 409\)/.exec(output)?.[0]
    if (!created || !conflict) return 'the output doesn\'t convert this route\'s own responses'
    writeFileSync(join(dir, 'migrated.mjs'), `import express from 'express'
import { ApiResponse, asyncValidatorHandler } from '@qnx/response'
import { ApiError } from '@qnx/errors'
const Order = { create: async (body) => (body.duplicate ? null : { id: 1, ...body }) }
const router = express.Router()
router.post('/orders', asyncValidatorHandler(async (req) => {
  const order = await Order.create(req.body)
  if (!order) ${conflict}
  ${created}
}))
const app = express(); app.use(express.json()); app.use(router)
app.listen(Number(process.env.PORT), () => console.log('listening'))
`)
    const port = await freePort()
    const server = await startServer(dir, 'migrated.mjs', { PORT: String(port) })
    try {
        const base = `http://127.0.0.1:${port}`
        if ((await request(base, 'POST', '/orders', { body: {} })).status !== 201) return 'lost the 201'
        return (await request(base, 'POST', '/orders', { body: { duplicate: true } })).status === 409 || 'lost the 409'
    } finally { server.stop() }
})

for (const [pattern, needle, why] of [
    ['callback-try-catch', 'setStatusCode(201)', 'after drops the 201'],
    ['promise-chain', "ApiError('Not found', 404)", 'after changes the 404 to 400'],
    ['express-next', 'next(err)', 'after bypasses the app error handler']
]) {
    await scenario('T9', `Migration example ${pattern} keeps behaviour`, async () => {
        const output = await text('transform-to-async-handler', { pattern })
        return (output.split('### After')[1]?.includes(needle) && output.includes('Behaviour changes')) || why
    })
}

await scenario('T10', 'Customising a status: setErrorCodes changes the validation code to 422', async () => {
    const dir = await getApiProject()
    const docs = await text('search-docs', { query: 'change validation status code 422' })
    if (!docs.includes('setErrorCodes')) return 'search doesn\'t find it'
    writeFileSync(join(dir, 'codes.mjs'), `import express from 'express'
import { asyncValidatorHandler as H } from '@qnx/response'
import { InvalidValueError, setErrorCodes } from '@qnx/errors'
setErrorCodes({ VALIDATION_ERROR_CODE: 422 })
const app = express()
app.get('/v', H(async () => { throw new InvalidValueError('m', { key: 'k' }) }))
app.listen(Number(process.env.PORT), () => console.log('listening'))
`)
    const port = await freePort()
    const server = await startServer(dir, 'codes.mjs', { PORT: String(port) })
    try { return (await request(`http://127.0.0.1:${port}`, 'GET', '/v')).status === 422 || 'still 400' } finally { server.stop() }
})

await scenario('T11', 'Small packages: the documented examples for core-helpers, message and interfaces work', async () => {
    const dir = newProject('small-packages')
    const commands = []
    for (const name of ['@qnx/core-helpers', '@qnx/message', '@qnx/interfaces']) {
        const docs = await call('get-package-info', { package: name })
        if (docs.isError) return `${name}: no documentation`
        commands.push(docs.text)
        const installed = runInstall(dir, firstInstall(docs.text))
        if (installed.status !== 0) return installed.stderr
    }
    runInstall(dir, 'npm install @qnx/response @qnx/errors express zod@4')
    runInstall(dir, 'npm install -D @types/express@5 @types/node@22')
    const names = ['core-helpers', 'message', 'interfaces']
    commands.forEach((docs, index) => writeFileSync(join(dir, `${names[index]}.ts`), `${blocks(docs)[0]}\nexport {}\n`))
    const errors = typecheck(dir, names.map((name) => `${name}.ts`))
    if (errors) return `tsc: ${errors}`
    const core = runFile(dir, 'core-helpers.ts')
    if (!core.stdout.includes('[ 1, 2 ]') || !core.stdout.includes('[ 5 ]')) return `core-helpers printed ${core.stdout} ${core.stderr}`
    const message = runFile(dir, 'message.ts')
    return message.stderr.includes('Email is a required field.') || `message: ${message.stderr.slice(0, 120)}`
})

// ─── 6. Troubleshooting with real errors ────────────────────────────────────

begin('Troubleshoot real errors: produce it, ask the server, apply the fix')

const realError = (dir, code, options) => {
    writeFileSync(join(dir, 'broken.ts'), code)
    const { stderr, status } = runFile(dir, 'broken.ts', options)
    if (status === 0) throw new Error('Expected this code to fail, and it did not')
    return stderr
}
const diagnose = async (error) => {
    const output = await call('diagnose-error', { error })
    if (output.protocolError || /not found/i.test(output.text) && output.isError) throw new Error('no diagnose-error tool')
    return output.text
}

await scenario('X1', 'Missing auth key: real error → cause names the variable → setting it fixes it', async () => {
    const dir = await getApiProject()
    const error = realError(dir, `import { generateAuthToken } from '@qnx/crypto'\nawait generateAuthToken('u')\n`, { env: { JWT_PRIVATE_KEY: '', JWE_PUBLIC_KEY: '' } })
    const answer = await diagnose(error)
    if (!answer.includes('JWT_PRIVATE_KEY')) return `no usable cause: ${answer.slice(0, 100)}`
    return runFile(dir, 'broken.ts', { env: { JWT_PRIVATE_KEY: JWT.privateKey, JWE_PUBLIC_KEY: JWE.publicKey } }).status === 0 || 'fix did not work'
})
await scenario('X2', 'PEM with literal \\n: real error → the server\'s code fixes it', async () => {
    const dir = await getApiProject()
    const code = `import { toPKCS8Secret } from '@qnx/crypto'\nawait toPKCS8Secret(process.env.JWT_PRIVATE_KEY ?? '', 'ES256')\n`
    const env = { JWT_PRIVATE_KEY: JWT.privateKey.replace(/\n/g, '\\n') }
    const answer = await diagnose(realError(dir, code, { env }))
    const fix = blocks(answer, '').find((block) => block.includes('replace'))
    if (!fix) return `no fix: ${answer.slice(0, 100)}`
    writeFileSync(join(dir, 'fixed.ts'), `${fix}\n${code}`)
    return runFile(dir, 'fixed.ts', { env }).status === 0 || 'fix did not work'
})
await scenario('X3', 'Missing peer dependency: real error → the server\'s command fixes it', async () => {
    const dir = newProject('missing-peer')
    runInstall(dir, 'npm install @qnx/crypto', ['--legacy-peer-deps'])
    const answer = await diagnose(realError(dir, `import '@qnx/crypto'\n`))
    const command = /npm install [^\n]+/.exec(answer)?.[0]
    if (!command) return `no command: ${answer.slice(0, 100)}`
    if (runInstall(dir, command, ['--legacy-peer-deps']).status !== 0) return `"${command}" failed`
    return runFile(dir, 'broken.ts').status === 0 || 'still fails after the command'
})
await scenario('X4', 'zod 3 conflict: real npm output → the server\'s command fixes it', async () => {
    const dir = newProject('zod-conflict')
    runInstall(dir, 'npm install zod@3 express')
    const failed = runInstall(dir, 'npm install @qnx/response @qnx/errors')
    if (failed.status === 0) return 'npm did not fail, so this can\'t be tested'
    const answer = await diagnose(failed.stderr)
    const command = /npm install [^\n]*zod@4[^\n]*/.exec(answer)?.[0]
    if (!command) return `no command: ${answer.slice(0, 100)}`
    if (runInstall(dir, command).status !== 0) return `"${command}" failed`
    return runInstall(dir, 'npm install @qnx/response @qnx/errors').status === 0 || 'still conflicts'
})

const JWT_CASES = [
    ['Symmetric secret, no alg', `import { jwtSign, toSymmetricSecret } from '@qnx/crypto'\nawait jwtSign({}, toSymmetricSecret('x'.repeat(32)))\n`, /alg/],
    ['RS256 key, no alg', `import { jwtSign, toPKCS8Secret } from '@qnx/crypto'\nawait jwtSign({}, await toPKCS8Secret(process.env.K ?? '', 'RS256'))\n`, /alg/],
    ['Bad expiry', `import { jwtSign, toSymmetricSecret } from '@qnx/crypto'\nawait jwtSign({}, toSymmetricSecret('x'.repeat(32)), { alg: 'HS256', expirationTime: 'banana' })\n`, /2h|30m/],
    ['Expired JWT', `import { jwtSign, jwtVerify, toSymmetricSecret } from '@qnx/crypto'\nconst k = toSymmetricSecret('x'.repeat(32))\nawait jwtVerify(await jwtSign({}, k, { alg: 'HS256', expirationTime: '-1s' }), k)\n`, /expired?/i],
    ['Wrong key on verify', `import { jwtSign, jwtVerify, toSymmetricSecret } from '@qnx/crypto'\nawait jwtVerify(await jwtSign({}, toSymmetricSecret('x'.repeat(32)), { alg: 'HS256' }), toSymmetricSecret('y'.repeat(32)))\n`, /signed with a different key/],
    ['Tampered auth token', `import { generateAuthToken, decryptAuthToken } from '@qnx/crypto'\nconst { token } = await generateAuthToken('u')\nawait decryptAuthToken(token.slice(0, -3) + 'AAA')\n`, /changed/],
    ['Public key in the private slot', `import { toPKCS8Secret } from '@qnx/crypto'\nawait toPKCS8Secret(process.env.PUB ?? '', 'ES256')\n`, /BEGIN PRIVATE KEY/],
    ['Key cut short', `import { toPKCS8Secret } from '@qnx/crypto'\nawait toPKCS8Secret('-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----', 'ES256')\n`, /cut off|Copy the whole key/],
    ['Short A256KW secret', `import { jweEncrypt, toSymmetricSecret } from '@qnx/crypto'\nawait jweEncrypt('hi', toSymmetricSecret('short'), { alg: 'A256KW', enc: 'A256GCM' })\n`, /32 for A256KW/],
    ['P-384 key with ES256', `import { jwtSign, toPKCS8Secret } from '@qnx/crypto'\nawait jwtSign({}, await toPKCS8Secret(process.env.P384 ?? '', 'ES256'))\n`, /P-256/],
    ['Garbage token', `import { jwtVerify, toSymmetricSecret } from '@qnx/crypto'\nawait jwtVerify('garbage', toSymmetricSecret('x'.repeat(32)))\n`, /Bearer|complete token/]
]
const P384 = generateKeyPairSync('ec', { namedCurve: 'P-384', ...pem })
for (const [label, code, expected] of JWT_CASES) {
    await scenario('X5', `${label}: real error gets a specific cause`, async () => {
        const dir = await getApiProject()
        const error = realError(dir, code, { env: { K: RSA.privateKey, PUB: JWT.publicKey, P384: P384.privateKey, JWT_PRIVATE_KEY: JWT.privateKey, JWT_PUBLIC_KEY: JWT.publicKey, JWE_PUBLIC_KEY: JWE.publicKey, JWE_PRIVATE_KEY: JWE.privateKey } })
        const answer = await diagnose(error)
        return (answer.includes('**Cause:**') && expected.test(answer)) || `no match for: ${error.split('\n').find((line) => /Error/.test(line))} → ${answer.slice(0, 80)}`
    })
}

await scenario('X6', 'DELETE route returns HTML 404: real response → cause and tested fix', async () => {
    const dir = await getApiProject()
    writeFileSync(join(dir, 'void.mjs'), `import express from 'express'
import { asyncValidatorHandler as H, initializeApiResponse } from '@qnx/response'
const app = express()
app.delete('/broken', H(async () => { /* the work happens here */ }))
app.delete('/fixed', H(async () => initializeApiResponse().setMessage('Deleted.')))
app.listen(Number(process.env.PORT), () => console.log('listening'))
`)
    const port = await freePort()
    const server = await startServer(dir, 'void.mjs', { PORT: String(port) })
    try {
        const base = `http://127.0.0.1:${port}`
        const { raw, status } = await request(base, 'DELETE', '/broken')
        if (status !== 404) return `expected 404, got ${status}`
        const answer = await diagnose(raw)
        if (!/returned nothing/.test(answer)) return `no cause: ${answer.slice(0, 80)}`
        return (await request(base, 'DELETE', '/fixed')).status === 200 || 'fix did not work'
    } finally { server.stop() }
})
await scenario('X7', 'POST with no Content-Type fails validation: real response → cause', async () => {
    const dir = await getApiProject()
    writeFileSync(join(dir, 'body.mjs'), `import express from 'express'
import { z } from 'zod'
import { asyncValidatorHandler as H } from '@qnx/response'
const app = express(); app.use(express.json())
app.post('/x', H(async (req) => z.object({ a: z.string() }).parse(req.body)))
app.listen(Number(process.env.PORT), () => console.log('listening'))
`)
    const port = await freePort()
    const server = await startServer(dir, 'body.mjs', { PORT: String(port) })
    try {
        const response = await fetch(`http://127.0.0.1:${port}/x`, { method: 'POST', body: JSON.stringify({ a: 'b' }) })
        const answer = await diagnose(await response.text())
        return answer.includes('Content-Type') || `no cause: ${answer.slice(0, 80)}`
    } finally { server.stop() }
})
await scenario('X8', 'Logged error is {}: real log line → cause', async () => {
    const answer = await diagnose('{"error":{},"level":"error","message":"Something went wrong","timestamp":"2026-11-05T07:33:08.093Z"}')
    return answer.includes("logger.error('") || `no cause: ${answer.slice(0, 80)}`
})
await scenario('X9', 'TypeScript error from a key helper: real tsc output → cause', async () => {
    const dir = await getApiProject()
    writeFileSync(join(dir, 'ts-broken.ts'), `import { toPKCS8Secret } from '@qnx/crypto'\nawait toPKCS8Secret(process.env.K, 'ES256')\nexport {}\n`)
    const errors = typecheck(dir, ['ts-broken.ts'])
    if (!errors) return 'tsc did not fail'
    const answer = await diagnose(errors)
    return answer.includes('**Cause:**') || `no cause: ${answer.slice(0, 80)}`
})
await scenario('X9b', 'Type error from the @qnx/interfaces Request: real tsc output → the server\'s type fixes it', async () => {
    const dir = await getApiProject()
    runInstall(dir, 'npm install @qnx/interfaces')
    writeFileSync(join(dir, 'ifc-broken.ts'), `import type { Request } from '@qnx/interfaces'\nimport { asyncValidatorHandler } from '@qnx/response'\nexport const h = asyncValidatorHandler<Request>(async (req) => req.user.id)\n`)
    const errors = typecheck(dir, ['ifc-broken.ts'])
    if (!errors) return 'tsc did not fail: the known issue may be fixed, so remove this note from the server'
    const answer = await diagnose(errors)
    const fix = blocks(answer, '').find((block) => block.includes('AuthRequest'))
    if (!fix) return `no fix: ${answer.slice(0, 80)}`
    writeFileSync(join(dir, 'ifc-fixed.ts'), `${fix}\nimport { asyncValidatorHandler } from '@qnx/response'\nexport const h = asyncValidatorHandler<AuthRequest>(async (req) => [req.user.id, req.params, req.query])\n`)
    const after = typecheck(dir, ['ifc-fixed.ts'])
    return !after || `tsc: ${after}`
})
await scenario('X10', 'An error unrelated to these packages isn\'t given an invented cause', async () => {
    const answer = await diagnose('Error: connect ECONNREFUSED 127.0.0.1:5432')
    return (/No known match/.test(answer) && !answer.includes('**Cause:**')) || `answered: ${answer.slice(0, 80)}`
})

// ─── 7. Find bugs in code ───────────────────────────────────────────────────

begin('Find bugs in a developer\'s code')
const BUGGY = `import express from 'express'
import { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'
import { logger } from '@qnx/winston'
import { jwtSign, toSymmetricSecret } from '@qnx/crypto'

const router = express.Router()

router.delete('/items/:id', asyncValidatorHandler(async (req) => {
    await Item.delete(req.params.id)
}))

router.get('/report', asyncValidatorHandler(async () => {
    throw new Error('connection to db-prod failed')
}))

try {
    await work()
} catch (err) {
    logger.error('Work failed', { error: err })
}

const token = await jwtSign({}, toSymmetricSecret('my-secret-string'))
const res = await fetch('/api', { method: 'POST', body: JSON.stringify({ a: 1 }) })
if (client.getError()) show()
`
const FIXED = `import express from 'express'
import { asyncValidatorHandler, initializeApiResponse } from '@qnx/response'
import { ServerError } from '@qnx/errors'
import { logger } from '@qnx/winston'
import { jwtSign, toSymmetricSecret } from '@qnx/crypto'

const router = express.Router()

router.delete('/items/:id', asyncValidatorHandler(async (req) => {
    await Item.delete(req.params.id)
    return initializeApiResponse().setMessage('Deleted.')
}))

router.get('/report', asyncValidatorHandler(async () => {
    throw new ServerError('The report could not be generated.')
}))

try {
    await work()
} catch (err) {
    logger.error('Work failed', err)
}

const token = await jwtSign({}, toSymmetricSecret(process.env.JWT_SECRET ?? ''), { alg: 'HS256', expirationTime: '2h' })
const res = await fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 1 }) })
if (!res.ok) show()
`
const review = async (code) => {
    const output = await call('review-code', { code })
    if (output.isError) throw new Error(`no review tool: ${output.text.slice(0, 60)}`)
    return JSON.parse(output.text).findings
}
await scenario('B1', 'review-code finds every planted bug on the right line, with a fix', async () => {
    const findings = await review(BUGGY)
    const expected = [['handler-returns-nothing', 8], ['plain-error-reaches-client', 13], ['error-nested-in-log-metadata', 19], ['symmetric-sign-without-alg', 22], ['hardcoded-secret', 22], ['jwt-without-expiry', 22], ['fetch-without-content-type', 23], ['client-get-error-check', 24]]
    const missing = expected.filter(([rule, line]) => !findings.some((finding) => finding.rule === rule && finding.line === line && finding.fix))
    return missing.length === 0 || `missed: ${missing.map(([rule]) => rule).join(', ')}`
})
await scenario('B2', 'After applying its fixes, review-code reports nothing', async () => {
    const findings = await review(FIXED)
    return findings.length === 0 || `still flags: ${findings.map(({ rule }) => rule).join(', ')}`
})

// ─── 8. Invalid input ───────────────────────────────────────────────────────

begin('Invalid input gets a clear, detectable error')
const INVALID = [
    ['Missing required enum', 'get-crypto-docs', {}, /topic/],
    ['Unknown enum value', 'get-crypto-docs', { topic: 'bogus' }, /overview/],
    ['Wrong type', 'build-api-response', { type: 123 }, /success/],
    ['jwt-sign without keyType', 'build-crypto-snippet', { operation: 'jwt-sign' }, /keyType/],
    ['jwe-encrypt without plaintext', 'build-crypto-snippet', { operation: 'jwe-encrypt' }, /plaintext/],
    ['Auth token without subject', 'build-crypto-snippet', { operation: 'auth-token-generate' }, /subject/],
    ['Unknown operation', 'build-crypto-snippet', { operation: 'rsa-sign' }, /jwt-sign/],
    ['Symmetric key with ES256', 'build-crypto-snippet', { operation: 'jwt-sign', keyType: 'symmetric', alg: 'ES256' }, /HS256/],
    ['Asymmetric key with HS256', 'build-crypto-snippet', { operation: 'jwt-sign', keyType: 'asymmetric', alg: 'HS256' }, /ES256/],
    ['alg none', 'build-crypto-snippet', { operation: 'jwt-sign', keyType: 'symmetric', alg: 'none' }, /HS256/],
    ['Bad expirationTime', 'build-crypto-snippet', { operation: 'jwt-sign', keyType: 'symmetric', expirationTime: 'banana' }, /2h/],
    ['validation-error without errors', 'build-api-response', { type: 'validation-error' }, /errors/],
    ['invalid-value without fields', 'build-api-response', { type: 'invalid-value' }, /field/],
    ['custom-error without statusCode', 'build-api-response', { type: 'custom-error', error: 'x' }, /statusCode/],
    ['Impossible statusCode', 'build-api-response', { type: 'custom-error', error: 'x', statusCode: 9999 }, /9999/],
    ['ValidationError without fields', 'build-api-error', { errorClass: 'ValidationError', message: 'v' }, /fields/],
    ['InvalidValueError with 2 fields', 'build-api-error', { errorClass: 'InvalidValueError', message: 'v', fields: [{ field: 'a', message: '1' }, { field: 'b', message: '2' }] }, /exactly one/],
    ['ServerError with fields', 'build-api-error', { errorClass: 'ServerError', message: 'v', fields: [{ field: 'a', message: '1' }] }, /fields/],
    ['ApiSuccessResponse without message', 'build-client-response', { responseClass: 'ApiSuccessResponse', data: {} }, /message/],
    ['ApiErrorResponse without errors', 'build-client-response', { responseClass: 'ApiErrorResponse', error: 'x' }, /errors/],
    ['Unknown log level', 'build-file-log-entry', { level: 'fatal', message: 'x' }, /error/],
    ['Migration with neither input', 'transform-to-async-handler', {}, /code|pattern/],
    ['Empty error to diagnose', 'diagnose-error', { error: '' }, /error/],
    ['Empty search', 'search-docs', { query: '' }, /query/],
    ['Unknown tool', 'does-not-exist', {}, /does-not-exist/]
]
for (const [label, tool, args, expected] of INVALID) {
    await scenario('V1', label, async () => {
        const output = await call(tool, args)
        if (!output.isError) return `not flagged as an error: ${output.text.slice(0, 70)}`
        return expected.test(output.text) || `unhelpful message: ${output.text.slice(0, 90)}`
    })
}
const rawPost = (body, headers = {}, target = url) => fetch(target, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body })
await scenario('V2', 'Malformed JSON returns JSON-RPC -32700', async () => (await (await rawPost('{bad')).text()).includes('-32700') || 'HTML page')
await scenario('V3', 'An unknown path returns JSON listing the endpoints', async () => { const response = await rawPost('{}', {}, `${url}/bogus`); return (response.status === 404 && (await response.text()).includes('/mcp/response')) || 'HTML page' })
await scenario('V4', 'The home page describes the server', async () => (await fetch(new URL(url).origin)).status === 200 || 'Cannot GET /')
await scenario('V5', 'CORS preflight allows browser clients', async () => (await fetch(url, { method: 'OPTIONS', headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'POST' } })).headers.get('access-control-allow-origin') === '*' || 'no CORS headers')
await scenario('V6', 'Very large input is rejected with JSON, not a crash', async () => {
    const response = await rawPost(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'review-code', arguments: { code: 'x'.repeat(3_000_000) } } }))
    if (response.status === 413 && (response.headers.get('content-type') ?? '').includes('json')) return true
    return `HTTP ${response.status} ${response.headers.get('content-type')}`
})

// ─── 9. Regression ──────────────────────────────────────────────────────────

begin('Existing tools still work')
await scenario('G1', 'All 14 original tools are still offered', async () => {
    const { tools } = await client.listTools()
    const names = tools.map(({ name }) => name)
    const missing = OLD_TOOLS.filter((name) => !names.includes(name))
    return missing.length === 0 || `missing: ${missing.join(', ')}`
})
const OLD_VALUES = {
    'get-crypto-docs': ['topic', ['overview', 'jwt', 'jwe', 'auth-token', 'key-helpers', 'algorithms', 'all']],
    'get-client-docs': ['topic', ['classes', 'api-response', 'success-response', 'error-response', 'types', 'patterns', 'all']],
    'get-console-log-docs': ['topic', ['usage', 'types', 'patterns', 'all']],
    'get-file-logger-docs': ['topic', ['usage', 'levels', 'output', 'configuration', 'patterns', 'all']],
    'get-error-class-docs': ['errorClass', ['ApiError', 'ValidationError', 'InvalidValueError', 'UnauthenticatedUserError', 'ServerError', 'all']],
    'get-response-docs': ['pattern', ['async-handler', 'success', 'validation-error', 'invalid-value', 'custom-error', 'throw-validation', 'zod-validation', 'unauthenticated', 'resource-route']],
    'transform-to-async-handler': ['pattern', ['callback-query', 'callback-try-catch', 'promise-chain', 'express-next']]
}
await scenario('G2', 'Every original option of every docs tool still works', async () => {
    for (const [tool, [param, values]] of Object.entries(OLD_VALUES)) {
        for (const value of values) {
            const output = await call(tool, { [param]: value })
            if (output.isError || output.text.length < 100) return `${tool} ${value}: ${output.text.slice(0, 60)}`
        }
    }
    return true
})
const VALID_BUILDS = [
    ['build-api-response', { type: 'success', data: { id: 1 }, message: 'Created.' }, (o) => o.statusCode === 200 && o.body.message === 'Created.' && o.producedBy],
    ['build-api-response', { type: 'success' }, (o) => o.statusCode === 200],
    ['build-api-response', { type: 'unauthenticated' }, (o) => o.statusCode === 401 && o.body.errorCode === 'unauthenticated'],
    ['build-api-response', { type: 'server-error', error: 'DB down' }, (o) => o.statusCode === 500 && o.body.serverError.message === 'DB down'],
    ['build-api-error', { errorClass: 'UnauthenticatedUserError', message: 'x' }, (o) => o.code === 401 && o.errorResponse === null],
    ['build-api-error', { errorClass: 'ServerError', message: 'x' }, (o) => o.code === 500 && o.errorResponse === null],
    ['build-client-response', { responseClass: 'ApiResponse', data: { id: 1 }, message: 'ok' }, (o) => o.methods.getData.id === 1 && o.snippet],
    ['build-client-response', { responseClass: 'ApiErrorResponse', error: 'bad', errors: { e: ['m'] }, errorCode: 'E1' }, (o) => o.methods.getErrorCode === 'E1'],
    ['build-file-log-entry', { level: 'info', message: 'hello', metadata: { userId: 1 } }, (o) => o.fileEntry.userId === 1 && o.snippet],
    ['build-console-log', { type: 'success', message: 'ok' }, (o) => o.consoleOutput === '✓  ok' && o.snippet],
    ['build-console-log', { type: 'warning', message: 'w' }, (o) => o.snippet.includes("type: 'warn'")],
    ['build-crypto-snippet', { operation: 'jwe-decrypt' }, (o) => o.snippet.includes('jweDecrypt')],
    ['build-crypto-snippet', { operation: 'auth-token-decrypt' }, (o) => o.snippet.includes('decryptAuthToken')]
]
for (const [tool, args, ok] of VALID_BUILDS) {
    await scenario('G3', `${tool} ${JSON.stringify(args).slice(0, 62)}`, async () => {
        const output = await call(tool, args)
        if (output.isError) return output.text.slice(0, 90)
        return Boolean(ok(JSON.parse(output.text))) || output.text.slice(0, 120)
    })
}
await scenario('G4', 'Repeated calls return identical documentation', async () => {
    const [a, b, c] = await Promise.all([text('get-crypto-docs', { topic: 'all' }), text('get-crypto-docs', { topic: 'all' }), text('get-crypto-docs', { topic: 'all' })])
    return (a === b && b === c) || 'differs'
})

// ─── 10. Accuracy of specific findings from the evaluation ──────────────────

begin('Previously failed findings from the evaluation report')
const FINDINGS = [
    ['B2', 'Logger docs use the form that keeps the error', async () => { const t = await text('get-file-logger-docs', { topic: 'patterns' }); return (!t.includes('{ error }') && t.includes('error as Error')) || 'shows { error }' }],
    ['B2', 'Preview invents no stack for { error }', async () => { const o = await json('build-file-log-entry', { level: 'error', message: 'x', metadata: { error: 'e' } }); return (!o.fileEntry.stack && JSON.stringify(o.notes ?? '').includes('{}')) || 'invented stack, no warning' }],
    ['B3', 'No client example uses if (res.getError()) to detect failure', async () => !/if \(res\.getError\(\)\)/.test(blocks(await text('get-client-docs', { topic: 'all' })).join()) || 'still recommended'],
    ['B3', 'Client POST examples send Content-Type', async () => !/method: 'POST',\s*\n?\s*body/.test(await text('get-client-docs', { topic: 'all' })) || 'an example omits it'],
    ['B3', '"always defined" claims are gone', async () => !(await text('get-client-docs', { topic: 'all' })).includes('always defined') || 'still claimed'],
    ['B5', 'server-error preview warns about stack traces', async () => JSON.stringify(await json('build-api-response', { type: 'server-error' })).includes('stack trace') || 'no warning'],
    ['B5', 'Docs explain setCallback and ServerError', async () => { const t = await text('get-response-docs', { pattern: 'server-error' }); return (t.includes('setCallback') && t.includes('ServerError')) || 'not covered' }],
    ['B7', 'Docs say auth tokens never expire', async () => (await text('get-crypto-docs', { topic: 'auth-token' })).includes('never expire') || 'not stated'],
    ['B7', 'Decrypt snippet doesn\'t imply expiry', async () => !(await json('build-crypto-snippet', { operation: 'auth-token-decrypt' })).snippet.includes('invalid, expired') || 'implies expiry'],
    ['B8', 'Unauthenticated default is 401', async () => (await text('get-response-docs', { pattern: 'unauthenticated' })).includes('default 401') || 'says 500'],
    ['B9', 'Repeated field keeps both messages', async () => (await json('build-api-error', { errorClass: 'ValidationError', message: 'm', fields: [{ field: 'a', message: '1' }, { field: 'a', message: '2' }] })).errorResponse.errors.a.length === 2 || 'keeps the last only'],
    ['B9', 'InvalidValueError keeps the given message', async () => (await json('build-api-error', { errorClass: 'InvalidValueError', message: 'bad', fields: [{ field: 'a', message: 'other' }] })).message === 'bad' || 'replaced'],
    ['B10', 'silly preview says nothing is written', async () => (await json('build-file-log-entry', { level: 'silly', message: 'x' })).fileEntry === null || 'previews an entry'],
    ['B11', 'Empty errors preview matches the real body', async () => { const o = await json('build-api-response', { type: 'validation-error', errors: {} }); return same(o.body, { errors: {} }) || JSON.stringify(o.body) }],
    ['B13', 'Snippets check process.env', async () => !/\(process\.env\.\w+[,)]/.test((await json('build-crypto-snippet', { operation: 'jwt-sign', keyType: 'symmetric' })).snippet) || 'bare process.env'],
    ['B14', 'jweEncrypt options documented as required together', async () => (await text('get-crypto-docs', { topic: 'jwe' })).includes('options?: { alg: string; enc: string }') || 'shown as optional'],
    ['B15', 'Crypto install names uuid', async () => (await text('get-crypto-docs', { topic: 'overview' })).includes('jose uuid') || 'omits uuid'],
    ['B16', 'Void-return 404 documented', async () => (await text('search-docs', { query: 'handler returns nothing 404' })).includes('404') || 'not found'],
    ['B16', 'setError replacing fields documented', async () => /Replaces everything/.test(await text('get-error-class-docs', { errorClass: 'all' })) || 'not stated'],
    ['B17', 'Key generation documented', async () => { const t = await text('get-crypto-docs', { topic: 'all' }); return (t.includes('openssl') && t.includes('generateKeyPairSync')) || 'not covered' }],
    ['Low', 'get-response-docs has an all option', async () => { const o = await call('get-response-docs', { pattern: 'all' }); return !o.isError || 'rejected' }],
    ['Low', 'No README link returning 404', async () => (await fetch(new URL(url).origin)).status !== 404 || 'home page is 404'],
    ['Low', 'Auth example imports what it uses', async () => (await text('get-crypto-docs', { topic: 'auth-token' })).includes("import { UnauthenticatedUserError } from '@qnx/errors'") || 'missing import']
]
for (const [id, label, run] of FINDINGS) await scenario(id, label, run)

// ─── Summary ────────────────────────────────────────────────────────────────

await client.close().catch(() => undefined)
const failed = results.filter(({ status }) => status === 'FAIL')
console.log(`\n# Summary\nServer: ${info?.name} ${info?.version} at ${url}`)
for (const name of [...new Set(results.map((result) => result.section))]) {
    const inSection = results.filter((result) => result.section === name)
    console.log(`${String(inSection.filter(({ status }) => status === 'PASS').length).padStart(3)}/${String(inSection.length).padEnd(3)} ${name}`)
}
console.log(`${String(results.length - failed.length).padStart(3)}/${String(results.length).padEnd(3)} TOTAL`)
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ url, server: info, connectAttempts, results }, null, 2))
process.exit(failed.length === 0 ? 0 : 1)
