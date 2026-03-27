import React from 'react';
import { DbService } from '@/services/mockDb';

export const PrintLetterhead: React.FC<{ className?: string }> = ({ className }) => {
  const s = DbService.getSettings?.();

  if (s?.letterheadEnabled === false) return null;

  const companyName = String(s?.companyName || '').trim();
  const slogan = String(s?.companySlogan || '').trim();
  const address = String(s?.companyAddress || '').trim();
  const phone = String(s?.companyPhone || '').trim();
  const email = String(s?.companyEmail || '').trim();
  const website = String(s?.companyWebsite || '').trim();
  const taxNumber = String(s?.taxNumber || '').trim();
  const commercialRegister = String(s?.commercialRegister || '').trim();
  const companyIdentityText = String(s?.companyIdentityText || '').trim();
  const logoUrl = String(s?.logoUrl || '').trim();

  const hasAny =
    companyName ||
    slogan ||
    address ||
    phone ||
    email ||
    website ||
    taxNumber ||
    commercialRegister ||
    companyIdentityText ||
    logoUrl;
  if (!hasAny) return null;

  return (
    <div className={className || ''}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {logoUrl ? (
            <div className="w-16 h-16 border border-slate-200 rounded-lg overflow-hidden bg-white flex items-center justify-center">
              <img src={logoUrl} alt="logo" className="w-full h-full object-contain" />
            </div>
          ) : null}

          <div className="min-w-0">
            {companyName ? (
              <div className="text-xl font-black text-slate-900">{companyName}</div>
            ) : null}
            {slogan ? (
              <div className="text-sm font-bold text-slate-600 mt-0.5">{slogan}</div>
            ) : null}
            <div className="text-[11px] text-slate-600 mt-2 leading-relaxed">
              {address ? <div>{address}</div> : null}
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {phone ? <span>هاتف: {phone}</span> : null}
                {email ? <span>إيميل: {email}</span> : null}
                {website ? <span>موقع: {website}</span> : null}
              </div>
            </div>
          </div>
        </div>

        {(taxNumber || commercialRegister || companyIdentityText) && (
          <div className="text-[11px] text-slate-600 text-left leading-relaxed">
            {companyIdentityText ? (
              <div className="whitespace-pre-line">{companyIdentityText}</div>
            ) : null}
            {taxNumber ? <div>الرقم الضريبي: {taxNumber}</div> : null}
            {commercialRegister ? <div>السجل التجاري: {commercialRegister}</div> : null}
          </div>
        )}
      </div>

      <div className="mt-3 h-px bg-slate-200" />
    </div>
  );
};
