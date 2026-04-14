import ExcelJS from 'exceljs';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const hasStringProp = <K extends string>(
  obj: Record<string, unknown>,
  key: K
): obj is Record<string, unknown> & Record<K, string> => typeof obj[key] === 'string';

const hasUnknownProp = <K extends string>(
  obj: Record<string, unknown>,
  key: K
): obj is Record<string, unknown> & Record<K, unknown> =>
  Object.prototype.hasOwnProperty.call(obj, key);

export const toExcelCellValue = (v: unknown): ExcelJS.CellValue => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (v instanceof Date) return v;

  // ExcelJS supports rich values, but for stability we store objects as strings.
  if (isRecord(v)) {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  return String(v);
};

export const toCellString = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();

  if (isRecord(v)) {
    if (hasStringProp(v, 'text')) return v.text;

    const richText = hasUnknownProp(v, 'richText') ? v.richText : undefined;
    if (Array.isArray(richText)) {
      return richText.map((x) => (isRecord(x) && hasStringProp(x, 'text') ? x.text : '')).join('');
    }

    const formulaResult = hasUnknownProp(v, 'result') ? v.result : undefined;
    if (formulaResult !== undefined) return String(formulaResult);
  }

  return String(v);
};

export type XlsxColumn<T extends Record<string, unknown>> = {
  key: keyof T & string;
  header: string;
};

export type ExtraSheet = { name: string; rows: unknown[][] };

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToXlsx<T extends Record<string, unknown>>(
  sheetName: string,
  columns: Array<XlsxColumn<T>>,
  rows: T[],
  filename: string,
  options?: {
    extraSheets?: ExtraSheet[];
  }
) {
  const run = async () => {
    const wb = new ExcelJS.Workbook();

    const ws = wb.addWorksheet(sheetName);
    ws.addRow(columns.map((c) => c.header));
    for (const row of rows) {
      ws.addRow(columns.map((c) => toExcelCellValue(row[c.key] ?? '')));
    }

    const extraSheets = options?.extraSheets || [];
    for (const sh of extraSheets) {
      if (!sh?.name || !Array.isArray(sh.rows)) continue;
      const extraWs = wb.addWorksheet(sh.name);
      for (const r of sh.rows) {
        if (!Array.isArray(r)) continue;
        extraWs.addRow(r.map((cell) => toExcelCellValue(cell)));
      }
    }

    const out = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const blob = new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlob(blob, filename);
  };

  return run();
}

export async function readXlsxFile(file: File): Promise<Array<Record<string, string>>> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const ws = wb.worksheets[0];
  if (!ws) return [];

  const headerRow = ws.getRow(1);
  const colCount = Math.max(0, ws.actualColumnCount || 0);
  const headers: string[] = [];
  for (let i = 1; i <= colCount; i++) {
    const raw = headerRow.getCell(i).value;
    const h = toCellString(raw).trim();
    headers.push(h || `Column${i}`);
  }

  const out: Array<Record<string, string>> = [];
  const rowCount = Math.max(0, ws.actualRowCount || 0);
  for (let r = 2; r <= rowCount; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, string> = {};
    for (let c = 1; c <= headers.length; c++) {
      const key = headers[c - 1] || String(c);
      const cell = row.getCell(c);
      obj[key] = toCellString(cell.value);
    }
    out.push(obj);
  }
  return out;
}

export async function readCsvFile(file: File): Promise<Array<Record<string, string>>> {
  const buffer = await file.arrayBuffer();
  let text = '';
  
  try {
    // Try UTF-8 first with fatal error checking
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    text = utf8Decoder.decode(buffer);
  } catch (err) {
    // Fallback to Windows-1256 (Arabic Windows) if UTF-8 fails
    console.warn('UTF-8 decoding failed, falling back to windows-1256 for Arabic support');
    const win1256Decoder = new TextDecoder('windows-1256');
    text = win1256Decoder.decode(buffer);
  }

  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const splitCsvLine = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out.map((x) => x.trim());
  };

  const headers = splitCsvLine(lines[0] ?? '').map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i] || String(i)] = cells[i] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

export async function readSpreadsheet(file: File): Promise<Array<Record<string, string>>> {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx')) return readXlsxFile(file);
  if (name.endsWith('.xls')) {
    throw new Error('ملف .xls غير مدعوم حالياً. يرجى حفظه كـ .xlsx أو استخدام .csv');
  }
  return readCsvFile(file);
}
