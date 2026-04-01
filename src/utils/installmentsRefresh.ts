/**
 * يُستدعى بعد تعديل الكمبيالات (سداد، عكس، غرامة، إلخ)
 * لإعادة تحميل صفحة الدفعات ومواءمة البطاقات مع التصفية دون الاعتماد على توقيت عشوائي.
 */
export function notifyInstallmentsDataChanged(): void {
  try {
    window.dispatchEvent(new Event('azrar:installments-changed'));
  } catch {
    // ignore
  }
}
