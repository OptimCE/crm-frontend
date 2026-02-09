import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SummaryErrorHandlerComponent } from './summary-error.handler.component';

describe('SummaryErrorHandlerComponent', () => {
  let component: SummaryErrorHandlerComponent;
  let fixture: ComponentFixture<SummaryErrorHandlerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SummaryErrorHandlerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SummaryErrorHandlerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
