import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeterCreation } from './meter-creation';

describe('MeterCreation', () => {
  let component: MeterCreation;
  let fixture: ComponentFixture<MeterCreation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeterCreation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MeterCreation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
