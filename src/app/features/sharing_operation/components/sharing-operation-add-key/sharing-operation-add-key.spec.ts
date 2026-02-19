import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharingOperationAddKey } from './sharing-operation-add-key';

describe('SharingOperationAddKey', () => {
  let component: SharingOperationAddKey;
  let fixture: ComponentFixture<SharingOperationAddKey>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharingOperationAddKey],
    }).compileComponents();

    fixture = TestBed.createComponent(SharingOperationAddKey);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
