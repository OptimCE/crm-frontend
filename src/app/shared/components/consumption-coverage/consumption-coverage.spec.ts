import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ConsumptionCoverage } from './consumption-coverage';
import { ApiResponse } from '../../../core/dtos/api.response';
import { SharingOpConsumptionCoverageDTO } from '../../dtos/sharing_operation.dtos';
import { SharingOperationService } from '../../services/sharing_operation.service';

describe('ConsumptionCoverage', () => {
  let fixture: ComponentFixture<ConsumptionCoverage>;
  let component: ConsumptionCoverage;
  let serviceSpy: { getSharingOperationConsumptionCoverage: ReturnType<typeof vi.fn> };

  async function createWith(coverage: SharingOpConsumptionCoverageDTO[], operationId = 1) {
    serviceSpy.getSharingOperationConsumptionCoverage.mockReturnValue(
      of(new ApiResponse<SharingOpConsumptionCoverageDTO[]>(coverage)),
    );
    fixture = TestBed.createComponent(ConsumptionCoverage);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('operationId', operationId);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    serviceSpy = { getSharingOperationConsumptionCoverage: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ConsumptionCoverage, TranslateModule.forRoot()],
      providers: [{ provide: SharingOperationService, useValue: serviceSpy }],
    }).compileComponents();
  });

  it('classifies months as complete / partial / none within a year', async () => {
    // May 2025 has 31 days → 2976 expected slots (full); June has some data (partial).
    await createWith([
      { month: '2025-05', count: 2976 },
      { month: '2025-06', count: 100 },
    ]);

    expect(component.hasData()).toBe(true);
    const rows = component.rows();
    expect(rows.length).toBe(1);
    expect(rows[0].year).toBe(2025);
    expect(rows[0].months[4].state).toBe('complete'); // May
    expect(rows[0].months[5].state).toBe('partial'); // June
    expect(rows[0].months[0].state).toBe('none'); // January
  });

  it('spans every year between the first and last with data', async () => {
    await createWith([
      { month: '2024-11', count: 2880 },
      { month: '2026-02', count: 500 },
    ]);
    const years = component.rows().map((r) => r.year);
    expect(years).toEqual([2024, 2025, 2026]);
  });

  it('shows the empty state when there is no data', async () => {
    await createWith([]);
    expect(component.hasData()).toBe(false);
    expect(component.rows()).toEqual([]);
  });

  it('refetches when reloadKey changes', async () => {
    await createWith([{ month: '2025-01', count: 10 }]);
    expect(serviceSpy.getSharingOperationConsumptionCoverage).toHaveBeenCalledTimes(1);

    serviceSpy.getSharingOperationConsumptionCoverage.mockReturnValue(
      of(new ApiResponse<SharingOpConsumptionCoverageDTO[]>([{ month: '2025-02', count: 2688 }])),
    );
    fixture.componentRef.setInput('reloadKey', 1);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(serviceSpy.getSharingOperationConsumptionCoverage).toHaveBeenCalledTimes(2);
    expect(component.rows()[0].months[1].state).toBe('complete'); // Feb 2025, 2688 = 28*96
  });
});
