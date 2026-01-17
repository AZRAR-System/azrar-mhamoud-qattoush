export type RentalTierId = '500-999' | '1000-1999' | '2000-2999' | '3000-3999' | 'out-of-tier';

export type EmployeeCommissionBreakdown = {
  rental: {
    officeCommissionTotal: number;
    tierId: RentalTierId;
    rate: number;
    earned: number;
  };
  sale: {
    officeCommissionTotal: number;
    rate: number;
    earned: number;
  };
  propertyIntro: {
    enabled: boolean;
    rate: number;
    earned: number;
  };
  totals: {
    baseEarned: number;
    finalEarned: number;
  };
};

const clampNonNegative = (n: unknown) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, x);
};

export const getRentalTier = (officeCommissionTotal: number): { tierId: RentalTierId; rate: number } => {
  const total = clampNonNegative(officeCommissionTotal);

  // ✅ حرفيًا حسب المواصفات: الشريحة تعتمد فقط على إجمالي عمولة الإيجار.
  if (total >= 500 && total <= 999) return { tierId: '500-999', rate: 0.1 };
  if (total >= 1000 && total <= 1999) return { tierId: '1000-1999', rate: 0.15 };
  if (total >= 2000 && total <= 2999) return { tierId: '2000-2999', rate: 0.2 };
  if (total >= 3000 && total <= 3999) return { tierId: '3000-3999', rate: 0.25 };

  // لم يتم تحديد شرائح خارج هذا النطاق
  return { tierId: 'out-of-tier', rate: 0 };
};

export const computeEmployeeCommission = (input: {
  rentalOfficeCommissionTotal?: number;
  saleOfficeCommissionTotal?: number;
  propertyIntroEnabled?: boolean;
}): EmployeeCommissionBreakdown => {
  const rentalOfficeCommissionTotal = clampNonNegative(input.rentalOfficeCommissionTotal);
  const saleOfficeCommissionTotal = clampNonNegative(input.saleOfficeCommissionTotal);

  const rentalTier = getRentalTier(rentalOfficeCommissionTotal);
  const rentalEarned = rentalOfficeCommissionTotal * rentalTier.rate;

  // ✅ البيع مستقل: الموظف يأخذ 40% من إجمالي عمولة البيع
  const saleRate = 0.4;
  const saleEarned = saleOfficeCommissionTotal * saleRate;

  const baseEarned = rentalEarned + saleEarned;

  // ✅ إدخال عقار: 5% من إجمالي عمولة العملية (للمكتب) ولا تدخل الشريحة
  // مثال: 200 (مالك) + 200 (مستأجر) = 400 => إدخال عقار = 400 * 5% = 20
  const introEnabled = !!input.propertyIntroEnabled;
  const introRate = 0.05;
  const officeTotal = rentalOfficeCommissionTotal + saleOfficeCommissionTotal;
  const introEarned = introEnabled ? officeTotal * introRate : 0;

  const finalEarned = baseEarned + introEarned;

  return {
    rental: {
      officeCommissionTotal: rentalOfficeCommissionTotal,
      tierId: rentalTier.tierId,
      rate: rentalTier.rate,
      earned: rentalEarned,
    },
    sale: {
      officeCommissionTotal: saleOfficeCommissionTotal,
      rate: saleRate,
      earned: saleEarned,
    },
    propertyIntro: {
      enabled: introEnabled,
      rate: introRate,
      earned: introEarned,
    },
    totals: {
      baseEarned,
      finalEarned,
    },
  };
};
