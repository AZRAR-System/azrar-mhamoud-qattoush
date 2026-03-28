import { DbService } from '@/services/mockDb';
import type { الأشخاص_tbl, العقود_tbl } from '@/types';
import { Button } from '@/components/ui/Button';
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

  if (isDesktopFast) {
    return (
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {desktopLoading ? '...' : desktopTotal.toLocaleString()} {t('نتيجة')}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={desktopLoading || desktopPage <= 0}
            onClick={() => setDesktopPage((p) => Math.max(0, p - 1))}
          >
            {t('السابق')}
          </Button>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {desktopPage + 1} / {desktopPageCount}
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={desktopLoading || desktopPage + 1 >= desktopPageCount}
            onClick={() =>
              setDesktopPage((p) => Math.min(Math.max(0, desktopPageCount - 1), p + 1))
            }
          >
            {t('التالي')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between mb-3">
      <div className="text-sm text-slate-500 dark:text-slate-400">
        {filtered.length.toLocaleString()} {t('نتيجة')}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={uiPage <= 0}
          onClick={() => setUiPage((p) => Math.max(0, p - 1))}
        >
          {t('السابق')}
        </Button>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {uiPage + 1} / {uiPageCount}
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={uiPage + 1 >= uiPageCount}
          onClick={() => setUiPage((p) => Math.min(Math.max(0, uiPageCount - 1), p + 1))}
        >
          {t('التالي')}
        </Button>
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

    const pick: العقود_tbl | null =
      (tenantContract || guarantorContract || ownerContract) ?? null;
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(360px,1fr))]">
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
