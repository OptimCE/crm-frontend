import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormErrorSummaryComponent } from './summary-error.handler.component';

describe('FormErrorSummaryComponent', () => {
  let component: FormErrorSummaryComponent;
  let fixture: ComponentFixture<FormErrorSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormErrorSummaryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FormErrorSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
