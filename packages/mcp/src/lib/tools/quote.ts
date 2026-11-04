/**
 * Renders a value as a single-quoted TypeScript string literal, so a user-supplied
 * apostrophe or newline cannot break the code snippet a tool generates.
 */
export function quote(value: string): string {
    const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
    return `'${escaped}'`
}
