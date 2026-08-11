import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { Role } from '../../../../core/dtos/role';
import { UserContextService } from '../../../../core/services/authorization/authorization.service';
import { DeadlineDashboard } from '../deadline-dashboard/deadline-dashboard';
import { DossierList } from '../dossier-list/dossier-list';
import { MyFilings } from '../my-filings/my-filings';
import { AdministrativeDocumentHub } from './administrative-document-hub';

/**
 * Render smoke test for the page shell, plus the role branch.
 *
 * The children are stubbed so no HTTP is pulled in; `detectChanges()` still
 * compiles the hub's own template, which is what catches a bad binding or a
 * missing import.
 */
@Component({ selector: 'app-dossier-list', standalone: true, template: '' })
class StubDossierList {}

@Component({ selector: 'app-deadline-dashboard', standalone: true, template: '' })
class StubDeadlineDashboard {}

@Component({ selector: 'app-my-filings', standalone: true, template: 'stub-my-filings' })
class StubMyFilings {}

describe('AdministrativeDocumentHub', () => {
  /** Whether the viewer clears MANAGER in the active community. */
  const isManager = signal<boolean>(true);

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdministrativeDocumentHub, TranslateModule.forRoot()],
      providers: [
        {
          provide: UserContextService,
          useValue: {
            compareWithActiveRole: (role: Role) =>
              role === Role.GESTIONNAIRE ? isManager() : true,
            activeCommunityId: signal<string | null>('org-a'),
          },
        },
      ],
    }).compileComponents();

    // remove/add rather than `set`: the hub's template also needs its tabs,
    // header and translate pipe, which `set` would drop.
    TestBed.overrideComponent(AdministrativeDocumentHub, {
      remove: { imports: [DossierList, DeadlineDashboard, MyFilings] },
      add: { imports: [StubDossierList, StubDeadlineDashboard, StubMyFilings] },
    });
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the manager console for a manager', async () => {
    isManager.set(true);
    await setup();

    const fixture = TestBed.createComponent(AdministrativeDocumentHub);
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('administrative-document-hub__tab--dossiers');
    expect(html).not.toContain('stub-my-filings');
  });

  it('renders the member filings view instead of the console for a member', async () => {
    isManager.set(false);
    await setup();

    const fixture = TestBed.createComponent(AdministrativeDocumentHub);
    fixture.detectChanges();

    // Instead of, not alongside: the console's children each read a
    // manager-gated endpoint that now answers 403, so instantiating them for a
    // member would fill the page with failed tiles.
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('stub-my-filings');
    expect(html).not.toContain('administrative-document-hub__tab--dossiers');
  });
});
