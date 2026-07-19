# Contributing to OptimCE CRM Frontend

Thank you for your interest in contributing! Issues and pull requests are
welcome from everyone. By participating in this project, you agree to abide by
our [Code of Conduct](CODE_OF_CONDUCT.md).

## Where to Contribute

This repository holds the **OptimCE CRM frontend** — the Angular web interface
for the OptimCE platform. The backend API and the supporting microservices live
in their own repositories under the
[OptimCE organization](https://github.com/OptimCE):

- **Frontend changes** — UI, components, feature modules, translations — belong
  here.
- **Backend or other services** should be reported or fixed in their respective
  repositories. To run the whole platform locally, see the
  [OptimCE monorepo](https://github.com/OptimCE/monorepo).

## Setting Up a Development Environment

```bash
git clone https://github.com/OptimCE/crm-frontend.git
cd crm-frontend
npm install
npm start   # ng serve → http://localhost:4200
```

The application needs a running OptimCE backend and Keycloak server, plus a
runtime `config.json` served at `/assets/config/config.json`. The easiest way to
get all of that is to run the full stack from the
[monorepo](https://github.com/OptimCE/monorepo) — see its README for details.

## Reporting Bugs and Suggesting Features

Open a [GitHub issue](https://github.com/OptimCE/crm-frontend/issues). For bugs,
include what you did, what you expected, and what happened instead — screenshots,
console output, and reproduction steps help a lot.

For security vulnerabilities, **do not open a public issue**; follow the
[security policy](SECURITY.md) instead.

## Submitting Pull Requests

1. Fork the repository and create a feature branch from `main`.
2. Make your changes. Keep each pull request focused on a single topic.
3. Before opening the pull request, make sure the checks pass:

   ```bash
   npm run lint
   npm test
   npm run build
   ```

   `npm run format` keeps the formatting consistent; Prettier and ESLint also
   run automatically on staged files via a pre-commit hook.

4. Open a pull request against `main`, describing **what** you changed and
   **why**.

Small documentation fixes are welcome as direct pull requests; for larger
changes, opening an issue first to discuss the approach can save you time.

## Commit Messages

Use short, imperative commit messages, preferably following the
[Conventional Commits](https://www.conventionalcommits.org/) style used in this
repository:

```
feat: add invoice detail dialog
fix: correct meter tooltip translation key
chore: bump primeng to 21.x
docs: update readme
```

## License

This project is licensed under the [Apache License 2.0](LICENSE). By
contributing, you agree that your contributions will be licensed under the same
license.
