/**
 * Global test setup. Registered through the `setupFiles` option of the
 * `@angular/build:unit-test` builder in `angular.json`, and run after the
 * polyfills and the TestBed initialisation, before every spec file.
 *
 * Keep this to browser APIs jsdom is missing. Anything spec-specific belongs
 * in the spec.
 */

/**
 * jsdom does not implement `ResizeObserver`, but several PrimeNG components
 * construct one unconditionally — `p-tablist` does it in `ngAfterViewInit`.
 * Without this stub, any spec that renders a real `p-tabs` dies with
 * `ReferenceError: ResizeObserver is not defined`, which pushes specs into
 * stripping the tabs out of the component under test and no longer covering
 * their own template.
 *
 * The callback is deliberately never invoked: nothing is laid out in jsdom, so
 * there is no resize to report and the observed element keeps its zero size.
 */
class ResizeObserverStub implements ResizeObserver {
  observe(): void {
    // no-op: jsdom never lays out, so no entry could ever be reported
  }

  unobserve(): void {
    // no-op: nothing was ever observed
  }

  disconnect(): void {
    // no-op: nothing was ever observed
  }
}

// `??=` so a real implementation wins — jsdom may grow one, and the builder's
// `browsers` option runs these same specs in a browser that already has it.
globalThis.ResizeObserver ??= ResizeObserverStub;
