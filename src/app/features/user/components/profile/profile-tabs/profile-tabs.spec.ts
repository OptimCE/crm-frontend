import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';

import { ProfileTabs } from './profile-tabs';
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

// ── Tests ──────────────────────────────────────────────────────────

describe('ProfileTabs', () => {
  let component: ProfileTabs;
  let fixture: ComponentFixture<ProfileTabs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileTabs, TranslateModule.forRoot()],
    })
      .overrideComponent(ProfileTabs, {
        remove: {
          imports: [
            MetersComponent,
            BankingInfoComponent,
            DocumentsComponent,
            RepresentationsComponent,
            NotificationPreferencesComponent,
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

  it('should accept null as user input', () => {
    fixture.componentRef.setInput('user', null);
    fixture.detectChanges();
    expect(component.user()).toBeNull();
  });
});
