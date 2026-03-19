import { Component, input } from '@angular/core';

@Component({
  selector: 'app-header-page',
  imports: [],
  templateUrl: './header-page.html',
  styleUrl: './header-page.css',
})
export class HeaderPage {
  readonly icon = input.required<string>();
  readonly text = input.required<string>();
}
