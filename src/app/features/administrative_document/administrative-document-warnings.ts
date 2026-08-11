import { PrefillWarning } from '../../shared/dtos/administrative-document.dtos';
import { prefillLabelKey } from './administrative-document-prefill';

/**
 * Presentation for the structured prefill warnings.
 *
 * Pure and DI-free, like the notification registry and for the same reason: the
 * rules that decide what a warning says and where it points are exactly the ones
 * worth unit-testing without a TestBed.
 *
 * The backend sends a machine `code` and the text lives here, mirroring the
 * notification taxonomy — the service has no message catalogue and the frontend
 * already owns these field labels in four locales.
 */

/** i18n key for a warning's sentence. */
export function warningLabelKey(warning: PrefillWarning): string {
  return `ADMINISTRATIVE_DOCUMENT.PREFILL.WARNINGS.CODES.${warning.code}`;
}

/**
 * Interpolation values for the sentence.
 *
 * `field` is the snapshot key the warning is about, so it resolves through the
 * SAME `prefillLabelKey` the form itself uses — the warning names the exact cell
 * that will come out blank, with no second vocabulary to keep in step.
 */
export function warningParams(warning: PrefillWarning): Record<string, string> {
  return {
    ...warning.params,
    ...(warning.subject_id ? { subject: warning.subject_id } : {}),
  };
}

/** The label key of the field a warning names, or null when it names none. */
export function warningFieldLabelKey(warning: PrefillWarning): string | null {
  const field = warning.params['field'];
  return field ? prefillLabelKey(field) : null;
}

/** An EAN is exactly 18 digits. Meters are keyed by it throughout the app. */
const EAN_PATTERN = /^\d{18}$/;
/** A positive integer id, the only thing `/members/{id}` accepts. */
const ID_PATTERN = /^[1-9]\d*$/;

/**
 * Where to go to fix a warning at source, or null when there is nothing to open.
 *
 * `subject_id` is server data heading into `routerLink`, so it is validated the
 * same way the notification registry validates its ids rather than trusted.
 *
 * No subscription gate is needed on these: `/meters` and `/members` are core
 * (minRole GESTIONNAIRE) and `/communities/info` is member-level, while this
 * dialog is only reachable from `/administrative-document`, which is already
 * manager-gated.
 */
export function warningLink(warning: PrefillWarning): string | null {
  switch (warning.subject_type) {
    case 'community':
      return '/communities/info';
    case 'meter':
      return warning.subject_id && EAN_PATTERN.test(warning.subject_id)
        ? `/meters/${warning.subject_id}`
        : null;
    case 'member':
      return warning.subject_id && ID_PATTERN.test(warning.subject_id)
        ? `/members/${warning.subject_id}`
        : null;
    default:
      return null;
  }
}
