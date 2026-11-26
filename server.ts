import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_GAS_HOSTS = new Set([
  'script.google.com',
  'script.googleusercontent.com',
]);

const ALLOWED_SHEET_HOSTS = new Set(['docs.google.com']);

function appendQueryParams(
  urlObj: URL,
  secretKey: string,
  sheetName: string,
): void {
  if (secretKey) {
    if (!urlObj.searchParams.has('key')) {
      urlObj.searchParams.set('key', secretKey);
    }
    if (!urlObj.searchParams.has('secret')) {
      urlObj.searchParams.set('secret', secretKey);
    }
    if (!urlObj.searchParams.has('token')) {
      urlObj.searchParams.set('token', secretKey);
    }
  }
  if (sheetName && !urlObj.searchParams.has('sheet')) {
    urlObj.searchParams.set('sheet', sheetName);
  }
}

function buildFallbackPublicGasUrl(urlObj: URL): URL | null {
  const match = urlObj.pathname.match(/^\/a\/macros\/[^/]+(\/s\/[^/]+\/exec.*)$/);
  if (!match) return null;
  const publicUrl = new URL(`https://script.google.com/macros${match[1]}`);
  urlObj.searchParams.forEach((value, key) => {
    publicUrl.searchParams.set(key, value);
  });
  return publicUrl;
}

function buildGoogleSheetCsvUrl(urlObj: URL): URL | null {
  // Already a published CSV or export CSV URL
  if (
    urlObj.pathname.includes('/pub') &&
    urlObj.searchParams.get('output') === 'csv'
  ) {
    return urlObj;
  }
  if (
    urlObj.pathname.includes('/export') &&
    urlObj.searchParams.get('format') === 'csv'
  ) {
    return urlObj;
  }

  // Standard Google Sheet URL: /spreadsheets/d/<SHEET_ID>/edit...
  const match = urlObj.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;

  const sheetId = match[1];
  const gidFromQuery = urlObj.searchParams.get('gid');
  const gidFromHash = urlObj.hash.match(/gid=(\d+)/)?.[1] ?? null;
  const gid = gidFromQuery || gidFromHash;

  const exportUrl = new URL(
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`,
  );
  if (gid) {
    exportUrl.searchParams.set('gid', gid);
  }
  return exportUrl;
}

function parseCsvToRows(csvText: string): Record<string, string>[] {
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

  if (records.length < 2) return [];
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
  return rows;
}

function isGoogleLoginHtml(text: string, finalUrl: string): boolean {
  const lowerUrl = finalUrl.toLowerCase();
  if (
    lowerUrl.includes('accounts.google.com') ||
    lowerUrl.includes('servicelogin') ||
    lowerUrl.includes('accountchooser')
  ) {
    return true;
  }
  const lowerText = text.slice(0, 2000).toLowerCase();
  return (
    lowerText.includes('servicelogin') ||
    lowerText.includes('accountchooser') ||
    lowerText.includes('sign in - google accounts')
  );
}

async function fetchUpstreamText(targetUrl: URL, signal: AbortSignal) {
  const upstream = await fetch(targetUrl.toString(), {
    method: 'GET',
    redirect: 'follow',
    signal,
    headers: {
      Accept: 'application/json, text/csv, text/plain, */*',
    },
  });
  const text = await upstream.text();
  return {
    ok: upstream.ok,
    status: upstream.status,
    finalUrl: upstream.url || targetUrl.toString(),
    text: text.trim(),
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));

  app.post('/api/sheet-sync', async (req, res) => {
    const body = (req.body ?? {}) as {
      scriptUrl?: unknown;
      secretKey?: unknown;
      sheetName?: unknown;
    };
    let rawUrl = typeof body.scriptUrl === 'string' ? body.scriptUrl.trim() : '';
    const secretKey = typeof body.secretKey === 'string' ? body.secretKey.trim() : '';
    const sheetName = typeof body.sheetName === 'string' ? body.sheetName.trim() : '';

    if (!rawUrl) {
      res.status(400).json({ error: 'กรุณาระบุ URL ของ Google Apps Script หรือ Google Sheet' });
      return;
    }

    if (/^AKfycb[A-Za-z0-9_-]{20,}$/.test(rawUrl)) {
      rawUrl = `https://script.google.com/macros/s/${rawUrl}/exec`;
    }

    let endpoint: URL;
    try {
      endpoint = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'รูปแบบ URL ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
      return;
    }

    if (endpoint.protocol !== 'https:') {
      res.status(400).json({
        error: 'URL ต้องขึ้นต้นด้วย https:// เพื่อความปลอดภัยในการเชื่อมต่อ',
      });
      return;
    }

    const isGas = ALLOWED_GAS_HOSTS.has(endpoint.hostname);
    const isSheet = ALLOWED_SHEET_HOSTS.has(endpoint.hostname);

    if (!isGas && !isSheet) {
      res.status(400).json({
        code: 'UNSUPPORTED_HOST',
        error:
          'รองรับ URL ของ Google Apps Script (script.google.com) หรือ Google Sheet (docs.google.com)',
      });
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      // Branch 1: Direct Google Sheets CSV sync
      if (isSheet) {
        const csvUrl = buildGoogleSheetCsvUrl(endpoint);
        if (!csvUrl) {
          res.status(400).json({
            error: 'ลิงก์ docs.google.com ไม่ใช่ลิงก์ Google Sheets ที่ถูกต้อง',
          });
          return;
        }
        const sheetRes = await fetchUpstreamText(csvUrl, controller.signal);
        if (
          isGoogleLoginHtml(sheetRes.text, sheetRes.finalUrl) ||
          sheetRes.text.startsWith('<!DOCTYPE') ||
          sheetRes.text.startsWith('<html')
        ) {
          res.status(403).json({
            code: 'REQUIRES_LOGIN',
            error:
              'Google Sheet นี้ยังไม่ได้เปิดสิทธิ์สาธารณะ — กรุณากดปุ่ม "แชร์" ใน Google Sheet แล้วเลือก "ทุกคนที่มีลิงก์ (ผู้มีสิทธิ์อ่าน)" หรือใช้เมนู "นำเข้า CSV / JSON ด้านล่าง" แทน',
          });
          return;
        }
        if (!sheetRes.ok) {
          res.status(502).json({
            error: `ไม่สามารถดึงข้อมูลจาก Google Sheet ได้ (HTTP ${sheetRes.status})`,
          });
          return;
        }
        const rows = parseCsvToRows(sheetRes.text);
        res.status(200).json({
          updatedAt: new Date().toISOString(),
          count: rows.length,
          rows,
        });
        return;
      }

      // Branch 2: Google Apps Script Web App
      appendQueryParams(endpoint, secretKey, sheetName);
      let result = await fetchUpstreamText(endpoint, controller.signal);

      if (isGoogleLoginHtml(result.text, result.finalUrl)) {
        const publicFallback = buildFallbackPublicGasUrl(endpoint);
        if (publicFallback) {
          result = await fetchUpstreamText(publicFallback, controller.signal);
        }
      }

      if (isGoogleLoginHtml(result.text, result.finalUrl)) {
        res.status(403).json({
          code: 'REQUIRES_LOGIN',
          error:
            'Google Apps Script นี้ยังบังคับให้ล็อกอินบัญชีองค์กร (ServiceLogin) ทำให้เว็บภายนอกดึงข้อมูลอัตโนมัติไม่ได้ — วิธีแก้: (1) ใน Apps Script กด Deploy รายการใหม่แล้วตั้ง "ผู้ที่มีสิทธิ์เข้าถึง" เป็น "ทุกคน (Anyone)" แล้วนำ URL ใหม่มาวาง, (2) หรือเปิดแชร์ Google Sheet แบบ "ทุกคนที่มีลิงก์ดูได้" แล้ววางลิงก์ Google Sheet แทน, (3) หรือกด "เปิดลิงก์ชีตในแท็บใหม่" แล้วคัดลอก JSON / อัปโหลด CSV ด้านล่าง',
        });
        return;
      }

      if (!result.ok) {
        res.status(502).json({
          error: `Google Apps Script ตอบกลับสถานะ HTTP ${result.status} กรุณาตรวจสอบ URL และสิทธิ์การ Deploy`,
        });
        return;
      }

      if (
        result.text.startsWith('<!DOCTYPE') ||
        result.text.startsWith('<html') ||
        result.text.startsWith('<HTML')
      ) {
        res.status(502).json({
          error:
            'Google Apps Script ส่งกลับเป็นหน้าเว็บ HTML แทน JSON กรุณาตรวจสอบว่า URL ลงท้ายด้วย /exec และตั้งค่าสิทธิ์เป็น "ทุกคน (Anyone)"',
        });
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.text);
      } catch {
        res.status(502).json({
          error:
            'ข้อมูลที่ได้รับจาก Google Apps Script ไม่ใช่รูปแบบ JSON ที่ถูกต้อง กรุณาตรวจสอบฟังก์ชัน doGet(e)',
        });
        return;
      }

      res.status(200).json(parsed);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        res.status(504).json({
          error:
            'Google Apps Script ใช้เวลาประมวลผลนานเกิน 2 นาที (มักเกิดจากชีตมีแถวว่าง/สูตรจำนวนมากใน getDataRange()) กรุณาลองกด Sync อีกครั้ง หรือลดแถวว่างในชีต / วางลิงก์ Google Sheet โดยตรงแทน',
        });
        return;
      }
      res.status(502).json({
        error:
          'ไม่สามารถติดต่อเซิร์ฟเวอร์ Google ได้ในขณะนี้ กรุณาตรวจสอบ URL และลองใหม่อีกครั้ง',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Autocorp x PB Manpower Control Tower running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
