import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharingOperationsList } from './sharing-operations-list';

describe('SharingOperationsList', () => {
  let component: SharingOperationsList;
  let fixture: ComponentFixture<SharingOperationsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharingOperationsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SharingOperationsList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
