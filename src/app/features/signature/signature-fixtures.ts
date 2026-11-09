/**
 * Test data for the signature specs, shaped like the annexe's answers
 * (`signature/service/views.py`). Imported by specs only, never by the app.
 */
import {
  MySignatureRow,
  MySignatureSlot,
  SignatureRequestDetail,
  SignatureRequestSummary,
  SignerView,
} from '../../shared/dtos/signature.dtos';

export const REQUEST_ID = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';
export const SIGNER_ID = '6fa459ea-ee8a-3ca4-894e-db77e160355e';

export function requestSummary(
  overrides: Partial<SignatureRequestSummary> = {},
): SignatureRequestSummary {
  return {
    id: REQUEST_ID,
    reference: '1B4E28BA',
    id_community: 10,
    community: 'CE Liège',
    title: 'Déclaration sur l’honneur — annexe 8',
    locale: 'fr',
    source_service: 'administrative_document',
    source_ref: '42',
    status: 'OPEN',
    signing_order: 'PARALLEL',
    created_at: '2026-11-03T09:00:00Z',
    expires_at: '2026-12-03T09:00:00Z',
    closed_at: null,
    failure_code: null,
    current_revision: 1,
    has_artifacts: false,
    ...overrides,
  };
}

export function signerView(overrides: Partial<SignerView> = {}): SignerView {
  return {
    id: SIGNER_ID,
    position: 1,
    id_member: 5,
    capacity: 'SELF',
    display_name: 'Alice Dupont',
    member_label: null,
    role_label: 'Participant',
    status: 'INVITED',
    method: null,
    slot: { page: 0, rect: [100, 100, 300, 150] },
    invited_at: '2026-11-03T09:00:00Z',
    signed_at: null,
    signed_by_name: null,
    declined_at: null,
    decline_reason: null,
    ...overrides,
  };
}

export function signatureRow(
  overrides: Partial<Omit<MySignatureRow, 'signer' | 'request'>> = {},
  signer: Partial<SignerView> = {},
  request: Partial<SignatureRequestSummary> = {},
): MySignatureRow {
  return {
    request: requestSummary(request),
    signer: signerView(signer),
    pending: true,
    your_turn: true,
    ...overrides,
  };
}

export function mySlot(overrides: Partial<MySignatureSlot> = {}): MySignatureSlot {
  return {
    signer_id: SIGNER_ID,
    consent_version: 'v1',
    consent_text: 'Je déclare avoir lu le document et le signer électroniquement.',
    fields: [
      {
        name: 'date',
        type: 'DATE',
        label: null,
        required: false,
        slot: { page: 0, rect: [320, 100, 420, 120] },
        value: null,
      },
      {
        name: 'place',
        type: 'TEXT',
        label: 'Fait à',
        required: true,
        slot: { page: 0, rect: [100, 160, 300, 180] },
        value: null,
      },
      {
        name: 'accept',
        type: 'CHECKBOX',
        label: 'J’accepte',
        required: false,
        slot: null,
        value: null,
      },
    ],
    ...overrides,
  };
}

export function requestDetail(
  overrides: Partial<SignatureRequestDetail> = {},
  signer: Partial<SignerView> = {},
  request: Partial<SignatureRequestSummary> = {},
): SignatureRequestDetail {
  return {
    request: requestSummary(request),
    signers: [{ ...signerView(signer), mine: true }],
    progress: { signed: 0, total: 1 },
    document: { revision: 1, sha256: 'f'.repeat(64), kind: 'PREPARED' },
    my_slots: [mySlot()],
    can_follow: false,
    ...overrides,
  };
}
