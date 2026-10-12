export interface GrdOption {
  name: string;
}

/**
 * The Belgian electricity distribution system operators (GRD / DSO) a meter can be
 * connected to, stored as is in `meter_data.grd` (free text on the backend).
 *
 * - ELIA is the transmission operator, not a GRD.
 * - Enexis (the Baarle-Hertog enclaves) distributes gas only, so it has no place here.
 * - The Walloon names stay upper-case: administrative-document matches them against the
 *   CWaPE form's own list (`cwape_labels.GRD_LABELS`) to prefill its documents.
 */
export const GRD_OPTIONS: readonly GrdOption[] = [
  // Wallonia
  { name: 'ORES' },
  { name: 'RESA' },
  { name: 'AIEG' },
  { name: 'AIESH' },
  { name: 'REW' },
  // Brussels
  { name: 'Sibelga' },
  // Flanders: eight legal entities, all operated by Fluvius System Operator
  { name: 'Fluvius Antwerpen' },
  { name: 'Fluvius Halle-Vilvoorde' },
  { name: 'Fluvius Imewo' },
  { name: 'Fluvius Kempen' },
  { name: 'Fluvius Limburg' },
  { name: 'Fluvius Midden-Vlaanderen' },
  { name: 'Fluvius West' },
  { name: 'Fluvius Zenne-Dijle' },
];

/**
 * The option for a stored `grd`, ignoring case and surrounding spaces. A value that is
 * not a GRD (a legacy "ELIA", a bare "Fluvius") gives `undefined`, so the select opens
 * empty and the user has to pick a real operator.
 */
export function findGrdOption(value: string | null | undefined): GrdOption | undefined {
  const wanted = value?.trim().toUpperCase();
  if (!wanted) {
    return undefined;
  }
  return GRD_OPTIONS.find((option) => option.name.toUpperCase() === wanted);
}
