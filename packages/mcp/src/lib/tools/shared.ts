import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'

/** Every tool is a pure lookup or generator: nothing is written, and nothing outside the server is called. */
export function readOnlyTool(title: string): { title: string; annotations: ToolAnnotations } {
    return {
        title,
        annotations: {
            title,
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false
        }
    }
}

export function textResult(text: string): CallToolResult {
    return { content: [{ type: 'text', text }] }
}

export function jsonResult(value: unknown): CallToolResult {
    return textResult(JSON.stringify(value, null, 2))
}

/** A failure the caller can act on. `isError` lets clients and agents detect it without reading the text. */
export function toolError(text: string): CallToolResult {
    return { isError: true, content: [{ type: 'text', text }] }
}
