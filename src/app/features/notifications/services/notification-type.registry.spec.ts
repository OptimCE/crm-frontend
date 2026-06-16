import { DEFAULT_PRESENTATION, presentationFor } from './notification-type.registry';

describe('presentationFor', () => {
  it('maps known invitation types to an envelope icon and a route', () => {
    const member = presentationFor('member_invitation.received');
    expect(member.icon).toBe('pi pi-envelope');
    expect(member.route).toBe('/users/invitations');

    expect(presentationFor('manager_invitation.received').route).toBe('/users/invitations');
  });

  it('maps member/document types to their own icons without a route', () => {
    expect(presentationFor('member.updated').icon).toBe('pi pi-user-edit');
    expect(presentationFor('member.updated').route).toBeUndefined();
    expect(presentationFor('document.uploaded').icon).toBe('pi pi-file');
  });

  it('falls back to the default presentation for unknown types', () => {
    expect(presentationFor('something.unknown')).toBe(DEFAULT_PRESENTATION);
    expect(presentationFor('').icon).toBe('pi pi-bell');
  });
});
