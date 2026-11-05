import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import ts from 'typescript'
import { createMcpServer, type McpServerConfig } from '../../server'

export interface ToolCall {
    text: string
    isError: boolean
    json: () => any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export async function callTool(name: string, args: Record<string, unknown> = {}, config?: McpServerConfig): Promise<ToolCall> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await createMcpServer(config).connect(serverTransport)
    const client = new Client({ name: 'contract-test', version: '1.0.0' }, { capabilities: {} })
    await client.connect(clientTransport)
    const result = await client.callTool({ name, arguments: args })
    await client.close()
    const text = (result.content as { text: string }[])[0].text
    return { text, isError: result.isError === true, json: () => JSON.parse(text) }
}

/** Returns the fenced code blocks of one language from a Markdown document. */
export function fencedBlocks(markdown: string, language = 'ts') {
    const pattern = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\`\`\``, 'g')
    return [...markdown.matchAll(pattern)].map((match) => match[1])
}

/**
 * Runs a generated snippet as a developer would paste it: TypeScript types are removed, its imports
 * come from `modules`, and `scope` supplies whatever it expects to exist already. `tail` runs at the end
 * and can return the snippet's variables to the test.
 */
export async function runSnippet(
    snippet: string,
    modules: Record<string, Record<string, unknown>>,
    scope: Record<string, unknown> = {},
    tail = ''
) {
    const javascript = ts.transpileModule(`${snippet}\nexport {}`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true }
    }).outputText

    const body = javascript
        .replace(/^export\s*\{\s*\};?\s*$/gm, '')
        .replace(/^export\s+(const|function|async function)/gm, '$1')
        .replace(/^import\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm, (_, clause: string, source: string) => {
            if (!(source in modules)) throw new Error(`Snippet imports ${source}, which the test didn't provide`)
            const named = /\{([\s\S]*)\}/.exec(clause)?.[1]
            const fallback = clause.replace(/\{[\s\S]*\}/, '').replace(',', '').trim()
            const lines: string[] = []
            if (fallback) lines.push(`const ${fallback} = __modules[${JSON.stringify(source)}].default ?? __modules[${JSON.stringify(source)}];`)
            if (named?.trim()) lines.push(`const { ${named.replace(/\s+as\s+/g, ': ')} } = __modules[${JSON.stringify(source)}];`)
            return lines.join('\n')
        })

    const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor
    const names = Object.keys(scope)
    const run = new AsyncFunction('__modules', ...names, `${body}\n${tail}`)
    return run(modules, ...names.map((name) => scope[name]))
}

export interface CompileFailure {
    file: string
    message: string
}

/** Type-checks snippets with --strict, resolving the @qnx/* packages from their source. */
export function compileStrict(snippets: Record<string, string>, repoRoot: string): CompileFailure[] {
    const files = new Map(Object.entries(snippets).map(([name, code]) => [`${repoRoot}/__snippets__/${name}.ts`, `${code}\nexport {}\n`]))
    const options: ts.CompilerOptions = {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        esModuleInterop: true,
        lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
        types: ['node'],
        typeRoots: [`${repoRoot}/node_modules/@types`],
        baseUrl: repoRoot,
        ignoreDeprecations: '6.0',
        paths: {
            '@qnx/client': ['packages/client/src/index.ts'],
            '@qnx/crypto': ['packages/crypto/src/index.ts'],
            '@qnx/errors': ['packages/errors/src/index.ts'],
            '@qnx/response': ['packages/response/src/index.ts'],
            '@qnx/winston': ['packages/winston/src/index.ts'],
            '@qnx/log': ['packages/log/src/index.ts'],
            '@qnx/core-helpers': ['packages/core-helpers/src/index.ts'],
            '@qnx/interfaces': ['packages/interfaces/src/index.ts'],
            '@qnx/message': ['packages/message/src/index.ts']
        }
    } as ts.CompilerOptions

    const host = ts.createCompilerHost(options)
    const { fileExists, readFile, getSourceFile } = host
    host.fileExists = (name) => files.has(name) || fileExists(name)
    host.readFile = (name) => files.get(name) ?? readFile(name)
    host.getSourceFile = (name, languageVersion) => {
        const content = files.get(name)
        return content === undefined ? getSourceFile(name, languageVersion) : ts.createSourceFile(name, content, languageVersion)
    }

    const program = ts.createProgram([...files.keys()], options, host)
    return ts.getPreEmitDiagnostics(program)
        .filter((diagnostic) => diagnostic.file && files.has(diagnostic.file.fileName))
        .map((diagnostic) => ({
            file: diagnostic.file?.fileName.split('/').pop() ?? '',
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
        }))
}
