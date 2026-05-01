export function cn(...classes: (string | boolean | undefined | null | {[key: string]: boolean})[]) {
  const result: string[] = [];
  
  classes.forEach(cls => {
    if (!cls) return;
    if (typeof cls === 'string') {
      result.push(cls);
    } else if (typeof cls === 'object') {
      Object.entries(cls).forEach(([key, value]) => {
        if (value) result.push(key);
      });
    }
  });
  
  return result.join(' ');
}
