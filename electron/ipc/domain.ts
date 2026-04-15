import type { IpcDeps } from './deps.js';
import * as ipc from './context.js';
import { ipcMain } from 'electron';
import {
  domainMigrateFromKvIfNeeded,
  domainRebuildFromKv,
  domainStatus,
  domainCounts,
  runSqlReport,
  domainSearchGlobal,
  domainSearch,
  domainGetEntityById,
  domainPropertyPickerSearch,
  domainContractPickerSearch,
  domainPeoplePickerSearch,
  domainInstallmentsContractsSearch,
  domainDashboardSummary,
  domainDashboardPerformance,
  domainDashboardHighlights,
  domainPaymentNotificationTargets,
  domainContractDetails,
  domainPersonDetails,
  domainPersonTenancyContracts,
  domainPropertyContracts,
} from '../db';
import { toErrorMessage } from '../utils/errors';
import { isRecord } from '../utils/unknown';

export function registerDomain(deps: IpcDeps): void {
  void deps;
  ipcMain.handle('domain:status', () => {
    try {
      return { ok: true, ...domainStatus() };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'تعذر قراءة حالة الجداول') };
    }
  });
  
  ipcMain.handle('domain:migrate', () => {
    try {
      return domainMigrateFromKvIfNeeded();
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل الترحيل') };
    }
  });
  
  ipcMain.handle('domain:rebuildFromKv', () => {
    try {
      return domainRebuildFromKv();
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل إعادة بناء الجداول من التخزين المحلي') };
    }
  });
  
  ipcMain.handle('reports:run', (_e, payload: unknown) => {
    try {
      const id = ipc.getStringField(payload, 'id').trim();
      if (!id) return { ok: false, message: 'معرّف التقرير غير صالح' };
      return runSqlReport(id);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل توليد التقرير') };
    }
  });
  
  ipcMain.handle('domain:searchGlobal', (_e, payload: unknown) => {
    try {
      const q = ipc.trimString(ipc.getStringField(payload, 'query'), 128, 'نص البحث');
      return domainSearchGlobal(q);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل البحث') };
    }
  });
  
  ipcMain.handle('domain:search', (_e, payload: unknown) => {
    try {
      const entityRaw = ipc.getStringField(payload, 'entity').trim();
      const entity: ipc.DomainEntity | null = ipc.isDomainEntity(entityRaw) ? entityRaw : null;
      if (!entity) return { ok: false, message: 'نوع البحث غير مدعوم' };
  
      const q = ipc.trimString(ipc.getStringField(payload, 'query'), 128, 'نص البحث');
      const limit = ipc.getOptionalNumberField(payload, 'limit');
      return domainSearch(entity, q, limit);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل البحث') };
    }
  });
  
  ipcMain.handle('domain:get', (_e, payload: unknown) => {
    try {
      const entityRaw = ipc.getStringField(payload, 'entity').trim();
      const entity: ipc.DomainEntity | null = ipc.isDomainEntity(entityRaw) ? entityRaw : null;
      if (!entity) return { ok: false, message: 'نوع غير مدعوم' };
      const id = ipc.trimString(ipc.getStringField(payload, 'id'), 128, 'المعرف');
      return domainGetEntityById(entity, id);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل قراءة البيانات') };
    }
  });
  
  ipcMain.handle('domain:counts', () => {
    try {
      return domainCounts();
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل قراءة الأعداد') };
    }
  });
  
  ipcMain.handle('domain:dashboard:summary', (_e, payload: unknown) => {
    try {
      const todayYMD = ipc.trimString(ipc.getStringField(payload, 'todayYMD'), 10, 'تاريخ اليوم');
      const weekYMD = ipc.trimString(ipc.getStringField(payload, 'weekYMD'), 10, 'تاريخ الأسبوع');
      return domainDashboardSummary({ todayYMD, weekYMD });
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل ملخص لوحة التحكم') };
    }
  });
  
  ipcMain.handle('domain:dashboard:performance', (_e, payload: unknown) => {
    try {
      const monthKey = ipc.trimString(ipc.getStringField(payload, 'monthKey'), 7, 'شهر');
      const prevMonthKey = ipc.trimString(ipc.getStringField(payload, 'prevMonthKey'), 7, 'شهر سابق');
      return domainDashboardPerformance({ monthKey, prevMonthKey });
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل الأداء المالي') };
    }
  });
  
  ipcMain.handle('domain:dashboard:highlights', (_e, payload: unknown) => {
    try {
      const todayYMD = ipc.trimString(ipc.getStringField(payload, 'todayYMD'), 10, 'تاريخ اليوم');
      return domainDashboardHighlights({ todayYMD });
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل مؤشرات لوحة التحكم') };
    }
  });
  
  ipcMain.handle('domain:notifications:paymentTargets', (_e, payload: unknown) => {
    try {
      const daysAhead = Math.max(
        1,
        Math.min(60, Math.trunc(Number(ipc.getField(payload, 'daysAhead')) || 7))
      );
      const todayYmdRaw = ipc.getStringField(payload, 'todayYMD');
      const todayYMD = todayYmdRaw ? ipc.trimString(todayYmdRaw, 10, 'تاريخ اليوم') : undefined;
      return domainPaymentNotificationTargets({ daysAhead, todayYMD });
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل إشعارات الدفعات') };
    }
  });
  
  ipcMain.handle('domain:person:details', (_e, payload: unknown) => {
    try {
      const personId = String(ipc.getField(payload, 'personId') ?? payload ?? '').trim();
      if (!personId) return { ok: false, message: 'معرف غير صالح' };
      return domainPersonDetails(personId);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل قراءة بيانات الشخص') };
    }
  });
  
  ipcMain.handle('domain:person:tenancyContracts', (_e, payload: unknown) => {
    try {
      const personId = String(ipc.getField(payload, 'personId') ?? payload ?? '').trim();
      if (!personId) return { ok: false, message: 'معرف غير صالح' };
      return domainPersonTenancyContracts(personId);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل جلب عقود الشخص') };
    }
  });
  
  ipcMain.handle('domain:property:contracts', (_e, payload: unknown) => {
    try {
      const propertyId = String(ipc.getField(payload, 'propertyId') ?? payload ?? '').trim();
      if (!propertyId) return { ok: false, message: 'معرف غير صالح' };
      const limit = ipc.getOptionalNumberField(payload, 'limit');
      return domainPropertyContracts(propertyId, limit);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل قراءة عقود العقار') };
    }
  });
  
  ipcMain.handle('domain:contract:details', (_e, payload: unknown) => {
    try {
      const contractId = String(ipc.getField(payload, 'contractId') ?? payload ?? '').trim();
      if (!contractId) return { ok: false, message: 'معرف غير صالح' };
      return domainContractDetails(contractId);
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل تفاصيل العقد') };
    }
  });
  
  // Fast-mode helpers for legacy arrays (read-only / targeted scans)
  ipcMain.handle('domain:ownership:history', (_e, payload: unknown) => {
    try {
      const propertyId = String(ipc.getField(payload, 'propertyId') ?? '').trim();
      const personId = String(ipc.getField(payload, 'personId') ?? '').trim();
  
      const all = ipc.kvGetArray(ipc.DB_KEYS.OWNERSHIP_HISTORY);
      const items = all.filter((row) => {
        const rec = isRecord(row) ? row : null;
        if (!rec) return false;
        if (propertyId) return String(rec['رقم_العقار'] ?? '').trim() === propertyId;
        if (personId) {
          const oldId = String(rec['رقم_المالك_القديم'] ?? '').trim();
          const newId = String(rec['رقم_المالك_الجديد'] ?? '').trim();
          return oldId === personId || newId === personId;
        }
        return true;
      });
  
      return { ok: true, items };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل سجل الملكية') };
    }
  });
  
  ipcMain.handle('domain:property:inspections', (_e, payload: unknown) => {
    try {
      const propertyId = String(ipc.getField(payload, 'propertyId') ?? payload ?? '').trim();
      if (!propertyId) return { ok: false, message: 'معرف غير صالح' };
      const all = ipc.kvGetArray(ipc.DB_KEYS.INSPECTIONS);
      const items = all
        .filter((row) => {
          const rec = isRecord(row) ? row : null;
          if (!rec) return false;
          return String(rec['propertyId'] ?? '').trim() === propertyId;
        })
        .slice()
        .sort((a, b) => {
          const aa = isRecord(a) ? String(a['inspectionDate'] ?? '').trim() : '';
          const bb = isRecord(b) ? String(b['inspectionDate'] ?? '').trim() : '';
          return bb.localeCompare(aa);
        });
      return { ok: true, items };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل الكشوفات') };
    }
  });
  
  ipcMain.handle('domain:sales:person', (_e, payload: unknown) => {
    try {
      const personId = String(ipc.getField(payload, 'personId') ?? payload ?? '').trim();
      if (!personId) return { ok: false, message: 'معرف غير صالح' };
  
      const listings = ipc.kvGetArray(ipc.DB_KEYS.SALES_LISTINGS);
      const agreements = ipc.kvGetArray(ipc.DB_KEYS.SALES_AGREEMENTS);
  
      const listingsById = new Map<string, unknown>();
      for (const l of listings) {
        if (!isRecord(l)) continue;
        const id = String(l['id'] ?? '').trim();
        if (!id) continue;
        listingsById.set(id, l);
      }
  
      const listingsForOwner = listings.filter(
        (l) => isRecord(l) && String(l['رقم_المالك'] ?? '').trim() === personId
      );
  
      const agreementsForPerson = agreements.filter((a) => {
        const rec = isRecord(a) ? a : null;
        if (!rec) return false;
        const buyer = String(rec['رقم_المشتري'] ?? '').trim();
        if (buyer === personId) return true;
        const seller = String(rec['رقم_البائع'] ?? '').trim();
        if (seller === personId) return true;
        const listingId = String(rec['listingId'] ?? '').trim();
        const l = listingId ? listingsById.get(listingId) : undefined;
        if (isRecord(l)) {
          const owner = String(l['رقم_المالك'] ?? '').trim();
          if (owner === personId) return true;
        }
        return false;
      });
  
      return { ok: true, listings: listingsForOwner, agreements: agreementsForPerson };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل بيانات البيع') };
    }
  });
  
  ipcMain.handle('domain:sales:property', (_e, payload: unknown) => {
    try {
      const propertyId = String(ipc.getField(payload, 'propertyId') ?? payload ?? '').trim();
      if (!propertyId) return { ok: false, message: 'معرف غير صالح' };
  
      const listings = ipc.kvGetArray(ipc.DB_KEYS.SALES_LISTINGS);
      const agreements = ipc.kvGetArray(ipc.DB_KEYS.SALES_AGREEMENTS);
  
      const listingsById = new Map<string, unknown>();
      for (const l of listings) {
        if (!isRecord(l)) continue;
        const id = String(l['id'] ?? '').trim();
        if (!id) continue;
        listingsById.set(id, l);
      }
  
      const listingsForProperty = listings
        .filter((l) => isRecord(l) && String(l['رقم_العقار'] ?? '').trim() === propertyId)
        .slice()
        .sort((a, b) => {
          const aa = isRecord(a) ? String(a['تاريخ_العرض'] ?? '').trim() : '';
          const bb = isRecord(b) ? String(b['تاريخ_العرض'] ?? '').trim() : '';
          return bb.localeCompare(aa);
        });
  
      const agreementsForProperty = agreements
        .map((a) => {
          const rec = isRecord(a) ? a : null;
          if (!rec) return null;
          const listingId = String(rec['listingId'] ?? '').trim();
          const listing = listingId ? listingsById.get(listingId) : undefined;
          const propId = String(
            rec['رقم_العقار'] ?? (isRecord(listing) ? listing['رقم_العقار'] : '') ?? ''
          ).trim();
          if (propId !== propertyId) return null;
          const sellerId = String(
            rec['رقم_البائع'] ?? (isRecord(listing) ? listing['رقم_المالك'] : '') ?? ''
          ).trim();
          return { a, propId, sellerId, listing };
        })
        .filter((x) => x !== null);
  
      return { ok: true, listings: listingsForProperty, agreements: agreementsForProperty };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل اتفاقيات البيع') };
    }
  });
  
  // Mutations for details panels
  ipcMain.handle('domain:blacklist:remove', (_e, payload: unknown) => {
    try {
      const id = String(ipc.getField(payload, 'id') ?? payload ?? '').trim();
      if (!id) return { ok: false, message: 'معرف غير صالح' };
      const all = ipc.kvGetArray(ipc.DB_KEYS.BLACKLIST);
      let changed = false;
  
      const next = all.map((row) => {
        if (!isRecord(row)) return row;
        if (id.startsWith('BL-')) {
          if (String(row['id'] ?? '').trim() !== id) return row;
        } else {
          const pid = String(row['personId'] ?? '').trim();
          const active = Boolean(row['isActive']);
          if (pid !== id || !active) return row;
        }
        changed = true;
        return { ...row, isActive: false };
      });
  
      if (changed) ipc.kvSetArray(ipc.DB_KEYS.BLACKLIST, next);
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل رفع الحظر') };
    }
  });
  
  ipcMain.handle('domain:people:delete', (_e, payload: unknown) => {
    try {
      const personId = String(ipc.getField(payload, 'personId') ?? payload ?? '').trim();
      if (!personId) return { ok: false, message: 'معرف غير صالح' };
  
      const props = ipc.kvGetArray(ipc.DB_KEYS.PROPERTIES);
      const hasOwnedProps = props.some(
        (p) => isRecord(p) && String(p['رقم_المالك'] ?? '').trim() === personId
      );
      if (hasOwnedProps) return { ok: false, message: 'لا يمكن حذف المالك لوجود عقارات مرتبطة به' };
  
      const contracts = ipc.kvGetArray(ipc.DB_KEYS.CONTRACTS);
      const hasContracts = contracts.some(
        (c) => isRecord(c) && String(c['رقم_المستاجر'] ?? '').trim() === personId
      );
      if (hasContracts) return { ok: false, message: 'لا يمكن حذف الشخص لوجود عقود مرتبطة به' };
  
      const people = ipc.kvGetArray(ipc.DB_KEYS.PEOPLE);
      const nextPeople = people.filter(
        (p) => !(isRecord(p) && String(p['رقم_الشخص'] ?? '').trim() === personId)
      );
      ipc.kvSetArray(ipc.DB_KEYS.PEOPLE, nextPeople);
  
      const roles = ipc.kvGetArray(ipc.DB_KEYS.ROLES);
      const nextRoles = roles.filter(
        (r) => !(isRecord(r) && String(r['رقم_الشخص'] ?? '').trim() === personId)
      );
      ipc.kvSetArray(ipc.DB_KEYS.ROLES, nextRoles);
  
      // Best-effort: deactivate any active blacklist records for the person.
      const bl = ipc.kvGetArray(ipc.DB_KEYS.BLACKLIST);
      const nextBl = bl.map((row) => {
        if (!isRecord(row)) return row;
        if (String(row['personId'] ?? '').trim() !== personId) return row;
        if (!row['isActive']) return row;
        return { ...row, isActive: false };
      });
      ipc.kvSetArray(ipc.DB_KEYS.BLACKLIST, nextBl);
  
      return { ok: true, message: 'تم حذف الشخص' };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل حذف الشخص') };
    }
  });
  
  ipcMain.handle('domain:property:update', (_e, payload: unknown) => {
    try {
      const propertyId = String(ipc.getField(payload, 'propertyId') ?? payload ?? '').trim();
      if (!propertyId) return { ok: false, message: 'معرف غير صالح' };
      const patchRaw = ipc.getField(payload, 'patch');
      const patch = isRecord(patchRaw) ? patchRaw : {};
  
      const all = ipc.kvGetArray(ipc.DB_KEYS.PROPERTIES);
      let updated: unknown = null;
      const next = all.map((row) => {
        if (!isRecord(row)) return row;
        if (String(row['رقم_العقار'] ?? '').trim() !== propertyId) return row;
  
        const patch2: Record<string, unknown> = { ...patch };
        if (typeof patch2['حالة_العقار'] === 'string' && patch2['IsRented'] === undefined) {
          patch2['IsRented'] = String(patch2['حالة_العقار']) === 'مؤجر';
        }
  
        const merged = ipc.mergeRecords(row, patch2);
        updated = merged;
        return merged;
      });
  
      if (!updated) return { ok: false, message: 'العقار غير موجود' };
      ipc.kvSetArray(ipc.DB_KEYS.PROPERTIES, next);
      return { ok: true, data: updated };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحديث العقار') };
    }
  });
  
  ipcMain.handle('domain:followups:add', (_e, payload: unknown) => {
    try {
      const taskRaw = ipc.getField(payload, 'task');
      if (!isRecord(taskRaw)) return { ok: false, message: 'بيانات غير صالحة' };
      const task = taskRaw;
  
      const id = `FUP-${Date.now()}`;
      const nowIso = new Date().toISOString();
  
      // Link general tasks to reminders for unified notifications/alerts (best-effort).
      let reminderId = String(task['reminderId'] ?? '').trim();
      const type = String(task['type'] ?? '').trim();
      const dueDate = String(task['dueDate'] ?? '').trim();
      const title = String(task['task'] ?? '').trim();
  
      if (!reminderId && type === 'Task' && dueDate && title) {
        const reminders = ipc.kvGetArray(ipc.DB_KEYS.REMINDERS);
        reminderId = `REM-${Date.now()}`;
        const nextReminders = [
          ...reminders,
          { ...task, id: reminderId, title, date: dueDate, isDone: false },
        ];
        ipc.kvSetArray(ipc.DB_KEYS.REMINDERS, nextReminders);
      }
  
      const followups = ipc.kvGetArray(ipc.DB_KEYS.FOLLOW_UPS);
      const nextFollowups = [
        ...followups,
        {
          ...task,
          id,
          status: 'Pending',
          reminderId: reminderId || undefined,
          createdAt: String(task['createdAt'] ?? nowIso),
          updatedAt: nowIso,
        },
      ];
      ipc.kvSetArray(ipc.DB_KEYS.FOLLOW_UPS, nextFollowups);
  
      return { ok: true, id, reminderId: reminderId || undefined };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل إضافة المتابعة') };
    }
  });
  
  ipcMain.handle('domain:inspection:delete', (_e, payload: unknown) => {
    try {
      const id = String(ipc.getField(payload, 'id') ?? payload ?? '').trim();
      if (!id) return { ok: false, message: 'معرف غير صالح' };
      const all = ipc.kvGetArray(ipc.DB_KEYS.INSPECTIONS);
      const next = all.filter((row) => !(isRecord(row) && String(row['id'] ?? '').trim() === id));
      ipc.kvSetArray(ipc.DB_KEYS.INSPECTIONS, next);
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل حذف الكشف') };
    }
  });
  
  ipcMain.handle('domain:sales:agreement:delete', (_e, payload: unknown) => {
    try {
      const id = String(ipc.getField(payload, 'id') ?? payload ?? '').trim();
      if (!id) return { ok: false, message: 'معرف غير صالح' };
  
      const agreements = ipc.kvGetArray(ipc.DB_KEYS.SALES_AGREEMENTS);
      const nowIso = new Date().toISOString();
      const nextAgreements = agreements.map((row) => {
        if (!(isRecord(row) && String(row['id'] ?? '').trim() === id)) return row;
        return { ...row, isArchived: true, archivedAt: nowIso };
      });
      ipc.kvSetArray(ipc.DB_KEYS.SALES_AGREEMENTS, nextAgreements);
  
      // Best-effort cleanup: remove associated external commission records if present.
      const commissions = ipc.kvGetArray(ipc.DB_KEYS.EXTERNAL_COMMISSIONS);
      const nextCommissions = commissions.filter((row) => {
        if (!isRecord(row)) return true;
        const agreementId = String(row['agreementId'] ?? row['salesAgreementId'] ?? '').trim();
        return agreementId !== id;
      });
      if (nextCommissions.length !== commissions.length)
        ipc.kvSetArray(ipc.DB_KEYS.EXTERNAL_COMMISSIONS, nextCommissions);
  
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل حذف اتفاقية البيع') };
    }
  });
  
  ipcMain.handle('domain:picker:properties', (_e, payload: unknown) => {
    try {
      const q = ipc.trimString(ipc.getStringField(payload, 'query'), 128, 'نص البحث');
      const status = ipc.trimString(ipc.getStringField(payload, 'status'), 64, 'الحالة');
      const type = ipc.trimString(ipc.getStringField(payload, 'type'), 64, 'النوع');
      const furnishing = ipc.trimString(ipc.getStringField(payload, 'furnishing'), 64, 'صفة العقار');
      const forceVacant = Boolean(ipc.getField(payload, 'forceVacant'));
      const occupancy = ipc.trimString(ipc.getStringField(payload, 'occupancy'), 16, 'الإشغال');
      const sale = ipc.trimString(ipc.getStringField(payload, 'sale'), 16, 'البيع');
      const rent = ipc.trimString(ipc.getStringField(payload, 'rent'), 16, 'الإيجار');
      const minArea = ipc.trimString(ipc.getStringField(payload, 'minArea'), 32, 'أقل مساحة');
      const maxArea = ipc.trimString(ipc.getStringField(payload, 'maxArea'), 32, 'أكبر مساحة');
      const floor = ipc.trimString(ipc.getStringField(payload, 'floor'), 64, 'الطابق');
      const minPrice = ipc.trimString(ipc.getStringField(payload, 'minPrice'), 32, 'أقل سعر');
      const maxPrice = ipc.trimString(ipc.getStringField(payload, 'maxPrice'), 32, 'أكبر سعر');
      const contractLink = ipc.trimString(ipc.getStringField(payload, 'contractLink'), 16, 'ارتباط عقد');
      const sort = ipc.trimString(ipc.getStringField(payload, 'sort'), 32, 'الترتيب');
      const offset = Math.max(0, Math.trunc(Number(ipc.getField(payload, 'offset')) || 0));
      const limit = ipc.getOptionalNumberField(payload, 'limit');
      return domainPropertyPickerSearch({
        query: q,
        status,
        type,
        furnishing,
        forceVacant,
        occupancy: occupancy as unknown as 'all' | 'rented' | 'vacant',
        sale: sale as unknown as 'for-sale' | 'not-for-sale' | '',
        rent: rent as unknown as 'for-rent' | 'not-for-rent' | '',
        minArea,
        maxArea,
        floor,
        minPrice,
        maxPrice,
        contractLink: contractLink as unknown as '' | 'linked' | 'unlinked' | 'all',
        sort,
        offset,
        limit,
      });
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل البحث عن العقارات') };
    }
  });
  
  ipcMain.handle('domain:picker:contracts', (_e, payload: unknown) => {
    try {
      const q = ipc.trimString(ipc.getStringField(payload, 'query'), 128, 'نص البحث');
      const offset = Math.max(0, Math.trunc(Number(ipc.getField(payload, 'offset')) || 0));
      const limit = ipc.getOptionalNumberField(payload, 'limit');
      const tab = ipc.trimString(ipc.getStringField(payload, 'tab'), 32, 'التبويب');
      const sort = ipc.trimString(ipc.getStringField(payload, 'sort'), 32, 'الترتيب');
      const createdMonthRaw = ipc.trimString(
        ipc.getStringField(payload, 'createdMonth'),
        16,
        'شهر الإنشاء'
      );
      const createdMonth = /^\d{4}-\d{2}$/.test(createdMonthRaw) ? createdMonthRaw : '';
      const startDateFromRaw = ipc.trimString(
        ipc.getStringField(payload, 'startDateFrom'),
        16,
        'تاريخ البداية (من)'
      );
      const startDateToRaw = ipc.trimString(
        ipc.getStringField(payload, 'startDateTo'),
        16,
        'تاريخ البداية (إلى)'
      );
      const endDateFromRaw = ipc.trimString(
        ipc.getStringField(payload, 'endDateFrom'),
        16,
        'تاريخ النهاية (من)'
      );
      const endDateToRaw = ipc.trimString(
        ipc.getStringField(payload, 'endDateTo'),
        16,
        'تاريخ النهاية (إلى)'
      );
      const startDateFrom = /^\d{4}-\d{2}-\d{2}$/.test(startDateFromRaw) ? startDateFromRaw : '';
      const startDateTo = /^\d{4}-\d{2}-\d{2}$/.test(startDateToRaw) ? startDateToRaw : '';
      const endDateFrom = /^\d{4}-\d{2}-\d{2}$/.test(endDateFromRaw) ? endDateFromRaw : '';
      const endDateTo = /^\d{4}-\d{2}-\d{2}$/.test(endDateToRaw) ? endDateToRaw : '';
  
      const minValueRaw = String(ipc.getField(payload, 'minValue') ?? '').trim();
      const maxValueRaw = String(ipc.getField(payload, 'maxValue') ?? '').trim();
      const minValue = minValueRaw ? Number(minValueRaw) : undefined;
      const maxValue = maxValueRaw ? Number(maxValueRaw) : undefined;
  
      return domainContractPickerSearch({
        query: q,
        offset,
        limit,
        tab,
        sort,
        createdMonth,
        startDateFrom,
        startDateTo,
        endDateFrom,
        endDateTo,
        minValue: Number.isFinite(minValue as number) ? (minValue as number) : undefined,
        maxValue: Number.isFinite(maxValue as number) ? (maxValue as number) : undefined,
      });
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل البحث عن العقود') };
    }
  });
  
  ipcMain.handle('domain:picker:people', (_e, payload: unknown) => {
    const q = ipc.trimString(ipc.getStringField(payload, 'query'), 128, 'نص البحث');
    const role = ipc.trimString(ipc.getStringField(payload, 'role'), 32, 'الدور');
    const onlyIdleOwners = Boolean(ipc.getField(payload, 'onlyIdleOwners'));
    const address = ipc.trimString(ipc.getStringField(payload, 'address'), 128, 'العنوان');
    const nationalId = ipc.trimString(ipc.getStringField(payload, 'nationalId'), 32, 'الرقم الوطني');
    const classification = ipc.trimString(ipc.getStringField(payload, 'classification'), 64, 'التصنيف');
    const minRating = Math.max(0, Math.min(5, Number(ipc.getField(payload, 'minRating') ?? 0) || 0));
    const sort = ipc.trimString(ipc.getStringField(payload, 'sort'), 32, 'الترتيب');
    const offset = Math.max(0, Math.trunc(Number(ipc.getField(payload, 'offset')) || 0));
    const limit = Math.max(1, Math.min(200, Math.trunc(Number(ipc.getField(payload, 'limit')) || 48)));
    return domainPeoplePickerSearch({
      query: q,
      role,
      onlyIdleOwners,
      address,
      nationalId,
      classification,
      minRating,
      sort,
      offset,
      limit,
    });
  });
  
  ipcMain.handle('domain:installments:contracts', (_e, payload: unknown) => {
    try {
      const q = ipc.trimString(ipc.getStringField(payload, 'query'), 128, 'نص البحث');
      const filter = ipc.trimString(ipc.getStringField(payload, 'filter') || 'all', 16, 'الفلتر') || 'all';
      const sort = ipc.trimString(ipc.getStringField(payload, 'sort'), 32, 'الترتيب');
      const offset = Math.max(0, Math.trunc(Number(ipc.getField(payload, 'offset')) || 0));
      const limit = Math.max(
        1,
        Math.min(100, Math.trunc(Number(ipc.getField(payload, 'limit')) || 20))
      );
      const filterStartDate = String(ipc.getField(payload, 'filterStartDate') ?? '')
        .trim()
        .slice(0, 32);
      const filterEndDate = String(ipc.getField(payload, 'filterEndDate') ?? '')
        .trim()
        .slice(0, 32);
      const filterMinAmount = ipc.getOptionalNumberField(payload, 'filterMinAmount');
      const filterMaxAmount = ipc.getOptionalNumberField(payload, 'filterMaxAmount');
      const filterPaymentMethodRaw = ipc.getStringField(payload, 'filterPaymentMethod').trim().slice(0, 24);
      const filterPaymentMethod = filterPaymentMethodRaw || 'all';
      return domainInstallmentsContractsSearch({
        query: q,
        filter,
        sort,
        offset,
        limit,
        filterStartDate,
        filterEndDate,
        filterMinAmount,
        filterMaxAmount,
        filterPaymentMethod,
      });
    } catch (e: unknown) {
      return { ok: false, message: toErrorMessage(e, 'فشل تحميل الأقساط') };
    }
  });
}
