import realManifest from '../../../../public/tours/tours.manifest.json';
import welcomeFr from '../../../../public/tours/onboarding-welcome.fr.json';
import { TourManifest, TourManifestEntry } from '../guided_tours/tour-catalog';
import { stepCountFor, TourFile, tourFileFor, tourVersionOf } from './onboarding-tour-files';

const manifest = realManifest as TourManifest;
const layouts = manifest.layouts ?? {};

function entry(
  files: Record<string, string>,
  integrity: Record<string, string> = {},
): TourManifestEntry {
  return { id: 't', role: 'member', entry: { route: '/home' }, title: {}, files, integrity };
}

describe('tourFileFor', () => {
  const files = { fr: 't.fr.json', en: 't.en.json', nl: 't.nl.json' };

  it('should pick the exact locale, then its base language', () => {
    expect(tourFileFor(entry(files), 'en', 'fr')).toBe('t.en.json');
    expect(tourFileFor(entry(files), 'nl-BE', 'fr')).toBe('t.nl.json');
  });

  it('should fall back on the default locale, then on the first file', () => {
    expect(tourFileFor(entry(files), 'de', 'fr')).toBe('t.fr.json');
    expect(tourFileFor(entry({ en: 't.en.json' }), 'de', 'fr')).toBe('t.en.json');
    expect(tourFileFor(entry({}), 'de', 'fr')).toBeNull();
  });
});

describe('stepCountFor', () => {
  const desktop = (query: string) => query === layouts['desktop'];
  const mobile = (query: string) => query === layouts['mobile'];

  it('should count only the steps of the current layout, as the player does', () => {
    // The welcome tour has 9 shared steps, 3 desktop-only and 5 mobile-only.
    const file = welcomeFr as TourFile;
    expect(file.steps).toHaveLength(17);
    expect(stepCountFor(file, layouts, desktop)).toBe(12);
    expect(stepCountFor(file, layouts, mobile)).toBe(14);
  });

  it('should give no count for a file without steps', () => {
    expect(stepCountFor({ steps: [] }, layouts, desktop)).toBeNull();
    expect(stepCountFor({} as TourFile, layouts, desktop)).toBeNull();
  });

  it('should give no count when a step names a layout the manifest does not define', () => {
    expect(
      stepCountFor({ steps: [{ id: 'a', layouts: ['tablet'] }] }, layouts, desktop),
    ).toBeNull();
  });
});

describe('tourVersionOf', () => {
  it("should be the hash of the default locale's file", () => {
    const tour = entry({ fr: 'f', en: 'e' }, { fr: 'sha384-fr', en: 'sha384-en' });
    expect(tourVersionOf(tour, { defaultLocale: 'fr', tours: [] })).toBe('sha384-fr');
    expect(tourVersionOf(entry({}), { defaultLocale: 'fr', tours: [] })).toBeNull();
  });

  it('should be set for every shipped onboarding tour', () => {
    const onboarding = manifest.tours.filter((t) => t.id.startsWith('onboarding-'));
    expect(onboarding.length).toBe(4);
    expect(onboarding.every((t) => tourVersionOf(t, manifest)?.startsWith('sha384-'))).toBe(true);
  });
});
