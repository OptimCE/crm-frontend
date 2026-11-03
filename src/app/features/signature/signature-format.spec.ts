import { SignatureFieldView } from '../../shared/dtos/signature.dtos';
import {
  capacityText,
  clearDraft,
  countBadge,
  draftKey,
  eventText,
  fieldsPayload,
  initialFieldValues,
  loadDraft,
  pastRows,
  pdfRectToBox,
  pendingRows,
  requiredFieldsFilled,
  saveDraft,
  viewportRectToBox,
} from './signature-format';
import { SIGNER_ID, signatureRow } from './signature-fixtures';

describe('signature-format', () => {
  describe('capacity in plain words', () => {
    it('says on whose behalf the user signs', () => {
      expect(capacityText({ capacity: 'SELF', member_label: null, display_name: 'A' })).toEqual({
        key: 'SIGNATURE.CAPACITY.SELF',
      });
      expect(
        capacityText({
          capacity: 'LEGAL_REPRESENTATIVE',
          member_label: 'ACME SRL',
          display_name: 'Alice',
        }),
      ).toEqual({
        key: 'SIGNATURE.CAPACITY.LEGAL_REPRESENTATIVE',
        params: { member: 'ACME SRL' },
      });
      expect(
        capacityText({ capacity: 'COMMUNITY_ADMIN', member_label: null, display_name: 'A' }).key,
      ).toBe('SIGNATURE.CAPACITY.COMMUNITY_ADMIN');
    });
  });

  describe('the inbox', () => {
    it('puts the slots the user can sign now first, then the waiting ones', () => {
      const waiting = signatureRow({ your_turn: false }, { id: 'w', status: 'WAITING' });
      const now = signatureRow({ your_turn: true }, { id: 'n' });
      const done = signatureRow({ pending: false, your_turn: false }, { id: 'd' });
      expect(pendingRows([waiting, done, now]).map((r) => r.signer.id)).toEqual(['n', 'w']);
      expect(pastRows([waiting, done, now]).map((r) => r.signer.id)).toEqual(['d']);
    });

    it('caps the badge at 99+ and shows nothing at zero', () => {
      expect(countBadge(0)).toBeNull();
      expect(countBadge(3)).toBe('3');
      expect(countBadge(120)).toBe('99+');
    });
  });

  describe('placement on the page', () => {
    it('turns PDF points (y up from the bottom) into percent of the page', () => {
      // A4 portrait: 595 x 842 points.
      const box = pdfRectToBox([100, 100, 300, 150], 595, 842);
      expect(box.left).toBeCloseTo((100 / 595) * 100);
      expect(box.width).toBeCloseTo((200 / 595) * 100);
      // The top edge is y2 = 150 from the bottom, so 692 from the top.
      expect(box.top).toBeCloseTo((692 / 842) * 100);
      expect(box.height).toBeCloseTo((50 / 842) * 100);
    });

    it('accepts corners in any order', () => {
      expect(viewportRectToBox([300, 50, 100, 10], 400, 100)).toEqual({
        left: 25,
        top: 10,
        width: 50,
        height: 40,
      });
    });
  });

  describe('what signing needs', () => {
    const fields: SignatureFieldView[] = [
      { name: 'date', type: 'DATE', label: null, required: true, slot: null, value: null },
      { name: 'place', type: 'TEXT', label: null, required: true, slot: null, value: null },
      { name: 'ok', type: 'CHECKBOX', label: null, required: true, slot: null, value: null },
      { name: 'note', type: 'TEXT', label: null, required: false, slot: null, value: 'x' },
    ];

    it('starts from the request’s values, never a DATE', () => {
      expect(initialFieldValues(fields)).toEqual({ place: '', ok: false, note: 'x' });
    });

    it('needs every required text and checkbox, but never the DATE the server writes', () => {
      expect(requiredFieldsFilled(fields, { place: '  ', ok: true })).toBe(false);
      expect(requiredFieldsFilled(fields, { place: 'Liège', ok: false })).toBe(false);
      expect(requiredFieldsFilled(fields, { place: 'Liège', ok: true })).toBe(true);
    });

    it('sends checkboxes as strings, skips DATE and blank text', () => {
      expect(fieldsPayload(fields, { place: ' Liège ', ok: true, note: '' })).toEqual({
        place: 'Liège',
        ok: 'true',
      });
      expect(fieldsPayload(fields, { place: 'Liège', ok: false })).toEqual({
        place: 'Liège',
        ok: 'false',
      });
    });
  });

  describe('the draft kept across the step-up login', () => {
    afterEach(() => sessionStorage.clear());

    it('round-trips through sessionStorage under signature-draft:<signerId>', () => {
      saveDraft(SIGNER_ID, {
        method: 'DRAWN',
        typedName: '',
        imagePng: 'data:image/png;base64,AAAA',
        fields: { place: 'Liège', ok: true },
        consent: true,
      });
      expect(sessionStorage.getItem(draftKey(SIGNER_ID))).not.toBeNull();
      expect(draftKey(SIGNER_ID)).toBe(`signature-draft:${SIGNER_ID}`);
      expect(loadDraft(SIGNER_ID)).toEqual({
        method: 'DRAWN',
        typedName: '',
        imagePng: 'data:image/png;base64,AAAA',
        fields: { place: 'Liège', ok: true },
        consent: true,
      });
      clearDraft(SIGNER_ID);
      expect(loadDraft(SIGNER_ID)).toBeNull();
    });

    it('ignores a draft it did not write', () => {
      sessionStorage.setItem(draftKey(SIGNER_ID), '{"method":"X"}');
      expect(loadDraft(SIGNER_ID)).toBeNull();
      sessionStorage.setItem(draftKey(SIGNER_ID), 'not json');
      expect(loadDraft(SIGNER_ID)).toBeNull();
      sessionStorage.setItem(
        draftKey(SIGNER_ID),
        JSON.stringify({ method: 'TYPED', imagePng: 'javascript:alert(1)', consent: 'yes' }),
      );
      expect(loadDraft(SIGNER_ID)).toEqual({
        method: 'TYPED',
        typedName: '',
        imagePng: null,
        fields: {},
        consent: false,
      });
    });
  });

  describe('the timeline in plain words', () => {
    it('names the signer, and keeps an unknown type readable', () => {
      expect(
        eventText({
          seq: 3,
          type: 'signer.signed',
          at: '',
          signer: { position: 1, display_name: 'Alice' },
          document_sha256: null,
          payload: {},
        }),
      ).toEqual({ key: 'SIGNATURE.EVENTS.SIGNER_SIGNED', params: { signer: 'Alice', reason: '' } });
      expect(
        eventText({
          seq: 4,
          type: 'request.archived',
          at: '',
          signer: null,
          document_sha256: null,
          payload: {},
        }),
      ).toEqual({ key: 'SIGNATURE.EVENTS.UNKNOWN', params: { type: 'request.archived' } });
    });
  });
});
