export type PersonColorClasses = {
  stripe: string;
  dot: string;
};

const personPalette = [
  { stripe: 'bg-slate-500/20 dark:bg-slate-400/15', dot: 'bg-slate-500' },
  { stripe: 'bg-emerald-500/20 dark:bg-emerald-400/15', dot: 'bg-emerald-500' },
  { stripe: 'bg-purple-500/20 dark:bg-purple-400/15', dot: 'bg-purple-500' },
  { stripe: 'bg-orange-500/20 dark:bg-orange-400/15', dot: 'bg-orange-500' },
  { stripe: 'bg-rose-500/20 dark:bg-rose-400/15', dot: 'bg-rose-500' },
  { stripe: 'bg-cyan-500/20 dark:bg-cyan-400/15', dot: 'bg-cyan-500' },
  { stripe: 'bg-amber-500/20 dark:bg-amber-400/15', dot: 'bg-amber-500' },
  { stripe: 'bg-indigo-500/20 dark:bg-indigo-400/15', dot: 'bg-indigo-500' },
] as const;

const hashSeed = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

export const getPersonSeedFromPerson = (person: any) => {
  return (
    person?.رقم_الشخص ??
    person?.الرقم_الوطني ??
    person?.رقم_الهاتف ??
    person?.الاسم ??
    ''
  );
};

export const getPersonColorClasses = (seed: unknown): PersonColorClasses => {
  const s = String(seed ?? '');
  const idx = hashSeed(s) % personPalette.length;
  return personPalette[idx];
};
