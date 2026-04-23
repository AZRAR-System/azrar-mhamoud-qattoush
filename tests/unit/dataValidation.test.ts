import { validateBeforeSave } from '@/services/db/schemas';
import { KEYS } from '@/services/db/keys';

describe('Data Validation - KV Guard', () => {
  test('validateBeforeSave - identifies invalid people data', () => {
    const invalidPerson = { رقم_الشخص: 'P1' }; 
    const result = validateBeforeSave(KEYS.PEOPLE, [invalidPerson]);
    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  test('validateBeforeSave - identifies invalid contract data', () => {
    const invalidContract = { رقم_العقد: 'C1' };
    const result = validateBeforeSave(KEYS.CONTRACTS, [invalidContract]);
    expect(result.valid).toBe(false);
  });

  test('validateBeforeSave - allows valid data', () => {
    const validPerson = { رقم_الشخص: 'P1', الاسم: 'John', رقم_الهاتف: '123' };
    const result = validateBeforeSave(KEYS.PEOPLE, [validPerson]);
    expect(result.valid).toBe(true);
  });

  test('validateBeforeSave - passes through keys without schemas', () => {
    const result = validateBeforeSave('random_key', { foo: 'bar' });
    expect(result.valid).toBe(true);
  });
});
