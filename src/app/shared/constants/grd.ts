import { DsoOperatorDTO } from '../dtos/dso.dtos';

export interface GrdOption {
  /** Stable id stored in `meter_data.grd` ("ores", "fluvius-imewo"). */
  id: string;
  name: string;
  /** `grd` = a distribution system operator; `grtl` = Elia's local transmission grid. */
  kind: 'grd' | 'grtl';
}

/**
 * The Belgian electricity distribution system operators (GRD / DSO) a meter can be
 * connected to. `meter_data.grd` stores the stable `id`; crm-backend normalises the
 * legacy display names ("RESA", "Fluvius Imewo") it still receives to the same ids.
 *
 * - The order is the select's: ORES first. The dso-lookup catalogue is re-sorted to
 *   it (see {@link grdSelectOptions}), so the first option stays ORES whichever list
 *   is shown, and the e2e meter scenarios that pick the first option keep getting it.
 * - Elia is not a GRD but the local transmission grid (30-70 kV) a few meters are
 *   connected to. It is offered separately, always last, and never prefilled.
 * - Enexis (the Baarle-Hertog enclaves) distributes gas only, so it has no place here.
 * - `name` is byte-identical to `operators.csv`'s `name` in belgian-dso-map.
 * - administrative-document maps the stored Walloon ids to the CWaPE form's own list
 *   (`cwape_labels.GRD_LABELS`) to prefill its documents.
 */
export const GRD_OPTIONS: readonly GrdOption[] = [
  // Wallonia
  { id: 'ores', name: 'ORES', kind: 'grd' },
  { id: 'resa', name: 'RESA', kind: 'grd' },
  { id: 'aieg', name: 'AIEG', kind: 'grd' },
  { id: 'aiesh', name: 'AIESH', kind: 'grd' },
  { id: 'rew', name: 'REW', kind: 'grd' },
  // Brussels
  { id: 'sibelga', name: 'Sibelga', kind: 'grd' },
  // Flanders: eight legal entities, all operated by Fluvius System Operator
  { id: 'fluvius-antwerpen', name: 'Fluvius Antwerpen', kind: 'grd' },
  { id: 'fluvius-halle-vilvoorde', name: 'Fluvius Halle-Vilvoorde', kind: 'grd' },
  { id: 'fluvius-imewo', name: 'Fluvius Imewo', kind: 'grd' },
  { id: 'fluvius-kempen', name: 'Fluvius Kempen', kind: 'grd' },
  { id: 'fluvius-limburg', name: 'Fluvius Limburg', kind: 'grd' },
  { id: 'fluvius-midden-vlaanderen', name: 'Fluvius Midden-Vlaanderen', kind: 'grd' },
  { id: 'fluvius-west', name: 'Fluvius West', kind: 'grd' },
  { id: 'fluvius-zenne-dijle', name: 'Fluvius Zenne-Dijle', kind: 'grd' },
];

export const ELIA_OPTION_ID = 'elia';

/**
 * Elia's short name, for display outside the select. The select itself labels it
 * with the translated `METER.INFORMATIONS.GRD_ELIA_OPTION`.
 */
const ELIA_OPTION: GrdOption = { id: ELIA_OPTION_ID, name: 'Elia', kind: 'grtl' };

/**
 * The options of a GRD select: the operators of the dso-lookup catalogue, or the
 * static list while it has not loaded (or when the service is off), then Elia.
 *
 * - Only current electricity GRDs are offered: `kind 'grd'`, `elec`, `lookup`, and
 *   not merged into another one (`replaced_by`). A replaced operator still gets its
 *   label from {@link grdLabel} on the meters that kept it.
 * - The catalogue comes grouped by kind, then region, in operators.csv's file order,
 *   which dso-lookup does not pin within a region; it is put back in the order of
 *   {@link GRD_OPTIONS}. An id the static list does not know yet goes
 *   after the known ones, in catalogue order.
 * - Elia is always appended last, never inside a group: a grouped select would move
 *   it, and the e2e scenarios pick the first option.
 */
export function grdSelectOptions(
  catalogue: readonly DsoOperatorDTO[] | null | undefined,
  eliaLabel: string,
): GrdOption[] {
  const rank = (id: string): number => {
    const index = GRD_OPTIONS.findIndex((option) => option.id === id);
    return index === -1 ? GRD_OPTIONS.length : index;
  };
  const fromCatalogue = (catalogue ?? [])
    .filter((operator) => operator.kind === 'grd' && operator.elec && operator.lookup)
    .filter((operator) => !operator.replaced_by)
    .map((operator): GrdOption => ({ id: operator.id, name: operator.name, kind: 'grd' }))
    // Array.prototype.sort is stable, so unknown ids keep the catalogue's order.
    .sort((a, b) => rank(a.id) - rank(b.id));
  // An empty catalogue is crm-backend's answer when dso-lookup is off.
  const grds =
    fromCatalogue.length > 0 ? fromCatalogue : GRD_OPTIONS.map((option) => ({ ...option }));
  return [...grds, { ...ELIA_OPTION, name: eliaLabel || ELIA_OPTION.name }];
}

/** Lower case, spaces and hyphens alike: "Fluvius-Imewo" and "fluvius imewo" are one name. */
function grdKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, ' ');
}

/**
 * The option for a stored `grd`: a stable id ("fluvius-imewo"), or a legacy display
 * name saved before the ids ("RESA", "Fluvius Imewo", "ELIA"), ignoring case,
 * surrounding spaces and the space/hyphen difference, as crm-backend does.
 *
 * A value that names no operator (a bare "Fluvius", "Enexis") gives `undefined`, so
 * an edit form opens empty and the user has to pick a real operator.
 */
export function findGrdOption(value: string | null | undefined): GrdOption | undefined {
  const wanted = value ? grdKey(value) : '';
  if (!wanted) {
    return undefined;
  }
  return [...GRD_OPTIONS, ELIA_OPTION].find(
    (option) => grdKey(option.id) === wanted || grdKey(option.name) === wanted,
  );
}

/** What to show for a stored `grd`: the operator's name, or the raw value it does not know. */
export function grdLabel(value: string | null | undefined): string {
  return findGrdOption(value)?.name ?? value ?? '';
}
