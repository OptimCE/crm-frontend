import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KeyCreationStepByStep } from './key-creation-step-by-step';

describe('KeyCreationStepByStep', () => {
  let component: KeyCreationStepByStep;
  let fixture: ComponentFixture<KeyCreationStepByStep>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeyCreationStepByStep],
    }).compileComponents();

    fixture = TestBed.createComponent(KeyCreationStepByStep);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
