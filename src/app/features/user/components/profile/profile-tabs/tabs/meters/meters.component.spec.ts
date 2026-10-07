import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TableLazyLoadEvent } from 'primeng/table';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MetersComponent } from './meters.component';
import { ApiResponsePaginated, Pagination } from '../../../../../../../core/dtos/api.response';
import { MeMetersPartialQuery, MePartialMeterDTO } from '../../../../../../../shared/dtos/me.dtos';
import { MeService } from '../../../../../../../shared/services/me.service';
import { ErrorMessageHandler } from '../../../../../../../shared/services-ui/error.message.handler';
import { SnackbarNotification } from '../../../../../../../shared/services-ui/snackbar.notifcation.service';
import { MeterDataStatus } from '../../../../../../../shared/types/meter.types';
import { DebouncedPInputComponent } from '../../../../../../../shared/components/debounced-p-input/debounced-p-input.component';

// ── Stubs ──────────────────────────────────────────────────────────

@Component({ selector: 'app-debounced-p-input', standalone: true, template: '' })
class DebouncedPInputStub {}

// ── Helpers ────────────────────────────────────────────────────────

function buildMeters(): MePartialMeterDTO[] {
  return [
    {
      EAN: '541449000000000001',
      meter_number: 'MTR-001',
      address: { id: 1, street: 'Rue Test', number: '10', postcode: '1000', city: 'Bruxelles' },
      status: MeterDataStatus.ACTIVE,
      community: { name: 'Community Alpha' },
    },
    {
      EAN: '541449000000000002',
      meter_number: 'MTR-002',
      address: { id: 2, street: 'Avenue Libre', number: '5', postcode: '4000', city: 'Liege' },
      status: MeterDataStatus.INACTIVE,
      community: { name: 'Community Beta' },
    },
  ] as MePartialMeterDTO[];
}

function buildPaginatedMeterResponse(
  data: MePartialMeterDTO[] = buildMeters(),
  pagination: Pagination = new Pagination(1, 10, 2, 1),
): ApiResponsePaginated<MePartialMeterDTO[] | string> {
  return new ApiResponsePaginated(data, pagination);
}

// ── Test Suite ─────────────────────────────────────────────────────

describe('MetersComponent', () => {
  let component: MetersComponent;
  let fixture: ComponentFixture<MetersComponent>;

  let meServiceSpy: {
    getMeters: ReturnType<typeof vi.fn>;
  };
  let snackbarSpy: {
    openSnackBar: ReturnType<typeof vi.fn>;
  };
  let errorHandlerSpy: {
    handleError: ReturnType<typeof vi.fn>;
  };
  let routerSpy: {
    navigate: ReturnType<typeof vi.fn>;
  };

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(MetersComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    meServiceSpy = {
      getMeters: vi.fn().mockReturnValue(of(buildPaginatedMeterResponse())),
    };
    snackbarSpy = { openSnackBar: vi.fn() };
    errorHandlerSpy = { handleError: vi.fn() };
    routerSpy = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [MetersComponent, TranslateModule.forRoot()],
      providers: [
        { provide: MeService, useValue: meServiceSpy },
        { provide: SnackbarNotification, useValue: snackbarSpy },
        { provide: Router, useValue: routerSpy },
      ],
    })
      .overrideComponent(MetersComponent, {
        remove: {
          imports: [DebouncedPInputComponent],
          providers: [ErrorMessageHandler],
        },
        add: {
          imports: [DebouncedPInputStub],
          providers: [{ provide: ErrorMessageHandler, useValue: errorHandlerSpy }],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();
  });

  // ── 1. Creation & defaults ─────────────────────────────────────

  describe('creation', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should have default filter with page 1 and limit 10', () => {
      expect(component.filter().page).toBe(1);
      expect(component.filter().limit).toBe(10);
    });

    it('should have default search field set to community_name', () => {
      expect(component.searchField()).toBe('community_name');
    });

    it('should have default empty search text', () => {
      expect(component.searchText()).toBe('');
    });

    it('should have default null status filter', () => {
      expect(component.statusFilter()).toBeNull();
    });

    it('should set currentPageReportTemplate after construction', () => {
      expect(component.currentPageReportTemplate()).toBeTruthy();
    });
  });

  // ── 2. loadMeters ─────────────────────────────────────────────

  describe('loadMeters', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getMeters.mockClear();
    });

    it('should call meService.getMeters with current filter', () => {
      component.loadMeters();
      expect(meServiceSpy.getMeters).toHaveBeenCalledWith(component.filter());
    });

    it('should set metersPartialList from response data', () => {
      const meters = buildMeters();
      meServiceSpy.getMeters.mockReturnValue(of(buildPaginatedMeterResponse(meters)));
      component.loadMeters();
      expect(component.metersPartialList()).toEqual(meters);
    });

    it('should set paginationInfo from response', () => {
      const pagination = new Pagination(2, 10, 25, 3);
      meServiceSpy.getMeters.mockReturnValue(
        of(buildPaginatedMeterResponse(buildMeters(), pagination)),
      );
      component.loadMeters();
      expect(component.paginationInfo()).toEqual(pagination);
    });

    it('should call errorHandler when response is falsy', () => {
      meServiceSpy.getMeters.mockReturnValue(of(null));
      component.loadMeters();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(null);
    });

    it("shows the server's message when the meters cannot be loaded", () => {
      // HttpClient fails with an HttpErrorResponse; the backend's message is in its body.
      const message = 'Your meters could not be retrieved, please try again later';
      const error = new HttpErrorResponse({
        status: 503,
        error: { data: message, error_code: 51001 },
      });
      meServiceSpy.getMeters.mockReturnValue(throwError(() => error));
      component.loadMeters();
      expect(errorHandlerSpy.handleError).toHaveBeenCalledWith(message);
    });
  });

  // ── 3. applyFilters ───────────────────────────────────────────

  describe('applyFilters', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getMeters.mockClear();
    });

    it('should reset page to 1', () => {
      component.filter.set({ page: 3, limit: 10 });
      component.applyFilters();
      expect(component.filter().page).toBe(1);
    });

    it('should include community_name filter when searchField is community_name', () => {
      component.searchField.set('community_name');
      component.searchText.set('Alpha');
      component.applyFilters();
      expect(component.filter().community_name).toBe('Alpha');
    });

    it('should include EAN filter when searchField is EAN', () => {
      component.searchField.set('EAN');
      component.searchText.set('5414');
      component.applyFilters();
      expect(component.filter().EAN).toBe('5414');
    });

    it('should include meter_number filter when searchField is meter_number', () => {
      component.searchField.set('meter_number');
      component.searchText.set('MTR-001');
      component.applyFilters();
      expect(component.filter().meter_number).toBe('MTR-001');
    });

    it('should include status filter when statusFilter is set', () => {
      component.statusFilter.set(MeterDataStatus.ACTIVE);
      component.applyFilters();
      expect(component.filter().status).toBe(MeterDataStatus.ACTIVE);
    });

    it('should omit search fields when searchText is empty', () => {
      component.searchText.set('');
      component.applyFilters();
      expect(component.filter().community_name).toBeUndefined();
      expect(component.filter().EAN).toBeUndefined();
      expect(component.filter().meter_number).toBeUndefined();
    });

    it('should omit status when statusFilter is null', () => {
      component.statusFilter.set(null);
      component.applyFilters();
      expect(component.filter().status).toBeUndefined();
    });

    it('should call loadMeters', () => {
      component.applyFilters();
      expect(meServiceSpy.getMeters).toHaveBeenCalled();
    });
  });

  // ── 4. onSearchTextChange ─────────────────────────────────────

  describe('onSearchTextChange', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getMeters.mockClear();
    });

    it('should set searchText and trigger loadMeters', () => {
      component.onSearchTextChange('hello');
      expect(component.searchText()).toBe('hello');
      expect(meServiceSpy.getMeters).toHaveBeenCalled();
    });
  });

  // ── 5. onSearchFieldChange ────────────────────────────────────

  describe('onSearchFieldChange', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getMeters.mockClear();
    });

    it('should trigger loadMeters when searchText is non-empty', () => {
      component.searchText.set('test');
      component.onSearchFieldChange();
      expect(meServiceSpy.getMeters).toHaveBeenCalled();
    });

    it('should not trigger loadMeters when searchText is empty', () => {
      component.searchText.set('');
      component.onSearchFieldChange();
      expect(meServiceSpy.getMeters).not.toHaveBeenCalled();
    });
  });

  // ── 6. onStatusFilterChange ───────────────────────────────────

  describe('onStatusFilterChange', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getMeters.mockClear();
    });

    it('should set statusFilter and trigger loadMeters', () => {
      component.onStatusFilterChange(MeterDataStatus.WAITING_GRD);
      expect(component.statusFilter()).toBe(MeterDataStatus.WAITING_GRD);
      expect(meServiceSpy.getMeters).toHaveBeenCalled();
    });

    it('should accept null to clear the status filter', () => {
      component.onStatusFilterChange(null);
      expect(component.statusFilter()).toBeNull();
    });
  });

  // ── 7. lazyLoadMeters ─────────────────────────────────────────

  describe('lazyLoadMeters', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getMeters.mockClear();
    });

    it('should compute correct page from event and call loadMeters', () => {
      component.lazyLoadMeters({ first: 20, rows: 10 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(3);
      expect(meServiceSpy.getMeters).toHaveBeenCalled();
    });

    it('should default page to 1 when rows is 0', () => {
      component.lazyLoadMeters({ first: 0, rows: 0 } as TableLazyLoadEvent);
      expect(component.filter().page).toBe(1);
    });

    it('should keep existing filter fields when paging', () => {
      component.filter.set({
        page: 1,
        limit: 10,
        community_name: 'Alpha',
      } as MeMetersPartialQuery);
      component.lazyLoadMeters({ first: 10, rows: 10 } as TableLazyLoadEvent);
      expect(component.filter().community_name).toBe('Alpha');
      expect(component.filter().page).toBe(2);
    });
  });

  // ── 8. pageChange ─────────────────────────────────────────────

  describe('pageChange', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getMeters.mockClear();
    });

    it('should compute page from event and call loadMeters', () => {
      component.pageChange({ first: 10, rows: 10 });
      expect(component.filter().page).toBe(2);
      expect(meServiceSpy.getMeters).toHaveBeenCalled();
    });

    it('should set page to 1 when first is 0', () => {
      component.pageChange({ first: 0, rows: 10 });
      expect(component.filter().page).toBe(1);
    });
  });

  // ── 9. clear ──────────────────────────────────────────────────

  describe('clear', () => {
    beforeEach(async () => {
      await createComponent();
      meServiceSpy.getMeters.mockClear();
    });

    it('should reset all filters and call loadMeters', () => {
      // Set some filters first
      component.searchText.set('test');
      component.statusFilter.set(MeterDataStatus.ACTIVE);
      component.searchField.set('EAN');
      component.filter.set({ page: 3, limit: 10, EAN: 'test' });

      // The table is resolved through a view query now, and is absent in map
      // view — clear() must cope with that, which is why it optional-chains.
      component.clear();

      expect(component.searchText()).toBe('');
      expect(component.statusFilter()).toBeNull();
      expect(component.searchField()).toBe('community_name');
      expect(component.filter()).toEqual({ page: 1, limit: 10 });
      expect(meServiceSpy.getMeters).toHaveBeenCalled();
    });
  });

  // ── 10. onRowClick ────────────────────────────────────────────

  describe('onRowClick', () => {
    beforeEach(async () => {
      await createComponent();
    });

    it('should navigate to the read-only meter view', () => {
      const meter = buildMeters()[0];
      component.onRowClick(meter);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/users/me/meters', meter.EAN]);
    });
  });

  // ── 11. Computed signals ──────────────────────────────────────

  describe('computed signals', () => {
    beforeEach(async () => {
      await createComponent();
    });

    describe('hasActiveFilters', () => {
      it('should be true when searchText is set', () => {
        component.searchText.set('test');
        expect(component.hasActiveFilters()).toBe(true);
      });

      it('should be true when statusFilter is set', () => {
        component.statusFilter.set(MeterDataStatus.ACTIVE);
        expect(component.hasActiveFilters()).toBe(true);
      });

      it('should be false when no filters are active', () => {
        component.searchText.set('');
        component.statusFilter.set(null);
        expect(component.hasActiveFilters()).toBe(false);
      });
    });

    describe('firstRow', () => {
      it('should compute (page - 1) * limit', () => {
        component.paginationInfo.set(new Pagination(3, 10, 30, 3));
        expect(component.firstRow()).toBe(20);
      });

      it('should be 0 when page is 1', () => {
        component.paginationInfo.set(new Pagination(1, 10, 5, 1));
        expect(component.firstRow()).toBe(0);
      });
    });

    describe('showPaginator', () => {
      it('should be true when total_pages > 1', () => {
        component.paginationInfo.set(new Pagination(1, 10, 25, 3));
        expect(component.showPaginator()).toBe(true);
      });

      it('should be false when total_pages is 1', () => {
        component.paginationInfo.set(new Pagination(1, 10, 5, 1));
        expect(component.showPaginator()).toBe(false);
      });
    });
  });

  // ── Translated select labels ────────────────────────────────────

  // PrimeNG copies an option's label into the select's aria-label, so a key
  // there is what a screen reader announces.
  describe('search-field select labels', () => {
    let translate: TranslateService;

    function searchFieldAriaLabel(): string | null {
      return (
        (fixture.nativeElement as HTMLElement)
          .querySelector('[data-testid="meters__select--search-field"] [role="combobox"]')
          ?.getAttribute('aria-label') ?? null
      );
    }

    beforeEach(async () => {
      translate = TestBed.inject(TranslateService);
      translate.setTranslation('fr', {
        PROFILE: { METERS: { COMMUNITY_LABEL: 'Communauté' } },
        METER: { INFORMATIONS: { EAN_LABEL: 'EAN', METER_NUMBER_LABEL: 'Numéro de compteur' } },
      });
      translate.setTranslation('en', {
        PROFILE: { METERS: { COMMUNITY_LABEL: 'Community' } },
        METER: { INFORMATIONS: { EAN_LABEL: 'EAN code', METER_NUMBER_LABEL: 'Meter number' } },
      });
      translate.use('fr');
      await createComponent();
    });

    it('should label the options with their translation, keeping the values', () => {
      expect(component.searchFieldOptions()).toEqual([
        { label: 'Communauté', value: 'community_name' },
        { label: 'EAN', value: 'EAN' },
        { label: 'Numéro de compteur', value: 'meter_number' },
      ]);
    });

    it('should give the selected field a translated aria-label that follows the language', async () => {
      expect(searchFieldAriaLabel()).toBe('Communauté');

      translate.use('en');
      await fixture.whenStable();
      expect(searchFieldAriaLabel()).toBe('Community');
    });
  });

  // The status options used to be bare MeterDataStatus numbers, so the select's
  // aria-label read "1".."4" while the tags showed words.
  describe('status select labels', () => {
    let translate: TranslateService;

    function statusSelect(): HTMLElement {
      return (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="meters__select--status-filter"]',
      ) as HTMLElement;
    }

    beforeEach(async () => {
      translate = TestBed.inject(TranslateService);
      translate.setTranslation('fr', {
        METER: {
          STATUS: {
            ACTIVE_LABEL: 'Actif',
            INACTIVE_LABEL: 'Inactif',
            WAITING_GRD_LABEL: 'En attente du GRD',
            WAITING_MANAGER_LABEL: 'En attente du gestionnaire',
          },
        },
      });
      translate.setTranslation('en', {
        METER: {
          STATUS: {
            ACTIVE_LABEL: 'Active',
            INACTIVE_LABEL: 'Inactive',
            WAITING_GRD_LABEL: 'Waiting for the DSO',
            WAITING_MANAGER_LABEL: 'Waiting for the manager',
          },
        },
      });
      translate.use('fr');
      await createComponent();
    });

    it('should offer the statuses as translated options, keeping values and severities', () => {
      expect(component.statusCategory()).toEqual([
        { label: 'Actif', value: MeterDataStatus.ACTIVE, severity: 'success' },
        { label: 'Inactif', value: MeterDataStatus.INACTIVE, severity: 'danger' },
        { label: 'En attente du GRD', value: MeterDataStatus.WAITING_GRD, severity: 'danger' },
        {
          label: 'En attente du gestionnaire',
          value: MeterDataStatus.WAITING_MANAGER,
          severity: 'danger',
        },
      ]);
    });

    it('should name the selected status in words, in the aria-label and the tag', async () => {
      component.statusFilter.set(MeterDataStatus.WAITING_GRD);
      await fixture.whenStable();

      const combobox = statusSelect().querySelector('[role="combobox"]');
      expect(combobox?.getAttribute('aria-label')).toBe('En attente du GRD');
      expect(statusSelect().querySelector('.p-tag')?.textContent?.trim()).toBe('En attente du GRD');
    });

    it('should translate the selected status again when the language changes', async () => {
      component.statusFilter.set(MeterDataStatus.ACTIVE);
      await fixture.whenStable();

      translate.use('en');
      await fixture.whenStable();

      const combobox = statusSelect().querySelector('[role="combobox"]');
      expect(combobox?.getAttribute('aria-label')).toBe('Active');
      expect(statusSelect().querySelector('.p-tag')?.textContent?.trim()).toBe('Active');
    });
  });
});
