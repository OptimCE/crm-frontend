import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  forwardRef,
  inject,
  input,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import type { Crepe } from '@milkdown/crepe';

/**
 * WYSIWYG Markdown editor (Milkdown Crepe) exposed as a reactive-forms
 * control. The model value is and stays clean Markdown — `writeValue`
 * seeds the editor, the `markdownUpdated` listener emits Markdown back.
 *
 * Crepe touches `window`/`document`, so it is constructed browser-only
 * via `afterNextRender` (which never runs during SSR or in jsdom) plus
 * a dynamic `import()` that keeps the heavy ProseMirror/CodeMirror/remark
 * bundle out of eager evaluation.
 */
@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  templateUrl: './markdown-editor.html',
  styleUrl: './markdown-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MarkdownEditorComponent),
      multi: true,
    },
  ],
})
export class MarkdownEditorComponent implements ControlValueAccessor {
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly platformId = inject(PLATFORM_ID);
  private readonly translate = inject(TranslateService);

  /** Placeholder shown while the document is empty. */
  readonly placeholder = input<string>('');

  private crepe: Crepe | null = null;
  /** The element Crepe was mounted on; kept for safe listener teardown. */
  private hostEl: HTMLElement | null = null;
  /** True once a Crepe instance exists and can be read/written. */
  private ready = false;
  /** Latest Markdown known to the model; seeds editor (re)creation. */
  private latestValue = '';
  private isDisabled = false;
  /** Serializes overlapping create/destroy cycles. */
  private lifecycle: Promise<void> = Promise.resolve();

  private onChange: (value: string) => void = () => {
    /* noop until registerOnChange */
  };
  private onTouched: () => void = () => {
    /* noop until registerOnTouched */
  };

  constructor() {
    const destroyRef = inject(DestroyRef);
    // afterNextRender runs browser-only, after the host <div> exists.
    afterNextRender(() => this.schedule(() => this.create(this.latestValue)));
    destroyRef.onDestroy(() => this.schedule(() => this.destroy()));
  }

  // ---- ControlValueAccessor -------------------------------------------

  writeValue(value: string | null): void {
    const md = value ?? '';
    this.latestValue = md;
    if (!this.ready) return; // afterNextRender will seed from latestValue
    if (this.sameValue(md, this.currentMarkdown())) return; // no-op: avoid cursor reset / loops
    this.schedule(() => this.recreate(md));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    this.crepe?.setReadonly(isDisabled);
  }

  // ---- editor lifecycle -----------------------------------------------

  private schedule(step: () => Promise<void>): void {
    this.lifecycle = this.lifecycle.then(step).catch(() => undefined);
  }

  private async create(md: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || this.crepe) return;

    const { Crepe } = await import('@milkdown/crepe');
    const el = this.host().nativeElement;
    const tMenu = (key: string): string =>
      this.translate.instant(`MARKDOWN_EDITOR.MENU.${key}`) as string;
    const tLink = (key: string): string =>
      this.translate.instant(`MARKDOWN_EDITOR.LINK.${key}`) as string;
    const crepe = new Crepe({
      root: el,
      defaultValue: md,
      // Keep the surface minimal for non-technical authors.
      features: {
        [Crepe.Feature.ImageBlock]: false, // images disabled for v1 (no upload backend)
        [Crepe.Feature.Table]: false,
        [Crepe.Feature.Latex]: false,
        [Crepe.Feature.CodeMirror]: false, // inline code stays; drop fenced code blocks
        // Replace the floating slash menu + gutter handle (which clipped inside
        // the dialog) with a fixed, always-visible TopBar toolbar. Its heading
        // selector also lets authors retype the *current* block.
        [Crepe.Feature.BlockEdit]: false,
        [Crepe.Feature.TopBar]: true,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: this.placeholder(), mode: 'block' },
        // Fixed toolbar. The heading selector is translated and limited to
        // Text + H1-H3 and reflects / sets the current block's type; Crepe's
        // image/table/math buttons auto-hide because those features are off.
        [Crepe.Feature.TopBar]: {
          headingOptions: [
            { label: tMenu('TEXT'), level: null },
            { label: tMenu('H1'), level: 1 },
            { label: tMenu('H2'), level: 2 },
            { label: tMenu('H3'), level: 3 },
          ],
        },
        [Crepe.Feature.LinkTooltip]: {
          editButton: tLink('EDIT'),
          removeButton: tLink('REMOVE'),
          confirmButton: tLink('CONFIRM'),
          inputPlaceholder: tLink('PLACEHOLDER'),
        },
      },
    });

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        const normalized = markdown.trim() === '' ? '' : markdown;
        // Skip the initial seed emit and any no-op change: only propagate
        // genuine edits so we never spuriously dirty a pristine control.
        if (normalized === this.latestValue) return;
        this.latestValue = normalized;
        this.onChange(normalized);
      });
    });

    await crepe.create();
    crepe.setReadonly(this.isDisabled);

    el.addEventListener('focusout', this.handleFocusOut);
    this.hostEl = el;
    this.crepe = crepe;
    this.ready = true;
  }

  private async destroy(): Promise<void> {
    this.ready = false;
    const crepe = this.crepe;
    this.crepe = null;
    this.hostEl?.removeEventListener('focusout', this.handleFocusOut);
    this.hostEl = null;
    if (crepe) await crepe.destroy();
  }

  private async recreate(md: string): Promise<void> {
    await this.destroy();
    await this.create(md);
  }

  private currentMarkdown(): string {
    try {
      return this.crepe?.getMarkdown() ?? this.latestValue;
    } catch {
      return this.latestValue;
    }
  }

  /** Treats any two all-whitespace values as equal (both "empty"). */
  private sameValue(a: string, b: string): boolean {
    return a === b || (a.trim() === '' && b.trim() === '');
  }

  private readonly handleFocusOut = (): void => this.onTouched();
}
