import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeaderPage } from './header-page';

describe('HeaderPage', () => {
  let component: HeaderPage;
  let fixture: ComponentFixture<HeaderPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderPage],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
