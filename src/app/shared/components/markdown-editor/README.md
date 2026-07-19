# MarkdownEditorComponent

WYSIWYG Markdown editor (Milkdown **Crepe**) exposed as a reactive-forms
control. Authors write a _rendered_ document with a fixed formatting toolbar and
never see Markdown syntax; the stored value stays **clean Markdown**.

```html
<app-markdown-editor formControlName="post" [placeholder]="'…' | translate" />
```

- **Value contract:** Markdown string in (`writeValue`), Markdown string out
  (`registerOnChange`). Drop-in replacement for a `<textarea>` — no backend
  change. The server keeps rendering stored Markdown → sanitized HTML for the
  read view.
- **`ControlValueAccessor`:** `writeValue` (re-creates the editor only when the
  incoming value differs — no-op otherwise to avoid cursor resets / loops),
  `setDisabledState` → `setReadonly`, `onTouched` on `focusout`.
- **Browser-only:** Crepe touches `window`/`document`, so it is built inside
  `afterNextRender` (never runs during SSR or in jsdom) via a dynamic
  `import('@milkdown/crepe')` that also keeps the heavy ProseMirror/CodeMirror
  bundle in a lazy chunk. NB: this app is currently a pure SPA (no SSR), so the
  guard is defensive / future-proofing.

## Feature set (v1)

Formatting is driven by Crepe's fixed **`TopBar`** toolbar (sticky to the top of
the editor — no floating menus that clip inside the compose dialog). It exposes a
**heading selector** (translated, limited to Text / H1–H3) that retypes the
_current_ block, plus bold / italic / inline code / lists / link / quote / hr.

- **`BlockEdit` (slash menu + gutter handle) is disabled** — its floating slash
  menu clipped inside the PrimeNG dialog and Crepe offers no body-portal for it.
  The TopBar replaces it; new blocks are added with Enter.
- Disabled: `ImageBlock`, `Table`, `Latex`, `CodeMirror`, `BlockEdit`
  (see `markdown-editor.ts`). TopBar auto-hides image/table/math buttons because
  those features are off.
- **Images are disabled for v1** — there is no asset-upload backend that returns
  a public image URL for the News Board. The read view still renders any image
  Markdown. _Follow-up:_ wire `Crepe.Feature.ImageBlock` to an upload endpoint.
- Menu / toolbar labels are translated via `MARKDOWN_EDITOR.*` (all 4 locales);
  `TranslateService` is injected into the component.

## Theming

Crepe's vendor CSS + the OptimCE token overrides live in
`markdown-editor.theme.css`, registered globally in `angular.json` `styles[]`
(component-scoped styles can't reach Crepe's imperatively-created DOM). Overrides
are scoped under `.crepe .milkdown`, so nothing leaks into the rest of the app.

## Round-trip / idempotency check

Because authoring now goes only through the editor, the invariant that matters is
**idempotency**: editor-produced Markdown, reopened and saved unchanged, is
byte-stable. To verify in the real compose dialog (`ng serve`, Node ≥ 22.12):

1. Create a post using the toolbar (heading, bold, list, link, quote) and save.
2. Reopen it for edit — it renders correctly (`prefill()` seeds the stored `post`).
3. Save without changes → the stored `post` Markdown is identical, modulo trivial
   stable normalizations (e.g. `_italic_` vs `*italic*`, list-marker unification)
   that do not change again on a second save.

`roundtrip.fixture.md` holds the representative constructs for a manual diff. Unit
coverage (`markdown-editor.spec.ts`) asserts the CVA contract without mounting the
editor (jsdom + ProseMirror is flaky); the round-trip itself is verified in a real
browser per the steps above.
