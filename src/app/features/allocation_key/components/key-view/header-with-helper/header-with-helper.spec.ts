import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeaderWithHelper } from './header-with-helper';

describe('HeaderWithHelper', () => {
  let component: HeaderWithHelper;
  let fixture: ComponentFixture<HeaderWithHelper>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderWithHelper]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeaderWithHelper);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
