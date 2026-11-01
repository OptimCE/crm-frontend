/**
 * Pure presentation helpers for the procedures screens.
 *
 * Two vocabularies meet here. The engine's own (common statuses, buckets, next
 * action codes, piece statuses, deadline parties) is generic, so the client
 * translates it from its bundles. The regulator's (steps, response types,
 * deadline and piece codes) arrives with its labels in four languages from the
 * catalogue, so the client only picks one: adding a regulator must not need a
 * frontend change.
 */
import { grdLabel } from '../../../shared/constants/grd';
import {
  BaselineChoice,
  Bucket,
  ChangeStatus,
  CheckOutcome,
  CorrespondenceDirection,
  DeadlineParty,
  DocumentKind,
  EntrySheetOut,
  Labels,
  NextActionCode,
  PieceOut,
  ProcedureDeadlineStatus,
  ProcedureDefinitionOut,
  ProcedureDetailOut,
  ProcedureDocumentStatus,
  ProcedureItemOut,
  ProcedureStatus,
  ThreadEntryOut,
  VersionStage,
  InboundMailOut,
} from '../../../shared/dtos/administrative-procedure.dtos';
import { RenderState } from '../../../shared/dtos/administrative-document.dtos';
import { TagSeverity, formatApiDate } from '../administrative-document-format';

const PREFIX = 'ADMINISTRATIVE_DOCUMENT.PROCEDURES';

/**
 * What a dialog acting on a procedure is opened with. It closes with the
 * procedure as it now is (every `/admin` action returns it), or null.
 */
export interface ProcedureDialogData {
  detail: ProcedureDetailOut;
  /** The community's regulator code, to name it when it is the recipient. */
  regulator?: string | null;
  /** « Ajouter une réponse » from a received mail: its .eml, subject, text, date. */
  inbound?: InboundMailOut | null;
}

/** A translation key and its parameters, for `| translate: params`. */
export interface I18nText {
  key: string;
  params?: Record<string, string | number>;
}

// ---------------------------------------------------------------------------
// Catalogue labels
// ---------------------------------------------------------------------------

/**
 * A catalogue label in the reader's language, else French (the catalogue's
 * reference language), else English, else any; `fallback` when there is none.
 */
export function pickLabel(labels: Labels | null | undefined, lang: string, fallback = ''): string {
  if (!labels) return fallback;
  return labels[lang] ?? labels['fr'] ?? labels['en'] ?? Object.values(labels)[0] ?? fallback;
}

/** What a dashboard row says: the step's next action, or the procedure's name. */
export function rowTitle(item: ProcedureItemOut, lang: string): string {
  return pickLabel(item.next_action.labels, lang) || pickLabel(item.labels, lang, item.code);
}

/** The step labels a detail knows, to name the steps its thread mentions. */
export function stepLabels(detail: ProcedureDetailOut): ReadonlyMap<string, Labels> {
  const known = new Map<string, Labels>();
  for (const step of detail.timeline) known.set(step.code, step.labels);
  for (const edge of detail.transitions)
    if (!known.has(edge.to_step)) known.set(edge.to_step, edge.labels);
  return known;
}

/** The definition a procedure was opened under: same code AND version. */
export function definitionOf(
  definitions: readonly ProcedureDefinitionOut[],
  item: Pick<ProcedureItemOut, 'code' | 'version'>,
): ProcedureDefinitionOut | undefined {
  return definitions.find((d) => d.code === item.code && d.version === item.version);
}

// ---------------------------------------------------------------------------
// Legal delays per step
// ---------------------------------------------------------------------------

export interface StepDelay {
  code: string;
  labels: Labels;
  value: number;
  unit: 'working_days' | 'calendar_days' | 'months';
}

function forVariant(variants: string[] | null, variant: string | null): boolean {
  return variants === null || (variant !== null && variants.includes(variant));
}

/**
 * The clocks each step starts, from the catalogue: a rule anchored on entering
 * the step, or on a response that leads to it. The frieze shows them under the
 * step ("DSO check: 20 working days"). Annual dates have no step; they show in
 * the deadlines.
 */
export function stepDelays(
  definition: ProcedureDefinitionOut,
  variant: string | null,
): ReadonlyMap<string, StepDelay[]> {
  const leadsTo = new Map<string, string>();
  for (const response of definition.response_types) {
    if (response.to_step && forVariant(response.variants, variant)) {
      leadsTo.set(response.code, response.to_step);
    }
  }
  const delays = new Map<string, StepDelay[]>();
  for (const rule of definition.deadline_rules) {
    if (rule.kind !== 'relative' || !rule.anchor || !rule.offset) continue;
    if (!forVariant(rule.variants, variant)) continue;
    const [type, code] = rule.anchor.split(':');
    const step = type === 'step' ? code : type === 'response' ? leadsTo.get(code) : undefined;
    if (!step) continue;
    const list = delays.get(step) ?? [];
    list.push({ code: rule.code, labels: rule.labels, ...rule.offset });
    delays.set(step, list);
  }
  return delays;
}

export function delayText(delay: StepDelay, lang: string): I18nText {
  return {
    key: `${PREFIX}.DELAY.${delay.unit.toUpperCase()}`,
    params: { label: pickLabel(delay.labels, lang, delay.code), n: delay.value },
  };
}

// ---------------------------------------------------------------------------
// Due dates
// ---------------------------------------------------------------------------

/**
 * "in 6 working days", "today", "3 working days late". The count is the
 * server's, on the regulator's calendar: the client never counts working days.
 * When it has none (a date past the calendar's years), the date itself.
 */
export function dueText(days: number | null, dueDate: string | null): I18nText | null {
  if (days === null) {
    return dueDate ? { key: `${PREFIX}.DUE.ON`, params: { date: formatApiDate(dueDate) } } : null;
  }
  if (days === 0) return { key: `${PREFIX}.DUE.TODAY` };
  if (days === 1) return { key: `${PREFIX}.DUE.IN_ONE` };
  if (days > 1) return { key: `${PREFIX}.DUE.IN_MANY`, params: { n: days } };
  if (days === -1) return { key: `${PREFIX}.DUE.LATE_ONE` };
  return { key: `${PREFIX}.DUE.LATE_MANY`, params: { n: -days } };
}

// ---------------------------------------------------------------------------
// The one primary action
// ---------------------------------------------------------------------------

/** What the single main button of a procedure does. */
export type PrimaryActionKind = 'pieces' | 'send' | 'respond' | 'baseline' | 'open';

export interface PrimaryAction {
  kind: PrimaryActionKind;
  labelKey: string;
  icon: string;
}

const PRIMARY_ACTIONS: Record<NextActionCode, PrimaryAction> = {
  complete_documents: {
    kind: 'pieces',
    labelKey: `${PREFIX}.ACTIONS.COMPLETE_DOCUMENTS`,
    icon: 'pi pi-file-edit',
  },
  send: { kind: 'send', labelKey: `${PREFIX}.ACTIONS.SEND`, icon: 'pi pi-send' },
  record_response: {
    kind: 'respond',
    labelKey: `${PREFIX}.ACTIONS.RECORD_RESPONSE`,
    icon: 'pi pi-reply',
  },
  confirm_baseline: {
    kind: 'baseline',
    labelKey: `${PREFIX}.ACTIONS.CONFIRM_BASELINE`,
    icon: 'pi pi-check-square',
  },
  none: { kind: 'open', labelKey: `${PREFIX}.ACTIONS.OPEN`, icon: 'pi pi-arrow-right' },
};

/** An unknown code (a newer backend) reads as `none`: open the procedure. */
export function primaryAction(code: string): PrimaryAction {
  return PRIMARY_ACTIONS[code as NextActionCode] ?? PRIMARY_ACTIONS.none;
}

// ---------------------------------------------------------------------------
// Engine statuses
// ---------------------------------------------------------------------------

export function bucketLabelKey(bucket: Bucket): string {
  return `${PREFIX}.BUCKETS.${bucket.toUpperCase()}`;
}

export function procedureStatusLabelKey(status: ProcedureStatus): string {
  return `${PREFIX}.STATUS.${status}`;
}

export function procedureStatusSeverity(status: ProcedureStatus): TagSeverity {
  switch (status) {
    case ProcedureStatus.READY:
    case ProcedureStatus.SENT:
      return 'info';
    case ProcedureStatus.IN_FORCE:
      return 'success';
    case ProcedureStatus.REFUSED:
      return 'danger';
    case ProcedureStatus.LAPSED:
      return 'warn';
    default:
      return 'secondary';
  }
}

export function pieceStatusLabelKey(status: ProcedureDocumentStatus): string {
  return `${PREFIX}.PIECE_STATUS.${status}`;
}

export function pieceStatusSeverity(status: ProcedureDocumentStatus): TagSeverity {
  switch (status) {
    case ProcedureDocumentStatus.READY:
    case ProcedureDocumentStatus.SIGNED:
      return 'success';
    case ProcedureDocumentStatus.MISSING:
      return 'warn';
    // Outdated by a later change: its own colour, it needs regenerating.
    case ProcedureDocumentStatus.STALE:
    case ProcedureDocumentStatus.REJECTED:
      return 'danger';
    default:
      return 'secondary';
  }
}

export function versionStageLabelKey(stage: VersionStage): string {
  return `${PREFIX}.VERSION_STAGE.${stage}`;
}

/** A draft is work in progress; a final is what gets sent; a form to sign waits on a participant. */
export function versionStageSeverity(stage: VersionStage): TagSeverity {
  switch (stage) {
    case VersionStage.FINAL:
      return 'success';
    case VersionStage.DRAFT:
      return 'info';
    default:
      return 'contrast';
  }
}

export function checkOutcomeLabelKey(outcome: CheckOutcome): string {
  return `${PREFIX}.CHECK_OUTCOME.${outcome}`;
}

export function checkOutcomeSeverity(outcome: CheckOutcome): TagSeverity {
  switch (outcome) {
    case CheckOutcome.IDENTICAL:
      return 'success';
    case CheckOutcome.DIFFERENT:
      return 'danger';
    default:
      return 'warn';
  }
}

export function pieceKindLabelKey(kind: DocumentKind | null): string {
  return `${PREFIX}.PIECE_KIND.${kind ?? 'UNKNOWN'}`;
}

export function changeStatusLabelKey(status: ChangeStatus): string {
  return `${PREFIX}.CHANGE_STATUS.${status}`;
}

export function changeStatusSeverity(status: ChangeStatus): TagSeverity {
  switch (status) {
    case ChangeStatus.ATTACHED:
      return 'info';
    case ChangeStatus.APPLIED:
      return 'success';
    case ChangeStatus.REFUSED:
      return 'danger';
    case ChangeStatus.PENDING:
      return 'warn';
    default:
      return 'secondary';
  }
}

/** The change kinds the core emits today. Another one is named by its code. */
const CHANGE_KINDS = new Set([
  'meter_added',
  'meter_removed',
  'key_changed',
  'representative_changed',
  'installation_added',
  'installation_removed',
  'operation_closed',
]);

export function changeKindText(kind: string): I18nText {
  return CHANGE_KINDS.has(kind)
    ? { key: `${PREFIX}.CHANGE_KIND.${kind.toUpperCase()}` }
    : { key: `${PREFIX}.CHANGE_KIND.OTHER`, params: { code: kind } };
}

/**
 * A procedure's route. The catalogue gives variants no labels; the two the
 * engine knows today are translated here, another one shows its code.
 */
const VARIANTS = new Set(['simple', 'authorization']);

export function variantText(variant: string): I18nText {
  return VARIANTS.has(variant)
    ? { key: `${PREFIX}.VARIANT.${variant.toUpperCase()}` }
    : { key: `${PREFIX}.VARIANT.OTHER`, params: { code: variant } };
}

/** The July labels: the engine kept the deadline statuses' codes. */
export function deadlineStatusKey(status: ProcedureDeadlineStatus): string {
  return `ADMINISTRATIVE_DOCUMENT.DEADLINE_STATUS.${ProcedureDeadlineStatus[status]}`;
}

export function partyLabelKey(party: DeadlineParty | null): string {
  return `${PREFIX}.PARTY.${party ?? 'UNKNOWN'}`;
}

export function baselineChoiceLabelKey(choice: BaselineChoice): string {
  return `${PREFIX}.BASELINE.CHOICE.${choice.toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Recipient
// ---------------------------------------------------------------------------

/**
 * Who the procedure goes to. The reference GRD's name when known; the
 * regulator's label otherwise (`REGULATORS.<code>`, as everywhere else).
 */
export function recipientText(
  recipient: string,
  grdRef: string | null,
  regulator: string | null,
): I18nText {
  if (recipient === 'grd_ref') {
    return grdRef
      ? { key: `${PREFIX}.RECIPIENT.GRD`, params: { name: grdLabel(grdRef) } }
      : { key: `${PREFIX}.RECIPIENT.GRD_UNKNOWN` };
  }
  return regulator ? { key: `REGULATORS.${regulator}` } : { key: `${PREFIX}.RECIPIENT.REGULATOR` };
}

// ---------------------------------------------------------------------------
// What the community may do on a piece or a change
// ---------------------------------------------------------------------------

const GENERATABLE = new Set([
  ProcedureDocumentStatus.MISSING,
  ProcedureDocumentStatus.STALE,
  ProcedureDocumentStatus.READY,
]);

/**
 * The annex's rule (missing, stale or ready, and not sent yet), offered only
 * where the catalogue names a template: without one the annex answers 422.
 */
export function canGenerate(detail: ProcedureDetailOut, piece: PieceOut): boolean {
  return detail.frozen_at === null && piece.template !== null && GENERATABLE.has(piece.status);
}

/**
 * One click: a stale piece the annex rendered (an upload has no pre-fill to
 * carry the reviewer's edits from, so it goes through the review form).
 */
export function canRegenerate(detail: ProcedureDetailOut, piece: PieceOut): boolean {
  return (
    canGenerate(detail, piece) &&
    piece.status === ProcedureDocumentStatus.STALE &&
    piece.current_version?.generated === true &&
    !isRendering(piece)
  );
}

/** Regenerate a rendered final from what it froze and compare the bytes. */
export function canVerify(piece: PieceOut): boolean {
  const version = piece.current_version;
  return (
    version !== null &&
    version.generated &&
    version.stage === VersionStage.FINAL &&
    !isRendering(piece)
  );
}

/** What the server says renders now (the slot outlives a page reload). */
export function isRendering(piece: PieceOut): boolean {
  return piece.render?.state === RenderState.PENDING;
}

/** After sending, only what the recipient sends back still arrives. */
export function canUpload(detail: ProcedureDetailOut, piece: PieceOut): boolean {
  if (piece.status === ProcedureDocumentStatus.OBSOLETE) return false;
  return detail.frozen_at === null || piece.kind === DocumentKind.RECEIVED;
}

export function canDownload(piece: PieceOut): boolean {
  return piece.current_version_id !== null;
}

/** Defer and exclude: a change still filed here, before the sending. */
export function canActOnChange(detail: ProcedureDetailOut, status: ChangeStatus): boolean {
  return detail.frozen_at === null && status === ChangeStatus.ATTACHED;
}

/** A way out of the path other than "in force". */
export function isDeadEnd(status: ProcedureStatus): boolean {
  return isFinished(status) && status !== ProcedureStatus.IN_FORCE;
}

/** Finished: nothing left to do but read. */
export function isFinished(status: ProcedureStatus): boolean {
  return (
    status === ProcedureStatus.IN_FORCE ||
    status === ProcedureStatus.REFUSED ||
    status === ProcedureStatus.CANCELLED ||
    status === ProcedureStatus.LAPSED
  );
}

// ---------------------------------------------------------------------------
// Thread
// ---------------------------------------------------------------------------

/** One line of the activity thread, as a sentence with its icon. */
export interface ThreadLine {
  icon: string;
  text: I18nText;
  /** Free text the admin wrote (a reason, a subject). Rendered as text, never HTML. */
  note: string | null;
}

export function threadLine(
  entry: ThreadEntryOut,
  detail: ProcedureDetailOut,
  lang: string,
  steps: ReadonlyMap<string, Labels> = stepLabels(detail),
): ThreadLine {
  const step = (code: string | null): string =>
    code ? pickLabel(steps.get(code), lang, code) : '—';
  if (entry.kind === 'step') {
    const text: I18nText = entry.from_step
      ? {
          key: `${PREFIX}.THREAD.STEP`,
          params: { from: step(entry.from_step), to: step(entry.to_step) },
        }
      : { key: `${PREFIX}.THREAD.OPENED`, params: { to: step(entry.to_step) } };
    return { icon: 'pi pi-arrow-right', text, note: entry.reason };
  }
  if (entry.kind === 'correspondence') {
    const type = detail.response_types.find((r) => r.code === entry.type);
    const label = pickLabel(type?.labels, lang, entry.type ?? '');
    const outbound = entry.direction === CorrespondenceDirection.OUTBOUND;
    return {
      icon: outbound ? 'pi pi-send' : 'pi pi-inbox',
      text: {
        key: `${PREFIX}.THREAD.${outbound ? 'OUTBOUND' : 'INBOUND'}`,
        params: { type: label },
      },
      note: entry.subject,
    };
  }
  if (entry.kind === 'inbound') {
    return {
      icon: 'pi pi-envelope',
      text: { key: `${PREFIX}.THREAD.RECEIVED` },
      note: entry.subject,
    };
  }
  const piece = detail.pieces.find((p) => p.id === entry.id_document);
  return {
    icon: 'pi pi-file',
    text: {
      key: `${PREFIX}.THREAD.VERSION`,
      params: {
        piece: pickLabel(piece?.labels, lang, piece?.code ?? ''),
        n: entry.version_no ?? 0,
      },
    },
    note: null,
  };
}

// ---------------------------------------------------------------------------
// The message the admin sends
// ---------------------------------------------------------------------------

/**
 * The pieces that go with the sending: community-supplied and there (ready or
 * signed). A form still waiting for its signature is not sent. The annex's own
 * rule; it refuses to mark as sent until each of these is final.
 */
export function piecesToSend(detail: ProcedureDetailOut): PieceOut[] {
  return detail.pieces.filter(
    (p) =>
      p.kind !== DocumentKind.RECEIVED &&
      (p.status === ProcedureDocumentStatus.READY || p.status === ProcedureDocumentStatus.SIGNED) &&
      p.current_version_id !== null,
  );
}

/** The pieces still to render as finals (a draft), or rendering. */
export function piecesNotFinal(detail: ProcedureDetailOut): PieceOut[] {
  return piecesToSend(detail).filter(
    (p) => isRendering(p) || p.current_version?.stage !== VersionStage.FINAL,
  );
}

/**
 * A fiche de saisie value as text to read and paste: a box ticked or not in
 * words, nothing for a blank. `t` resolves a key.
 */
export function entryValueText(value: unknown, t: (key: string) => string): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return t(`${PREFIX}.SEND.SHEET.${value ? 'YES' : 'NO'}`);
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  return JSON.stringify(value);
}

/**
 * The body of the message, ready to copy. The annex prepares the subject (with
 * the `[OPT-<id>]` reference a reply must keep); the wording of the body is the
 * client's, in the reader's language. `t` resolves a key: ngx-translate does not
 * expand a key passed as a parameter.
 */
export function sendBody(
  detail: ProcedureDetailOut,
  lang: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const pieces = piecesToSend(detail)
    .map((p) => `- ${pickLabel(p.labels, lang, p.code)}`)
    .join('\n');
  return t(`${PREFIX}.SEND.BODY`, {
    procedure: pickLabel(detail.labels, lang, detail.code),
    operation: detail.operation_name ?? '—',
    reference: detail.send_preview.reference,
    pieces: pieces || t(`${PREFIX}.SEND.NO_PIECES`),
  });
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * The fiches de saisie as a standalone printable page (print it, or save it as
 * PDF from the browser): the same values, labels and order as on screen, and
 * nothing of the application around them.
 */
export function entrySheetsHtml(
  title: string,
  sheets: EntrySheetOut[],
  lang: string,
  t: (key: string) => string,
): string {
  const body = sheets
    .map((sheet) => {
      const sections = sheet.sections
        .map((section) => {
          const rows = section.fields
            .map(
              (field) =>
                `<tr><th>${escapeHtml(pickLabel(field.labels, lang, field.key))}</th>` +
                `<td>${escapeHtml(entryValueText(field.value, t))}</td></tr>`,
            )
            .join('');
          return `<h3>${escapeHtml(pickLabel(section.labels, lang, ''))}</h3><table>${rows}</table>`;
        })
        .join('');
      return `<h2>${escapeHtml(pickLabel(sheet.labels, lang, sheet.code))}</h2>${sections}`;
    })
    .join('');
  return (
    `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8">` +
    `<title>${escapeHtml(title)}</title><style>` +
    'body{font-family:system-ui,sans-serif;font-size:11pt;color:#1f2933;margin:16mm}' +
    'h1{font-size:15pt}h2{font-size:13pt;margin-top:8mm}h3{font-size:10pt;color:#52606d;' +
    'text-transform:uppercase;margin:5mm 0 1mm}table{width:100%;border-collapse:collapse}' +
    'th,td{text-align:left;vertical-align:top;padding:1.5mm 2mm;border-bottom:0.3mm solid #d9e2ec}' +
    'th{width:40%;font-weight:normal;color:#52606d}td{font-family:ui-monospace,monospace}' +
    `</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`
  );
}
