# Header-with-Helper: Where Else Is It Needed?

## What the component does

`header-with-helper` (`src/app/features/allocation_key/components/key-view/header-with-helper/`) is an **ag-Grid column header component**. It renders a column label alongside a small info-circle button; clicking it opens a PrimeNG popover with a title and explanatory paragraph. The component inputs are `label` (header text) and `tooltip` (help text), both passed via `headerComponentParams` in a `ColDef`.

---

## What is already covered

Both ag-Grid tables in `allocation_key` already have `HeaderWithHelper` on their three most jargon-heavy columns:

| Column label  | Tooltip text                                         |
| ------------- | ---------------------------------------------------- |
| Iteration no. | "Number of the iteration in the sequence"            |
| VA Percentage | "Injection value allocated to this iteration (in %)" |
| VAP           | "Value allocated to a consumer (in %)"               |

---

## Scope limitation: ag-Grid vs. PrimeNG

`header-with-helper` implements `IHeaderComponent` (ag-Grid interface). **ag-Grid is used exclusively in `allocation_key`**. Every other feature module uses PrimeNG `<p-table>`. This means:

- The existing component **can be extended** within `allocation_key` tables.
- Applying the same pattern elsewhere requires either a new inline-label helper component (for forms) or a PrimeNG-compatible table header helper.

---

## Gaps inside the existing ag-Grid tables (quick wins)

The key-view data table already shows simulation results. Several columns in that table have opaque names with no tooltip yet:

| Column label           | Translation key                     | Suggested tooltip                                                                                       |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Alloconsumption**    | `ALLOCONSUMPTION_LABEL`             | Portion of a consumer's total consumption that was covered by energy allocated through this key         |
| **% Shared**           | `SHARED_PERCENTAGE_LABEL`           | Share of the consumer's total consumption that was met by the community's shared energy                 |
| **% Self-sufficiency** | `SELF_SUFFICIENCY_PERCENTAGE_LABEL` | Share of the consumer's total consumption covered by energy the community produced itself               |
| **VP**                 | `VP_LABEL`                          | Injection value: total renewable energy (kWh) produced and injected by the community in this period     |
| **VPC**                | `VPC_LABEL`                         | Injection value per consumer: portion of the community's injected energy attributed to this consumer    |
| **Surplus**            | `SURPLUS_LABEL`                     | Energy injected by the community that exceeded what consumers could absorb; returned to the public grid |

All of these can reuse the existing `HeaderWithHelper` component with no changes — just add `headerComponent` + `headerComponentParams` to the relevant `ColDef` entries.

---

## Fields in other modules that need the pattern

### Meter — HIGH priority

The meter creation and update forms contain the most technically complex fields in the app. Energy professionals fill these in, but the CRM is also used by community managers who are not electricians.

**Energy characteristics section**

| UI label                            | DTO field                                     | Why confusing                                                                             | Draft tooltip                                                                                                                                                     |
| ----------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Withdrawal power (kVA)**          | `sampling_power`                              | kVA ≠ kW; the distinction matters for billing. Non-electricians don't know what to enter. | Maximum power (in kVA) the meter is contractually allowed to draw from the grid at any instant. Found on the network contract.                                    |
| **Total generating capacity (kVA)** | `total_generating_capacity`                   | Distinct from withdrawal power but both measured in kVA — easy to mix up.                 | Maximum power (in kVA) that the production installation connected to this meter can inject into the grid.                                                         |
| **Amperage (A)**                    | `amperage`                                    | Electrical parameter; only relevant for certain billing schemes.                          | Current rating of the meter's main circuit breaker in amperes. Used for tariff classification by the DSO.                                                         |
| **Number of phases**                | `phases_number` (SINGLE_PHASE / THREE_PHASES) | Users know their installation but may not know why it matters here.                       | Single-phase meters handle up to ~7 kVA; three-phase meters are used for higher-power installations. Affects DSO billing thresholds.                              |
| **Generation type**                 | `production_chain`                            | "Fossil-fired cogeneration" and "Solid biomass" are industry terms.                       | Type of renewable or low-carbon installation connected to this meter. Choose "None" if this is a consumption-only meter.                                          |
| **Injection status**                | `injection_status`                            | Four regulatory sub-statuses blend legal ownership and grid-feed rights.                  | Describes the meter's relationship to a production installation and who holds the injection rights: owner of the installation, holder of a right-of-use, or none. |

**Financial characteristics section**

| UI label              | DTO field                                               | Why confusing                                                               | Draft tooltip                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tariff group**      | `tariff_group` (LOW_VOLTAGE / HIGH_VOLTAGE)             | Infrastructure classification, not a user choice.                           | Voltage level at which the meter is connected to the grid. Low voltage = standard residential/commercial connection. High voltage = industrial or large-scale connection. Set by your DSO.  |
| **Tariff**            | `rate` (SINGLE_RATE / DUAL_HOURLY / EXCLUSIVE_NIGHT)    | The billing implications of each option are invisible from the label alone. | Single-rate: one price 24/7. Dual-hourly: day and night prices differ. Exclusive night: all energy is billed at the night rate (typically used with large storage or heating systems).      |
| **Usage**             | `client_type` (RESIDENTIAL / PROFESSIONAL / INDUSTRIAL) | The boundary between Professional and Industrial is not obvious.            | Residential: private household. Professional: SME or office. Industrial: large industrial site with high-voltage connection or process loads. Determines which DSO tariff schedule applies. |
| **Reading frequency** | `reading_frequency` (MONTHLY / ANNUAL)                  | Affects how often real data is available vs. estimated.                     | How often the DSO reads the physical meter. Monthly reading provides finer billing granularity; annual reading means interim months are estimated from consumption profiles.                |

**DSO / GRD**

| UI label | DTO field | Why confusing                     | Draft tooltip                                                                                                                                       |
| -------- | --------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DSO**  | `grd`     | Acronym used without explanation. | Distribution System Operator: the regulated utility company that owns and manages the electricity grid in your area (e.g., Ores, Fluvius, Sibelga). |

**Consumption monitoring tab (meter-data-view)**

The chart and any future table showing consumption data uses four series:

| Series label             | Meaning                                 | Draft tooltip                                                                                           |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Consumption – Net**    | Actual consumption billed to the member | Total electricity taken from the grid for this meter after community sharing is applied.                |
| **Consumption – Shared** | Portion met by community allocation     | Portion of this meter's consumption covered by energy allocated from the community's shared production. |
| **Injection – Net**      | Actual injection credited to the member | Total electricity this meter fed back to the grid after community sharing is applied.                   |
| **Injection – Shared**   | Portion attributed via allocation       | Portion of this meter's injection that was allocated to community members through the sharing key.      |

---

### Sharing operation — MEDIUM priority

| Location       | Field / concept                        | Why confusing                                                              | Draft tooltip                                                                                                                                                                                                                                                                                                        |
| -------------- | -------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Creation form  | **Type** (INSIDE_BUILDING / REC / CEC) | REC and CEC are EU/Belgian regulatory categories unfamiliar to most users. | Within a building: meters in the same building sharing a common production installation. REC (Renewable Energy Community): members spread across several buildings, governed by the CWaPE framework. CEC (Collective Energy Community): broader community type with additional allowed activities under Belgian law. |
| Creation form  | **Covered municipalities**             | Users don't know why geographic scope matters.                             | Municipalities where members' meters may be located. The DSO uses this to validate whether a meter is eligible to join the operation.                                                                                                                                                                                |
| Operation view | **Current key / Key pending approval** | The concept of a key needing approval — and who approves it — is opaque.   | The allocation key defines how shared energy is distributed among consumers. A new key must be approved by the community manager before it takes effect. Until approved, the previous key remains active.                                                                                                            |
| Operation view | **Past / Current / Future meter tabs** | Users don't know what determines which tab a meter appears in.             | A meter is "current" if it is active in this operation today. "Past" meters left the operation on a past date. "Future" meters are registered but their start date has not yet arrived.                                                                                                                              |

---

### Member — MEDIUM priority

| Location               | Field                           | Why confusing                                                                                  | Draft tooltip                                                                                                                                                                                                                                              |
| ---------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Creation / update form | **Social tariff** checkbox      | Belgian regulatory concept; users don't know if it applies to their member or what it changes. | Members eligible for the social tariff receive a reduced energy rate under Belgian law (based on income or social status). Check this box if the member holds a valid social tariff right — the community manager may need to verify supporting documents. |
| Creation / update form | **Guardian** checkbox + section | The section appears conditionally; its legal significance is unclear.                          | Indicates that this member is legally represented by a guardian (e.g., a minor or a person under legal protection). When checked, the guardian's details must be provided; they will be the legally responsible contact for communications.                |

---

### Community — LOW priority

| Location            | Field                  | Why confusing                                                                            | Draft tooltip                                                                                                                                            |
| ------------------- | ---------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Community info form | **Address supplement** | "Supplement" is ambiguous — users don't know what goes here vs. the main address fields. | Optional second address line for details not captured by street, number, and box: building name, floor, wing, or other precision.                        |
| Community info form | **Logo upload**        | No indication of accepted formats or size limits in the UI.                              | Accepted formats: JPG, PNG, WebP. Recommended size: at least 200 × 200 px, square ratio. The logo appears in the community list and public-facing pages. |

---

## Summary: what needs to be built

| Scope                                   | What to build                                                                  | Effort                                         |
| --------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- |
| Remaining ag-Grid columns in `key-view` | Add `headerComponent` / `headerComponentParams` to existing `ColDef` entries   | Low — reuse existing component                 |
| Meter form fields                       | New `form-field-helper` component (label + inline info icon + PrimeNG popover) | Medium — new component, reuse popover pattern  |
| PrimeNG `<p-table>` column headers      | New `p-table`-compatible header template with the same icon+popover pattern    | Medium — template-driven, no ag-Grid interface |
| Sharing operation & member form fields  | Same `form-field-helper` component as meter                                    | Low once the component exists                  |
