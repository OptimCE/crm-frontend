import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ButtonRenderer } from './button-renderer';

describe('ButtonRenderer', () => {
  let component: ButtonRenderer;
  let fixture: ComponentFixture<ButtonRenderer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonRenderer],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonRenderer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
