import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KeyView } from './key-view';

describe('KeyView', () => {
  let component: KeyView;
  let fixture: ComponentFixture<KeyView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeyView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KeyView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
