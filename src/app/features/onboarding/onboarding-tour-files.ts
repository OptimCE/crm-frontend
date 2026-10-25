import { TourManifest, TourManifestEntry } from '../guided_tours/tour-catalog';

/** The part of a compiled tour file (`<tourId>.<locale>.json`) read here. */
export interface TourFile {
  steps: { id: string; layouts?: string[] }[];
}

/**
 * The file Steppy will play for `lang`: the exact tag, then its base language,
 * then the manifest's default locale, then the first file. The same order as
 * the player's own `pickLocale`, so the step count matches what it shows.
 */
export function tourFileFor(
  entry: TourManifestEntry,
  lang: string,
  defaultLocale: string,
): string | null {
  const files = entry.files ?? {};
  const base = lang.toLowerCase().split(/[-_]/)[0];
  return files[lang] ?? files[base] ?? files[defaultLocale] ?? Object.values(files)[0] ?? null;
}

/**
 * The number of steps the player will show on this screen: a step limited to
 * some layouts counts only when one of their media queries matches, which is
 * how the player computes its own `total`. The manifest's `steps` counts every
 * layout (15 for the welcome tour, of which 11 play on a desktop).
 *
 * null when the count is unknown (no steps, or a layout the manifest does not
 * define): the text then leaves the number out rather than guess.
 */
export function stepCountFor(
  file: TourFile,
  layouts: Readonly<Record<string, string>>,
  matches: (query: string) => boolean,
): number | null {
  if (!Array.isArray(file?.steps) || file.steps.length === 0) return null;
  let count = 0;
  for (const step of file.steps) {
    if (!step.layouts?.length) {
      count++;
      continue;
    }
    if (step.layouts.some((name) => layouts[name] === undefined)) return null;
    if (step.layouts.some((name) => matches(layouts[name]))) count++;
  }
  return count;
}

/**
 * The tour's content hash, stored with the answer so a later release can tell a
 * rewritten tour from the one the user saw: the SHA-384 of its default-locale
 * file. Steppy's `buildId` would not do, as it changes for every tour at once.
 */
export function tourVersionOf(entry: TourManifestEntry, manifest: TourManifest): string | null {
  return entry.integrity?.[manifest.defaultLocale] ?? null;
}
