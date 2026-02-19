import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KeysList } from './keys-list';

describe('KeysList', () => {
  let component: KeysList;
  let fixture: ComponentFixture<KeysList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeysList],
    }).compileComponents();

    fixture = TestBed.createComponent(KeysList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
