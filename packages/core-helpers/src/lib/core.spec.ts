import { coreHelpers } from '.'
import { asyncSubArrayGenerator, collectTypeValue, isFunction } from '../index'

describe('coreHelpers', () => {
    it('should work', () => {
        expect(coreHelpers()).toEqual('core-helpers')
    })
})

describe('isFunction', () => {
    it.each([
        ['arrow', () => 1],
        ['function', function () { return 1 }],
        ['async', async () => 1],
        ['generator', function* () { yield 1 }],
        ['async generator', async function* () { yield 1 }],
        ['class', class {}]
    ])('is true for a %s', (_label, value) => {
        expect(isFunction(value)).toBe(true)
    })

    it.each([[null], [undefined], [0], ['function'], [{}], [[]]])('is false for %j', (value) => {
        expect(isFunction(value)).toBe(false)
    })
})

describe('asyncSubArrayGenerator', () => {
    const collect = async <T>(generator: AsyncGenerator<T>) => {
        const chunks: T[] = []
        for await (const chunk of generator) chunks.push(chunk)
        return chunks
    }

    it('yields chunks of the requested size, keeping the element type', async () => {
        const chunks: number[][] = await collect(asyncSubArrayGenerator([1, 2, 3, 4, 5], 2))
        expect(chunks).toEqual([[1, 2], [3, 4], [5]])
    })

    it('yields nothing for an empty array', async () => {
        expect(await collect(asyncSubArrayGenerator([], 2))).toEqual([])
    })

    it.each([[0], [-1], [Number.NaN]])('rejects a size of %d instead of looping', async (size) => {
        await expect(collect(asyncSubArrayGenerator([1, 2], size))).rejects.toThrow(RangeError)
    })
})

describe('collectTypeValue', () => {
    it('is part of the public entry point, as the README documents', () => {
        expect(collectTypeValue('42', 0)).toBe(42)
        expect(collectTypeValue(null, 'default')).toBe('default')
    })
})
