<p align="center">
  <img src="logo.svg" alt="Logo OptimCE" width="160">
</p>

# OptimCE CRM Frontend

[![Site web](https://img.shields.io/badge/Site%20web-optimce.be-2e7d32.svg)](https://www.optimce.be/fr/)
[![Licence](https://img.shields.io/badge/Licence-Apache%202.0-blue.svg)](../LICENSE)
[![Angular](https://img.shields.io/badge/Angular-21-dd0031.svg)](https://angular.dev)
[![en](https://img.shields.io/badge/lang-en-lightgrey.svg)](../README.md)
[![fr](https://img.shields.io/badge/lang-fr-43a047.svg)](README.fr.md)
[![de](https://img.shields.io/badge/lang-de-lightgrey.svg)](README.de.md)
[![nl](https://img.shields.io/badge/lang-nl-lightgrey.svg)](README.nl.md)

> Traduction du [README anglais](../README.md), maintenue manuellement. En cas de
> doute, la version anglaise fait foi.

Le **CRM frontend** est l'interface web Angular d'
[OptimCE](https://www.optimce.be/fr/), une plateforme open source de gestion des
communautés d'énergie renouvelable dans le contexte belge du partage d'énergie.
C'est l'application authentifiée unique que les gestionnaires et les membres
utilisent pour administrer les membres, les compteurs, les opérations de partage
d'énergie, les clés de répartition, la facturation et les actualités de la
communauté.

Ce dépôt est l'un des services de la plateforme OptimCE. Il est normalement
construit et exécuté au sein du
[monorepo OptimCE](https://github.com/OptimCE/monorepo), qui orchestre le frontend
avec l'API backend, l'authentification et les microservices associés.

## Fonctionnalités

- **Membres** — gérer les membres de la communauté, les rôles et le statut tarif
  social
- **Compteurs & consommation** — compteurs électriques et données de consommation
- **Opérations de partage d'énergie** — opérations CER / CEC / au sein d'un
  bâtiment
- **Clés de répartition** — la manière dont l'énergie partagée est répartie (vues
  ag-Grid)
- **Communautés** — informations et paramètres de la communauté
- **Facturation** — cycles de facturation, tarifs, paiements, notes de crédit
  (activable par indicateur de fonctionnalité)
- **Fil d'actualités** — publications et sondages de la communauté (activable par
  indicateur de fonctionnalité)
- **Notifications** — cloche de notifications et historique dans l'application
- **Journaux d'audit** — traçabilité des actions administratives
- **Authentification & rôles** — connexion via Keycloak avec accès basé sur les
  rôles (`MEMBER`, `GESTIONNAIRE`)
- **Internationalisation** — anglais, français, néerlandais et allemand
  (ngx-translate)

## Pile technique

- [Angular 21](https://angular.dev) — composants standalone, builders basés sur
  esbuild
- [PrimeNG 21](https://primeng.org) avec un thème `OptimcePreset` personnalisé,
  ainsi que [PrimeIcons](https://primeng.org/icons)
- [Tailwind CSS v4](https://tailwindcss.com)
- [ngx-translate](https://github.com/ngx-translate/core) pour l'i18n
- [keycloak-angular](https://github.com/mauriciovigolo/keycloak-angular) /
  keycloak-js pour l'authentification
- [ag-Grid](https://www.ag-grid.com) (clés de répartition),
  [Chart.js](https://www.chartjs.org) et l'éditeur markdown
  [Milkdown](https://milkdown.dev)
- Outillage : [Vitest](https://vitest.dev), ESLint 9, Prettier et Husky +
  lint-staged

## Démarrage

### Avec la stack OptimCE (recommandé)

Le frontend dépend de l'API backend, d'un serveur Keycloak et d'une configuration
d'exécution générée. La façon la plus simple de l'exécuter avec tout ce dont il a
besoin est la stack de développement du monorepo :

```bash
git clone --recurse-submodules https://github.com/OptimCE/monorepo.git
cd monorepo
./docker-stack.sh start
```

Le frontend est alors servi sur le port hôte `8090` (et derrière le reverse
proxy). Consultez le [README du monorepo](https://github.com/OptimCE/monorepo)
pour les prérequis et la configuration.

### Développement autonome

Pour travailler sur le frontend seul, vous aurez besoin de
[Node.js](https://nodejs.org) 22+ et de npm 10+ :

```bash
git clone https://github.com/OptimCE/crm-frontend.git
cd crm-frontend
npm install
npm start
```

Le serveur de développement tourne sur `http://localhost:4200/` et se recharge à
chaque modification des sources. L'application a toujours besoin d'un backend
OptimCE et d'un serveur Keycloak accessibles, ainsi que d'un fichier `config.json`
servi à `/assets/config/config.json`.

## Scripts disponibles

| Script                        | Description                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `npm start`                   | Démarrer le serveur de développement (`ng serve`) sur `http://localhost:4200/` |
| `npm run build`               | Build de production dans `dist/crm-frontend/browser/`                          |
| `npm run watch`               | Reconstruire en continu (configuration de développement)                       |
| `npm test`                    | Lancer les tests unitaires avec Vitest                                         |
| `npm run lint`                | Analyser le code avec ESLint                                                   |
| `npm run lint-fix`            | Analyser et corriger automatiquement                                           |
| `npm run format`              | Formater le code avec Prettier                                                 |
| `npm run format-check`        | Vérifier le formatage sans écrire                                              |
| `npm run audit`               | Lancer `npm audit`                                                             |
| `npm run bundle-analyse-size` | Builder avec statistiques et visualiser le bundle                              |

## Build

```bash
npm run build
```

Les artefacts de build sont écrits dans `dist/crm-frontend/browser/`. Le build de
production est optimisé par défaut.

## Tests

```bash
npm test
```

Les tests unitaires s'exécutent avec le test runner [Vitest](https://vitest.dev).

## Docker

- **`Dockerfile`** — image de production multi-étapes : construit l'application
  puis sert la sortie statique avec nginx (expose le port `80`).
- **`Dockerfile.dev`** — un conteneur de développement persistant (shell de
  devcontainer) avec les dépendances installées ; démarrez le serveur de
  développement manuellement à l'intérieur.

## Structure du projet

| Dossier     | Rôle                                                                             |
| ----------- | -------------------------------------------------------------------------------- |
| `core/`     | Services singletons, intercepteurs HTTP, guards, DTOs, configuration d'exécution |
| `shared/`   | Composants d'interface, pipes et directives réutilisables                        |
| `features/` | Modules fonctionnels, chargés à la demande et découpés par domaine métier        |
| `layout/`   | Composants de mise en page qui encadrent les pages de l'application              |
| `assets/`   | Traductions (`i18n/`), configuration d'exécution (`config/`) et images           |

## Contribuer

Les contributions sont les bienvenues ! Merci de lire les
[règles de contribution](../CONTRIBUTING.md) et notre
[Code de conduite](../CODE_OF_CONDUCT.md) avant d'ouvrir une issue ou une pull
request.

## Sécurité

Pour signaler une vulnérabilité de sécurité, veuillez suivre la
[politique de sécurité](../SECURITY.md) — n'ouvrez pas d'issue publique.

## Licence

Ce projet est sous licence [Apache 2.0](../LICENSE).
