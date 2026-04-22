import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';

import { Invitations } from './invitations';
import { InvitationMember } from './invitation-tables/invitation-member/invitation-member';
import { InvitationGestionnaire } from './invitation-tables/invitation-gestionnaire/invitation-gestionnaire';
import { HeaderPage } from '../../../../layout/header-page/header-page';

describe('Invitations', () => {
  let component: Invitations;
  let fixture: ComponentFixture<Invitations>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Invitations, TranslateModule.forRoot()],
    })
      .overrideComponent(Invitations, {
        remove: {
          imports: [
            Tabs,
            TabList,
            Tab,
            TabPanels,
            TabPanel,
            InvitationMember,
            InvitationGestionnaire,
            HeaderPage,
          ],
        },
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(Invitations);
    component = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  // ── 1. Creation ─────────────────────────────────────────────────

  describe('creation', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });
  });

  // ── 2. Hero Header ─────────────────────────────────────────────

  describe('hero header', () => {
    it('should render the shared header-page hero', () => {
      const hero = el.querySelector('app-header-page[data-testid="invitations__hero"]');
      expect(hero).toBeTruthy();
    });

    it('should pass the envelope icon to the header', () => {
      const hero = el.querySelector('app-header-page[data-testid="invitations__hero"]');
      expect(hero?.getAttribute('icon')).toBe('pi pi-envelope');
    });

    it('should display the translated title', () => {
      const title = el.querySelector(
        'app-header-page[data-testid="invitations__hero"] [data-testid="header-page__title"]',
      );
      expect(title).toBeTruthy();
      expect(title?.textContent).toContain('INVITATION.TITLE');
    });

    it('should display the translated subtitle', () => {
      const subtitle = el.querySelector(
        'app-header-page[data-testid="invitations__hero"] [data-testid="header-page__subtitle"]',
      );
      expect(subtitle).toBeTruthy();
      expect(subtitle?.textContent).toContain('INVITATION.SUBTITLE');
    });
  });

  // ── 3. Tabs ─────────────────────────────────────────────────────

  describe('tabs', () => {
    it('should render the tabs component', () => {
      const tabs = el.querySelector('p-tabs');
      expect(tabs).toBeTruthy();
    });

    it('should render two tab items', () => {
      const tabItems = el.querySelectorAll('p-tab');
      expect(tabItems.length).toBe(2);
    });

    it('should display the member tab with users icon', () => {
      const firstTab = el.querySelector('p-tab');
      expect(firstTab).toBeTruthy();
      const icon = firstTab?.querySelector('.pi-users');
      expect(icon).toBeTruthy();
      expect(firstTab?.textContent).toContain('INVITATION.MEMBER.TITLE');
    });

    it('should display the manager tab with briefcase icon', () => {
      const tabs = el.querySelectorAll('p-tab');
      const secondTab = tabs[1];
      expect(secondTab).toBeTruthy();
      const icon = secondTab.querySelector('.pi-briefcase');
      expect(icon).toBeTruthy();
      expect(secondTab.textContent).toContain('INVITATION.MANAGER.TITLE');
    });
  });

  // ── 4. Tab Panels / Child Components ────────────────────────────

  describe('child components', () => {
    it('should render the invitation member component', () => {
      const member = el.querySelector('app-invitation-member');
      expect(member).toBeTruthy();
    });

    it('should render the invitation gestionnaire component', () => {
      const gestionnaire = el.querySelector('app-invitation-gestionnaire');
      expect(gestionnaire).toBeTruthy();
    });
  });
});
