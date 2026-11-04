async function* asyncSubArrayGenerator<T>(array: T[], iterate: number, deley = 0) {
    // A size of 0 or less never advances the index, so the loop below would not end.
    if (!(iterate > 0)) {
        throw new RangeError(`Sub-array size must be greater than 0, received ${iterate}.`)
    }

    let i = 0
    const arrayLength = array.length
    while (i < arrayLength) {
        if (i && deley > 0) await new Promise((resolve) => setTimeout(resolve, deley))

        yield array.slice(i, i + iterate)
        i = i + iterate
    }
    return []
}

export { asyncSubArrayGenerator }
