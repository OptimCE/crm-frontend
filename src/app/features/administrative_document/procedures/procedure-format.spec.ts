import {
  ChangeStatus,
  DocumentKind,
  ProcedureDocumentStatus,
} from '../../../shared/dtos/administrative-procedure.dtos';
import { modifDefinition, procedureDetail, procedureItem } from './procedure-fixtures';
import {
  canActOnChange,
  canGenerate,
  canUpload,
  changeKindText,
  definitionOf,
  dueText,
  pickLabel,
  piecesToSend,
  primaryAction,
  recipientText,
  rowTitle,
  sendBody,
  stepDelays,
  threadLine,
  variantText,
} from './procedure-format';

const P = 'ADMINISTRATIVE_DOCUMENT.PROCEDURES';

describe('procedure-format', () => {
  describe('pickLabel', () => {
    it('picks the reader language, then French, then English, then any', () => {
      expect(pickLabel({ fr: 'Brouillon', en: 'Draft', nl: 'Concept' }, 'nl')).toBe('Concept');
      expect(pickLabel({ fr: 'Brouillon', en: 'Draft' }, 'de')).toBe('Brouillon');
      expect(pickLabel({ en: 'Draft' }, 'de')).toBe('Draft');
      expect(pickLabel({ nl: 'Concept' }, 'de')).toBe('Concept');
    });

    it('falls back when there is no label at all', () => {
      expect(pickLabel(null, 'fr', 'draft')).toBe('draft');
      expect(pickLabel({}, 'fr', 'draft')).toBe('draft');
    });
  });

  describe('rowTitle', () => {
    it('names the next action, or the procedure when there is none', () => {
      expect(rowTitle(procedureItem(), 'fr')).toBe('Compléter les pièces');
      const none = procedureItem({ next_action: { code: 'none', labels: null } });
      expect(rowTitle(none, 'fr')).toBe('Modification du partage');
    });
  });

  describe('dueText (criterion 1.5: the count is the server’s)', () => {
    it('words the working days the annex counted', () => {
      expect(dueText(0, '2026-10-29')).toEqual({ key: `${P}.DUE.TODAY` });
      expect(dueText(1, '2026-10-30')).toEqual({ key: `${P}.DUE.IN_ONE` });
      expect(dueText(6, '2026-11-06')).toEqual({ key: `${P}.DUE.IN_MANY`, params: { n: 6 } });
      expect(dueText(-1, '2026-10-28')).toEqual({ key: `${P}.DUE.LATE_ONE` });
      expect(dueText(-3, '2026-10-26')).toEqual({ key: `${P}.DUE.LATE_MANY`, params: { n: 3 } });
    });

    it('shows the date when the calendar does not cover it, and nothing without one', () => {
      expect(dueText(null, '2036-01-05')).toEqual({
        key: `${P}.DUE.ON`,
        params: { date: '05/01/2036' },
      });
      expect(dueText(null, null)).toBeNull();
    });
  });

  describe('primaryAction', () => {
    it('maps each next action to one button', () => {
      expect(primaryAction('complete_documents').kind).toBe('pieces');
      expect(primaryAction('send').kind).toBe('send');
      expect(primaryAction('record_response').kind).toBe('respond');
      expect(primaryAction('confirm_baseline').kind).toBe('baseline');
      expect(primaryAction('none').kind).toBe('open');
    });

    it('reads an unknown code from a newer backend as "open"', () => {
      expect(primaryAction('sign_declarations').kind).toBe('open');
    });
  });

  describe('stepDelays', () => {
    it('puts each clock under the step that starts it, for the variant only', () => {
      const simple = stepDelays(modifDefinition(), 'simple');
      expect(simple.get('sent')?.map((d) => [d.code, d.value, d.unit])).toEqual([
        ['grd_control', 20, 'working_days'],
      ]);

      const authorization = stepDelays(modifDefinition(), 'authorization');
      expect(authorization.get('sent')?.map((d) => d.code)).toEqual(['completeness']);
    });

    it('follows a response to the step it leads to', () => {
      expect(
        stepDelays(modifDefinition(), 'simple')
          .get('accepted')
          ?.map((d) => d.code),
      ).toEqual(['amendment_return']);
    });

    it('leaves annual dates out: they have no step', () => {
      const all = [...stepDelays(modifDefinition(), 'simple').values()].flat();
      expect(all.map((d) => d.code)).not.toContain('annual');
    });
  });

  describe('definitionOf', () => {
    it('matches the code AND the version the procedure was opened under', () => {
      const v1 = modifDefinition();
      const v2 = modifDefinition({ version: 2 });
      expect(definitionOf([v2, v1], procedureItem())).toBe(v1);
      expect(definitionOf([v2], procedureItem())).toBeUndefined();
    });
  });

  describe('what a piece and a change allow', () => {
    it('generates a missing, stale or ready piece with a template, before sending', () => {
      const detail = procedureDetail();
      const [missing, ready] = detail.pieces;
      expect(canGenerate(detail, missing)).toBe(true);
      expect(canGenerate(detail, ready)).toBe(true);
      expect(canGenerate(detail, { ...missing, template: null })).toBe(false);
      expect(canGenerate(detail, { ...missing, status: ProcedureDocumentStatus.SIGNED })).toBe(
        false,
      );
      expect(canGenerate({ ...detail, frozen_at: '2026-10-29T10:00:00Z' }, missing)).toBe(false);
    });

    it('takes an upload until sending, and a received piece after it', () => {
      const detail = procedureDetail();
      const frozen = { ...detail, frozen_at: '2026-10-29T10:00:00Z' };
      const piece = detail.pieces[0];
      expect(canUpload(detail, piece)).toBe(true);
      expect(canUpload(frozen, piece)).toBe(false);
      expect(canUpload(frozen, { ...piece, kind: DocumentKind.RECEIVED })).toBe(true);
      expect(canUpload(detail, { ...piece, status: ProcedureDocumentStatus.OBSOLETE })).toBe(false);
    });

    it('defers or excludes only a change still filed here, before sending', () => {
      const detail = procedureDetail();
      expect(canActOnChange(detail, ChangeStatus.ATTACHED)).toBe(true);
      expect(canActOnChange(detail, ChangeStatus.EXCLUDED)).toBe(false);
      expect(
        canActOnChange({ ...detail, frozen_at: '2026-10-29T10:00:00Z' }, ChangeStatus.ATTACHED),
      ).toBe(false);
    });
  });

  describe('labels with a fallback', () => {
    it('names a known change kind and shows the code of another', () => {
      expect(changeKindText('meter_added')).toEqual({ key: `${P}.CHANGE_KIND.METER_ADDED` });
      expect(changeKindText('statutes_changed')).toEqual({
        key: `${P}.CHANGE_KIND.OTHER`,
        params: { code: 'statutes_changed' },
      });
    });

    it('names the two known routes and shows the code of another', () => {
      expect(variantText('authorization')).toEqual({ key: `${P}.VARIANT.AUTHORIZATION` });
      expect(variantText('express')).toEqual({
        key: `${P}.VARIANT.OTHER`,
        params: { code: 'express' },
      });
    });

    it('names the recipient: the GRD by name, else the regulator', () => {
      expect(recipientText('grd_ref', 'ores', null)).toEqual({
        key: `${P}.RECIPIENT.GRD`,
        params: { name: 'ORES' },
      });
      expect(recipientText('grd_ref', null, null)).toEqual({ key: `${P}.RECIPIENT.GRD_UNKNOWN` });
      expect(recipientText('regulator', null, 'BE-WAL-CWAPE')).toEqual({
        key: 'REGULATORS.BE-WAL-CWAPE',
      });
    });
  });

  describe('threadLine', () => {
    it('words a step change with the steps’ labels', () => {
      const detail = procedureDetail();
      const entry = {
        ...detail.thread[0],
        from_step: 'draft',
        to_step: 'ready',
        reason: 'pièces prêtes',
      };
      expect(threadLine(entry, detail, 'fr')).toEqual({
        icon: 'pi pi-arrow-right',
        text: { key: `${P}.THREAD.STEP`, params: { from: 'Brouillon', to: 'Prêt' } },
        note: 'pièces prêtes',
      });
    });

    it('words a message with its response type, inbound or outbound', () => {
      const detail = procedureDetail();
      const line = threadLine(detail.thread[1], detail, 'en');
      expect(line.text).toEqual({
        key: `${P}.THREAD.INBOUND`,
        params: { type: 'Acknowledgement of receipt' },
      });
      expect(line.note).toBe('AR ORES');
    });
  });

  describe('the sending', () => {
    it('lists only the pieces the community attaches and has', () => {
      expect(piecesToSend(procedureDetail()).map((p) => p.id)).toEqual([22]);
    });

    it('composes the body with the reference a reply must keep', () => {
      const params: Record<string, string | number>[] = [];
      const body = sendBody(procedureDetail(), 'fr', (key, p) => {
        if (p) params.push(p);
        return key;
      });
      expect(body).toBe(`${P}.SEND.BODY`);
      expect(params[0]).toEqual({
        procedure: 'Modification du partage',
        operation: 'Op Centre',
        reference: '[OPT-12]',
        pieces: '- Annexe 6',
      });
    });
  });
});
