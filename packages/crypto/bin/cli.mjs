// The qnx-crypto command. qnx-crypto.mjs runs it with the real terminal and files; tests pass their own.
import { parseArgs } from 'node:util'

export const usage = `Usage: qnx-crypto generate-keys [options]

Creates the keys for generateAuthToken and decryptAuthToken. In a terminal it asks
a few questions; press Enter to take the recommended answer.

Options:
  --jwt-alg <alg>  Signing: ES256 (recommended), ES384, ES512 or EdDSA
  --jwe-alg <alg>  Encryption: ECDH-ES+A128KW (recommended) or ECDH-ES+A256KW
  --out <file>     Save the .env lines to <file>, or "-" to print them
  --jwks <file>    Also save the public keys as a JWKS
  --no-jwks        Don't create a JWKS
  --force          Overwrite existing files
  -y, --yes        Don't ask, use the defaults
  -h, --help       Show this help

Examples:
  npx @qnx/crypto generate-keys
  npx @qnx/crypto generate-keys --yes --out .env.keys --jwks jwks.json`

const DEFAULT_ENV_FILE = '.env.keys'
const DEFAULT_JWKS_FILE = 'jwks.json'
const LABEL_WIDTH = 13

class Cancelled extends Error {}
class UsageError extends Error {}

/** Colors and cursor control, only for a terminal. */
function createUi(io) {
  const paint = (code) => (text) => (io.color ? `\x1b[${code}m${text}\x1b[0m` : String(text))
  const c = {
    bold: paint(1),
    dim: paint(2),
    red: paint(31),
    green: paint(32),
    yellow: paint(33),
    cyan: paint(36)
  }
  const write = (text) => io.stderr.write(text)

  async function ask(question) {
    const answer = await io.ask(question)
    // null means the input ended (Ctrl+D) or was interrupted (Ctrl+C).
    if (answer === null) throw new Cancelled()
    return answer.trim()
  }

  /**
   * Shows a question until it gets a valid answer, then replaces it with one line: ✔ Label  answer.
   * Without cursor control the question just stays on screen.
   */
  async function prompt({ label, lines = [], input, parse }) {
    let error = ''
    let shown = false
    for (;;) {
      const block = [`  ${c.cyan('?')} ${c.bold(label)}`, ...lines]
      if (error) block.push(`    ${c.red(error)}`)
      // A terminal without cursor control keeps what's on screen, so the question is shown once.
      if (io.ansi || !shown) write(`${block.join('\n')}\n`)
      shown = true
      const result = parse(await ask(`  ${c.cyan('›')} ${input ? c.dim(input) + ' ' : ''}`))
      // The answer line is one more line on screen.
      if (io.ansi) write(`\x1b[${block.length + 1}A\x1b[0J`)
      if (!result.error) {
        if (io.ansi)
          write(`  ${c.green('✔')} ${label.padEnd(LABEL_WIDTH)} ${c.cyan(result.shown)}\n`)
        return result.value
      }
      error = result.error
      if (!io.ansi) write(`    ${error}\n`)
    }
  }

  return {
    c,
    write,
    choose: (label, choices) =>
      prompt({
        label,
        lines: choices.map(
          (choice, index) =>
            `    ${c.dim(index + 1)}  ${choice}${index === 0 ? `  ${c.green('recommended')}` : ''}`
        ),
        input: `1-${choices.length}, Enter for ${choices[0]}`,
        parse(answer) {
          const byName = choices.find((choice) => choice.toLowerCase() === answer.toLowerCase())
          const byNumber = /^\d+$/.test(answer) ? choices[Number(answer) - 1] : undefined
          const value = answer === '' ? choices[0] : (byNumber ?? byName)
          return value
            ? { value, shown: value }
            : { error: `Type 1-${choices.length}, or press Enter.` }
        }
      }),
    text: (label, fallback) =>
      prompt({
        label,
        input: `Enter for ${fallback}`,
        parse: (answer) => {
          const value = answer || fallback
          return { value, shown: value === '-' ? 'print here' : value }
        }
      }),
    confirm: (label, defaultYes, shownYes = 'yes') =>
      prompt({
        label,
        input: defaultYes ? 'Y/n' : 'y/N',
        parse(answer) {
          const value =
            answer === ''
              ? defaultYes
              : /^y(es)?$/i.test(answer)
                ? true
                : /^no?$/i.test(answer)
                  ? false
                  : undefined
          if (value === undefined) return { error: 'Type y or n.' }
          return { value, shown: value ? shownYes : 'no' }
        }
      })
  }
}

function checkChoice(name, value, allowed) {
  if (value !== undefined && !allowed.includes(value)) {
    throw new UsageError(`${name} must be one of ${allowed.join(', ')}, not "${value}".`)
  }
}

function writeFile(io, path, text, secret) {
  try {
    io.write(path, text, { secret })
  } catch (error) {
    throw new UsageError(`Couldn't write ${path}: ${error.message}`)
  }
}

/**
 * Runs the command.
 *
 * @param {object} lib - generateAuthKeys, formatAuthKeyEnv and the algorithm lists from @qnx/crypto.
 * @param {object} io - See cli.d.mts.
 * @returns {Promise<number>} The exit code.
 */
export async function run(lib, io) {
  let values, positionals
  try {
    ;({ values, positionals } = parseArgs({
      args: io.argv,
      allowPositionals: true,
      options: {
        'jwt-alg': { type: 'string' },
        'jwe-alg': { type: 'string' },
        out: { type: 'string' },
        jwks: { type: 'string' },
        'no-jwks': { type: 'boolean', default: false },
        force: { type: 'boolean', default: false },
        yes: { type: 'boolean', short: 'y', default: false },
        help: { type: 'boolean', short: 'h', default: false }
      }
    }))
    if (values.help) {
      io.stdout.write(`${usage}\n`)
      return 0
    }
    if (positionals.length !== 1 || positionals[0] !== 'generate-keys') {
      throw new UsageError(
        positionals.length ? `Unknown command: ${positionals.join(' ')}` : 'Missing command.'
      )
    }
    checkChoice('--jwt-alg', values['jwt-alg'], lib.authTokenSigningAlgorithms)
    checkChoice('--jwe-alg', values['jwe-alg'], lib.authTokenEncryptionAlgorithms)
    if (values.jwks !== undefined && values['no-jwks'])
      throw new UsageError('Pass --jwks or --no-jwks, not both.')
    if (values.out === '')
      throw new UsageError('--out needs a file name, or "-" to print the lines.')
    if (values.jwks === '' || values.jwks === '-') throw new UsageError('--jwks needs a file name.')
  } catch (error) {
    io.stderr.write(`${error.message}\n\n${usage}\n`)
    return 1
  }

  const ui = createUi(io)
  const { c } = ui
  const interactive = io.interactive && !values.yes
  try {
    if (interactive) ui.write(`\n  ${c.bold('qnx-crypto')}  ${c.dim('Keys for auth tokens')}\n\n`)

    const jwtAlg =
      values['jwt-alg'] ??
      (interactive ? await ui.choose('Signing', lib.authTokenSigningAlgorithms) : 'ES256')
    const jweAlg =
      values['jwe-alg'] ??
      (interactive
        ? await ui.choose('Encryption', lib.authTokenEncryptionAlgorithms)
        : 'ECDH-ES+A128KW')

    // When the output is redirected (`> file`), the lines go there and there's nothing to ask.
    let out = values.out
    if (out === undefined) {
      out =
        interactive && io.stdoutIsTerminal ? await ui.text('Save keys to', DEFAULT_ENV_FILE) : '-'
    }

    let jwks = values['no-jwks'] ? undefined : values.jwks
    if (jwks === undefined && !values['no-jwks'] && interactive) {
      // --jwks picks another file name.
      const wanted = await ui.confirm('Public JWKS', true, DEFAULT_JWKS_FILE)
      if (wanted) jwks = DEFAULT_JWKS_FILE
    }
    if (jwks !== undefined && jwks === out)
      throw new UsageError('The .env lines and the JWKS need different files.')

    // Checked before generating, so nothing is written when the command can't finish.
    for (const file of [out, jwks]) {
      if (file === undefined || file === '-' || !io.exists(file) || values.force) continue
      if (!interactive)
        throw new UsageError(`${file} already exists. Pass --force to overwrite it.`)
      if (!(await ui.confirm(`Overwrite ${file}?`, false))) {
        ui.write(`\n  ${c.yellow('!')} Nothing was written.\n\n`)
        return 1
      }
    }

    const { env, jwks: publicJwks } = await lib.generateAuthKeys({ jwtAlg, jweAlg })
    const envText = lib.formatAuthKeyEnv(env)

    if (out === '-') io.stdout.write(envText)
    else writeFile(io, out, envText, true)
    if (jwks !== undefined) writeFile(io, jwks, `${JSON.stringify(publicJwks, null, 2)}\n`, false)

    const files = []
    if (out !== '-') files.push([out, 'private keys, copy them into your .env'])
    if (jwks !== undefined) files.push([jwks, 'public keys, safe to share'])
    const width = Math.max(0, ...files.map(([name]) => name.length))
    const summary = [
      `  ${c.green('✔')} ${c.bold(`Keys created`)} ${c.dim(`(${jwtAlg}, ${jweAlg})`)}`
    ]
    if (files.length) {
      summary.push(
        '',
        ...files.map(([name, what]) => `    ${c.cyan(name.padEnd(width))}  ${c.dim(what)}`)
      )
    }
    if (out !== '-' && io.isUnignoredInGit(out)) {
      summary.push('', `  ${c.yellow('!')} git doesn't ignore ${out}. Add it to .gitignore.`)
    }
    summary.push(
      '',
      `  ${c.dim('Keep the private keys secret. Old tokens stop working when you switch keys.')}`
    )
    ui.write(`\n${summary.join('\n')}\n\n`)
    return 0
  } catch (error) {
    if (error instanceof Cancelled) {
      ui.write(`\n  ${c.yellow('!')} Cancelled. Nothing was written.\n\n`)
      return 130
    }
    if (error instanceof UsageError) {
      ui.write(`${error.message}\n`)
      return 1
    }
    throw error
  }
}
