import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';

import { ApiResponse } from '../../../../core/dtos/api.response';
import { VALIDATION_TYPE } from '../../../../core/dtos/notification';
import {
  AdminVisibility,
  CreatePostRequest,
  MemberDisplay,
  MemberVisibility,
  PostType,
  UpdatePostRequest,
} from '../../../../shared/dtos/news.dtos';
import { MarkdownEditorComponent } from '../../../../shared/components/markdown-editor/markdown-editor';
import { NewsService } from '../../../../shared/services/news.service';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../shared/services-ui/snackbar.notifcation.service';

interface ComposeData {
  mode: 'create' | 'edit';
  postId?: number;
}

interface SelectOption {
  label: string;
  value: number;
}

interface VisibilityPreset {
  key: string;
  admin: AdminVisibility;
  member: MemberVisibility;
  display: MemberDisplay;
}

const PRESETS: VisibilityPreset[] = [
  {
    key: 'anonymous',
    admin: AdminVisibility.AGGREGATE,
    member: MemberVisibility.AGGREGATE,
    display: MemberDisplay.AFTER_VOTE,
  },
  {
    key: 'transparent',
    admin: AdminVisibility.FULL,
    member: MemberVisibility.FULL,
    display: MemberDisplay.BEFORE_VOTE,
  },
  {
    key: 'on_close',
    admin: AdminVisibility.FULL,
    member: MemberVisibility.AGGREGATE,
    display: MemberDisplay.WHEN_POLL_ENDS,
  },
];

@Component({
  selector: 'app-news-compose-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    Button,
    DatePicker,
    InputText,
    Select,
    MarkdownEditorComponent,
  ],
  templateUrl: './news-compose-dialog.html',
  styleUrl: './news-compose-dialog.css',
})
export class NewsComposeDialog implements OnInit {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig<ComposeData>);
  private readonly service = inject(NewsService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarNotification);
  private readonly errorHandler = inject(ErrorMessageHandler);
  private readonly destroyRef = inject(DestroyRef);

  private readonly data: ComposeData = (this.config.data as ComposeData | undefined) ?? {
    mode: 'create',
  };

  readonly kind = signal<'post' | 'poll'>('post');
  readonly pollMultiple = signal<boolean>(false);
  readonly advanced = signal<boolean>(false);
  readonly selectedPreset = signal<string>('anonymous');
  readonly loading = signal<boolean>(false);
  readonly submitting = signal<boolean>(false);
  readonly optionsLocked = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  readonly isEdit = computed(() => this.data.mode === 'edit');
  readonly isPoll = computed(() => this.kind() === 'poll');

  /** DatePicker lower bound — now. Captured once (Date.now is fine in components). */
  readonly minDate = new Date();

  readonly form = new FormGroup({
    post: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1)],
    }),
    expires_at: new FormControl<Date | null>(null),
    admin_visibility: new FormControl<AdminVisibility>(AdminVisibility.AGGREGATE, {
      nonNullable: true,
    }),
    member_visibility: new FormControl<MemberVisibility>(MemberVisibility.AGGREGATE, {
      nonNullable: true,
    }),
    member_display: new FormControl<MemberDisplay>(MemberDisplay.AFTER_VOTE, { nonNullable: true }),
    options: new FormArray<FormControl<string>>([this.optionControl(), this.optionControl()]),
  });

  readonly presets = PRESETS;
  adminOptions: SelectOption[] = [];
  memberOptions: SelectOption[] = [];
  displayOptions: SelectOption[] = [];

  ngOnInit(): void {
    this.buildSelectOptions();
    this.applyPreset(this.selectedPreset());
    if (this.isEdit() && this.data.postId != null) {
      this.prefill(this.data.postId);
    }
  }

  get optionsArray(): FormArray<FormControl<string>> {
    return this.form.controls.options;
  }

  // ----- kind / poll type ------------------------------------------------

  setKind(kind: 'post' | 'poll'): void {
    if (this.isEdit()) return;
    this.kind.set(kind);
    this.formError.set(null);
  }

  setPollMultiple(multiple: boolean): void {
    this.pollMultiple.set(multiple);
  }

  // ----- options ---------------------------------------------------------

  addOption(): void {
    if (this.optionsLocked()) return;
    this.optionsArray.push(this.optionControl());
  }

  removeOption(index: number): void {
    if (this.optionsLocked() || this.optionsArray.length <= 2) return;
    this.optionsArray.removeAt(index);
  }

  private optionControl(value = ''): FormControl<string> {
    return new FormControl<string>(value, { nonNullable: true });
  }

  // ----- visibility presets ---------------------------------------------

  applyPreset(key: string): void {
    const preset = PRESETS.find((p) => p.key === key);
    if (!preset) return;
    this.selectedPreset.set(key);
    this.advanced.set(false);
    this.form.patchValue({
      admin_visibility: preset.admin,
      member_visibility: preset.member,
      member_display: preset.display,
    });
  }

  toggleAdvanced(): void {
    this.advanced.update((v) => !v);
    if (this.advanced()) this.selectedPreset.set('');
  }

  // ----- submit ----------------------------------------------------------

  submit(): void {
    this.formError.set(null);
    this.form.controls.post.markAsTouched();
    const postText = this.form.controls.post.value.trim();
    if (!postText) {
      this.formError.set(
        this.translate.instant('NEWS_BOARD.COMPOSE.ERRORS.POST_REQUIRED') as string,
      );
      return;
    }

    if (this.isPoll()) {
      const options = this.optionValues();
      if (options.length < 2) {
        this.formError.set(
          this.translate.instant('NEWS_BOARD.COMPOSE.ERRORS.MIN_OPTIONS') as string,
        );
        return;
      }
      const expires = this.form.controls.expires_at.value;
      if (!expires) {
        this.formError.set(
          this.translate.instant('NEWS_BOARD.COMPOSE.ERRORS.EXPIRY_REQUIRED') as string,
        );
        return;
      }
      if (expires.getTime() <= Date.now()) {
        this.formError.set(
          this.translate.instant('NEWS_BOARD.COMPOSE.ERRORS.EXPIRY_FUTURE') as string,
        );
        return;
      }
    }

    this.submitting.set(true);
    const request$ = this.isEdit()
      ? this.service.updatePost(this.data.postId as number, this.buildUpdate(postText))
      : this.service.createPost(this.buildCreate(postText));

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snackbar.openSnackBar(
          this.translate.instant(
            this.isEdit() ? 'NEWS_BOARD.COMPOSE.UPDATED' : 'NEWS_BOARD.COMPOSE.CREATED',
          ) as string,
          VALIDATION_TYPE,
        );
        this.ref.close(true);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.errorHandler.handleError(error instanceof ApiResponse ? (error.data as string) : null);
      },
    });
  }

  close(): void {
    this.ref.close(false);
  }

  // ----- builders --------------------------------------------------------

  private effectiveType(): PostType {
    if (this.kind() === 'post') return PostType.POST;
    return this.pollMultiple() ? PostType.POLL_MULTIPLE_CHOICE : PostType.POLL_SINGLE_CHOICE;
  }

  private optionValues(): string[] {
    return this.optionsArray.controls.map((c) => c.value.trim()).filter((v) => v.length > 0);
  }

  private buildCreate(postText: string): CreatePostRequest {
    const body: CreatePostRequest = { type: this.effectiveType(), post: postText };
    if (this.isPoll()) {
      body.options = this.optionValues().map((value, index) => ({
        option_value: value,
        display_order: index,
      }));
      body.expires_at = this.form.controls.expires_at.value?.toISOString();
      body.admin_visibility = this.form.controls.admin_visibility.value;
      body.member_visibility = this.form.controls.member_visibility.value;
      body.member_display = this.form.controls.member_display.value;
    }
    return body;
  }

  private buildUpdate(postText: string): UpdatePostRequest {
    const body: UpdatePostRequest = { post: postText };
    if (this.isPoll()) {
      body.expires_at = this.form.controls.expires_at.value?.toISOString();
      body.admin_visibility = this.form.controls.admin_visibility.value;
      body.member_visibility = this.form.controls.member_visibility.value;
      body.member_display = this.form.controls.member_display.value;
      if (!this.optionsLocked()) {
        body.options = this.optionValues().map((value, index) => ({
          option_value: value,
          display_order: index,
        }));
      }
    }
    return body;
  }

  // ----- edit prefill ----------------------------------------------------

  private prefill(postId: number): void {
    this.loading.set(true);
    forkJoin({
      detail: this.service.getPost(postId),
      results: this.service.getResults(postId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ detail, results }) => {
          const d = detail.data;
          this.form.controls.post.setValue(d.post);

          if (d.is_poll) {
            this.kind.set('poll');
            this.pollMultiple.set(d.type === PostType.POLL_MULTIPLE_CHOICE);
            this.form.controls.expires_at.setValue(d.expires_at ? new Date(d.expires_at) : null);
            this.form.patchValue({
              admin_visibility: d.admin_visibility ?? AdminVisibility.AGGREGATE,
              member_visibility: d.member_visibility ?? MemberVisibility.AGGREGATE,
              member_display: d.member_display ?? MemberDisplay.AFTER_VOTE,
            });
            this.matchPreset();

            this.optionsArray.clear();
            for (const option of d.options) {
              this.optionsArray.push(this.optionControl(option.option_value));
            }
            if ((results.data.total_voters ?? 0) > 0) {
              this.optionsLocked.set(true);
              this.optionsArray.disable();
            }
          }
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorHandler.handleError(
            error instanceof ApiResponse ? (error.data as string) : null,
          );
          this.ref.close(false);
        },
      });
  }

  private matchPreset(): void {
    const a = this.form.controls.admin_visibility.value;
    const m = this.form.controls.member_visibility.value;
    const display = this.form.controls.member_display.value;
    const preset = PRESETS.find((p) => p.admin === a && p.member === m && p.display === display);
    if (preset) {
      this.selectedPreset.set(preset.key);
      this.advanced.set(false);
    } else {
      this.selectedPreset.set('');
      this.advanced.set(true);
    }
  }

  private buildSelectOptions(): void {
    const t = (key: string): string => this.translate.instant(key) as string;
    this.adminOptions = [
      { label: t('NEWS_BOARD.COMPOSE.VIS.AGGREGATE'), value: AdminVisibility.AGGREGATE },
      { label: t('NEWS_BOARD.COMPOSE.VIS.FULL'), value: AdminVisibility.FULL },
    ];
    this.memberOptions = [
      { label: t('NEWS_BOARD.COMPOSE.VIS.NONE'), value: MemberVisibility.NONE },
      { label: t('NEWS_BOARD.COMPOSE.VIS.AGGREGATE'), value: MemberVisibility.AGGREGATE },
      { label: t('NEWS_BOARD.COMPOSE.VIS.FULL'), value: MemberVisibility.FULL },
    ];
    this.displayOptions = [
      { label: t('NEWS_BOARD.COMPOSE.DISPLAY.NEVER'), value: MemberDisplay.NEVER },
      { label: t('NEWS_BOARD.COMPOSE.DISPLAY.BEFORE_VOTE'), value: MemberDisplay.BEFORE_VOTE },
      { label: t('NEWS_BOARD.COMPOSE.DISPLAY.AFTER_VOTE'), value: MemberDisplay.AFTER_VOTE },
      {
        label: t('NEWS_BOARD.COMPOSE.DISPLAY.WHEN_POLL_ENDS'),
        value: MemberDisplay.WHEN_POLL_ENDS,
      },
    ];
  }
}
