import type { McpServerConfig } from '../server'
import { clientDocs } from '../tools/client-docs.tool'
import { consoleLogDocs } from '../tools/console-log-docs.tool'
import { errorClassDocs, errorCodesDocs, errorSummaryDocs } from '../tools/create-error-instance.tool'
import { cryptoDocs } from '../tools/crypto-docs.tool'
import { guides } from '../tools/guide.tool'
import { loggerDocs } from '../tools/logger-docs.tool'
import { responseDocs } from '../tools/response-pattern.tool'
import { knownErrors } from './known-errors'
import { packages, renderCatalogue, renderPackage } from './packages'

export interface DocSection {
    package: string
    source: string
    title: string
    text: string
}

const fromTool = (
    name: keyof McpServerConfig,
    tool: string,
    param: string,
    docs: Record<string, string>
): DocSection[] => Object.entries(docs).map(([topic, text]) => ({
    package: `@qnx/${name}`,
    source: `${tool} { "${param}": "${topic}" }`,
    title: text.match(/^#+\s+(.+)$/m)?.[1] ?? topic,
    text
}))

function sectionsFor(config: McpServerConfig): DocSection[] {
    const sections: DocSection[] = []
    if (config.crypto) sections.push(...fromTool('crypto', 'get-crypto-docs', 'topic', cryptoDocs))
    if (config.response) sections.push(...fromTool('response', 'get-response-docs', 'pattern', responseDocs))
    if (config.client) sections.push(...fromTool('client', 'get-client-docs', 'topic', clientDocs))
    if (config.winston) sections.push(...fromTool('winston', 'get-file-logger-docs', 'topic', loggerDocs))
    if (config.log) sections.push(...fromTool('log', 'get-console-log-docs', 'topic', consoleLogDocs))
    if (config.errors) {
        sections.push(...fromTool('errors', 'get-error-class-docs', 'errorClass', errorClassDocs))
        sections.push({ package: '@qnx/errors', source: 'get-error-class-docs { "errorClass": "all" }', title: 'Error class summary', text: errorSummaryDocs })
        sections.push({ package: '@qnx/errors', source: 'get-error-class-docs { "errorClass": "all" }', title: 'Customizing error codes', text: errorCodesDocs })
    }

    for (const info of packages) {
        // A package with its own tools is searched through those, unless it's in another scope.
        if (!info.scope || config[info.scope]) {
            sections.push({
                package: info.name,
                source: `get-package-info { "package": "${info.name}" }`,
                title: `${info.name} overview and exports`,
                text: renderPackage(info)
            })
        }
    }
    sections.push({
        package: 'All packages',
        source: 'get-package-info { "package": "all" }',
        title: 'Which @qnx/* packages exist',
        text: renderCatalogue()
    })

    for (const [topic, { packages: guidePackages, text }] of Object.entries(guides)) {
        if (guidePackages.some((name) => config[name])) {
            sections.push({
                package: guidePackages.map((name) => `@qnx/${name}`).join(', '),
                source: `get-guide { "topic": "${topic}" }`,
                title: text.match(/^#\s+(.+)$/m)?.[1] ?? topic,
                text
            })
        }
    }

    for (const known of knownErrors) {
        if (known.package !== 'mcp' && config[known.package]) {
            sections.push({
                package: `@qnx/${known.package}`,
                source: 'diagnose-error',
                title: `Error: ${known.title}`,
                text: [known.title, known.patterns.map((pattern) => pattern.source).join(' '), known.cause, known.fix, known.code ?? ''].join('\n')
            })
        }
    }
    return sections
}

const STOP_WORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'should', 'that', 'the', 'this', 'to', 'use', 'using', 'what', 'when', 'where', 'which', 'why', 'with', 'you', 'your', 'qnx'])

const tokenize = (text: string) => text.toLowerCase().match(/[a-z0-9_@$][a-z0-9_$-]*/g) ?? []

/** Long terms match by prefix, so "expire" also finds "expiry" and "expiration". */
function matcher(term: string) {
    if (term.length <= 4) return (token: string) => token === term || token === `${term}s`
    const stem = term.slice(0, term.length >= 7 ? term.length - 3 : 5)
    return (token: string) => token.startsWith(stem)
}

function excerpt(text: string, matches: (token: string) => boolean, maxLength = 700) {
    const paragraphs = text.split(/\n{2,}/)
    let best = 0
    let bestScore = -1
    paragraphs.forEach((paragraph, index) => {
        if (/^#+\s/.test(paragraph) && !paragraph.includes('\n')) return
        const score = tokenize(paragraph).filter(matches).length
        if (score > bestScore) {
            best = index
            bestScore = score
        }
    })
    let output = paragraphs[best]
    // Keeps a code block or table with the sentence that introduces it.
    if (output.endsWith(':') && paragraphs[best + 1]) output += `\n\n${paragraphs[best + 1]}`
    if (output.length > maxLength) output = `${output.slice(0, maxLength).trimEnd()}…`
    // A paragraph break inside a code block can leave one fence behind, which would swallow what follows.
    const fences = output.match(/^```.*$/gm) ?? []
    return fences.length % 2 === 0 ? output : output.replace(/^```.*\n?/gm, '')
}

export interface SearchHit {
    package: string
    title: string
    source: string
    excerpt: string
}

export function searchDocs(query: string, config: McpServerConfig, limit = 5): SearchHit[] {
    const terms = [...new Set(tokenize(query))].filter((term) => !STOP_WORDS.has(term))
    if (terms.length === 0) return []
    const phrase = query.trim().toLowerCase()
    const matchers = terms.map(matcher)

    const scored = sectionsFor(config).map((section) => {
        const titleTokens = tokenize(section.title)
        const tokens = tokenize(section.text)
        let matched = 0
        let score = 0
        for (const matches of matchers) {
            const inText = tokens.filter(matches).length
            const inTitle = titleTokens.filter(matches).length
            if (inText > 0 || inTitle > 0) matched++
            score += Math.min(inText, 5) + inTitle * 5
        }
        if (section.text.toLowerCase().includes(phrase)) score += 10
        // Sections covering more of the query outrank ones repeating a single word.
        return { section, score: score * (matched / terms.length) ** 2, matched }
    })

    // A section sharing one word with a longer query isn't an answer to it.
    const minimumMatched = Math.ceil(terms.length / 2)

    return scored
        .filter(({ matched }) => matched >= minimumMatched)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ section }) => ({
            package: section.package,
            title: section.title,
            source: section.source,
            excerpt: excerpt(section.text, (token) => matchers.some((matches) => matches(token)))
        }))
}
