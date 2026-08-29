<p align="center">
  <img src="docs/logo.svg" alt="OptimCE logo" width="160">
</p>

# OptimCE CRM Frontend

[![Website](https://img.shields.io/badge/Website-optimce.be-2e7d32.svg)](https://www.optimce.be/en/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Angular](https://img.shields.io/badge/Angular-21-dd0031.svg)](https://angular.dev)
[![Translation status](https://hosted.weblate.org/widgets/optimce/-/svg-badge.svg)](https://hosted.weblate.org/engage/optimce/)
[![en](https://img.shields.io/badge/lang-en-43a047.svg)](README.md)
[![fr](https://img.shields.io/badge/lang-fr-lightgrey.svg)](docs/README.fr.md)
[![de](https://img.shields.io/badge/lang-de-lightgrey.svg)](docs/README.de.md)
[![nl](https://img.shields.io/badge/lang-nl-lightgrey.svg)](docs/README.nl.md)

The **CRM frontend** is the Angular web interface of
[OptimCE](https://www.optimce.be/en/), an open-source platform for managing
renewable energy communities in the Belgian energy-sharing context. It is the
single authenticated application that community managers and members use to
administer members, meters, energy-sharing operations, allocation keys,
invoicing, and community news.

This repository is one service of the wider OptimCE platform. It is normally
built and run as part of the
[OptimCE monorepo](https://github.com/OptimCE/monorepo), which orchestrates the
frontend together with the backend API, authentication, and the supporting
microservices.

## Features

- **Members** — manage community members, roles, and social-tariff status
- **Meters & consumption** — electricity meters and their consumption data
- **Energy-sharing operations** — REC / CEC / within-building sharing operations
- **Allocation keys** — how shared energy is distributed (ag-Grid views)
- **Communities** — community information and settings
- **Billing & invoicing** — invoice runs, tariffs, payments, credit notes
  (feature-flagged)
- **News board** — community posts and polls (feature-flagged)
- **Notifications** — in-app notification bell and history
- **Audit logs** — traceability of administrative actions
- **Authentication & roles** — Keycloak-based sign-in with role-based access
  (`MEMBER`, `GESTIONNAIRE`)
- **Internationalization** — English, French, Dutch, and German (ngx-translate)

## Tech Stack

- [Angular 21](https://angular.dev) — standalone components, esbuild-based
  builders
- [PrimeNG 21](https://primeng.org) with a custom `OptimcePreset` theme, plus
  [PrimeIcons](https://primeng.org/icons)
- [Tailwind CSS v4](https://tailwindcss.com)
- [ngx-translate](https://github.com/ngx-translate/core) for i18n
- [keycloak-angular](https://github.com/mauriciovigolo/keycloak-angular) /
  keycloak-js for authentication
- [ag-Grid](https://www.ag-grid.com) (allocation keys),
  [Chart.js](https://www.chartjs.org), and the
  [Milkdown](https://milkdown.dev) markdown editor
- Tooling: [Vitest](https://vitest.dev), ESLint 9, Prettier, and Husky +
  lint-staged

## Getting Started

### With the OptimCE stack (recommended)

The frontend depends on the backend API, a Keycloak server, and a generated
runtime configuration. The simplest way to run it with everything it needs is the
monorepo dev stack:

```bash
git clone --recurse-submodules https://github.com/OptimCE/monorepo.git
cd monorepo
./docker-stack.sh start
```

The frontend is then served on host port `8090` (and behind the reverse proxy).
See the [monorepo README](https://github.com/OptimCE/monorepo) for prerequisites
and configuration.

### Standalone development

To work on the frontend on its own you will need [Node.js](https://nodejs.org)
22+ and npm 10+:

```bash
git clone https://github.com/OptimCE/crm-frontend.git
cd crm-frontend
npm install
npm start
```

The dev server runs at `http://localhost:4200/` and reloads on source changes.
The app still needs a reachable OptimCE backend and Keycloak server, plus a
runtime `config.json` served at `/assets/config/config.json`.

## Available Scripts

| Script                        | Description                                                   |
| ----------------------------- | ------------------------------------------------------------- |
| `npm start`                   | Start the dev server (`ng serve`) at `http://localhost:4200/` |
| `npm run build`               | Production build into `dist/crm-frontend/browser/`            |
| `npm run watch`               | Rebuild continuously (development configuration)              |
| `npm test`                    | Run unit tests with Vitest                                    |
| `npm run lint`                | Lint with ESLint                                              |
| `npm run lint-fix`            | Lint and apply fixes                                          |
| `npm run format`              | Format the codebase with Prettier                             |
| `npm run format-check`        | Check formatting without writing                              |
| `npm run audit`               | Run `npm audit`                                               |
| `npm run bundle-analyse-size` | Build with stats and visualize the bundle                     |

## Building

```bash
npm run build
```

Build artifacts are written to `dist/crm-frontend/browser/`. The production build
is optimized by default.

## Testing

```bash
npm test
```

Unit tests run with the [Vitest](https://vitest.dev) test runner.

## Docker

- **`Dockerfile`** — multi-stage production image: builds the app, then serves the
  static output with nginx (exposes port `80`).
- **`Dockerfile.dev`** — a long-lived development container (devcontainer shell)
  with dependencies installed; start the dev server manually inside it.

## Project Structure

| Folder      | Purpose                                                             |
| ----------- | ------------------------------------------------------------------- |
| `core/`     | Singleton services, HTTP interceptors, guards, DTOs, runtime config |
| `shared/`   | Reusable UI components, pipes, and directives                       |
| `features/` | Feature modules, lazy-loaded and split by business domain           |
| `layout/`   | Layout components that wrap application pages                       |
| `assets/`   | Translations (`i18n/`), runtime config (`config/`), and images      |

## Translations

The interface is available in **French, English, Dutch, and German**. The
catalogs are the nested JSON files in `src/assets/i18n/` (`fr.json`, `en.json`,
`nl.json`, `de.json`), loaded at runtime by
[ngx-translate](https://github.com/ngx-translate/core); French is the source
language.

Translations are managed on [Weblate](https://weblate.org/), a libre web-based
continuous localization platform that hosts this project free of charge under
its Libre plan for free software. You do not need to touch the JSON files or
open a pull request to help:

**[Translate OptimCE on Weblate →](https://hosted.weblate.org/engage/optimce/)**

Weblate commits approved translations back to this repository, so please make
translation-only changes there rather than editing `src/assets/i18n/*.json` by
hand. New keys are still added in a pull request, together with the code that
uses them and their French source string.

## Contributing

Contributions are welcome! Please read the
[contributing guidelines](CONTRIBUTING.md) and our
[Code of Conduct](CODE_OF_CONDUCT.md) before opening an issue or pull request.

## Security

To report a security vulnerability, please follow the
[security policy](SECURITY.md) — do not open a public issue.

## License

This project is licensed under the [Apache License 2.0](LICENSE).
