import { Injectable } from '@angular/core';

import { PercentBox, viewportRectToBox } from './signature-format';

/** One page as laid out: its size in PDF points, and where a rectangle of it falls. */
export interface PdfPageInfo {
  index: number;
  /** Width and height at scale 1 (PDF points, rotation applied). */
  width: number;
  height: number;
  /** A rectangle in PDF points (y up) to a box in percent of this page. */
  toBox(rect: readonly number[]): PercentBox;
}

export interface PdfDocumentHandle {
  pages: PdfPageInfo[];
  /** Draw a page into the canvas, sharp at `cssWidth` CSS pixels wide. */
  render(index: number, canvas: HTMLCanvasElement, cssWidth: number): Promise<void>;
  destroy(): void;
}

/** Beyond this many device pixels per PDF point, a page costs memory and shows nothing more. */
const MAX_RENDER_SCALE = 3;

/**
 * Where angular.json copies pdf.js's worker and its data. Relative to the base
 * href, so the app works under a sub-path too. The LEGACY build: the modern one
 * needs this year's browsers (`Map.prototype.getOrInsertComputed`,
 * `Math.sumPrecise`, `URL.parse`), and a member signs on whatever phone they have.
 */
const PDFJS_ASSETS = 'pdfjs/';

function assetUrl(path: string): string {
  return new URL(PDFJS_ASSETS + path, document.baseURI).href;
}

/**
 * pdf.js behind a seam: loaded on first use only (a lazy chunk of the signing
 * screen, never the main bundle), and replaced by a stub in the specs, where
 * jsdom has neither canvas nor workers.
 *
 * Every page is drawn on a canvas, annotations' appearances included (the
 * values docgen filled, the signatures already applied), without a text layer.
 */
@Injectable({ providedIn: 'root' })
export class PdfRenderer {
  async open(bytes: ArrayBuffer): Promise<PdfDocumentHandle> {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = assetUrl('pdf.worker.min.mjs');

    // A copy: pdf.js transfers its buffer to the worker, which detaches it.
    const task = pdfjs.getDocument({
      data: new Uint8Array(bytes.slice(0)),
      cMapUrl: assetUrl('cmaps/'),
      cMapPacked: true,
      standardFontDataUrl: assetUrl('standard_fonts/'),
      wasmUrl: assetUrl('wasm/'),
      iccUrl: assetUrl('iccs/'),
      enableXfa: false,
    });
    const doc = await task.promise;

    const pages: PdfPageInfo[] = [];
    for (let index = 0; index < doc.numPages; index++) {
      const page = await doc.getPage(index + 1);
      const viewport = page.getViewport({ scale: 1 });
      pages.push({
        index,
        width: viewport.width,
        height: viewport.height,
        toBox: (rect) => {
          const [x1, y1] = viewport.convertToViewportPoint(rect[0], rect[1]) as number[];
          const [x2, y2] = viewport.convertToViewportPoint(rect[2], rect[3]) as number[];
          return viewportRectToBox([x1, y1, x2, y2], viewport.width, viewport.height);
        },
      });
    }

    return {
      pages,
      render: async (index, canvas, cssWidth) => {
        const page = await doc.getPage(index + 1);
        const base = page.getViewport({ scale: 1 });
        const ratio = window.devicePixelRatio || 1;
        const scale = Math.min(MAX_RENDER_SCALE, Math.max(1, (cssWidth * ratio) / base.width));
        const viewport = page.getViewport({ scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({
          canvas,
          viewport,
          annotationMode: pdfjs.AnnotationMode.ENABLE,
        }).promise;
      },
      destroy: () => {
        void task.destroy();
      },
    };
  }
}
