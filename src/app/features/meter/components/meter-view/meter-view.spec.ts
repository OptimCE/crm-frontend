import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeterView } from './meter-view';

describe('MeterView', () => {
  let component: MeterView;
  let fixture: ComponentFixture<MeterView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeterView],
    }).compileComponents();

    fixture = TestBed.createComponent(MeterView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
