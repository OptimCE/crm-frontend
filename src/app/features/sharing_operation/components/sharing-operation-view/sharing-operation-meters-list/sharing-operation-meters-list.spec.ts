import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharingOperationMetersList } from './sharing-operation-meters-list';

describe('SharingOperationMetersList', () => {
  let component: SharingOperationMetersList;
  let fixture: ComponentFixture<SharingOperationMetersList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharingOperationMetersList],
    }).compileComponents();

    fixture = TestBed.createComponent(SharingOperationMetersList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
