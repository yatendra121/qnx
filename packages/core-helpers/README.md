# `@qnx/core-helpers`

`@qnx/core-helpers` provides a collection of lightweight utility functions for common TypeScript/JavaScript patterns including async iteration, type-safe value collection, and type checking.

## ✨ Features

- Async sub-array generator for chunked iteration
- Type-safe value collection with automatic coercion
- Function type guard utility

## 📦 Installation

Install via your preferred package manager:

```bash
# npm
npm install @qnx/core-helpers

# yarn
yarn add @qnx/core-helpers

# pnpm
pnpm install @qnx/core-helpers
```

## 🚀 Usage

### `asyncSubArrayGenerator`

Yields sub-arrays of a given size from a larger array, with optional delay between iterations.

```ts
import { asyncSubArrayGenerator } from '@qnx/core-helpers'

const items = [1, 2, 3, 4, 5, 6, 7, 8]

for await (const chunk of asyncSubArrayGenerator(items, 3)) {
  console.log(chunk) // [1,2,3], [4,5,6], [7,8]
}
```

With a delay between iterations (in milliseconds):

```ts
for await (const chunk of asyncSubArrayGenerator(items, 3, 500)) {
  console.log(chunk)
}
```

### `collectTypeValue`

Collects a value with a fallback default, coercing to the default's type.

```ts
import { collectTypeValue } from '@qnx/core-helpers'

const value = collectTypeValue('42', 0)   // returns 42 (number)
const str   = collectTypeValue(null, 'default') // returns 'default'
```

### `isFunction`

Returns `true` if the provided value is a function.

```ts
import { isFunction } from '@qnx/core-helpers'

isFunction(() => {})    // true
isFunction('string')    // false
```

## 🤝 Contributing

Pull requests are welcome!
For major changes, please open an issue first to discuss what you'd like to change.
Make sure to update or add tests where appropriate.

## 📄 License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
