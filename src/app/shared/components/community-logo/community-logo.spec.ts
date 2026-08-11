import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityLogo } from './community-logo';

describe('CommunityLogo', () => {
  let fixture: ComponentFixture<CommunityLogo>;
  let el: HTMLElement;

  function create(inputs: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(CommunityLogo);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  /** jsdom never loads images, so the failure path has to be driven by hand. */
  function failTheImage(): void {
    el.querySelector('img')?.dispatchEvent(new Event('error'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CommunityLogo] }).compileComponents();
  });

  // ── 1. Which of the two branches renders ────────────────────────────

  it('renders the image when a src is given', () => {
    create({ src: 'https://cdn/logo.png?sig=1', alt: 'CE de Namur' });

    const img = el.querySelector<HTMLImageElement>('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://cdn/logo.png?sig=1');
    expect(img?.alt).toBe('CE de Namur');
    expect(el.querySelector('.pi-building')).toBeNull();
  });

  it('renders the placeholder when src is null', () => {
    create({ src: null });

    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.pi-building')).toBeTruthy();
  });

  it('renders the placeholder when src is undefined', () => {
    create();

    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.pi-building')).toBeTruthy();
  });

  // ── 2. The load-failure path ────────────────────────────────────────

  it('swaps to the placeholder when the image fails to load', () => {
    create({ src: 'https://cdn/expired.png?sig=1' });
    expect(el.querySelector('img')).toBeTruthy();

    failTheImage();

    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.pi-building')).toBeTruthy();
  });

  it('tries again when the src changes after a failure', () => {
    // The regression this component exists to prevent: a boolean "broken" flag
    // would pin the placeholder forever, so a re-signed URL after an upload —
    // or the next community reusing this slot in a @for — would never render.
    create({ src: 'https://cdn/expired.png?sig=1' });
    failTheImage();
    expect(el.querySelector('img')).toBeNull();

    fixture.componentRef.setInput('src', 'https://cdn/fresh.png?sig=2');
    fixture.detectChanges();

    expect(el.querySelector<HTMLImageElement>('img')?.getAttribute('src')).toBe(
      'https://cdn/fresh.png?sig=2',
    );
  });

  it('stays on the placeholder while the same failed src is re-applied', () => {
    create({ src: 'https://cdn/expired.png?sig=1' });
    failTheImage();

    fixture.componentRef.setInput('src', 'https://cdn/expired.png?sig=1');
    fixture.detectChanges();

    expect(el.querySelector('img')).toBeNull();
  });

  // ── 3. Styling and test ids pass through ────────────────────────────

  it('applies the call site classes to each branch', () => {
    // Assert membership, not the whole string: Angular's [class] binding does
    // not preserve the order the call site wrote them in.
    const classesOf = (selector: string) => [...(el.querySelector(selector)?.classList ?? [])];

    create({
      src: 'https://cdn/logo.png',
      imgClass: 'w-8 h-8 rounded',
      fallbackClass: 'w-8 h-8 bg-primary-50',
      iconClass: 'pi pi-building text-primary-400',
    });
    expect(classesOf('img')).toEqual(expect.arrayContaining(['w-8', 'h-8', 'rounded']));

    failTheImage();

    expect(classesOf('span')).toEqual(expect.arrayContaining(['w-8', 'h-8', 'bg-primary-50']));
    expect(classesOf('i')).toEqual(
      expect.arrayContaining(['pi', 'pi-building', 'text-primary-400']),
    );
  });

  it('derives the placeholder test id from testId', () => {
    create({ src: 'https://cdn/logo.png', testId: 'community-info__img--logo' });
    expect(el.querySelector('[data-testid="community-info__img--logo"]')).toBeTruthy();

    failTheImage();

    expect(el.querySelector('[data-testid="community-info__img--logo-placeholder"]')).toBeTruthy();
  });

  it('omits data-testid entirely when no testId is given', () => {
    create({ src: null });
    expect(el.querySelector('[data-testid]')).toBeNull();
  });
});
