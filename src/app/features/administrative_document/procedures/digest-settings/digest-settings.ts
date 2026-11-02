import { formatDate } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';

import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { LocaleService } from '../../../../core/services/language/locale.service';
import {
  DigestCadence,
  DigestSettingOut,
} from '../../../../shared/dtos/administrative-procedure.dtos';
import { UsersCommunityDTO } from '../../../../shared/dtos/community.dtos';
import { LocaleDatePipe } from '../../../../shared/pipes/locale-format/locale-format-pipes';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';
import { AdministrativeProcedureService } from '../../../../shared/services/administrative-procedure.service';
import { CommunityService } from '../../../../shared/services/community.service';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error.utils';
import {
  translatedOptions,
  translationChanges,
} from '../../../../shared/utils/translated-options.utils';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
/** Every admin and manager of a community fits one page. */
const PEOPLE_PAGE = { page: 1, limit: 200 };

/**
 * The hub's summary email (phase 4): off by default. An admin turns it on and
 * picks its rhythm and its recipients among the community's admins and
 * managers; every manager reads it. Recipients who stopped it in their
 * profile are named, so the admin knows it no longer reaches them.
 */
@Component({
  selector: 'app-digest-settings',
  standalone: true,
  imports: [FormsModule, TranslatePipe, Button, MultiSelect, Select, ToggleSwitch, LocaleDatePipe],
  templateUrl: './digest-settings.html',
})
export class DigestSettings implements OnInit {
  private readonly service = inject(AdministrativeProcedureService);
  private readonly communities = inject(CommunityService);
  private readonly userContext = inject(UserContextService);
  private readonly locale = inject(LocaleService).locale;
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translations = translationChanges();

  /** What the server holds; the form below is its edited copy. */
  readonly setting = signal<DigestSettingOut | null>(null);
  readonly people = signal<UsersCommunityDTO[]>([]);
  readonly enabled = signal(false);
  readonly cadence = signal<DigestCadence>('weekly');
  readonly weekday = signal(1);
  readonly firstOn = signal<string | null>(null);
  readonly recipientIds = signal<number[]>([]);
  readonly saving = signal(false);

  canEdit(): boolean {
    return this.userContext.compareWithActiveRole(Role.ADMIN);
  }

  readonly cadenceOptions = translatedOptions<{ value: DigestCadence; label: string }>([
    { value: 'working_days', label: 'ADMINISTRATIVE_DOCUMENT.DIGEST.CADENCE.working_days' },
    { value: 'weekly', label: 'ADMINISTRATIVE_DOCUMENT.DIGEST.CADENCE.weekly' },
    { value: 'biweekly', label: 'ADMINISTRATIVE_DOCUMENT.DIGEST.CADENCE.biweekly' },
    { value: 'monthly', label: 'ADMINISTRATIVE_DOCUMENT.DIGEST.CADENCE.monthly' },
  ]);
  readonly weekdayOptions = translatedOptions(
    WEEKDAYS.map((day) => ({
      value: day,
      label: `ADMINISTRATIVE_DOCUMENT.DIGEST.WEEKDAYS.${day}`,
    })),
  );

  /** Every two weeks: the next two such weekdays, or the first send it already has. */
  readonly firstOnOptions = computed(() => {
    const setting = this.setting();
    const weekday = this.weekday();
    const offered = setting?.first_dates[weekday - 1] ?? [];
    const kept =
      setting?.cadence === 'biweekly' &&
      setting.weekday === weekday &&
      setting.first_on &&
      !offered.includes(setting.first_on)
        ? [setting.first_on]
        : [];
    const locale = this.locale();
    return [...kept, ...offered].map((day) => ({
      value: day,
      label: formatDate(day, 'fullDate', locale),
    }));
  });

  readonly recipientOptions = computed(() =>
    this.people().map((person) => ({ value: person.id_user, label: labelOf(person) })),
  );

  /** The saved recipients, each with whether they stopped it in their profile. */
  readonly recipients = computed(() => {
    const setting = this.setting();
    if (!setting) return [];
    const byId = new Map(this.people().map((person) => [person.id_user, person]));
    const off = new Set(setting.opted_out);
    return setting.recipient_ids.map((id) => {
      const person = byId.get(id);
      return { id, name: person ? labelOf(person) : `#${id}`, optedOut: off.has(id) };
    });
  });

  readonly optedOutNames = computed(() =>
    this.recipients()
      .filter((recipient) => recipient.optedOut && this.recipientIds().includes(recipient.id))
      .map((recipient) => recipient.name)
      .join(', '),
  );

  /** « Chaque mardi », « Un mardi sur deux »…, as saved. */
  readonly rhythm = computed(() => {
    this.translations();
    const setting = this.setting();
    if (!setting) return '';
    const day = setting.weekday
      ? (this.translate.instant(
          `ADMINISTRATIVE_DOCUMENT.DIGEST.WEEKDAYS.${setting.weekday}`,
        ) as string)
      : '';
    return this.translate.instant(`ADMINISTRATIVE_DOCUMENT.DIGEST.RHYTHM.${setting.cadence}`, {
      day,
    }) as string;
  });

  readonly canSave = computed(
    () =>
      !this.saving() &&
      (!this.enabled() || this.recipientIds().length > 0) &&
      (!this.enabled() || this.cadence() !== 'biweekly' || this.firstOn() !== null),
  );

  ngOnInit(): void {
    this.service
      .getDigestSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.data) this.apply(res.data);
        },
        error: () => this.setting.set(null),
      });
    this.communities
      .getAdmins(PEOPLE_PAGE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.people.set(Array.isArray(res.data) ? res.data : []),
        error: () => this.people.set([]),
      });
  }

  onCadence(cadence: DigestCadence): void {
    this.cadence.set(cadence);
    if (cadence === 'biweekly' && this.firstOn() === null) this.firstOn.set(this.firstOffered());
  }

  onWeekday(weekday: number): void {
    this.weekday.set(weekday);
    // A first send falls on its weekday: another day, another first send.
    this.firstOn.set(this.firstOffered());
  }

  save(): void {
    const cadence = this.cadence();
    this.saving.set(true);
    this.service
      .saveDigestSettings({
        enabled: this.enabled(),
        cadence,
        weekday: cadence === 'working_days' ? null : this.weekday(),
        first_on: cadence === 'biweekly' ? this.firstOn() : null,
        recipient_ids: this.recipientIds(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          if (res.data) this.apply(res.data);
          this.snackbar.openSnackBar(
            this.translate.instant('ADMINISTRATIVE_DOCUMENT.DIGEST.SAVED') as string,
            VALIDATION_TYPE,
          );
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.errorHandler.handleError(extractApiErrorMessage(error));
        },
      });
  }

  private apply(setting: DigestSettingOut): void {
    this.setting.set(setting);
    this.enabled.set(setting.enabled);
    this.cadence.set(setting.cadence);
    this.weekday.set(setting.weekday ?? 1);
    this.firstOn.set(setting.first_on);
    this.recipientIds.set([...setting.recipient_ids]);
  }

  private firstOffered(): string | null {
    return this.setting()?.first_dates[this.weekday() - 1]?.[0] ?? null;
  }
}

function labelOf(person: UsersCommunityDTO): string {
  const name = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
  return name ? `${name} (${person.email})` : person.email;
}
