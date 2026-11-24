import { parseEnv } from 'node:util'
import { describe, expect, it } from 'vitest'
import * as lib from '../../index'
import { run, type CliIo } from '../../../bin/cli.mjs'

/** A terminal session: answers are given in order, and a missing answer is Ctrl+C. */
function session(answers: string[] = [], options: Partial<CliIo> & { files?: string[] } = {}) {
    const written = new Map<string, { text: string; secret: boolean }>()
    const existing = new Set(options.files)
    const questions: string[] = []
    let stdout = ''
    let stderr = ''
    const io: CliIo = {
        argv: ['generate-keys'],
        stdout: { write: (text) => (stdout += text) },
        stderr: { write: (text) => (stderr += text) },
        interactive: true,
        stdoutIsTerminal: true,
        ansi: false,
        color: false,
        ask: async (question) => {
            questions.push(question)
            return answers.length ? (answers.shift() as string) : null
        },
        exists: (path) => existing.has(path) || written.has(path),
        write: (path, text, { secret }) => void written.set(path, { text, secret }),
        isUnignoredInGit: () => false,
        ...options
    }
    return {
        run: () => run(lib, io),
        written,
        questions,
        get stdout() {
            return stdout
        },
        get stderr() {
            return stderr
        }
    }
}

const envOf = (text: string | undefined) => parseEnv(text ?? '')

describe('qnx-crypto generate-keys in a terminal', () => {
    it('uses the recommended choice for every question answered with Enter', async () => {
        const s = session(['', '', '', ''])

        expect(await s.run()).toBe(0)

        expect(s.questions).toHaveLength(4)
        expect(s.stderr).toContain('1  ES256  recommended')
        expect(s.stderr).toContain('1  ECDH-ES+A128KW  recommended')
        const env = envOf(s.written.get('.env.keys')?.text)
        expect([env.JWT_ALG, env.JWE_ALG]).toEqual(['ES256', 'ECDH-ES+A128KW'])
        expect(s.written.get('.env.keys')?.secret).toBe(true)
        expect(JSON.parse(s.written.get('jwks.json')?.text ?? '').keys).toHaveLength(2)
        expect(s.written.get('jwks.json')?.secret).toBe(false)
        expect(s.stdout).toBe('')
    })

    it('accepts a number or a name, in any case', async () => {
        const s = session(['4', 'ecdh-es+a256kw', 'prod.env', 'n'])

        expect(await s.run()).toBe(0)

        const env = envOf(s.written.get('prod.env')?.text)
        expect([env.JWT_ALG, env.JWE_ALG]).toEqual(['EdDSA', 'ECDH-ES+A256KW'])
        expect([...s.written.keys()]).toEqual(['prod.env'])
    })

    it('asks again after an invalid answer', async () => {
        const s = session(['9', 'RS256', '0', '3', '', '', 'maybe', 'n'])

        expect(await s.run()).toBe(0)

        expect(s.stderr.match(/Type 1-4, or press Enter\./g)).toHaveLength(3)
        expect(s.stderr).toContain('Type y or n.')
        // Without cursor control, the question is shown once, not again after each error.
        expect(s.stderr.match(/\? Signing/g)).toHaveLength(1)
        expect(envOf(s.written.get('.env.keys')?.text).JWT_ALG).toBe('ES512')
    })

    it('prints the lines when the answer is "-"', async () => {
        const s = session(['', '', '-', 'n'])

        expect(await s.run()).toBe(0)

        expect(envOf(s.stdout).JWT_PRIVATE_KEY).toMatch(/^-----BEGIN PRIVATE KEY-----/)
        expect(s.written.size).toBe(0)
    })

    it('does not ask where to save when the output is redirected', async () => {
        const s = session(['', '', 'y'], { stdoutIsTerminal: false })

        expect(await s.run()).toBe(0)

        expect(s.questions.some((question) => question.includes('Save the .env lines'))).toBe(false)
        expect(envOf(s.stdout).JWT_ALG).toBe('ES256')
        expect([...s.written.keys()]).toEqual(['jwks.json'])
    })

    it('skips the questions that flags answer', async () => {
        const s = session(['', ''], {
            argv: ['generate-keys', '--jwt-alg', 'ES384', '--out', 'a.env', '--no-jwks']
        })

        expect(await s.run()).toBe(0)

        expect(s.questions).toHaveLength(1)
        expect(envOf(s.written.get('a.env')?.text).JWT_ALG).toBe('ES384')
    })

    it('asks before overwriting, and writes nothing when the answer is no', async () => {
        const s = session(['', '', '', '', ''], { files: ['.env.keys'] })

        expect(await s.run()).toBe(1)

        expect(s.stderr).toContain('? Overwrite .env.keys?')
        expect(s.questions.at(-1)).toContain('y/N')
        expect(s.written.size).toBe(0)
        expect(s.stderr).toContain('Nothing was written.')
    })

    it('overwrites when the answer is yes', async () => {
        const s = session(['', '', '', '', 'y'], { files: ['.env.keys'] })

        expect(await s.run()).toBe(0)

        expect(s.written.has('.env.keys')).toBe(true)
    })

    it('writes nothing when cancelled', async () => {
        const s = session(['', ''])

        expect(await s.run()).toBe(130)

        expect(s.written.size).toBe(0)
        expect(s.stdout).toBe('')
        expect(s.stderr).toContain('Cancelled. Nothing was written.')
    })

    it('warns when git does not ignore the key file', async () => {
        const s = session(['', '', '', 'n'], { isUnignoredInGit: (path) => path === '.env.keys' })

        expect(await s.run()).toBe(0)

        expect(s.stderr).toContain("git doesn't ignore .env.keys. Add it to .gitignore.")
    })

    it('reports a file it cannot write, without a stack trace', async () => {
        const s = session(['', '', '', 'n'], {
            write: () => {
                throw new Error('EACCES: permission denied')
            }
        })

        expect(await s.run()).toBe(1)

        expect(s.stderr).toContain("Couldn't write .env.keys: EACCES: permission denied")
    })
})

describe('qnx-crypto generate-keys look', () => {
    it('replaces each answered question with one line when the terminal has cursor control', async () => {
        const s = session(['4', '', '', 'n'], { ansi: true })

        expect(await s.run()).toBe(0)

        expect(s.stderr).toContain('✔ Signing       EdDSA')
        expect(s.stderr).toContain('✔ Encryption    ECDH-ES+A128KW')
        expect(s.stderr).toContain('✔ Save keys to  .env.keys')
        expect(s.stderr).toContain('✔ Public JWKS   no')
        // Moves up over the question (5 lines for Signing: title, 4 choices, plus the answer line).
        expect(s.stderr).toContain('\x1b[6A\x1b[0J')
    })

    it('uses colors only when asked to', async () => {
        const plain = session(['', '', '', ''])
        const colored = session(['', '', '', ''], { color: true })

        await plain.run()
        await colored.run()

        expect(plain.stderr).not.toContain('\x1b[')
        expect(colored.stderr).toContain('\x1b[32m✔\x1b[0m')
    })

    it('lists what each file holds', async () => {
        const s = session(['', '', '', ''])

        await s.run()

        expect(s.stderr).toMatch(/\.env\.keys {2}private keys, copy them into your \.env/)
        expect(s.stderr).toMatch(/jwks\.json {2}public keys, safe to share/)
    })
})

describe('qnx-crypto generate-keys without questions', () => {
    it.each([
        ['without a terminal', { interactive: false }],
        ['with --yes', { argv: ['generate-keys', '--yes'] }]
    ])('uses the defaults and prints the lines %s', async (_label, options) => {
        const s = session([], options)

        expect(await s.run()).toBe(0)

        expect(s.questions).toEqual([])
        const env = envOf(s.stdout)
        expect([env.JWT_ALG, env.JWE_ALG]).toEqual(['ES256', 'ECDH-ES+A128KW'])
        expect(s.written.size).toBe(0)
    })

    it('fails instead of asking when a file exists', async () => {
        const s = session([], {
            interactive: false,
            argv: ['generate-keys', '--jwks', 'jwks.json'],
            files: ['jwks.json']
        })

        expect(await s.run()).toBe(1)

        expect(s.stderr).toContain('jwks.json already exists. Pass --force to overwrite it.')
        expect(s.stdout).toBe('')
    })

    it('overwrites with --force', async () => {
        const s = session([], {
            interactive: false,
            argv: ['generate-keys', '--out', 'k.env', '--force'],
            files: ['k.env']
        })

        expect(await s.run()).toBe(0)

        expect(s.written.has('k.env')).toBe(true)
    })

    it.each([
        [
            ['generate-keys', '--jwt-alg', 'RS256'],
            '--jwt-alg must be one of ES256, ES384, ES512, EdDSA, not "RS256".'
        ],
        [
            ['generate-keys', '--jwe-alg', 'dir'],
            '--jwe-alg must be one of ECDH-ES+A128KW, ECDH-ES+A256KW, not "dir".'
        ],
        [['generate-keys', '--jwks', 'a.json', '--no-jwks'], 'Pass --jwks or --no-jwks, not both.'],
        [['generate-keys', '--jwks', '-'], '--jwks needs a file name.'],
        [
            ['generate-keys', '--out', 'same', '--jwks', 'same'],
            'The .env lines and the JWKS need different files.'
        ],
        [['generate-keys', '--colour'], "Unknown option '--colour'"],
        [['make-keys'], 'Unknown command: make-keys'],
        [[], 'Missing command.']
    ])('rejects %j', async (argv, message) => {
        const s = session([], { interactive: false, argv })

        expect(await s.run()).toBe(1)

        expect(s.stderr).toContain(message)
        expect(s.stdout).toBe('')
    })

    it('prints help', async () => {
        const s = session([], { argv: ['--help'] })

        expect(await s.run()).toBe(0)

        expect(s.stdout).toContain('Usage: qnx-crypto generate-keys [options]')
    })
})
