<p align="center">
  <img src="logo.svg" alt="OptimCE-logo" width="160">
</p>

# OptimCE CRM Frontend

[![Website](https://img.shields.io/badge/Website-optimce.be-2e7d32.svg)](https://www.optimce.be/nl/)
[![Licentie](https://img.shields.io/badge/Licentie-Apache%202.0-blue.svg)](../LICENSE)
[![Angular](https://img.shields.io/badge/Angular-21-dd0031.svg)](https://angular.dev)
[![Vertaalstatus](https://hosted.weblate.org/widgets/optimce/-/svg-badge.svg)](https://hosted.weblate.org/engage/optimce/)
[![en](https://img.shields.io/badge/lang-en-lightgrey.svg)](../README.md)
[![fr](https://img.shields.io/badge/lang-fr-lightgrey.svg)](README.fr.md)
[![de](https://img.shields.io/badge/lang-de-lightgrey.svg)](README.de.md)
[![nl](https://img.shields.io/badge/lang-nl-43a047.svg)](README.nl.md)

> Vertaling van de [Engelse README](../README.md), handmatig bijgehouden. Bij
> twijfel is de Engelse versie leidend.

De **CRM-frontend** is de Angular-webinterface van
[OptimCE](https://www.optimce.be/nl/), een opensourceplatform voor het beheer van
hernieuwbare-energiegemeenschappen binnen de Belgische context van energiedeling.
Het is de enige geauthenticeerde toepassing waarmee beheerders en leden leden,
meters, energiedeeloperaties, verdeelsleutels, facturatie en gemeenschapsnieuws
beheren.

Deze repository is een van de diensten van het OptimCE-platform. Ze wordt normaal
gebouwd en uitgevoerd als onderdeel van de
[OptimCE-monorepo](https://github.com/OptimCE/monorepo), die de frontend samen met
de backend-API, de authenticatie en de bijbehorende microservices orkestreert.

## Functies

- **Leden** — leden van de gemeenschap, rollen en sociaal-tariefstatus beheren
- **Meters & verbruik** — elektriciteitsmeters en hun verbruiksgegevens
- **Energiedeeloperaties** — REC-/CEC-/gebouwinterne deeloperaties
- **Verdeelsleutels** — hoe gedeelde energie wordt verdeeld (ag-Grid-weergaven)
- **Gemeenschappen** — informatie en instellingen van de gemeenschap
- **Facturatie** — facturatieruns, tarieven, betalingen, creditnota's
  (in te schakelen via feature flag)
- **Nieuwsbord** — berichten en peilingen van de gemeenschap (in te schakelen via
  feature flag)
- **Meldingen** — meldingsbel en geschiedenis in de app
- **Auditlogboeken** — traceerbaarheid van administratieve acties
- **Authenticatie & rollen** — aanmelden via Keycloak met rolgebaseerde toegang
  (`MEMBER`, `GESTIONNAIRE`)
- **Internationalisatie** — Engels, Frans, Nederlands en Duits (ngx-translate)

## Technologie

- [Angular 21](https://angular.dev) — standalone componenten, esbuild-gebaseerde
  builders
- [PrimeNG 21](https://primeng.org) met een aangepast `OptimcePreset`-thema, plus
  [PrimeIcons](https://primeng.org/icons)
- [Tailwind CSS v4](https://tailwindcss.com)
- [ngx-translate](https://github.com/ngx-translate/core) voor i18n
- [keycloak-angular](https://github.com/mauriciovigolo/keycloak-angular) /
  keycloak-js voor authenticatie
- [ag-Grid](https://www.ag-grid.com) (verdeelsleutels),
  [Chart.js](https://www.chartjs.org) en de markdown-editor
  [Milkdown](https://milkdown.dev)
- Gereedschap: [Vitest](https://vitest.dev), ESLint 9, Prettier en Husky +
  lint-staged

## Aan de slag

### Met de OptimCE-stack (aanbevolen)

De frontend heeft de backend-API, een Keycloak-server en een gegenereerde
runtimeconfiguratie nodig. De eenvoudigste manier om ze met alles erbij uit te
voeren is de ontwikkelstack van de monorepo:

```bash
git clone --recurse-submodules https://github.com/OptimCE/monorepo.git
cd monorepo
./docker-stack.sh start
```

De frontend wordt dan geserveerd op hostpoort `8090` (en achter de reverse
proxy). Zie de [monorepo-README](https://github.com/OptimCE/monorepo) voor de
vereisten en de configuratie.

### Zelfstandige ontwikkeling

Om alleen aan de frontend te werken heb je [Node.js](https://nodejs.org) 22+ en
npm 10+ nodig:

```bash
git clone https://github.com/OptimCE/crm-frontend.git
cd crm-frontend
npm install
npm start
```

De ontwikkelserver draait op `http://localhost:4200/` en herlaadt bij wijzigingen
in de bronbestanden. De toepassing heeft nog steeds een bereikbare
OptimCE-backend en Keycloak-server nodig, plus een `config.json` die wordt
geserveerd op `/assets/config/config.json`.

## Beschikbare scripts

| Script                        | Beschrijving                                                        |
| ----------------------------- | ------------------------------------------------------------------- |
| `npm start`                   | De ontwikkelserver starten (`ng serve`) op `http://localhost:4200/` |
| `npm run build`               | Productiebuild naar `dist/crm-frontend/browser/`                    |
| `npm run watch`               | Doorlopend opnieuw bouwen (ontwikkelconfiguratie)                   |
| `npm test`                    | Unittests uitvoeren met Vitest                                      |
| `npm run lint`                | Code controleren met ESLint                                         |
| `npm run lint-fix`            | Controleren en automatisch corrigeren                               |
| `npm run format`              | Code formatteren met Prettier                                       |
| `npm run format-check`        | Formattering controleren zonder te schrijven                        |
| `npm run audit`               | `npm audit` uitvoeren                                               |
| `npm run bundle-analyse-size` | Bouwen met statistieken en de bundel visualiseren                   |

## Bouwen

```bash
npm run build
```

De build-artefacten worden naar `dist/crm-frontend/browser/` geschreven. De
productiebuild is standaard geoptimaliseerd.

## Testen

```bash
npm test
```

De unittests draaien met de testrunner [Vitest](https://vitest.dev).

## Docker

- **`Dockerfile`** — meertraps productie-image: bouwt de toepassing en serveert de
  statische uitvoer vervolgens met nginx (stelt poort `80` beschikbaar).
- **`Dockerfile.dev`** — een langlevende ontwikkelcontainer (devcontainer-shell)
  met de afhankelijkheden geïnstalleerd; start de ontwikkelserver er handmatig in.

## Projectstructuur

| Map         | Doel                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| `core/`     | Singleton-services, HTTP-interceptors, guards, DTO's, runtimeconfiguratie |
| `shared/`   | Herbruikbare UI-componenten, pipes en directives                          |
| `features/` | Functiemodules, lazy-loaded en opgesplitst per businessdomein             |
| `layout/`   | Layoutcomponenten die de pagina's van de toepassing omhullen              |
| `assets/`   | Vertalingen (`i18n/`), runtimeconfiguratie (`config/`) en afbeeldingen    |

## Vertalingen

De interface is beschikbaar in het **Frans, Engels, Nederlands en Duits**. De
catalogi zijn de geneste JSON-bestanden in `src/assets/i18n/` (`fr.json`,
`en.json`, `nl.json`, `de.json`), die tijdens runtime worden geladen door
[ngx-translate](https://github.com/ngx-translate/core); het Frans is de brontaal.

De vertalingen worden beheerd op [Weblate](https://weblate.org/), een vrij
webgebaseerd platform voor continue lokalisatie, dat dit project gratis host
binnen zijn Libre-plan voor vrije software. Je hoeft de JSON-bestanden niet aan
te raken en geen pull request te openen om te helpen:

**[OptimCE vertalen op Weblate →](https://hosted.weblate.org/engage/optimce/)**

Weblate commit goedgekeurde vertalingen terug naar deze repository. Breng
wijzigingen die alleen vertalingen betreffen dus daar aan in plaats van
`src/assets/i18n/*.json` handmatig te bewerken. Nieuwe sleutels komen nog steeds
via een pull request binnen, samen met de code die ze gebruikt en hun Franse
bronstring.

## Bijdragen

Bijdragen zijn welkom! Lees de
[bijdragerichtlijnen](../CONTRIBUTING.md) en onze
[Gedragscode](../CODE_OF_CONDUCT.md) voordat je een issue of pull request opent.

## Beveiliging

Om een beveiligingskwetsbaarheid te melden, volg je het
[beveiligingsbeleid](../SECURITY.md) — open geen openbare issue.

## Licentie

Dit project valt onder de [Apache-licentie 2.0](../LICENSE).
