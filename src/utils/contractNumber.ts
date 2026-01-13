export const formatContractNumberShort = (id: string | null | undefined): string => {
  const raw = String(id ?? '').trim();
  if (!raw) return '';

  // New canonical format: cot_### (global sequential)
  const cot = /^cot_(\d+)$/i.exec(raw);
  if (cot) {
    const n = parseInt(cot[1], 10);
    if (!Number.isFinite(n) || n <= 0) return raw;
    return `cot_${String(n).padStart(3, '0')}`;
  }

  // Legacy canonical format: CNT-YYYYMMDD-###
  const m = /^CNT-(\d{8})-(\d{3})$/.exec(raw);
  if (!m) return raw;

  const yyyymmdd = m[1];
  const seq = m[2];
  const yymmdd = yyyymmdd.slice(2);
  return `${yymmdd}-${seq}`;
};
