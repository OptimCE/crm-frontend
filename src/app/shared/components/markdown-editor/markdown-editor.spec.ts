import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';

import { MarkdownEditorComponent } from './markdown-editor';

/**
 * Keep the real editor out of jsdom (ProseMirror is flaky there): a no-op
 * fake stands in for Crepe if the browser-only init runs during a test.
 * The CVA contract is asserted on the component, not on a mounted editor.
 */
vi.mock('@milkdown/crepe', () => {
  class FakeCrepe {
    static Feature = {
      ImageBlock: 'image-block',
      Table: 'table',
      Latex: 'latex',
      CodeMirror: 'code-mirror',
      Placeholder: 'placeholder',
      BlockEdit: 'block-edit',
      LinkTooltip: 'link-tooltip',
      TopBar: 'top-bar',
    };
    on(): this {
      return this;
    }
    setReadonly(): this {
      return this;
    }
    getMarkdown(): string {
      return '';
    }
    create(): Promise<this> {
      return Promise.resolve(this);
    }
    destroy(): Promise<this> {
      return Promise.resolve(this);
    }
  }
  return { Crepe: FakeCrepe };
});

describe('MarkdownEditorComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownEditorComponent, TranslateModule.forRoot()],
    }).compileComponents();
  });

  it('creates', () => {
    const fixture = TestBed.createComponent(MarkdownEditorComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('registers itself as a ControlValueAccessor (NG_VALUE_ACCESSOR)', () => {
    const fixture = TestBed.createComponent(MarkdownEditorComponent);
    const accessors = fixture.debugElement.injector.get(NG_VALUE_ACCESSOR, null);
    expect(accessors).toBeTruthy();
    expect(accessors).toContain(fixture.componentInstance);
  });

  it('keeps CVA methods safe and inert before the editor mounts', () => {
    const fixture = TestBed.createComponent(MarkdownEditorComponent);
    const cmp = fixture.componentInstance;
    const onChange = vi.fn();
    const onTouched = vi.fn();

    cmp.registerOnChange(onChange);
    cmp.registerOnTouched(onTouched);

    expect(() => cmp.writeValue('# hello')).not.toThrow();
    expect(() => cmp.writeValue(null)).not.toThrow();
    expect(() => cmp.setDisabledState(true)).not.toThrow();

    // No editor mounted yet → no spurious value emission to the form.
    expect(onChange).not.toHaveBeenCalled();
    expect(onTouched).not.toHaveBeenCalled();
  });

  it('binds to a reactive FormControl without errors', () => {
    @Component({
      standalone: true,
      imports: [ReactiveFormsModule, MarkdownEditorComponent],
      template: `<app-markdown-editor [formControl]="control" />`,
    })
    class HostComponent {
      readonly control = new FormControl<string>('initial', { nonNullable: true });
    }

    const fixture = TestBed.createComponent(HostComponent);
    expect(() => fixture.detectChanges()).not.toThrow();
    // Markdown string contract preserved through writeValue.
    expect(fixture.componentInstance.control.value).toBe('initial');
  });
});
