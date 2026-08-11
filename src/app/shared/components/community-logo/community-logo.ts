import { Component, computed, input, linkedSignal } from '@angular/core';

/**
 * A community's logo, with the placeholder that stands in for it.
 *
 * Exists because a logo is served through a presigned URL that expires in about
 * fifteen minutes, while `CommunityService.cachedGet` happily hands out a cached
 * payload for longer than that. A URL that looks perfectly valid therefore 403s
 * on a regular basis, and every call site was painting the browser's broken-image
 * glyph. Both "no logo" and "logo would not load" resolve to the same placeholder
 * here, once, instead of four times.
 *
 * The component owns only that state machine. Size, shape and colour stay at the
 * call sites as complete class strings — three sizes and two shapes are in use,
 * and turning those into inputs would trade one small component for a design
 * system nobody asked for.
 *
 * `display: contents` on the host keeps the `<img>` a direct child of whatever
 * flex container it sits in, so `shrink-0` and friends still apply to it.
 */
@Component({
  selector: 'app-community-logo',
  standalone: true,
  templateUrl: './community-logo.html',
  styleUrl: './community-logo.css',
})
export class CommunityLogo {
  /**
   * A presigned URL, or a `data:` URL preview. Never `logo_url` — that column
   * holds a raw storage key and rendering it always gives a broken image.
   */
  readonly src = input<string | null | undefined>(null);
  readonly alt = input('');
  /** Complete class string for the `<img>`. */
  readonly imgClass = input('');
  /** Complete class string for the placeholder box. */
  readonly fallbackClass = input('');
  /**
   * Complete class string for the placeholder icon. Size and colour belong here
   * rather than on the box: `.pi` sets its own `font-size`, so a `text-4xl` on
   * the parent has no effect on the glyph.
   */
  readonly iconClass = input('pi pi-building');
  readonly testId = input<string | null>(null);

  /**
   * Reset on every new URL. A fresh presigned URL after an upload — or simply a
   * different community landing in the same `@for` slot — has to get its own
   * chance to load, otherwise one expired-URL 403 pins the placeholder for the
   * rest of the session.
   */
  private readonly failed = linkedSignal<string | null | undefined, boolean>({
    source: this.src,
    computation: () => false,
  });

  protected readonly showImage = computed(() => !!this.src() && !this.failed());

  protected readonly placeholderTestId = computed(() => {
    const id = this.testId();
    return id ? `${id}-placeholder` : null;
  });

  protected onError(): void {
    this.failed.set(true);
  }
}
