import { getActivities, addActivity } from '@/services/db/system/activities';
import * as kv from '@/services/db/kv';
import { KEYS } from '@/services/db/keys';
import { buildCache } from '@/services/dbCache';

describe('Activities System Service - Audit Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    buildCache();
  });

  test('addActivity and getActivities - persists and filters audit logs', () => {
    addActivity({ 
      referenceId: 'P1', 
      referenceType: 'Person', 
      user: 'Admin', 
      action: 'Login', 
      description: 'User logged in' 
    });
    
    addActivity({ 
      referenceId: 'C1', 
      referenceType: 'Contract', 
      user: 'Admin', 
      action: 'Sign', 
      description: 'Contract signed' 
    });

    const personActivities = getActivities('P1', 'Person');
    expect(personActivities).toHaveLength(1);
    expect(personActivities[0].description).toBe('User logged in');
    expect(personActivities[0].id).toContain('ACT-');
    expect(personActivities[0].createdAt).toBeDefined();

    const contractActivities = getActivities('C1', 'Contract');
    expect(contractActivities).toHaveLength(1);
    expect(contractActivities[0].description).toBe('Contract signed');
  });

  test('getActivities - returns empty array if no matches found', () => {
    const results = getActivities('NON_EXISTENT', 'Generic');
    expect(results).toHaveLength(0);
  });
});
