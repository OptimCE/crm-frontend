import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { RegulatoryStatus, RegulatorySubjectType } from '../../dtos/regulatory-status.dtos';
import { RegulatoryBadgeComponent } from './regulatory-badge';

describe('RegulatoryBadgeComponent', () => {
  let fixture: ComponentFixture<RegulatoryBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegulatoryBadgeComponent, TranslateModule.forRoot()],
      providers: [provideRouter([])],
    }).compileComponents();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('fr', {
      REGULATORY: {
        BADGE: { METER: { ACTIVE: 'Actif depuis le {{date}}' }, OPEN_PROCEDURE: 'Ouvrir' },
      },
    });
    translate.use('fr');
    fixture = TestBed.createComponent(RegulatoryBadgeComponent);
  });

  function render(state: unknown, procedureId: string | null = null): HTMLElement {
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('subjectType', RegulatorySubjectType.METER);
    fixture.componentRef.setInput('procedureId', procedureId);
    fixture.componentRef.setInput('testId', 'badge');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('says since when a meter is active, and links to its procedure', () => {
    const el = render(
      { regulatory_status: RegulatoryStatus.ACTIVE, valid_from: '2026-11-02' },
      '17',
    );

    const link = el.querySelector('a[data-testid="badge"]');
    expect(link?.getAttribute('href')).toBe('/administrative-document/procedures/17');
    expect(el.textContent).toContain('Actif depuis le 02/11/2026');
  });

  it('has no link without a procedure', () => {
    const el = render({ regulatory_status: RegulatoryStatus.ACTIVE, valid_from: '2026-11-02' });

    expect(el.querySelector('a')).toBeNull();
    expect(el.textContent).toContain('Actif depuis le 02/11/2026');
  });

  it('renders nothing for a subject nobody tracks', () => {
    const el = render(null, '17');

    expect(el.textContent?.trim()).toBe('');
  });
});
