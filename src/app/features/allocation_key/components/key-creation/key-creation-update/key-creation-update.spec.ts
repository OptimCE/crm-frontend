import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KeyCreationUpdate } from './key-creation-update';

describe('KeyCreationUpdate', () => {
  let component: KeyCreationUpdate;
  let fixture: ComponentFixture<KeyCreationUpdate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeyCreationUpdate],
    }).compileComponents();

    fixture = TestBed.createComponent(KeyCreationUpdate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
