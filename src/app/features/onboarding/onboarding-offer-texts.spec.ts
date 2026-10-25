import fr from '../../../assets/i18n/fr.json';
import { offerTexts, Translate } from './onboarding-offer-texts';

/** Resolves keys against fr.json and fills {{params}}, as ngx-translate does. */
const translate: Translate = (key, params = {}) => {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], fr);
  if (typeof value !== 'string') return key;
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name: string) => {
    const param = params[name];
    return typeof param === 'string' || typeof param === 'number' ? String(param) : '';
  });
};

describe('offerTexts', () => {
  it('should give the welcome texts of the spec, with the step count', () => {
    expect(offerTexts('welcome', 11, null, translate)).toEqual({
      title: 'Bienvenue sur OptimCE',
      text: 'Faites le tour des principaux écrans en 11 étapes.',
      action: 'Me faire visiter',
      later: 'Plus tard',
      hint: 'Vous pourrez relancer ce tour à tout moment depuis « Guide utilisateur ».',
    });
  });

  it.each([
    ['community_admin', "Espace d'administration de Soleil", "Découvrir l'espace admin"],
    ['community_manager', 'Vous gérez désormais Soleil', 'Découvrir mes outils'],
    ['community_member', 'Bienvenue dans Soleil', 'Découvrir mon espace'],
  ] as const)('should name the community in the %s title', (key, title, action) => {
    const texts = offerTexts(key, 8, 'Soleil', translate);
    expect(texts.title).toBe(title);
    expect(texts.action).toBe(action);
    expect(texts.text).toContain('8 étapes');
  });

  it('should leave the step count out when it is not known', () => {
    const text = offerTexts('community_member', null, 'Soleil', translate).text;
    expect(text).toBe('Découvrez votre espace membre.');
    expect(text).not.toMatch(/\d/);
  });

  it('should leave the step count out for a one-step tour', () => {
    expect(offerTexts('welcome', 1, null, translate).text).toBe(
      'Faites le tour des principaux écrans.',
    );
  });
});
