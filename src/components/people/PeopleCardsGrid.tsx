import { DbService } from '@/services/mockDb';
import type { الأشخاص_tbl, العقود_tbl } from '@/types';
import {
  PersonListingCardWeb,
  PersonListingCardDesktop,
} from '@/components/people/PersonListingCard';
import { getPersonColorClasses, getPersonSeedFromPerson } from '@/utils/personColor';
import { SkeletonCardGrid } from '@/components/shared/SkeletonCard';
import type { PeoplePageModel } from '@/hooks/usePeople';

type Props = { page: PeoplePageModel };

function PeopleResultsToolbar({ page }: Props) {
  const {
    t,
    isDesktopFast,
    desktopLoading,
    desktopTotal,
    desktopPage,
    setDesktopPage,
    desktopPageCount,
    filtered,
    uiPage,
    setUiPage,
    uiPageCount,
  } = page;

  const total = isDesktopFast ? desktopTotal : filtered.length;
  const currentPage = isDesktopFast ? desktopPage + 1 : uiPage + 1;
  const totalPages = isDesktopFast ? desktopPageCount : uiPageCount;
  const isFirst = isDesktopFast ? desktopPage <= 0 : uiPage <= 0;
  const isLast = isDesktopFast ? desktopPage + 1 >= desktopPageCount : uiPage + 1 >= uiPageCount;
  const goPrev = () => isDesktopFast ? setDesktopPage((p) => Math.max(0, p - 1)) : setUiPage((p) => Math.max(0, p - 1));
  const goNext = () => isDesktopFast
    ? setDesktopPage((p) => Math.min(Math.max(0, desktopPageCount - 1), p + 1))
    : setUiPage((p) => Math.min(Math.max(0, uiPageCount - 1), p + 1));

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
            {desktopLoading ? '...' : total}
          </span>
        </div>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('نتيجة')}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={goPrev}
          disabled={isFirst || desktopLoading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: 'rotate(180deg)' }}><path d="M9 18l6-6-6-6"/></svg>
          {t('السابق')}
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let page: number;
            if (totalPages <= 5) {
              page = i + 1;
            } else if (currentPage <= 3) {
              page = i + 1;
            } else if (currentPage >= totalPages - 2) {
              page = totalPages - 4 + i;
            } else {
              page = currentPage - 2 + i;
            }
            return (
              <button
                key={page}
                onClick={() => {
                  const target = page - 1;
                  if (isDesktopFast) setDesktopPage(target);
                  else setUiPage(target);
                }}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  page === currentPage
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        <button
          onClick={goNext}
          disabled={isLast || desktopLoading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          {t('التالي')}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  );
}


export function PeopleCardsGrid({ page }: Props) {
  const {
    t,
    tr,
    loading,
    isDesktopFast,
    desktopRows,
    uiRows,
    peopleById,
    contracts,
    properties,
    getRoles,
    getPrimaryRole,
    getRoleClasses,
    isActiveContract,
    showDynamicColumns,
    dynamicFields,
    openPanel,
    handleOpenForm,
    handleDelete,
    handleBlacklist,
    handleQuickReminderForPerson,
    deletingPersonId,
  } = page;

  const renderWebCard = (person: الأشخاص_tbl) => {
    const roles = getRoles(person.رقم_الشخص);
    const isBlacklisted = Boolean(DbService.getPersonBlacklistStatus(person.رقم_الشخص));
    const primaryRole = getPrimaryRole(roles);
    const accent = getRoleClasses(primaryRole);
    const personColor = getPersonColorClasses(getPersonSeedFromPerson(person));

    const roleVisual = (() => {
      if (isBlacklisted) {
        return { stripe: 'bg-red-500/25 dark:bg-red-400/20', dot: 'bg-red-500' };
      }
      if (primaryRole === 'مالك') {
        return { stripe: 'bg-emerald-500/20 dark:bg-emerald-400/15', dot: 'bg-emerald-500' };
      }
      if (primaryRole === 'مستأجر') {
        return { stripe: 'bg-indigo-500/20 dark:bg-indigo-400/15', dot: 'bg-indigo-500' };
      }
      if (primaryRole === 'كفيل') {
        return { stripe: 'bg-amber-500/20 dark:bg-amber-400/15', dot: 'bg-amber-500' };
      }
      return { stripe: personColor.stripe, dot: personColor.dot };
    })();

    const roleRing =
      primaryRole === 'مالك'
        ? 'ring-2 ring-emerald-500/10 border-emerald-500/20'
        : primaryRole === 'مستأجر'
          ? 'ring-2 ring-indigo-500/10 border-indigo-500/20'
          : primaryRole === 'كفيل'
            ? 'ring-2 ring-amber-500/10 border-amber-500/20'
            : '';

    const tenantContract = contracts
      .filter((c) => isActiveContract(c) && c.رقم_المستاجر === person.رقم_الشخص)
      .sort((a, b) =>
        String(b.تاريخ_البداية || '').localeCompare(String(a.تاريخ_البداية || ''))
      )[0];
    const guarantorContract = contracts
      .filter((c) => isActiveContract(c) && c.رقم_الكفيل === person.رقم_الشخص)
      .sort((a, b) =>
        String(b.تاريخ_البداية || '').localeCompare(String(a.تاريخ_البداية || ''))
      )[0];

    const ownerPropertyIds = new Set(
      properties.filter((p) => p.رقم_المالك === person.رقم_الشخص).map((p) => p.رقم_العقار)
    );
    const ownerContract = contracts
      .filter((c) => isActiveContract(c) && ownerPropertyIds.has(c.رقم_العقار))
      .sort((a, b) =>
        String(b.تاريخ_البداية || '').localeCompare(String(a.تاريخ_البداية || ''))
      )[0];

    const pick: العقود_tbl | null = (tenantContract || guarantorContract || ownerContract) ?? null;
    const linkedProperty = pick
      ? properties.find((p) => p.رقم_العقار === pick.رقم_العقار)
      : undefined;
    const tenantName = pick?.رقم_المستاجر
      ? peopleById.get(pick.رقم_المستاجر)?.الاسم || t('غير معروف')
      : '';
    const guarantorName = pick?.رقم_الكفيل
      ? peopleById.get(pick.رقم_الكفيل)?.الاسم || t('غير معروف')
      : '';

    return (
      <PersonListingCardWeb
        key={person.رقم_الشخص}
        person={person}
        roles={roles}
        isBlacklisted={isBlacklisted}
        roleVisual={roleVisual}
        roleRing={roleRing}
        accent={accent}
        pick={pick}
        linkedProperty={linkedProperty}
        tenantName={tenantName}
        guarantorName={guarantorName}
        tenantContract={tenantContract}
        guarantorContract={guarantorContract}
        ownerContract={ownerContract}
        getRoleClasses={getRoleClasses}
        showDynamicColumns={showDynamicColumns}
        dynamicFields={dynamicFields}
        tr={tr}
        t={t}
        openPanel={openPanel}
        handleOpenForm={handleOpenForm}
        handleDelete={handleDelete}
        handleBlacklist={handleBlacklist}
        handleQuickReminderForPerson={handleQuickReminderForPerson}
        isDeleting={deletingPersonId === String(person.رقم_الشخص)}
      />
    );
  };

  return (
    <>
      <PeopleResultsToolbar page={page} />
      {loading ? (
        <SkeletonCardGrid count={6} variant="listing" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {isDesktopFast
            ? desktopRows.map((r) => (
                <PersonListingCardDesktop
                  key={r.person.رقم_الشخص}
                  row={r}
                  getPrimaryRole={getPrimaryRole}
                  getRoleClasses={getRoleClasses}
                  showDynamicColumns={showDynamicColumns}
                  dynamicFields={dynamicFields}
                  tr={tr}
                  t={t}
                  openPanel={openPanel}
                  handleOpenForm={handleOpenForm}
                  handleDelete={handleDelete}
                  handleBlacklist={handleBlacklist}
                  handleQuickReminderForPerson={handleQuickReminderForPerson}
                  isDeleting={deletingPersonId === String(r.person.رقم_الشخص)}
                />
              ))
            : uiRows.map((person) => renderWebCard(person))}
        </div>
      )}
    </>
  );
}
