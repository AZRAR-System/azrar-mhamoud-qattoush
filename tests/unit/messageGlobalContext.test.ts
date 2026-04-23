import { getMessageGlobalContext, injectMessageGlobalVariables } from '@/utils/messageGlobalContext';

describe('Message Global Context - Template Injection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('getMessageGlobalContext - returns default empty values', () => {
    const ctx = getMessageGlobalContext();
    expect(ctx.companyName).toBe('');
    expect(ctx.اسم_الشركة).toBe('');
  });

  test('getMessageGlobalContext - reads from localStorage', () => {
    localStorage.setItem('db_settings', JSON.stringify({
      companyName: 'Azrar Real Estate',
      companyPhone: '0791234567',
      paymentMethods: ['Cash', 'Bank Transfer']
    }));
    
    const ctx = getMessageGlobalContext();
    expect(ctx.companyName).toBe('Azrar Real Estate');
    expect(ctx.paymentMethods).toContain('Cash');
    expect(ctx.paymentMethods).toContain('Bank Transfer');
  });

  test('injectMessageGlobalVariables - replaces placeholders', () => {
    localStorage.setItem('db_settings', JSON.stringify({ companyName: 'Azrar' }));
    
    const template = 'Welcome to {{ companyName }}';
    const res = injectMessageGlobalVariables(template);
    expect(res).toBe('Welcome to Azrar');
  });

  test('injectMessageGlobalVariables - supports Arabic keys', () => {
    localStorage.setItem('db_settings', JSON.stringify({ companyName: 'أزرار' }));
    
    const template = 'مرحباً بكم في {{ اسم_الشركة }}';
    const res = injectMessageGlobalVariables(template);
    expect(res).toBe('مرحباً بكم في أزرار');
  });

  test('injectMessageGlobalVariables - supports extraContext', () => {
    const template = 'Hello {{ name }}';
    const res = injectMessageGlobalVariables(template, { name: 'Mhamoud' });
    expect(res).toBe('Hello Mhamoud');
  });

  test('injectMessageGlobalVariables - handles missing variables gracefully', () => {
    const template = 'Hello {{ missing }}';
    const res = injectMessageGlobalVariables(template);
    expect(res).toBe('Hello {{ missing }}');
  });
});
