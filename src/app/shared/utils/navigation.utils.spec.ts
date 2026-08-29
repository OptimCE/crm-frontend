import { sanitizeReturnUrl } from './navigation.utils';

describe('sanitizeReturnUrl', () => {
  it('should accept an in-app absolute path', () => {
    expect(sanitizeReturnUrl('/sharing_operations/7')).toBe('/sharing_operations/7');
  });

  it('should keep a query string on an in-app path', () => {
    expect(sanitizeReturnUrl('/keys?page=2')).toBe('/keys?page=2');
  });

  it('should reject a protocol-relative URL', () => {
    expect(sanitizeReturnUrl('//evil.com')).toBeNull();
  });

  it('should reject an absolute URL', () => {
    expect(sanitizeReturnUrl('https://evil.com')).toBeNull();
  });

  it('should reject a relative path that could resolve anywhere', () => {
    expect(sanitizeReturnUrl('keys/add')).toBeNull();
  });

  it('should reject a javascript: URL', () => {
    expect(sanitizeReturnUrl('javascript:alert(1)')).toBeNull();
  });

  it('should return null for a missing value', () => {
    expect(sanitizeReturnUrl(null)).toBeNull();
  });

  it('should return null for an empty string', () => {
    expect(sanitizeReturnUrl('')).toBeNull();
  });
});
