import { environments, RuntimeConfig, setRuntimeConfig } from './environments';

describe('environments.onboarding', () => {
  afterEach(() => setRuntimeConfig({}));

  it('should be enabled by default', () => {
    setRuntimeConfig({});
    expect(environments.onboarding.enabled).toBe(true);
  });

  it.each([false, 'false', ' FALSE '])('should be disabled by %p', (enabled) => {
    setRuntimeConfig({ onboarding: { enabled } } as Partial<RuntimeConfig>);
    expect(environments.onboarding.enabled).toBe(false);
  });

  it.each([true, 'true', '', undefined])('should stay enabled for %p', (enabled) => {
    setRuntimeConfig({ onboarding: { enabled } } as Partial<RuntimeConfig>);
    expect(environments.onboarding.enabled).toBe(true);
  });
});
