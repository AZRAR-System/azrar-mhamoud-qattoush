/**
 * AZRAR Coverage Strike: Pushing to 70%+ (Aggressive V3)
 * Target Modules: storage, domainQueries, mockDb, localDbStorage, dataValidation
 */
import { jest, describe, it, expect } from '@jest/globals';
import { DbService } from '@/services/mockDb';
import { KEYS } from '@/services/db/keys';
import { save } from '@/services/db/kv';
import { auditLog } from '@/services/auditLog';
import * as DomainQueries from '@/services/domainQueries';
import * as Reports from '@/services/db/system/reports';
import * as DataValidation from '@/services/dataValidation';
import { storage } from '@/services/storage';
import { dbOk, dbFail, localDbStorage } from '@/services/localDbStorage';

describe('Coverage Strike - 70% Final Push', () => {

  describe('Storage & UI Notifications', () => {
    it('exercises async storage methods in Web Mode', async () => {
      await storage.setItem('test_async', 'val');
      const val = await storage.getItem('test_async');
      expect(val).toBe('val');
      await storage.removeItem('test_async');
      expect(await storage.getItem('test_async')).toBeNull();
    });

    it('triggers UI change events for special keys', async () => {
      const spy = jest.fn();
      window.addEventListener('azrar:marquee-changed', spy);
      await storage.setItem('db_marquee', '[]');
      expect(spy).toHaveBeenCalled();
      
      const spyTasks = jest.fn();
      window.addEventListener('azrar:tasks-changed', spyTasks);
      await storage.setItem('db_test', '[]');
      expect(spyTasks).toHaveBeenCalled();
    });
  });

  describe('Data Validation & Local Storage', () => {
    it('exercises dbOk/dbFail and localDbStorage', () => {
      expect(dbOk({x:1}).success).toBe(true);
      expect(dbFail('Err').success).toBe(false);

      const spySet = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
      localDbStorage.saveJson('k', {v:1});
      expect(spySet).toHaveBeenCalled();
      spySet.mockRestore();
    });

    it('performs exhaustive data audits', () => {
      const emptyAudit = DataValidation.validateAllData();
      expect(emptyAudit.isValid).toBe(true);

      // Trigger duplicates
      save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1' }, { رقم_الشخص: 'P1' }]);
      const dupAudit = DataValidation.checkPrimaryKeyDuplicates();
      expect(dupAudit.isValid).toBe(false);
      expect(dupAudit.errors[0]).toContain('تكرار');
    });
  });

  describe('Domain Queries Helper & Fallbacks', () => {
    it('exercises internal cast helpers', async () => {
       // We can't reach internal exports directly if not exported, 
       // but we can trigger them via public methods.
       await DomainQueries.deletePersonSmart(''); // Empty ID coverage
       await DomainQueries.updatePropertySmart('', {}); // Empty ID coverage
    });

    it('exercises search variants', async () => {
      save(KEYS.PEOPLE, [{ رقم_الشخص: 'P1', الاسم: 'John Doe', رقم_الهاتف: '079' }]);
      save(KEYS.PROPERTIES, [{ رقم_العقار: 'PR1', الكود_الداخلي: 'ST-101' }]);
      
      const resGlobal = await DomainQueries.domainSearchGlobalSmart('John');
      expect(resGlobal.people).toHaveLength(1);

      const resProps = await DomainQueries.domainSearchSmart('properties', 'ST');
      expect(resProps).toHaveLength(1);
    });
  });

  describe('MockDB & System Ops', () => {
    it('exercises reset and optimization', () => {
      expect(() => DbService.resetAllData()).not.toThrow();
      expect(DbService.optimizeSystem().success).toBe(true);
      expect(DbService.getDatabaseStatus().size).toBeDefined();
    });

    it('manages lookups', () => {
      save(KEYS.LOOKUP_CATEGORIES, [{ id: 'CAT1', name: 'Cat' }]);
      expect(DbService.getLookupCategories()).toHaveLength(1);
      
      save(KEYS.LOOKUPS, [{ id: 'L1', category: 'CAT1', value: 'V' }]);
      expect(DbService.getLookupsByCategory('CAT1')).toHaveLength(1);
    });
  });

});
