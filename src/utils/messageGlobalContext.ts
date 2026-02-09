type SystemSettingsForMessages = Partial<{
  companyName: string;
  companySlogan: string;
  companyAddress: string;
  companyPhone: string;
  companyPhones: string[];
  companyEmail: string;
  companyWebsite: string;
  paymentMethods: string[];
  whatsAppTarget: 'web' | 'desktop' | 'auto';
  whatsAppDelayMs: number;
}>;

const safeParseJsonRecord = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const readSystemSettingsForMessages = (): SystemSettingsForMessages => {
  if (typeof window === 'undefined') return {};
  const rec = safeParseJsonRecord(localStorage.getItem('db_settings'));
  if (!rec) return {};
  return rec as unknown as SystemSettingsForMessages;
};

export const getMessageGlobalContext = (): Record<string, string> => {
  const s = readSystemSettingsForMessages();

  const companyName = String(s.companyName || '').trim();
  const companyPhone = String(s.companyPhone || '').trim();
  const companyPhones = Array.isArray(s.companyPhones)
    ? s.companyPhones.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const paymentMethods = Array.isArray(s.paymentMethods)
    ? s.paymentMethods.map((x) => String(x || '').trim()).filter(Boolean)
    : [];

  const joinLines = (arr: string[]): string => arr.join('\n');
  const joinComma = (arr: string[]): string => arr.join('، ');

  return {
    // English-ish keys (common)
    companyName,
    companyPhone,
    companyPhones: joinLines(companyPhones),
    companyPhonesComma: joinComma(companyPhones),
    paymentMethods: joinLines(paymentMethods),
    paymentMethodsComma: joinComma(paymentMethods),

    // Arabic aliases (to be usable inside Arabic templates)
    اسم_الشركة: companyName,
    هاتف_الشركة: companyPhone,
    هواتف_الشركة: joinLines(companyPhones),
    هواتف_الشركة_سطر_واحد: joinComma(companyPhones),
    طرق_الدفع: joinLines(paymentMethods),
    طرق_الدفع_سطر_واحد: joinComma(paymentMethods),
  };
};

export const injectMessageGlobalVariables = (
  input: string,
  extraContext?: Record<string, unknown>
): string => {
  const content = String(input ?? '');
  if (!content.includes('{{')) return content;

  const global = getMessageGlobalContext();
  const merged: Record<string, unknown> = { ...global, ...(extraContext || {}) };

  return content.replace(/\{\{\s*([\w\u0600-\u06FF]+)\s*\}\}/g, (match, key) => {
    const value = merged[key];
    if (value === undefined || value === null) return match;
    if (typeof value === 'number') return value.toLocaleString('en-US');
    return String(value);
  });
};
