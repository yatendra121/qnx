# Contributing to QNX

Thank you for considering contributing to the QNX monorepository! We appreciate your interest and effort in helping us improve and maintain this collection of libraries. To ensure a smooth and collaborative process, please follow the guidelines below.

## How to Contribute

### Reporting Issues

If you encounter any bugs, issues, or have suggestions for improvements, please open an issue in the respective library's repository. When reporting an issue, please include:

- A clear and descriptive title
- A detailed description of the problem or suggestion
- Steps to reproduce the issue (if applicable)
- Any relevant code snippets, error messages, or screenshots

### Submitting Pull Requests

We welcome pull requests from the community. To submit a pull request, please follow these steps:

1. **Fork the Repository**: Create a fork of the QNX monorepo by clicking the "Fork" button on the GitHub page.

2. **Clone the Repository**: Clone your forked repository to your local machine.
   ```bash
   git clone https://github.com/yatendra121/qnx.git
   cd qnx
   ```

3. **Install nx and pnpm Globally**: Install the nx package globally to run the necessary commands.
  ```bash
   npm install -g nx
   npm install -g pnpm
   ```

4. **Install Dependencies**: Install all dependencies using pnpm.
  ```bash
   pnpm install
   ```

3. **Create a New Branch**: Create a new branch for your feature or bugfix.
  ```bash
git checkout -b feature-or-bugfix-name
```

4. **Make Your Changes**: Implement your changes in the appropriate library.

5. **Write Tests**: Ensure that your changes are covered by tests. We aim for a high level of test coverage to maintain code quality.

6. **Commit Your Changes**: Commit your changes with a clear and concise commit message.
```bash
git commit -m "Description of the changes"
```
7. **Push to Your Fork**: Push your changes to your forked repository.
```bash
git push origin feature-or-bugfix-name
```
8. **Open a Pull Request**: Open a pull request from your forked repository to the main QNX repository. Provide a detailed description of your changes and any additional context that may be helpful.

### Code Style
Please adhere to the coding standards and style guidelines used throughout the QNX monorepo. Consistent coding styles help improve readability and maintainability.

### Running Tests
Before submitting your pull request, ensure that all tests pass successfully. You can run the tests using the following command:

```bash
nx run affected:test
```
### Documentation
Update the documentation as necessary to reflect your changes. Clear and comprehensive documentation helps other contributors and users understand how to use the libraries effectively.

## Code of Conduct
Please note that we have a Code of Conduct. By participating in this project, you agree to abide by its terms. We are committed to providing a welcoming and respectful environment for all contributors.

## Getting Help
If you need any help or have questions about contributing, feel free to reach out by opening an issue in the relevant repository. We're here to assist you!

## Acknowledgments
We would like to extend our gratitude to all contributors who have helped improve this project. Your efforts are greatly appreciated.

Thank you for contributing to the QNX monorepository! We look forward to your contributions and working together to make these libraries even better.

