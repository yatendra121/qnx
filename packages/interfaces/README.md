# `@qnx/interfaces`

`@qnx/interfaces` provides a collection of shared TypeScript interfaces and type augmentations for use across Node.js/Express applications, including typed request objects, user models, and common message shapes.

## ✨ Features

- Typed `Request` with `user` property for authenticated routes
- Common `User` and `Message` interfaces
- Re-exports Express `Response` and `NextFunction` for convenience

## 📦 Installation

Install via your preferred package manager:

```bash
# npm
npm install @qnx/interfaces

# yarn
yarn add @qnx/interfaces

# pnpm
pnpm install @qnx/interfaces
```

### Peer Dependencies

This package requires `express` as a peer dependency:

```bash
npm install express
```

## 🚀 Usage

### Authenticated Request

Use the typed `Request` in route handlers to access `req.user` without casting:

```ts
import type { Request, Response, NextFunction } from '@qnx/interfaces'

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  console.log(req.user.id)   // typed as User
  next()
}
```

### `User` Interface

```ts
import type { User } from '@qnx/interfaces'

const user: User = {
  id: '123',
  name: 'John Doe',
  email: 'john@example.com',
  password: 'hashed_password'
}
```

### `Message` Interface

```ts
import type { Message } from '@qnx/interfaces'

const response: Message = {
  message: 'Operation completed successfully.'
}
```

## 🤝 Contributing

Pull requests are welcome!
For major changes, please open an issue first to discuss what you'd like to change.
Make sure to update or add tests where appropriate.

## 📄 License

[MIT License](https://github.com/yatendra121/qnx/blob/main/LICENSE.md) © 2023-PRESENT [Yatendra Kushwaha](https://github.com/yatendra121)
