import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MetersComponent } from './meters.component';

describe('Meters', () => {
  let component: MetersComponent;
  let fixture: ComponentFixture<MetersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MetersComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MetersComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
