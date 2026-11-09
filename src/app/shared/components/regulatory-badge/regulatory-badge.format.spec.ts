import { describe, expect, it } from 'vitest';

import { RegulatoryStatus, RegulatorySubjectType } from '../../dtos/regulatory-status.dtos';
import { regulatoryBadge } from './regulatory-badge.format';

const METER = RegulatorySubjectType.METER;
const KEY = RegulatorySubjectType.KEY;

describe('regulatoryBadge', () => {
  it.each([
    [RegulatoryStatus.TO_NOTIFY, null, null, 'REGULATORY.BADGE.METER.TO_NOTIFY', '', 'warn'],
    [RegulatoryStatus.PENDING_GRD, null, null, 'REGULATORY.BADGE.METER.PENDING_GRD', '', 'info'],
    [
      RegulatoryStatus.PENDING_REGULATOR,
      null,
      null,
      'REGULATORY.BADGE.METER.PENDING_REGULATOR',
      '',
      'info',
    ],
    [RegulatoryStatus.AUTHORIZED, null, null, 'REGULATORY.BADGE.METER.AUTHORIZED', '', 'info'],
    [
      RegulatoryStatus.AUTHORIZED,
      '2026-12-01',
      null,
      'REGULATORY.BADGE.METER.AUTHORIZED_FROM',
      '01/12/2026',
      'info',
    ],
    [
      RegulatoryStatus.ACTIVE,
      '2026-11-02',
      null,
      'REGULATORY.BADGE.METER.ACTIVE',
      '02/11/2026',
      'success',
    ],
    [RegulatoryStatus.ACTIVE, null, null, 'REGULATORY.BADGE.METER.ACTIVE_UNDATED', '', 'success'],
    [RegulatoryStatus.LEAVING, '2026-01-01', null, 'REGULATORY.BADGE.METER.LEAVING', '', 'warn'],
    [
      RegulatoryStatus.LEAVING,
      '2026-01-01',
      '2026-11-30',
      'REGULATORY.BADGE.METER.LEAVING_UNTIL',
      '30/11/2026',
      'warn',
    ],
    [
      RegulatoryStatus.ENDED,
      '2026-01-01',
      '2026-11-30',
      'REGULATORY.BADGE.METER.ENDED',
      '30/11/2026',
      'secondary',
    ],
    [RegulatoryStatus.REFUSED, null, null, 'REGULATORY.BADGE.METER.REFUSED', '', 'danger'],
  ])('a meter %s from %s to %s reads %s', (status, from, to, key, date, severity) => {
    expect(
      regulatoryBadge({ regulatory_status: status, valid_from: from, valid_to: to }, METER),
    ).toEqual({
      labelKey: key,
      date,
      severity,
    });
  });

  it('shows nothing for a subject the annexe does not track', () => {
    expect(regulatoryBadge(null, METER)).toBeNull();
    expect(regulatoryBadge({ regulatory_status: null }, METER)).toBeNull();
    expect(regulatoryBadge({ regulatory_status: 42 as RegulatoryStatus }, METER)).toBeNull();
  });

  it('shows nothing for a meter withdrawn before it was authorised', () => {
    expect(regulatoryBadge({ regulatory_status: RegulatoryStatus.WITHDRAWN }, METER)).toBeNull();
  });

  it('says a key keeps the previous one when its change was withdrawn', () => {
    expect(regulatoryBadge({ regulatory_status: RegulatoryStatus.WITHDRAWN }, KEY)?.labelKey).toBe(
      'REGULATORY.BADGE.KEY.WITHDRAWN',
    );
  });

  it('names a key that took effect, and one replaced', () => {
    expect(
      regulatoryBadge(
        { regulatory_status: RegulatoryStatus.AUTHORIZED, valid_from: '2026-12-01' },
        KEY,
      ),
    ).toEqual({
      labelKey: 'REGULATORY.BADGE.KEY.AUTHORIZED_FROM',
      date: '01/12/2026',
      severity: 'info',
    });
    expect(
      regulatoryBadge(
        {
          regulatory_status: RegulatoryStatus.ENDED,
          valid_from: '2026-01-01',
          valid_to: '2026-11-30',
        },
        KEY,
      )?.labelKey,
    ).toBe('REGULATORY.BADGE.KEY.ENDED');
  });
});
