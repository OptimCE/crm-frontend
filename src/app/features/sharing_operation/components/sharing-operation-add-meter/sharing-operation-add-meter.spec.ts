import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharingOperationAddMeter } from './sharing-operation-add-meter';

describe('SharingOperationAddMeter', () => {
  let component: SharingOperationAddMeter;
  let fixture: ComponentFixture<SharingOperationAddMeter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharingOperationAddMeter],
    }).compileComponents();

    fixture = TestBed.createComponent(SharingOperationAddMeter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
