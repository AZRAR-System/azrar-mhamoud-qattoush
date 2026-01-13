import ExcelJS from 'exceljs';

export type XlsxColumn<T extends Record<string, any>> = {
  key: keyof T & string;
  header: string;
};

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

export function exportToXlsx<T extends Record<string, any>>(
  sheetName: string,
  columns: Array<XlsxColumn<T>>,
  rows: T[],
  filename: string,
  options?: {
    extraSheets?: Array<{ name: string; rows: any[][] }>;
  }
) {
  const run = async () => {
    const wb = new ExcelJS.Workbook();

    const ws = wb.addWorksheet(sheetName);
    ws.addRow(columns.map(c => c.header));
    for (const row of rows) {
      ws.addRow(columns.map(c => (row[c.key] ?? '') as any));
    }

    const extraSheets = options?.extraSheets || [];
    for (const sh of extraSheets) {
      if (!sh?.name || !Array.isArray(sh.rows)) continue;
      const extraWs = wb.addWorksheet(sh.name);
      for (const r of sh.rows) {
        if (!Array.isArray(r)) continue;
        extraWs.addRow(r as any[]);
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

export async function readXlsxFile(file: File): Promise<Array<Record<string, any>>> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const ws = wb.worksheets[0];
  if (!ws) return [];

  const headerValues = ws.getRow(1).values as any[];
  const colCount = Math.max(0, ws.actualColumnCount || 0);
  const headers: string[] = [];
  for (let i = 1; i <= colCount; i++) {
    const raw = headerValues?.[i];
    const h = String(raw ?? '').trim();
    headers.push(h || `Column${i}`);
  }

  const toCellString = (v: any): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'object') {
      const maybeText = (v as any)?.text;
      if (typeof maybeText === 'string') return maybeText;
      const rich = (v as any)?.richText;
      if (Array.isArray(rich)) return rich.map((x: any) => x?.text ?? '').join('');
      const formulaResult = (v as any)?.result;
      if (formulaResult !== undefined) return String(formulaResult);
    }
    return String(v);
  };

  const out: Array<Record<string, any>> = [];
  const rowCount = Math.max(0, ws.actualRowCount || 0);
  for (let r = 2; r <= rowCount; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, any> = {};
    for (let c = 1; c <= headers.length; c++) {
      const key = headers[c - 1] || String(c);
      const cell = row.getCell(c);
      obj[key] = toCellString((cell as any)?.value);
    }
    out.push(obj);
  }
  return out;
}

export async function readCsvFile(file: File): Promise<Array<Record<string, any>>> {
  const text = await file.text();
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(l => l.trim())
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
    return out.map(x => x.trim());
  };

  const headers = splitCsvLine(lines[0] ?? '').map(h => h.trim());
  const rows: Array<Record<string, any>> = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const row: Record<string, any> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i] || String(i)] = cells[i] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

export async function readSpreadsheet(file: File): Promise<Array<Record<string, any>>> {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx')) return readXlsxFile(file);
  if (name.endsWith('.xls')) {
    throw new Error('ملف .xls غير مدعوم حالياً. يرجى حفظه كـ .xlsx أو استخدام .csv');
  }
  return readCsvFile(file);
}
