import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Presentational section wrapper: shows the section label when the drawer is open
 * and a divider when collapsed to the icon rail. Its items (projected) are always
 * visible in both states.
 */
@Component({
  selector: 'app-sidebar-section',
  imports: [TranslatePipe],
  templateUrl: './sidebar-section.html',
  styleUrl: './sidebar-section.css',
})
export class SidebarSection {
  /** i18n key for the section label, e.g. 'NAVBAR.PROFILE'. */
  readonly label = input.required<string>();
  /** Stable key used for test ids, e.g. 'profile'. */
  readonly key = input.required<string>();
  /** Whether the sidebar drawer is expanded (vs. the collapsed icon rail). */
  readonly sidebarOpen = input.required<boolean>();
}
