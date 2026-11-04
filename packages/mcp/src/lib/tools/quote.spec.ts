import { describe, expect, it } from 'vitest'
import { quote } from './quote'

describe('quote', () => {
    it.each([
        ['plain', `'plain'`],
        [`it's`, `'it\\'s'`],
        ['back\\slash', `'back\\\\slash'`],
        ['two\nlines', `'two\\nlines'`],
        ['\\\'', `'\\\\\\''`]
    ])('renders %j as %s', (value, expected) => {
        expect(quote(value)).toBe(expected)
    })

    it.each([[`it's`], ['back\\slash'], ['two\r\nlines'], [`\\'`], ['${x}']])(
        'produces a literal that evaluates back to %j',
        (value) => {
            expect(new Function(`return ${quote(value)}`)()).toBe(value)
        }
    )
})
