/**
 * Only same-origin app paths are accepted as a return target, so a crafted `returnUrl` cannot turn a
 * flow that honours it into an open redirect. `//evil.com` is a protocol-relative URL, hence the
 * explicit second-character check.
 */
export function sanitizeReturnUrl(raw: string | null): string | null {
  if (!raw) return null;
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : null;
}
