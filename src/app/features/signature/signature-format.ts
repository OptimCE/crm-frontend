/**
 * Pure helpers for the signature screens: what a signer is told (capacity,
 * statuses, the timeline in plain words), where a slot sits on a page, what
 * signing needs and the draft kept across the step-up login. No TestBed needed.
 */
import {
  MySignatureRow,
  SignMethod,
  SignatureEvent,
  SignatureFieldView,
  SignerCapacity,
} from '../../shared/dtos/signature.dtos';

export type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

/** A translation key and its parameters, for the template's translate pipe. */
export interface I18nText {
  key: string;
  params?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Capacity and statuses
// ---------------------------------------------------------------------------

/** « En votre nom », « Pour ACME SRL (représentant légal) », « Pour la communauté (administrateur) ». */
export function capacityText(signer: {
  capacity: SignerCapacity;
  member_label: string | null;
  display_name: string;
}): I18nText {
  switch (signer.capacity) {
    case 'LEGAL_REPRESENTATIVE':
      return {
        key: 'SIGNATURE.CAPACITY.LEGAL_REPRESENTATIVE',
        params: { member: signer.member_label || signer.display_name },
      };
    case 'COMMUNITY_ADMIN':
      return { key: 'SIGNATURE.CAPACITY.COMMUNITY_ADMIN' };
    default:
      return { key: 'SIGNATURE.CAPACITY.SELF' };
  }
}

export function requestStatusKey(status: string): string {
  return `SIGNATURE.REQUEST_STATUS.${status}`;
}

export function requestStatusSeverity(status: string): TagSeverity {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'OPEN':
    case 'COMPLETING':
      return 'info';
    case 'PREPARING':
      return 'secondary';
    case 'EXPIRED':
    case 'CANCELLED':
      return 'warn';
    default:
      return 'danger';
  }
}

export function signerStatusKey(status: string): string {
  return `SIGNATURE.SIGNER_STATUS.${status}`;
}

export function signerStatusSeverity(status: string): TagSeverity {
  switch (status) {
    case 'SIGNED':
      return 'success';
    case 'DECLINED':
      return 'danger';
    case 'SIGNING':
    case 'INVITED':
    case 'VIEWED':
      return 'info';
    default:
      return 'secondary';
  }
}

/** The slot can be signed now: the request is open and it is this slot's turn. */
export function isYourTurn(requestStatus: string, signerStatus: string): boolean {
  return requestStatus === 'OPEN' && (signerStatus === 'INVITED' || signerStatus === 'VIEWED');
}

/** Who asked for it: the requesting domain, in words when we know it. */
export function sourceText(source: string): I18nText {
  if (source === 'administrative_document' || source === 'administrative-document') {
    return { key: 'SIGNATURE.SOURCE.ADMINISTRATIVE_DOCUMENT' };
  }
  return { key: 'SIGNATURE.SOURCE.OTHER', params: { source } };
}

// ---------------------------------------------------------------------------
// The inbox
// ---------------------------------------------------------------------------

/** Pending rows, the ones the user can sign now first; the API's order otherwise (newest first). */
export function pendingRows(rows: readonly MySignatureRow[]): MySignatureRow[] {
  const pending = rows.filter((row) => row.pending);
  return [...pending.filter((row) => row.your_turn), ...pending.filter((row) => !row.your_turn)];
}

export function pastRows(rows: readonly MySignatureRow[]): MySignatureRow[] {
  return rows.filter((row) => !row.pending);
}

/** The badge: the slots the user can sign now. */
export function pendingCount(rows: readonly MySignatureRow[]): number {
  return rows.filter((row) => row.your_turn).length;
}

/** What the navigation shows: a count, capped at 99+, nothing at zero. */
export function countBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

// ---------------------------------------------------------------------------
// Placement on the page
// ---------------------------------------------------------------------------

/** A box in percent of its page, so it follows the page at any rendered size. */
export interface PercentBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * A rectangle already in viewport units (y down, as pdf.js's
 * `convertToViewportRectangle` returns it, corners in any order) to a box in
 * percent of a page of that viewport's size.
 */
export function viewportRectToBox(
  rect: readonly number[],
  pageWidth: number,
  pageHeight: number,
): PercentBox {
  const [x1, y1, x2, y2] = rect;
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  return {
    left: (left / pageWidth) * 100,
    top: (top / pageHeight) * 100,
    width: (Math.abs(x2 - x1) / pageWidth) * 100,
    height: (Math.abs(y2 - y1) / pageHeight) * 100,
  };
}

/**
 * A rectangle in PDF points (origin bottom-left, y up) on an unrotated page
 * whose media box starts at the origin, to a box in percent of the page. The
 * renderer uses the page's own viewport when it has one (rotation, offset
 * media box); this is the plain case and the specs' reference.
 */
export function pdfRectToBox(
  rect: readonly number[],
  pageWidth: number,
  pageHeight: number,
): PercentBox {
  const [x1, y1, x2, y2] = rect;
  return viewportRectToBox([x1, pageHeight - y1, x2, pageHeight - y2], pageWidth, pageHeight);
}

export function boxStyle(box: PercentBox): Record<string, string> {
  return {
    left: `${box.left}%`,
    top: `${box.top}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
  };
}

// ---------------------------------------------------------------------------
// What signing needs
// ---------------------------------------------------------------------------

/** A field the signer fills; DATE is written by the server at signing. */
export function isFillable(field: SignatureFieldView): boolean {
  return field.type !== 'DATE';
}

export type FieldValues = Record<string, string | boolean>;

/** The fields' starting values: what the request carries, else empty. */
export function initialFieldValues(fields: readonly SignatureFieldView[]): FieldValues {
  const values: FieldValues = {};
  for (const field of fields) {
    if (!isFillable(field)) continue;
    values[field.name] = field.type === 'CHECKBOX' ? field.value === 'true' : (field.value ?? '');
  }
  return values;
}

/** Every required field is filled: text not blank, a checkbox ticked. */
export function requiredFieldsFilled(
  fields: readonly SignatureFieldView[],
  values: FieldValues,
): boolean {
  return fields
    .filter((field) => field.required && isFillable(field))
    .every((field) => {
      const value = values[field.name];
      return field.type === 'CHECKBOX' ? value === true : String(value ?? '').trim().length > 0;
    });
}

/** The `fields` of the sign call: checkboxes as 'true'/'false', no DATE, no blank text. */
export function fieldsPayload(
  fields: readonly SignatureFieldView[],
  values: FieldValues,
): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const field of fields) {
    if (!isFillable(field)) continue;
    const value = values[field.name];
    if (field.type === 'CHECKBOX') {
      payload[field.name] = value === true ? 'true' : 'false';
    } else {
      const text = String(value ?? '').trim();
      if (text) payload[field.name] = text;
    }
  }
  return payload;
}

// ---------------------------------------------------------------------------
// The draft kept across the step-up login
// ---------------------------------------------------------------------------

/** What the signer had prepared when the annexe asked for a fresh login. */
export interface SignatureDraft {
  method: SignMethod;
  typedName: string;
  /** The signature as a PNG data URL (typed or drawn), when there was one. */
  imagePng: string | null;
  fields: FieldValues;
  consent: boolean;
}

export function draftKey(signerId: string): string {
  return `signature-draft:${signerId}`;
}

/** Session storage only: the draft must not outlive the tab. Storage failures are not fatal. */
export function saveDraft(signerId: string, draft: SignatureDraft): void {
  try {
    sessionStorage.setItem(draftKey(signerId), JSON.stringify(draft));
  } catch {
    /* a full or blocked storage only costs the user a second signature */
  }
}

export function loadDraft(signerId: string): SignatureDraft | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(draftKey(signerId));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SignatureDraft> | null;
    if (!parsed || (parsed.method !== 'TYPED' && parsed.method !== 'DRAWN')) return null;
    const image =
      typeof parsed.imagePng === 'string' && parsed.imagePng.startsWith('data:image/png;base64,')
        ? parsed.imagePng
        : null;
    const fields: FieldValues = {};
    for (const [name, value] of Object.entries(parsed.fields ?? {})) {
      if (typeof value === 'string' || typeof value === 'boolean') fields[name] = value;
    }
    return {
      method: parsed.method,
      typedName: typeof parsed.typedName === 'string' ? parsed.typedName : '',
      imagePng: image,
      fields,
      consent: parsed.consent === true,
    };
  } catch {
    return null;
  }
}

export function clearDraft(signerId: string): void {
  try {
    sessionStorage.removeItem(draftKey(signerId));
  } catch {
    /* nothing to clear */
  }
}

// ---------------------------------------------------------------------------
// The timeline in plain words
// ---------------------------------------------------------------------------

const KNOWN_EVENTS = new Set([
  'request.created',
  'document.prepared',
  'signer.invited',
  'signer.viewed',
  'signer.reauthenticated',
  'signer.signed',
  'signer.declined',
  'request.reminded',
  'request.completed',
  'request.cancelled',
  'request.expired',
  'request.failed',
]);

/** « Alice Dupont a signé », « La demande a été annulée »… An unknown type keeps its code. */
export function eventText(event: SignatureEvent): I18nText {
  const signer = event.signer?.display_name ?? '';
  if (!KNOWN_EVENTS.has(event.type)) {
    return { key: 'SIGNATURE.EVENTS.UNKNOWN', params: { type: event.type } };
  }
  const key = `SIGNATURE.EVENTS.${event.type.replace('.', '_').toUpperCase()}`;
  const reason = typeof event.payload['reason'] === 'string' ? event.payload['reason'] : '';
  return { key, params: { signer, reason } };
}

export function eventIcon(type: string): string {
  switch (type) {
    case 'signer.signed':
    case 'request.completed':
      return 'pi pi-check-circle';
    case 'signer.declined':
    case 'request.cancelled':
    case 'request.failed':
      return 'pi pi-times-circle';
    case 'request.expired':
      return 'pi pi-clock';
    case 'signer.viewed':
      return 'pi pi-eye';
    case 'signer.reauthenticated':
      return 'pi pi-lock';
    case 'signer.invited':
    case 'request.reminded':
      return 'pi pi-envelope';
    default:
      return 'pi pi-circle';
  }
}
