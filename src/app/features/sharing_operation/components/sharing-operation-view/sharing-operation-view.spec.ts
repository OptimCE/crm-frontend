import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharingOperationView } from './sharing-operation-view';

describe('SharingOperationView', () => {
  let component: SharingOperationView;
  let fixture: ComponentFixture<SharingOperationView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharingOperationView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SharingOperationView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
