import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-back-arrow',
  imports: [RouterLink],
  templateUrl: './back-arrow.html',
  styleUrl: './back-arrow.css',
})
export class BackArrow {
  readonly url = input.required<string>();
  readonly text = input.required<string>();
}
