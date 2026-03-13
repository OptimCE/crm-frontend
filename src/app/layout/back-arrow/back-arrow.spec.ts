import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BackArrow } from './back-arrow';

describe('BackArrow', () => {
  let component: BackArrow;
  let fixture: ComponentFixture<BackArrow>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackArrow],
    }).compileComponents();

    fixture = TestBed.createComponent(BackArrow);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
