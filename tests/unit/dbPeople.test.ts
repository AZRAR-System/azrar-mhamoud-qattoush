import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { addPerson, getPersonById, updatePerson } from '@/services/db/people';
import { installMemoryLocalStorage, resetKvAndCache } from '../helpers/kvTestEnv';

const validPerson = {
  الاسم: 'مختبر',
  رقم_الهاتف: '0791234567',
};

beforeAll(() => {
  installMemoryLocalStorage();
});

beforeEach(() => {
  resetKvAndCache();
});

describe('db/people', () => {
  it('getPersonById returns undefined when missing', () => {
    expect(getPersonById('P-none')).toBeUndefined();
  });

  it('addPerson then getPersonById returns the record', () => {
    const res = addPerson(validPerson, ['مستأجر']);
    expect(res.success).toBe(true);
    const id = res.data!.رقم_الشخص;
    const found = getPersonById(id);
    expect(found?.الاسم).toBe('مختبر');
    expect(found?.رقم_الهاتف).toBe('0791234567');
  });

  it('updatePerson mutates stored person', () => {
    const { data } = addPerson(validPerson, []);
    const id = data!.رقم_الشخص;
    const upd = updatePerson(id, { الاسم: 'محدّث' });
    expect(upd.success).toBe(true);
    expect(getPersonById(id)?.الاسم).toBe('محدّث');
  });

  it('addPerson rejects invalid payload', () => {
    const res = addPerson({ الاسم: '', رقم_الهاتف: '0791234567' }, []);
    expect(res.success).toBe(false);
  });
});
