import { OnboardingTourKey } from './onboarding-tours';

/** The i18n block of each tour's offer, under ONBOARDING. */
const TEXT_KEYS: Readonly<Record<OnboardingTourKey, string>> = {
  welcome: 'ONBOARDING.WELCOME',
  community_admin: 'ONBOARDING.COMMUNITY_ADMIN',
  community_manager: 'ONBOARDING.COMMUNITY_MANAGER',
  community_member: 'ONBOARDING.COMMUNITY_MEMBER',
};

/** The help entry the hint line names: the sidebar's "User guide" link opens the Help dialog. */
export const HELP_ENTRY_LABEL = 'NAVBAR.USER_GUIDE';

export interface OfferTexts {
  title: string;
  text: string;
  action: string;
  later: string;
  hint: string;
}

export type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * The texts of an offer. The step count is mentioned only when it is known and
 * plural (below two the sentence would read oddly): never a hard-coded number.
 */
export function offerTexts(
  key: OnboardingTourKey,
  steps: number | null,
  community: string | null,
  translate: Translate,
): OfferTexts {
  const base = TEXT_KEYS[key];
  const withCount = steps !== null && steps >= 2;
  return {
    title: translate(`${base}.TITLE`, { community: community ?? '' }),
    text: withCount ? translate(`${base}.TEXT`, { n: steps }) : translate(`${base}.TEXT_NO_COUNT`),
    action: translate(`${base}.ACTION`),
    later: translate('ONBOARDING.LATER'),
    // ngx-translate does not expand a key passed as a parameter: resolve it first.
    hint: translate('ONBOARDING.HINT', { help: translate(HELP_ENTRY_LABEL) }),
  };
}
