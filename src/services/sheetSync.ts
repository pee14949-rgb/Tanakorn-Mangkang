import type {
  AttendanceStore,
  DataState,
  EmployeeRow,
  SheetConfig,
  SheetSyncPayload,
} from '../types/manpower';
import {
  MOCK_EMPLOYEES,
  createSeedAttendanceForDate,
  getTodayIsoDate,
} from '../data/mockData';

const STORAGE_KEYS = {
  CONFIG: 'atc_manpower_sheet_config_v1',
  DATA: 'atc_manpower_cached_data_v1',
  ATTENDANCE: 'atc_manpower_attendance_v1',
} as const;

function safeGetStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or restricted-iframe errors so UI stays responsive
  }
}

function safeRemoveStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

export function loadSheetConfig(): SheetConfig {
  try {
    const raw = safeGetStorage(STORAGE_KEYS.CONFIG);
    if (!raw) return { scriptUrl: '', secretKey: '', sheetName: '' };
    const parsed = JSON.parse(raw) as Partial<SheetConfig>;
    return {
      scriptUrl: typeof parsed.scriptUrl === 'string' ? parsed.scriptUrl : '',
      secretKey: typeof parsed.secretKey === 'string' ? parsed.secretKey : '',
      sheetName: typeof parsed.sheetName === 'string' ? parsed.sheetName : '',
    };
  } catch {
    return { scriptUrl: '', secretKey: '', sheetName: '' };
  }
}

export function saveSheetConfig(config: SheetConfig): void {
  safeSetStorage(
    STORAGE_KEYS.CONFIG,
    JSON.stringify({
      scriptUrl: config.scriptUrl.trim(),
      secretKey: config.secretKey.trim(),
      sheetName: (config.sheetName ?? '').trim(),
    }),
  );
}

export function loadInitialDataState(): DataState {
  try {
    const raw = safeGetStorage(STORAGE_KEYS.DATA);
    if (raw) {
      const parsed = JSON.parse(raw) as DataState;
      if (parsed && Array.isArray(parsed.rows) && parsed.rows.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fallback to mock data if corrupted
  }
  return getMockDataState();
}

export function getMockDataState(): DataState {
  return {
    source: 'mock',
    updatedAt: new Date().toISOString(),
    count: MOCK_EMPLOYEES.length,
    rows: MOCK_EMPLOYEES,
  };
}

export function saveCachedDataState(state: DataState): void {
  safeSetStorage(STORAGE_KEYS.DATA, JSON.stringify(state));
}

export function clearCachedDataState(): void {
  safeRemoveStorage(STORAGE_KEYS.DATA);
}

export function loadAttendanceStore(): AttendanceStore {
  const today = getTodayIsoDate();
  try {
    const raw = safeGetStorage(STORAGE_KEYS.ATTENDANCE);
    if (raw) {
      const parsed = JSON.parse(raw) as AttendanceStore;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // Fallback to seeded attendance
  }
  const seeded = createSeedAttendanceForDate(today);
  saveAttendanceStore(seeded);
  return seeded;
}

export function saveAttendanceStore(store: AttendanceStore): void {
  safeSetStorage(STORAGE_KEYS.ATTENDANCE, JSON.stringify(store));
}

function pickField(record: Record<string, unknown>, candidates: string[]): string {
  for (const key of candidates) {
    const val = record[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  const entries = Object.entries(record);
  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase().replace(/\s+/g, '');
    const found = entries.find(
      ([k]) => k.toLowerCase().replace(/\s+/g, '') === normalizedCandidate,
    );
    if (
      found &&
      found[1] !== undefined &&
      found[1] !== null &&
      String(found[1]).trim() !== ''
    ) {
      return String(found[1]).trim();
    }
  }
  return '-';
}

function normalizeRow(raw: unknown, index: number): EmployeeRow {
  const rec = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const empId = pickField(rec, ['รหัสพนักงาน', 'employeeId', 'empId', 'id']);
  return {
    Level: pickField(rec, ['Level', 'level', 'ระดับ']),
    ตำแหน่ง: pickField(rec, ['ตำแหน่ง', 'position', 'role']),
    รหัสพนักงาน: empId === '-' ? `EMP-${String(index + 1).padStart(4, '0')}` : empId,
    รายชื่อพนักงาน: pickField(rec, ['รายชื่อพนักงาน', 'ชื่อ-นามสกุล', 'ชื่อพนักงาน', 'name']),
    แผนก: pickField(rec, ['แผนก', 'department']),
    ส่วนงาน: pickField(rec, ['ส่วนงาน', 'section', 'division']),
    'ช่องทางหลัก (Channel)': pickField(rec, [
      'ช่องทางหลัก (Channel)',
      'ช่องทางหลัก',
      'Channel',
      'channel',
    ]),
    ช่องทางย่อย: pickField(rec, ['ช่องทางย่อย', 'subChannel', 'sub_channel']),
    สังกัด: pickField(rec, ['สังกัด', 'affiliation', 'site', 'branch']),
  };
}

export function normalizeAppsScriptUrl(input: string): string {
  const trimmed = input.trim();
  if (/^AKfycb[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    return `https://script.google.com/macros/s/${trimmed}/exec`;
  }
  return trimmed;
}

export function buildRequestUrlWithSecret(config: SheetConfig): string | null {
  const normalized = normalizeAppsScriptUrl(config.scriptUrl);
  if (!normalized) return null;
  try {
    const endpoint = new URL(normalized);
    if (endpoint.protocol !== 'https:') return null;
    const secret = config.secretKey.trim();
    const sheetName = (config.sheetName ?? '').trim();
    if (secret) {
      if (!endpoint.searchParams.has('key')) endpoint.searchParams.set('key', secret);
      if (!endpoint.searchParams.has('secret')) endpoint.searchParams.set('secret', secret);
      if (!endpoint.searchParams.has('token')) endpoint.searchParams.set('token', secret);
    }
    if (sheetName && !endpoint.searchParams.has('sheet')) {
      endpoint.searchParams.set('sheet', sheetName);
    }
    return endpoint.toString();
  } catch {
    return null;
  }
}

export function validateAppsScriptUrl(url: string): string | null {
  const trimmed = normalizeAppsScriptUrl(url);
  if (!trimmed) {
    return 'กรุณาระบุ URL ของ Google Apps Script ก่อนกด Sync จากชีต';
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return 'URL ต้องขึ้นต้นด้วย https:// เพื่อความปลอดภัยในการเชื่อมต่อ';
    }
    return null;
  } catch {
    return 'รูปแบบ URL ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
  }
}

export function parseSheetJsonPayload(rawJson: unknown): DataState {
  const json = (
    rawJson && typeof rawJson === 'object' ? rawJson : {}
  ) as Partial<SheetSyncPayload> & {
    data?: unknown[];
    error?: string;
    message?: string;
    ok?: boolean;
  };

  if (json.error) {
    throw new Error(`Google Sheet แจ้งข้อผิดพลาด: ${json.error}`);
  }
  if (json.ok === false && json.message) {
    throw new Error(`Google Sheet แจ้งข้อผิดพลาด: ${json.message}`);
  }

  const rawRows = Array.isArray(rawJson)
    ? rawJson
    : Array.isArray(json.rows)
      ? json.rows
      : Array.isArray(json.data)
        ? json.data
        : null;

  if (!rawRows) {
    throw new Error(
      'โครงสร้าง JSON ไม่ตรงตามรูปแบบที่กำหนด (ไม่พบฟิลด์ "rows" ในข้อมูลที่ได้รับ)',
    );
  }

  const normalizedRows = rawRows
    .filter((item) => item && typeof item === 'object')
    .map((item, idx) => normalizeRow(item, idx));

  const state: DataState = {
    source: 'sheet',
    updatedAt:
      typeof json.updatedAt === 'string' && json.updatedAt
        ? json.updatedAt
        : new Date().toISOString(),
    count: typeof json.count === 'number' ? json.count : normalizedRows.length,
    rows: normalizedRows,
  };

  saveCachedDataState(state);
  return state;
}

export function importFromRawJsonText(rawText: string): DataState {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('กรุณาวางข้อความ JSON ที่ได้จาก Google Apps Script');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('ข้อความที่วางไม่ใช่รูปแบบ JSON ที่ถูกต้อง กรุณาคัดลอกทั้งหมดตั้งแต่ { ถึง }');
  }
  return parseSheetJsonPayload(parsed);
}

export function importFromCsvText(csvText: string): DataState {
  const clean = csvText.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (clean[i + 1] === '\n') i += 1;
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  if (records.length < 2) {
    throw new Error('ไฟล์ CSV ไม่มีข้อมูลพนักงาน (ต้องมีแถวหัวตารางและข้อมูลอย่างน้อย 1 แถว)');
  }

  const headers = records[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < records.length; i++) {
    const cells = records[i];
    if (!cells.some((c) => c.trim() !== '')) continue;
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (!header) continue;
      obj[header] = (cells[j] ?? '').trim();
    }
    rows.push(obj);
  }

  return parseSheetJsonPayload({
    updatedAt: new Date().toISOString(),
    count: rows.length,
    rows,
  });
}

async function fetchDirectFromBrowser(config: SheetConfig): Promise<unknown> {
  const normalizedUrl = normalizeAppsScriptUrl(config.scriptUrl);
  const endpoint = new URL(normalizedUrl);
  const secret = config.secretKey.trim();
  const sheetName = (config.sheetName ?? '').trim();
  if (secret) {
    if (!endpoint.searchParams.has('key')) endpoint.searchParams.set('key', secret);
    if (!endpoint.searchParams.has('secret')) endpoint.searchParams.set('secret', secret);
    if (!endpoint.searchParams.has('token')) endpoint.searchParams.set('token', secret);
  }
  if (sheetName && !endpoint.searchParams.has('sheet')) {
    endpoint.searchParams.set('sheet', sheetName);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(endpoint.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `การเชื่อมต่อไม่สำเร็จ (HTTP ${response.status}) กรุณาตรวจสอบสิทธิ์การเข้าถึงหรือ Secret Key`,
      );
    }

    const text = (await response.text()).trim();
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html') || text.startsWith('<HTML')) {
      throw new Error(
        'Google Apps Script ส่งกลับเป็นหน้าเว็บ HTML แทน JSON (บังคับล็อกอิน) กรุณาตั้งค่าสิทธิ์ Deploy เป็น "ทุกคน (Anyone)" หรือใช้วิธีวาง JSON โดยตรงด้านล่าง',
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        'ข้อมูลที่ได้รับไม่ใช่รูปแบบ JSON กรุณาตรวจสอบฟังก์ชัน doGet(e) ใน Google Apps Script',
      );
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('การเชื่อมต่อใช้เวลานานเกิน 2 นาที กรุณาลองใหม่อีกครั้ง หรือลดแถวว่างในชีต');
    }
    if (err instanceof TypeError) {
      throw new Error(
        'ไม่สามารถเชื่อมต่อ Google Apps Script ได้ (ติดสิทธิ์องค์กรหรือ CORS) กรุณาตั้งค่า Deploy เป็น "ทุกคน (Anyone)" หรือเปิดลิงก์ในแท็บใหม่แล้วคัดลอก JSON มาวางด้านล่าง',
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchViaServerProxy(
  config: SheetConfig,
): Promise<{ ok: true; data: unknown } | { ok: false; fallback: boolean; error: string }> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 125000);

  try {
    const response = await fetch('/api/sheet-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scriptUrl: normalizeAppsScriptUrl(config.scriptUrl),
        secretKey: config.secretKey.trim(),
        sheetName: (config.sheetName ?? '').trim(),
      }),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return { ok: false, fallback: true, error: '' };
    }

    const body = (await response.json()) as { error?: string; code?: string };
    if (!response.ok) {
      if (body.code === 'UNSUPPORTED_HOST') {
        return { ok: false, fallback: true, error: body.error ?? '' };
      }
      return {
        ok: false,
        fallback: false,
        error: body.error || `ไม่สามารถดึงข้อมูลจากชีตได้ (HTTP ${response.status})`,
      };
    }

    return { ok: true, data: body };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        ok: false,
        fallback: false,
        error: 'การเชื่อมต่อใช้เวลานานเกิน 2 นาที กรุณาลองใหม่อีกครั้ง หรือลดแถวว่างในชีต',
      };
    }
    return { ok: false, fallback: true, error: '' };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchFromGoogleSheet(config: SheetConfig): Promise<DataState> {
  const validationError = validateAppsScriptUrl(config.scriptUrl);
  if (validationError) {
    throw new Error(validationError);
  }

  let rawJson: unknown;
  const proxyResult = await fetchViaServerProxy(config);
  if (proxyResult.ok) {
    rawJson = proxyResult.data;
  } else if (proxyResult.fallback) {
    rawJson = await fetchDirectFromBrowser(config);
  } else {
    throw new Error(proxyResult.error);
  }

  return parseSheetJsonPayload(rawJson);
}

export function formatThaiDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatThaiDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const escapeCell = (value: string) => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];
  const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
