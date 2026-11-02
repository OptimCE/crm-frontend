import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { LocaleService } from '../../../../core/services/language/locale.service';
import { DigestSettingOut } from '../../../../shared/dtos/administrative-procedure.dtos';
import { UsersCommunityDTO } from '../../../../shared/dtos/community.dtos';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { CommunityService } from '../../../../shared/services/community.service';
import { DigestSettings } from './digest-settings';

const OFF: DigestSettingOut = {
  enabled: false,
  cadence: 'weekly',
  weekday: 1,
  first_on: null,
  recipient_ids: [],
  opted_out: [],
  next_on: null,
  // Index 1: Tuesdays.
  first_dates: [
    ['2026-04-20', '2026-04-27'],
    ['2026-04-21', '2026-04-28'],
    ['2026-04-22', '2026-04-29'],
    ['2026-04-16', '2026-04-23'],
    ['2026-04-17', '2026-04-24'],
    ['2026-04-18', '2026-04-25'],
    ['2026-04-19', '2026-04-26'],
  ],
  updated_at: null,
  updated_by: null,
};

const ON: DigestSettingOut = {
  ...OFF,
  enabled: true,
  weekday: 2,
  recipient_ids: [7, 8],
  opted_out: [8],
  next_on: '2026-04-21',
};

const PEOPLE: UsersCommunityDTO[] = [
  { id_user: 7, id_community: 1, email: 'anna@ce.be', role: Role.ADMIN, first_name: 'Anna' },
  { id_user: 8, id_community: 1, email: 'bram@ce.be', role: Role.GESTIONNAIRE },
];

describe('DigestSettings (the hub)', () => {
  let save: ReturnType<typeof vi.fn>;

  async function render(setting: DigestSettingOut, admin = false) {
    save = vi.fn().mockReturnValue(of(new ApiResponse({ ...ON, recipient_ids: [7] })));
    await TestBed.configureTestingModule({
      imports: [DigestSettings, TranslateModule.forRoot()],
      providers: [
        {
          provide: AdministrativeProcedureService,
          useValue: {
            getDigestSettings: () => of(new ApiResponse(setting)),
            saveDigestSettings: save,
          },
        },
        { provide: CommunityService, useValue: { getAdmins: () => of({ data: PEOPLE }) } },
        { provide: UserContextService, useValue: { compareWithActiveRole: () => admin } },
        { provide: LocaleService, useValue: { locale: signal('fr') } },
        { provide: SnackbarNotification, useValue: { openSnackBar: vi.fn() } },
        { provide: ErrorMessageHandler, useValue: { handleError: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(DigestSettings);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('says it is off by default, and a manager cannot change it', async () => {
    const { el } = await render(OFF);

    expect(el.querySelector('[data-testid="digest-settings__status"]')?.textContent).toContain(
      'ADMINISTRATIVE_DOCUMENT.DIGEST.OFF',
    );
    expect(el.querySelector('[data-testid="digest-settings__form"]')).toBeNull();
    expect(el.querySelector('[data-testid="digest-settings__recipients-view"]')).toBeNull();
  });

  it('shows a manager the next send and who receives it, who stopped it marked', async () => {
    const { el } = await render(ON);

    expect(el.querySelector('[data-testid="digest-settings__next"]')).not.toBeNull();
    const items = Array.from(
      el.querySelectorAll('[data-testid="digest-settings__recipients-view"] li'),
    ).map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
    expect(items).toEqual([
      'Anna (anna@ce.be)',
      'bram@ce.be — ADMINISTRATIVE_DOCUMENT.DIGEST.OPTED_OUT',
    ]);
  });

  it('lets an admin turn it on, with its rhythm and recipients', async () => {
    const { fixture } = await render(OFF, true);
    const card = fixture.componentInstance;

    card.enabled.set(true);
    card.onCadence('weekly');
    card.onWeekday(2);
    expect(card.canSave()).toBe(false); // nobody to send it to yet
    card.recipientIds.set([7]);
    expect(card.canSave()).toBe(true);
    card.save();

    expect(save).toHaveBeenCalledWith({
      enabled: true,
      cadence: 'weekly',
      weekday: 2,
      first_on: null,
      recipient_ids: [7],
    });
    expect(card.setting()?.enabled).toBe(true);
  });

  it('starts every two weeks on the first date offered for the day', async () => {
    const { fixture } = await render(OFF, true);
    const card = fixture.componentInstance;

    card.enabled.set(true);
    card.onWeekday(2);
    card.onCadence('biweekly');

    expect(card.firstOn()).toBe('2026-04-21');
    expect(card.firstOnOptions().map((option) => option.value)).toEqual([
      '2026-04-21',
      '2026-04-28',
    ]);
    card.onWeekday(3); // another day, another first send
    expect(card.firstOn()).toBe('2026-04-22');
  });

  it('sends no weekday on working days', async () => {
    const { fixture } = await render(OFF, true);
    const card = fixture.componentInstance;
    card.enabled.set(true);
    card.onCadence('working_days');
    card.recipientIds.set([7]);

    card.save();

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ cadence: 'working_days', weekday: null, first_on: null }),
    );
  });

  it('tells the admin which chosen recipients stopped it in their profile', async () => {
    const { el } = await render(ON, true);

    expect(el.querySelector('[data-testid="digest-settings__opted-out"]')?.textContent).toContain(
      'ADMINISTRATIVE_DOCUMENT.DIGEST.OPTED_OUT_NOTE',
    );
  });
});
