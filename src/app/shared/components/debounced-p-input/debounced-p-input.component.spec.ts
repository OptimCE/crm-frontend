import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebouncedPInputComponent } from './debounced-p-input.component';

describe('DebouncedPInputComponent', () => {
  let component: DebouncedPInputComponent;
  let fixture: ComponentFixture<DebouncedPInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DebouncedPInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DebouncedPInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('search() should emit the provided query string directly', () => {
    const emitted: string[] = [];
    component.searchEvent.subscribe((v: string) => emitted.push(v));

    component.search('direct');
    expect(emitted).toEqual(['direct']);
  });

  it('search() should emit an empty string when called with empty input', () => {
    const emitted: string[] = [];
    component.searchEvent.subscribe((v: string) => emitted.push(v));

    component.search('');
    expect(emitted).toEqual(['']);
  });

  it('search() should emit each value when called multiple times', () => {
    const emitted: string[] = [];
    component.searchEvent.subscribe((v: string) => emitted.push(v));

    component.search('first');
    component.search('second');
    expect(emitted).toEqual(['first', 'second']);
  });
});
