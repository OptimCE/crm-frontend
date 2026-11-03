import { Injectable } from '@angular/core';
import SignaturePad from 'signature_pad';

/** Dark blue ink, on a transparent background: what lands in the slot of the PDF. */
export const INK_COLOR = '#1e3a8a';
/** The typed signature's script font (@fontsource/dancing-script, loaded in angular.json). */
export const SCRIPT_FONT = 'Dancing Script';

/** Enough pixels for a crisp stamp, few enough to stay far below the annexe's 420 kB. */
const MAX_PAD_RATIO = 2;
const TYPED_HEIGHT = 160;
const TYPED_MAX_WIDTH = 900;
const TYPED_FONT_PX = 96;
const TYPED_PADDING = 16;
/** Room kept around the ink once a drawing is cut to it, in canvas pixels. */
const TRIM_PADDING = 12;

/** The drawing pad, as the signing screen uses it. */
export interface SignaturePadHandle {
  isEmpty(): boolean;
  clear(): void;
  /** The drawing, PNG, transparent background. */
  toDataURL(): string;
  /** Put a saved drawing back (the draft kept across the step-up login). */
  fromDataURL(dataUrl: string): Promise<void>;
  /** Called after each stroke. */
  onEnd(callback: () => void): void;
  /** Fit the canvas to its displayed size again, keeping the strokes. */
  resize(): void;
  destroy(): void;
}

/**
 * Canvas work behind a seam: the drawing pad (signature_pad) and the typed
 * name rendered in the script font. jsdom has no canvas, so the specs stub it.
 */
@Injectable({ providedIn: 'root' })
export class SignatureInk {
  createPad(canvas: HTMLCanvasElement): SignaturePadHandle {
    const pad = new SignaturePad(canvas, {
      penColor: INK_COLOR,
      backgroundColor: 'rgba(0,0,0,0)',
      minWidth: 0.8,
      maxWidth: 2.6,
    });
    const listeners: (() => void)[] = [];
    const ended = (): void => listeners.forEach((listener) => listener());
    pad.addEventListener('endStroke', ended);

    const fit = (): void => {
      const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_PAD_RATIO);
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      if (width === 0 || height === 0) return; // hidden: fitted when shown
      const strokes = pad.toData();
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      pad.clear();
      pad.fromData(strokes);
    };
    fit();

    return {
      isEmpty: () => pad.isEmpty(),
      clear: () => pad.clear(),
      toDataURL: () => pad.toDataURL('image/png'),
      fromDataURL: (dataUrl) =>
        pad.fromDataURL(dataUrl, {
          width: canvas.offsetWidth,
          height: canvas.offsetHeight,
        }),
      onEnd: (callback) => listeners.push(callback),
      resize: fit,
      destroy: () => {
        pad.removeEventListener('endStroke', ended);
        pad.off();
      },
    };
  }

  /**
   * The typed name as a PNG: the script font, dark blue ink, transparent
   * background, shrunk to fit when the name is long. Waits for the font, or
   * the first signature of a session would be drawn in a fallback face.
   */
  async typedPng(name: string): Promise<string> {
    const text = name.trim();
    try {
      await document.fonts?.load(`${TYPED_FONT_PX}px "${SCRIPT_FONT}"`, text);
    } catch {
      /* a fallback face is still a signature */
    }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');

    let size = TYPED_FONT_PX;
    context.font = `${size}px "${SCRIPT_FONT}", cursive`;
    let width = context.measureText(text).width;
    const room = TYPED_MAX_WIDTH - 2 * TYPED_PADDING;
    if (width > room) {
      size = Math.max(24, Math.floor((size * room) / width));
      context.font = `${size}px "${SCRIPT_FONT}", cursive`;
      width = context.measureText(text).width;
    }

    canvas.width = Math.ceil(Math.min(TYPED_MAX_WIDTH, width + 2 * TYPED_PADDING));
    canvas.height = TYPED_HEIGHT;
    // Resizing resets the context.
    context.font = `${size}px "${SCRIPT_FONT}", cursive`;
    context.fillStyle = INK_COLOR;
    context.textBaseline = 'middle';
    context.fillText(text, TYPED_PADDING, TYPED_HEIGHT / 2, canvas.width - 2 * TYPED_PADDING);
    return canvas.toDataURL('image/png');
  }

  /**
   * A drawing cut to its ink. The pad is as wide as the panel, and the stamp
   * fits the whole image into the slot, so an uncut drawing comes out small.
   * Only transparent margins go: the strokes are the ones the signer drew. The
   * draft keeps the uncut pad, which restores at its own size.
   */
  async trimPng(dataUrl: string): Promise<string> {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const { naturalWidth: width, naturalHeight: height } = image;
    const source = document.createElement('canvas');
    source.width = width;
    source.height = height;
    const context = source.getContext('2d');
    if (!context || width === 0 || height === 0) return dataUrl;
    context.drawImage(image, 0, 0);
    const alpha = context.getImageData(0, 0, width, height).data;

    let left = width;
    let right = -1;
    let top = height;
    let bottom = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (alpha[(y * width + x) * 4 + 3] === 0) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    if (right < 0) return dataUrl; // no ink: the caller refuses an empty pad anyway

    const x = Math.max(0, left - TRIM_PADDING);
    const y = Math.max(0, top - TRIM_PADDING);
    const cropWidth = Math.min(width, right + 1 + TRIM_PADDING) - x;
    const cropHeight = Math.min(height, bottom + 1 + TRIM_PADDING) - y;
    const cropped = document.createElement('canvas');
    cropped.width = cropWidth;
    cropped.height = cropHeight;
    cropped
      .getContext('2d')
      ?.drawImage(source, x, y, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return cropped.toDataURL('image/png');
  }
}
