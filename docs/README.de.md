<p align="center">
  <img src="logo.svg" alt="OptimCE-Logo" width="160">
</p>

# OptimCE CRM Frontend

[![Website](https://img.shields.io/badge/Website-optimce.be-2e7d32.svg)](https://www.optimce.be/de/)
[![Lizenz](https://img.shields.io/badge/Lizenz-Apache%202.0-blue.svg)](../LICENSE)
[![Angular](https://img.shields.io/badge/Angular-21-dd0031.svg)](https://angular.dev)
[![Übersetzungsstatus](https://hosted.weblate.org/widgets/optimce/-/svg-badge.svg)](https://hosted.weblate.org/engage/optimce/)
[![en](https://img.shields.io/badge/lang-en-lightgrey.svg)](../README.md)
[![fr](https://img.shields.io/badge/lang-fr-lightgrey.svg)](README.fr.md)
[![de](https://img.shields.io/badge/lang-de-43a047.svg)](README.de.md)
[![nl](https://img.shields.io/badge/lang-nl-lightgrey.svg)](README.nl.md)

> Übersetzung der [englischen README](../README.md), manuell gepflegt. Im
> Zweifelsfall ist die englische Fassung maßgeblich.

Das **CRM-Frontend** ist die Angular-Weboberfläche von
[OptimCE](https://www.optimce.be/de/), einer Open-Source-Plattform zur Verwaltung
von Erneuerbare-Energie-Gemeinschaften im belgischen Kontext des Energieteilens.
Es ist die einzige authentifizierte Anwendung, mit der Verwalter und Mitglieder
Mitglieder, Zähler, Energieteilungs-Vorgänge, Verteilschlüssel,
Rechnungsstellung und Community-News verwalten.

Dieses Repository ist einer der Dienste der OptimCE-Plattform. Es wird
normalerweise als Teil des
[OptimCE-Monorepos](https://github.com/OptimCE/monorepo) gebaut und ausgeführt,
das das Frontend zusammen mit der Backend-API, der Authentifizierung und den
zugehörigen Microservices orchestriert.

## Funktionen

- **Mitglieder** — Community-Mitglieder, Rollen und Sozialtarif-Status verwalten
- **Zähler & Verbrauch** — Stromzähler und ihre Verbrauchsdaten
- **Energieteilungs-Vorgänge** — REC-/CEC-/gebäudeinterne Teilungsvorgänge
- **Verteilschlüssel** — wie geteilte Energie verteilt wird (ag-Grid-Ansichten)
- **Gemeinschaften** — Informationen und Einstellungen der Gemeinschaft
- **Rechnungsstellung** — Abrechnungsläufe, Tarife, Zahlungen, Gutschriften
  (per Feature-Flag aktivierbar)
- **News-Board** — Beiträge und Umfragen der Community (per Feature-Flag
  aktivierbar)
- **Benachrichtigungen** — In-App-Benachrichtigungsglocke und Verlauf
- **Audit-Protokolle** — Nachvollziehbarkeit administrativer Aktionen
- **Authentifizierung & Rollen** — Keycloak-Anmeldung mit rollenbasiertem Zugriff
  (`MEMBER`, `GESTIONNAIRE`)
- **Internationalisierung** — Englisch, Französisch, Niederländisch und Deutsch
  (ngx-translate)

## Technologie-Stack

- [Angular 21](https://angular.dev) — Standalone-Komponenten, esbuild-basierte
  Builder
- [PrimeNG 21](https://primeng.org) mit einem angepassten `OptimcePreset`-Theme
  sowie [PrimeIcons](https://primeng.org/icons)
- [Tailwind CSS v4](https://tailwindcss.com)
- [ngx-translate](https://github.com/ngx-translate/core) für i18n
- [keycloak-angular](https://github.com/mauriciovigolo/keycloak-angular) /
  keycloak-js für die Authentifizierung
- [ag-Grid](https://www.ag-grid.com) (Verteilschlüssel),
  [Chart.js](https://www.chartjs.org) und der Markdown-Editor
  [Milkdown](https://milkdown.dev)
- Werkzeuge: [Vitest](https://vitest.dev), ESLint 9, Prettier und Husky +
  lint-staged

## Erste Schritte

### Mit dem OptimCE-Stack (empfohlen)

Das Frontend benötigt die Backend-API, einen Keycloak-Server und eine generierte
Laufzeitkonfiguration. Am einfachsten lässt es sich mit allem Nötigen über den
Entwicklungs-Stack des Monorepos ausführen:

```bash
git clone --recurse-submodules https://github.com/OptimCE/monorepo.git
cd monorepo
./docker-stack.sh start
```

Das Frontend wird dann auf dem Host-Port `8090` (und hinter dem Reverse-Proxy)
bereitgestellt. Voraussetzungen und Konfiguration finden Sie in der
[Monorepo-README](https://github.com/OptimCE/monorepo).

### Eigenständige Entwicklung

Um allein am Frontend zu arbeiten, benötigen Sie [Node.js](https://nodejs.org)
22+ und npm 10+:

```bash
git clone https://github.com/OptimCE/crm-frontend.git
cd crm-frontend
npm install
npm start
```

Der Entwicklungsserver läuft unter `http://localhost:4200/` und lädt bei
Änderungen an den Quelldateien neu. Die Anwendung benötigt weiterhin ein
erreichbares OptimCE-Backend und einen Keycloak-Server sowie eine `config.json`,
die unter `/assets/config/config.json` bereitgestellt wird.

## Verfügbare Skripte

| Skript                        | Beschreibung                                                           |
| ----------------------------- | ---------------------------------------------------------------------- |
| `npm start`                   | Entwicklungsserver starten (`ng serve`) unter `http://localhost:4200/` |
| `npm run build`               | Produktions-Build nach `dist/crm-frontend/browser/`                    |
| `npm run watch`               | Kontinuierlich neu bauen (Entwicklungskonfiguration)                   |
| `npm test`                    | Unit-Tests mit Vitest ausführen                                        |
| `npm run lint`                | Code mit ESLint prüfen                                                 |
| `npm run lint-fix`            | Prüfen und automatisch korrigieren                                     |
| `npm run format`              | Code mit Prettier formatieren                                          |
| `npm run format-check`        | Formatierung prüfen, ohne zu schreiben                                 |
| `npm run audit`               | `npm audit` ausführen                                                  |
| `npm run bundle-analyse-size` | Mit Statistiken bauen und das Bundle visualisieren                     |

## Build

```bash
npm run build
```

Die Build-Artefakte werden nach `dist/crm-frontend/browser/` geschrieben. Der
Produktions-Build ist standardmäßig optimiert.

## Tests

```bash
npm test
```

Die Unit-Tests laufen mit dem Test-Runner [Vitest](https://vitest.dev).

## Docker

- **`Dockerfile`** — mehrstufiges Produktions-Image: baut die Anwendung und
  liefert die statische Ausgabe anschließend mit nginx aus (exponiert Port `80`).
- **`Dockerfile.dev`** — ein langlebiger Entwicklungscontainer
  (Devcontainer-Shell) mit installierten Abhängigkeiten; starten Sie den
  Entwicklungsserver darin manuell.

## Projektstruktur

| Ordner      | Zweck                                                                      |
| ----------- | -------------------------------------------------------------------------- |
| `core/`     | Singleton-Services, HTTP-Interceptors, Guards, DTOs, Laufzeitkonfiguration |
| `shared/`   | Wiederverwendbare UI-Komponenten, Pipes und Direktiven                     |
| `features/` | Fachmodule, bedarfsweise geladen und nach Geschäftsdomäne aufgeteilt       |
| `layout/`   | Layout-Komponenten, die die Anwendungsseiten umschließen                   |
| `assets/`   | Übersetzungen (`i18n/`), Laufzeitkonfiguration (`config/`) und Bilder      |

## Übersetzungen

Die Oberfläche ist auf **Französisch, Englisch, Niederländisch und Deutsch**
verfügbar. Die Kataloge sind die verschachtelten JSON-Dateien in
`src/assets/i18n/` (`fr.json`, `en.json`, `nl.json`, `de.json`), die zur
Laufzeit von [ngx-translate](https://github.com/ngx-translate/core) geladen
werden; Französisch ist die Ausgangssprache.

Die Übersetzungen werden auf [Weblate](https://weblate.org/) gepflegt, einer
freien webbasierten Plattform für kontinuierliche Lokalisierung, die dieses
Projekt im Rahmen ihres Libre-Tarifs für freie Software kostenlos hostet. Sie
müssen weder die JSON-Dateien anfassen noch einen Pull Request öffnen, um zu
helfen:

**[OptimCE auf Weblate übersetzen →](https://hosted.weblate.org/engage/optimce/)**

Weblate committet freigegebene Übersetzungen zurück in dieses Repository. Bitte
nehmen Sie reine Übersetzungsänderungen daher dort vor, statt
`src/assets/i18n/*.json` von Hand zu bearbeiten. Neue Schlüssel kommen weiterhin
per Pull Request hinzu — zusammen mit dem Code, der sie verwendet, und ihrer
französischen Ausgangszeichenkette.

## Mitwirken

Beiträge sind willkommen! Bitte lesen Sie die
[Richtlinien für Beiträge](../CONTRIBUTING.md) und unseren
[Verhaltenskodex](../CODE_OF_CONDUCT.md), bevor Sie ein Issue oder einen Pull
Request eröffnen.

## Sicherheit

Um eine Sicherheitslücke zu melden, folgen Sie bitte der
[Sicherheitsrichtlinie](../SECURITY.md) — öffnen Sie kein öffentliches Issue.

## Lizenz

Dieses Projekt ist unter der [Apache-Lizenz 2.0](../LICENSE) lizenziert.
