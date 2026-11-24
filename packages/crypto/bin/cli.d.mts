export declare const usage: string

export interface CliIo {
  argv: string[]
  stdout: { write(text: string): unknown }
  stderr: { write(text: string): unknown }
  /** stdin and stderr are a terminal, so questions can be asked. */
  interactive: boolean
  stdoutIsTerminal: boolean
  /** The terminal understands cursor movement, so answered questions are redrawn as one line. */
  ansi: boolean
  /** Use colors. */
  color: boolean
  /** Resolves with the answer, or null when the input ends or is interrupted. */
  ask(question: string): Promise<string | null>
  exists(path: string): boolean
  write(path: string, text: string, options: { secret: boolean }): void
  isUnignoredInGit(path: string): boolean
}

/** Runs qnx-crypto with the given library and I/O, and resolves with the exit code. */
export declare function run(lib: typeof import('../src/index'), io: CliIo): Promise<number>
