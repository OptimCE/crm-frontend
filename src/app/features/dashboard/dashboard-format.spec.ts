import { ApiResponse } from '../../core/dtos/api.response';
import { CommunityDashboardDTO } from '../../shared/dtos/dashboard.dtos';
import { MeAllocationShareDTO } from '../../shared/dtos/me.dtos';
import { InvoiceStatus } from '../../shared/dtos/billing.dtos';
import { MeterDataStatus } from '../../shared/types/meter.types';
import {
  envelopeData,
  isEnvelopeError,
  legalFieldLabelKey,
  readinessItems,
  shareDisplay,
  tagSeverity,
  UNPAID_INVOICE_STATUSES,
  worstSeverity,
} from './dashboard-format';

function dashboard(overrides: Partial<CommunityDashboardDTO> = {}): CommunityDashboardDTO {
  return {
    as_of: '2026-08-05',
    members: {
      total: 0,
      active: 0,
      inactive: 0,
      pending: 0,
      without_user_account: 0,
      incomplete: 0,
    },
    meters: {
      total: 0,
      active: 0,
      inactive: 0,
      waiting_grd: 0,
      waiting_manager: 0,
      without_active_data: 0,
      not_in_sharing_operation: 0,
    },
    sharing_operations: {
      total: 0,
      without_valid_key: 0,
      with_pending_key: 0,
      operations_without_valid_key: [],
    },
    invitations: { member_pending: 0, member_to_be_encoded: 0, manager_pending: 0 },
    legal_info: { missing_fields: [], complete: true },
    ...overrides,
  };
}

function share(overrides: Partial<MeAllocationShareDTO> = {}): MeAllocationShareDTO {
  return {
    community: { id: 1, name: 'C', logo_url: null },
    sharing_operation: { id: 1, name: 'Op', type: 1 },
    ean: '541448200000000001',
    member: { id: 4, name: 'Alice' },
    holding_start_date: '2024-01-01',
    holding_end_date: null,
    key: { id: 1, name: 'Key 1', start_date: '2024-01-01', end_date: null },
    matched: true,
    match_basis: 'ean_consumer_name',
    is_prorata: false,
    effective_share: 0.4,
    iterations: [],
    ...overrides,
  } as MeAllocationShareDTO;
}

describe('envelope handling', () => {
  it('treats a string payload as an error, not as data', () => {
    // The backend answers HTTP 200 with `data` as a message string on failure.
    // Rendering that as the payload is the silent-garbage failure mode.
    const response = new ApiResponse<string>('An unexpected error occurred', 3001);
    expect(isEnvelopeError(response)).toBe(true);
    expect(envelopeData(response)).toBeNull();
  });

  it('treats a non-zero error_code as an error even with a shaped payload', () => {
    const response = new ApiResponse<{ a: number } | string>({ a: 1 }, 42);
    expect(envelopeData(response)).toBeNull();
  });

  it('passes a success envelope through', () => {
    const response = new ApiResponse<{ a: number } | string>({ a: 1 }, 0);
    expect(envelopeData(response)).toEqual({ a: 1 });
  });
});

describe('readinessItems', () => {
  it('returns nothing when the community is in order', () => {
    expect(readinessItems(dashboard())).toEqual([]);
  });

  it('omits zero counters rather than listing them as findings', () => {
    const items = readinessItems(dashboard({ members: { ...dashboard().members, pending: 2 } }));
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('MEMBERS_PENDING');
  });

  it('links waiting meters to the matching status filter', () => {
    const items = readinessItems(
      dashboard({ meters: { ...dashboard().meters, waiting_grd: 3, waiting_manager: 1 } }),
    );

    const grd = items.find((i) => i.key === 'METERS_WAITING_GRD');
    const manager = items.find((i) => i.key === 'METERS_WAITING_MANAGER');
    expect(grd?.queryParams).toEqual({ status: MeterDataStatus.WAITING_GRD });
    expect(manager?.queryParams).toEqual({ status: MeterDataStatus.WAITING_MANAGER });
  });

  it('treats a sharing operation with no valid key as blocking', () => {
    const items = readinessItems(
      dashboard({
        sharing_operations: { ...dashboard().sharing_operations, without_valid_key: 1 },
      }),
    );
    expect(items[0].severity).toBe('blocking');
  });

  it('emits one row per missing community field, carrying its label key', () => {
    const items = readinessItems(
      dashboard({ legal_info: { missing_fields: ['vat_number', 'iban'], complete: false } }),
    );

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.fieldLabelKey)).toEqual([
      'DASHBOARD.MANAGER.READINESS.FIELDS.VAT_NUMBER',
      'DASHBOARD.MANAGER.READINESS.FIELDS.IBAN',
    ]);
  });

  it('never links a readiness row into a gated annexe', () => {
    const items = readinessItems(
      dashboard({
        members: { ...dashboard().members, incomplete: 1, pending: 1 },
        meters: { ...dashboard().meters, waiting_grd: 1, without_active_data: 1 },
        sharing_operations: {
          ...dashboard().sharing_operations,
          without_valid_key: 1,
          with_pending_key: 1,
        },
        legal_info: { missing_fields: ['iban'], complete: false },
      }),
    );

    // Every one of these is reachable with no subscription; an annexe link here
    // would bounce the manager off activeFeatureGuard to `/`.
    const CORE_ROUTES = ['/members', '/meters', '/sharing_operations', '/communities/info'];
    for (const item of items) {
      expect(item.link === null || CORE_ROUTES.includes(item.link)).toBe(true);
    }
  });
});

describe('severity', () => {
  it('reports the worst severity present', () => {
    expect(worstSeverity([])).toBe('ok');
    expect(
      worstSeverity(readinessItems(dashboard({ members: { ...dashboard().members, pending: 1 } }))),
    ).toBe('attention');
    expect(
      worstSeverity(
        readinessItems(
          dashboard({
            sharing_operations: { ...dashboard().sharing_operations, without_valid_key: 1 },
          }),
        ),
      ),
    ).toBe('blocking');
  });

  it('maps to PrimeNG tag severities', () => {
    expect(tagSeverity('blocking')).toBe('danger');
    expect(tagSeverity('attention')).toBe('warn');
    expect(tagSeverity('ok')).toBe('success');
  });
});

describe('legalFieldLabelKey', () => {
  it('derives the key from the field name so the two cannot drift', () => {
    expect(legalFieldLabelKey('account_holder_name')).toBe(
      'DASHBOARD.MANAGER.READINESS.FIELDS.ACCOUNT_HOLDER_NAME',
    );
  });
});

describe('UNPAID_INVOICE_STATUSES', () => {
  it('is the definition of unpaid, because the API has no such filter', () => {
    expect([...UNPAID_INVOICE_STATUSES]).toEqual([
      InvoiceStatus.ISSUED,
      InvoiceStatus.SENT,
      InvoiceStatus.OVERDUE,
    ]);
    expect(UNPAID_INVOICE_STATUSES).not.toContain(InvoiceStatus.PAID);
    expect(UNPAID_INVOICE_STATUSES).not.toContain(InvoiceStatus.DRAFT);
    expect(UNPAID_INVOICE_STATUSES).not.toContain(InvoiceStatus.CANCELLED);
  });
});

describe('shareDisplay', () => {
  it('shows the fraction when the key names the meter', () => {
    expect(shareDisplay(share())).toBe('share');
  });

  it('shows prorata rather than a number', () => {
    expect(shareDisplay(share({ is_prorata: true, effective_share: null }))).toBe('prorata');
  });

  it('distinguishes "not in the key" from a zero share', () => {
    // The whole reason `matched` exists: the key does not name this meter, which
    // is a fact about the key — not a statement that the member receives nothing.
    expect(shareDisplay(share({ matched: false, effective_share: null }))).toBe('unmatched');
  });

  it('reports a missing key separately from an unmatched one', () => {
    expect(shareDisplay(share({ key: null, matched: false, effective_share: null }))).toBe(
      'no_key',
    );
  });
});
