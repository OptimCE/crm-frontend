import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { TranslateModule } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';

import { profileTabIndex, ProfileTabs } from './profile-tabs';
import { DataExportPanel } from '../../../../data_export/components/data-export-panel/data-export-panel';
import { MetersComponent } from './tabs/meters/meters.component';
import { BankingInfoComponent } from './tabs/banking-info/banking-info.component';
import { DocumentsComponent } from './tabs/documents/documents.component';
import { RepresentationsComponent } from './tabs/representations/representations.component';
import { NotificationPreferencesComponent } from './tabs/notification-preferences/notification-preferences.component';

// ── Stubs ──────────────────────────────────────────────────────────

@Component({ selector: 'app-meters-user', standalone: true, template: '' })
class MetersStub {}

@Component({ selector: 'app-banking-info-user', standalone: true, template: '' })
class BankingInfoStub {}

@Component({ selector: 'app-documents-user', standalone: true, template: '' })
class DocumentsStub {}

@Component({ selector: 'app-representations-user', standalone: true, template: '' })
class RepresentationsStub {}

// Stubbed like its siblings, and it matters more here: the real component
// calls the notification API from its constructor, so leaving it in would
// need an HttpClient this spec has no reason to provide.
@Component({ selector: 'app-notification-preferences-user', standalone: true, template: '' })
class NotificationPreferencesStub {}

// The export list reads the API and Keycloak: out of scope here.
@Component({ selector: 'app-data-export-panel', standalone: true, template: '' })
class DataExportPanelStub {}

// ── Tests ──────────────────────────────────────────────────────────

describe('ProfileTabs', () => {
  let component: ProfileTabs;
  let fixture: ComponentFixture<ProfileTabs>;
  let queryParamMap: BehaviorSubject<ParamMap>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    queryParamMap = new BehaviorSubject(convertToParamMap({}));
    navigate = vi.fn().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [ProfileTabs, TranslateModule.forRoot()],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParamMap } },
        { provide: Router, useValue: { navigate } },
      ],
    })
      .overrideComponent(ProfileTabs, {
        remove: {
          imports: [
            MetersComponent,
            BankingInfoComponent,
            DocumentsComponent,
            RepresentationsComponent,
            NotificationPreferencesComponent,
            DataExportPanel,
            Tabs,
            TabList,
            TabPanels,
            TabPanel,
            Tab,
          ],
        },
        add: {
          imports: [
            MetersStub,
            BankingInfoStub,
            DocumentsStub,
            RepresentationsStub,
            NotificationPreferencesStub,
            DataExportPanelStub,
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ProfileTabs);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have user input defaulting to undefined', () => {
    expect(component.user()).toBeUndefined();
  });

  it('should accept a user input value', () => {
    fixture.componentRef.setInput('user', { id: 1, email: 'test@test.com' });
    fixture.detectChanges();
    expect(component.user()).toEqual({ id: 1, email: 'test@test.com' });
  });

  it('opens the first tab by default, and the one ?tab= names', () => {
    expect(component.activeTab()).toBe(0);
    queryParamMap.next(convertToParamMap({ tab: 'exports' }));
    expect(component.activeTab()).toBe(5);
    queryParamMap.next(convertToParamMap({ tab: 'nonsense' }));
    expect(component.activeTab()).toBe(0);
  });

  it('maps every tab name to its index', () => {
    expect(profileTabIndex('meters')).toBe(0);
    expect(profileTabIndex('notifications')).toBe(4);
    expect(profileTabIndex('exports')).toBe(5);
    expect(profileTabIndex(null)).toBe(0);
  });

  it('puts the clicked tab in the URL, without a history entry', () => {
    component.onTabChange(5);
    expect(component.activeTab()).toBe(5);
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { tab: 'exports' }, replaceUrl: true }),
    );
    navigate.mockClear();
    component.onTabChange(5);
    component.onTabChange(undefined);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should accept null as user input', () => {
    fixture.componentRef.setInput('user', null);
    fixture.detectChanges();
    expect(component.user()).toBeNull();
  });
});
