# `@qnx/message`

`@qnx/message` provides lightweight utility functions for generating consistent user-facing message strings in TypeScript/JavaScript applications.

## ✨ Features

- Standard required-field validation message generator
- Simple, predictable string output for UI and API messages

## 📦 Installation

Install via your preferred package manager:

```bash
# npm
npm install @qnx/message

# yarn
yarn add @qnx/message

# pnpm
pnpm install @qnx/message
```

## 🚀 Usage

### `requiredField`

Generates a standardized required-field error message.

```ts
import { requiredField } from '@qnx/message'

requiredField('name')   // "name is a required field."
requiredField('Email')  // "Email is a required field."
```

## 🤝 Contributing

Pull requests are welcome!
For major changes, please open an issue first to discuss what you'd like to change.
Make sure to update or add tests where appropriate.

## 📄 License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
