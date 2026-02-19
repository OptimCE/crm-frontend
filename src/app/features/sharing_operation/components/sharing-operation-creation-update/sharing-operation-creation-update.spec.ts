import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharingOperationCreationUpdate } from './sharing-operation-creation-update';

describe('SharingOperationCreationUpdate', () => {
  let component: SharingOperationCreationUpdate;
  let fixture: ComponentFixture<SharingOperationCreationUpdate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharingOperationCreationUpdate],
    }).compileComponents();

    fixture = TestBed.createComponent(SharingOperationCreationUpdate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
