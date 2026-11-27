import { mailtoHref, telHref } from './contact-links';

describe('telHref', () => {
  it.each([
    ['+32 470 12 34 56', 'tel:+32470123456'],
    ['0470 12 34 56', 'tel:0470123456'],
    ['04/123.45.67', 'tel:041234567'],
    ['+32 (0)2 123 45 67', 'tel:+32021234567'],
    ['  081-22-33-44  ', 'tel:081223344'],
  ])('turns %s into %s', (phone, href) => {
    expect(telHref(phone)).toBe(href);
  });
});

describe('mailtoHref', () => {
  it('prefixes the address', () => {
    expect(mailtoHref('contact@coteaux.be')).toBe('mailto:contact@coteaux.be');
  });

  it('drops surrounding spaces', () => {
    expect(mailtoHref('  contact@coteaux.be ')).toBe('mailto:contact@coteaux.be');
  });
});
