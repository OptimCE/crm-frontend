import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';

import { CommunityPendingInvitation } from './community-pending-invitation';
import { PendingMemberInvitation } from './pending-member-invitation/pending-member-invitation';
import { PendingManagerInvitation } from './pending-manager-invitation/pending-manager-invitation';
import { ErrorMessageHandler } from '../../../../shared/services-ui/error.message.handler';
import { Tabs, Tab, TabList, TabPanel, TabPanels } from 'primeng/tabs';

// ── Stubs ──────────────────────────────────────────────────────────

@Component({ selector: 'app-pending-member-invitation', standalone: true, template: '' })
class PendingMemberInvitationStub {}

@Component({ selector: 'app-pending-manager-invitation', standalone: true, template: '' })
class PendingManagerInvitationStub {}

// ── Test Suite ─────────────────────────────────────────────────────

describe('CommunityPendingInvitation', () => {
  let component: CommunityPendingInvitation;
  let fixture: ComponentFixture<CommunityPendingInvitation>;

  const errorHandlerSpy = { handleError: vi.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityPendingInvitation, TranslateModule.forRoot()],
      providers: [{ provide: ErrorMessageHandler, useValue: errorHandlerSpy }],
    })
      .overrideComponent(CommunityPendingInvitation, {
        remove: {
          imports: [
            PendingMemberInvitation,
            PendingManagerInvitation,
            Tabs,
            Tab,
            TabList,
            TabPanel,
            TabPanels,
          ],
        },
        add: {
          imports: [PendingMemberInvitationStub, PendingManagerInvitationStub],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CommunityPendingInvitation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
