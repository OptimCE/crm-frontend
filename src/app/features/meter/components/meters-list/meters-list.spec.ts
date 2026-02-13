import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MetersList } from './meters-list';

describe('MetersList', () => {
  let component: MetersList;
  let fixture: ComponentFixture<MetersList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MetersList],
    }).compileComponents();

    fixture = TestBed.createComponent(MetersList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
