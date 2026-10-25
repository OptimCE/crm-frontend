import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputText } from 'primeng/inputtext';
import { Skeleton } from 'primeng/skeleton';

import { LocaleService } from '../../../../core/services/language/locale.service';
import { GuidedToursService, GuidedToursState } from '../../services/guided-tours.service';
import { filterSelection, OfferedTour, selectTours, TourSelection } from '../../tour-catalog';

/** The guide the sidebar's "User guide" link opens. */
export const USER_GUIDE_URL = 'https://guide.optimce.be';

/** What the dialog closes with when the user picks a tour; the caller starts it. */
export interface HelpDialogResult {
  tourId: string;
  params?: Record<string, string>;
}

/**
 * The Help dialog: the online guide, and the in-app tours this user can start
 * from where they are. It only picks a tour; the navbar starts it once the
 * dialog is closed, so the modal never sits over the tour's first step.
 */
@Component({
  selector: 'app-help-dialog',
  imports: [Button, InputText, Skeleton, TranslatePipe],
  templateUrl: './help-dialog.html',
  styleUrl: './help-dialog.css',
})
export class HelpDialog implements OnInit {
  private readonly ref = inject(DynamicDialogRef);
  private readonly guidedTours = inject(GuidedToursService);
  private readonly locale = inject(LocaleService).locale;

  protected readonly guideUrl = USER_GUIDE_URL;
  protected readonly state = signal<GuidedToursState | null>(null);
  protected readonly query = signal('');

  /** Recomputed on a language switch, so the titles follow it while open. */
  private readonly selection = computed<TourSelection | null>(() => {
    const state = this.state();
    if (!state?.manifest) return null;
    return selectTours(state.manifest, state.context, this.locale());
  });

  protected readonly visible = computed(() => {
    const selection = this.selection();
    return selection ? filterSelection(selection, this.query()) : null;
  });

  /** "On this page" first, then the areas; one heading and list each. */
  protected readonly sections = computed<{ key: string; label: string; tours: OfferedTour[] }[]>(
    () => {
      const visible = this.visible();
      if (!visible) return [];
      const here = visible.onThisPage.length
        ? [{ key: 'on-this-page', label: 'HELP.TOURS.ON_THIS_PAGE', tours: visible.onThisPage }]
        : [];
      return [
        ...here,
        ...visible.byArea.map((group) => ({
          key: group.area,
          label: group.label,
          tours: group.tours,
        })),
      ];
    },
  );

  protected readonly loading = computed(() => this.state() === null);
  protected readonly failed = computed(() => this.state() !== null && !this.state()?.manifest);
  protected readonly noCommunity = computed(() => this.state()?.context.role === null);
  protected readonly offersNothing = computed(() => {
    const selection = this.selection();
    return !!selection && selection.onThisPage.length === 0 && selection.byArea.length === 0;
  });
  protected readonly noMatch = computed(() => {
    const visible = this.visible();
    return !!visible && visible.onThisPage.length === 0 && visible.byArea.length === 0;
  });

  ngOnInit(): void {
    void this.guidedTours.load().then((state) => this.state.set(state));
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected start(tour: OfferedTour): void {
    const result: HelpDialogResult = tour.params
      ? { tourId: tour.id, params: tour.params }
      : { tourId: tour.id };
    this.ref.close(result);
  }
}
