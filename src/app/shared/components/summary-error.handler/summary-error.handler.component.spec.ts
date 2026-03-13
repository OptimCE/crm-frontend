import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, FormGroupDirective } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { FormErrorSummaryComponent } from './summary-error.handler.component';

describe('FormErrorSummaryComponent', () => {
  let component: FormErrorSummaryComponent;
  let fixture: ComponentFixture<FormErrorSummaryComponent>;

  beforeEach(async () => {
    const mockFormGroupDirective = new FormGroupDirective([], []);
    mockFormGroupDirective.form = new FormGroup({
      test: new FormControl(''),
    });

    await TestBed.configureTestingModule({
      imports: [FormErrorSummaryComponent, TranslateModule.forRoot()],
      providers: [{ provide: FormGroupDirective, useValue: mockFormGroupDirective }],
    }).compileComponents();

    fixture = TestBed.createComponent(FormErrorSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
