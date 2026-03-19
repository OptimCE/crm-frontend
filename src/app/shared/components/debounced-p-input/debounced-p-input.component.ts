import { Component, EventEmitter, Input, Output } from '@angular/core';
import { InputText } from 'primeng/inputtext';
import { debounceTime, Subject } from 'rxjs';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-debounced-p-input',
  imports: [InputText, FormsModule],
  templateUrl: './debounced-p-input.component.html',
  styleUrl: './debounced-p-input.component.css',
})
export class DebouncedPInputComponent {
  @Input() placeholder: string = '';
  @Input() value: string = '';
  @Input() inputClass: string = '';
  @Output() valueChange = new EventEmitter<string>();
  @Output() searchEvent = new EventEmitter<string>();
  private searchSubject = new Subject<string>();
  constructor() {
    this.searchSubject.pipe(debounceTime(300)).subscribe((query) => {
      this.search(query);
    });
  }

  onSearch(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchSubject.next(query);
  }
  search(query: string): void {
    this.searchEvent.emit(query);
  }
}
