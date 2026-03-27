import React from 'react';

export type ExpandableTextProps = {
  value: unknown;
  title?: string;
  dir?: 'auto' | 'rtl' | 'ltr';
  previewChars?: number;
  className?: string;
};

export const ExpandableText: React.FC<ExpandableTextProps> = ({
  value,
  title,
  dir = 'auto',
  previewChars = 60,
  className = '',
}) => {
  const full =
    typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  const normalized = full.trim();

  const [expanded, setExpanded] = React.useState(false);

  if (!normalized) {
    return (
      <span dir={dir} title={title} className={className}>
        —
      </span>
    );
  }

  const shouldTrim = previewChars > 0 && normalized.length > previewChars;
  const shown = !shouldTrim || expanded ? normalized : normalized.slice(0, previewChars) + '…';

  return (
    <span dir={dir} title={title} className={className}>
      {shown}{' '}
      {shouldTrim ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
        >
          {expanded ? 'أقل' : 'المزيد'}
        </button>
      ) : null}
    </span>
  );
};

export default ExpandableText;
