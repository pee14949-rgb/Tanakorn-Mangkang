import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  FileJson,
  RefreshCw,
  RotateCcw,
  Save,
  Upload,
} from 'lucide-react';
import type { DataState, SheetConfig } from '../types/manpower';
import {
  buildRequestUrlWithSecret,
  formatThaiDateTime,
} from '../services/sheetSync';

interface SyncSettingsViewProps {
  config: SheetConfig;
  onChangeConfig: (config: SheetConfig) => void;
  dataState: DataState;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncSuccessMessage: string | null;
  onSaveConfig: (config: SheetConfig) => void;
  onSaveAndSync: (config: SheetConfig) => Promise<void>;
  onImportRawJson: (rawText: string) => void;
  onImportCsvText: (csvText: string) => void;
  onResetToMock: () => void;
}

const SAMPLE_APPS_SCRIPT = `function doGet(e) {
  var SECRET = 'YOUR_SECRET_KEY';
  var key = (e && e.parameter && (e.parameter.key || e.parameter.secret || e.parameter.token)) || '';
  if (SECRET && key !== SECRET) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: 'Unauthorized: Invalid Secret Key' })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var rows = [];

  for (var i = 1; i < values.length; i++) {
    if (!values[i].join('').trim()) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[String(headers[j]).trim()] = values[i][j];
    }
    rows.push(obj);
  }

  var payload = {
    updatedAt: new Date().toISOString(),
    count: rows.length,
    rows: rows
  };

  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}`;

const EXPECTED_JSON_SAMPLE = `{
  "updatedAt": "2026-11-25T07:30:00.000Z",
  "count": 10,
  "rows": [
    {
      "Level": "L3",
      "ตำแหน่ง": "เจ้าหน้าที่อาวุโสบริการลูกค้า",
      "รหัสพนักงาน": "ATC-1002",
      "รายชื่อพนักงาน": "สุภาวดี เจริญกิจ",
      "แผนก": "ปฏิบัติการลูกค้าสัมพันธ์",
      "ส่วนงาน": "ส่วนงานบริการลูกค้าองค์กร",
      "ช่องทางหลัก (Channel)": "Voice Inbound",
      "ช่องทางย่อย": "สายด่วนลูกค้าทั่วไป",
      "สังกัด": "ATC สำนักงานใหญ่"
    }
  ]
}`;

export function SyncSettingsView({
  config,
  onChangeConfig,
  dataState,
  isSyncing,
  syncError,
  lastSyncSuccessMessage,
  onSaveConfig,
  onSaveAndSync,
  onImportRawJson,
  onImportCsvText,
  onResetToMock,
}: SyncSettingsViewProps) {
  const [showSecret, setShowSecret] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [rawJsonInput, setRawJsonInput] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const csvFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isSyncing) {
      setElapsedSec(0);
      return;
    }
    setElapsedSec(0);
    const interval = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isSyncing]);

  const previewEndpointUrl = buildRequestUrlWithSecret(config);

  const handleSaveOnly = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      scriptUrl: config.scriptUrl.trim(),
      secretKey: config.secretKey.trim(),
      sheetName: (config.sheetName ?? '').trim(),
    });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleSyncClick = async () => {
    await onSaveAndSync({
      scriptUrl: config.scriptUrl.trim(),
      secretKey: config.secretKey.trim(),
      sheetName: (config.sheetName ?? '').trim(),
    });
  };

  const handleManualImport = () => {
    onImportRawJson(rawJsonInput);
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      onImportCsvText(text);
    } finally {
      e.target.value = '';
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(SAMPLE_APPS_SCRIPT);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Clipboard blocked in some iframe contexts
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Connection Form */}
        <section className="lg:col-span-2 rounded-xl bg-white border border-slate-200/90 p-6">
          <div className="pb-5 border-b border-slate-200/80">
            <h2 className="text-base font-semibold text-slate-900">
              เชื่อมต่อ Google Sheet / Google Apps Script
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              วาง URL ของ Google Apps Script (/exec) หรือวางลิงก์ Google Sheet โดยตรงที่เปิดแชร์แบบ "ทุกคนที่มีลิงก์ดูได้" ระบบจะบันทึกค่าไว้ใน localStorage เพื่อกดดึงข้อมูลล่าสุดได้ตลอดเวลา
            </p>
          </div>

          <form onSubmit={handleSaveOnly} className="mt-5 space-y-5">
            <div>
              <label
                htmlFor="gas-url"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                URL ของ Google Apps Script หรือ Google Sheet
              </label>
              <input
                id="gas-url"
                type="text"
                inputMode="url"
                value={config.scriptUrl}
                onChange={(e) =>
                  onChangeConfig({ ...config, scriptUrl: e.target.value })
                }
                placeholder="https://script.google.com/macros/s/.../exec หรือ https://docs.google.com/spreadsheets/d/..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-600 transition-colors"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                รองรับทั้ง Google Apps Script Web App (ตั้งสิทธิ์ Anyone) และลิงก์ Google Sheet (แชร์แบบทุกคนที่มีลิงก์อ่านได้)
              </p>
            </div>

            <div>
              <label
                htmlFor="gas-secret"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Secret Key (สำหรับ Google Apps Script)
              </label>
              <div className="relative">
                <input
                  id="gas-secret"
                  type={showSecret ? 'text' : 'password'}
                  value={config.secretKey}
                  onChange={(e) =>
                    onChangeConfig({ ...config, secretKey: e.target.value })
                  }
                  placeholder="ระบุ Secret Key สำหรับยืนยันตัวตน"
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-3.5 pr-11 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-600 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  aria-label={showSecret ? 'ซ่อน Secret Key' : 'แสดง Secret Key'}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                ระบบจะส่งพารามิเตอร์ <code className="font-mono text-slate-700">key</code> / <code className="font-mono text-slate-700">secret</code> / <code className="font-mono text-slate-700">token</code> ไปพร้อมคำขอดึงข้อมูลโดยอัตโนมัติ
              </p>
            </div>

            <div>
              <label
                htmlFor="gas-sheet-name"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                ชื่อแท็บชีต (ไม่บังคับ — กรณี Apps Script รับค่า ?sheet=...)
              </label>
              <input
                id="gas-sheet-name"
                type="text"
                value={config.sheetName ?? ''}
                onChange={(e) =>
                  onChangeConfig({ ...config, sheetName: e.target.value })
                }
                placeholder="เช่น Manpower หรือ Active (เว้นว่างได้หากสคริปต์กำหนดชื่อไว้แล้ว)"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-600 transition-colors"
              />
            </div>

            {/* Live Syncing Progress Banner */}
            {isSyncing && (
              <div
                role="status"
                className="flex items-center justify-between gap-2.5 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900"
              >
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-teal-700" />
                  <span>
                    กำลังเชื่อมต่อและดึงข้อมูลล่าสุดจาก Google Sheet (หากชีตมีข้อมูลเยอะอาจใช้เวลา 15–60 วินาที)...
                  </span>
                </div>
                <span className="font-mono text-xs font-semibold text-teal-800 tabular-nums shrink-0">
                  {elapsedSec} วิ
                </span>
              </div>
            )}

            {/* Feedback Banner */}
            {!isSyncing && syncError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 leading-relaxed"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{syncError}</span>
              </div>
            )}

            {!isSyncing && lastSyncSuccessMessage && !syncError && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{lastSyncSuccessMessage}</span>
              </div>
            )}

            {savedNotice && (
              <div className="text-xs font-medium text-teal-800">
                บันทึก URL และ Secret Key ลงใน localStorage เรียบร้อยแล้ว
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSyncClick}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F766E] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0D5F59] active:bg-[#0B4F4A] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`}
                />
                <span>{isSyncing ? 'กำลังดึงข้อมูลจากชีต...' : 'Sync จากชีต'}</span>
              </button>

              <button
                type="submit"
                disabled={isSyncing}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <Save className="h-4 w-4 text-slate-500" />
                <span>บันทึกการตั้งค่า</span>
              </button>
            </div>
          </form>
        </section>

        {/* Current Dataset Status Card */}
        <aside className="rounded-xl bg-white border border-slate-200/90 p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Database className="h-5 w-5 text-teal-700 shrink-0" />
            <h2 className="text-base font-semibold text-slate-900">
              สถานะชุดข้อมูลปัจจุบัน
            </h2>
          </div>

          <dl className="divide-y divide-slate-100 text-sm">
            <div className="py-2.5 flex items-center justify-between gap-2">
              <dt className="text-slate-500">แหล่งข้อมูล</dt>
              <dd className="font-semibold text-teal-900">
                {dataState.source === 'sheet'
                  ? 'Google Sheet'
                  : 'ข้อมูลตัวอย่าง (Mock)'}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <dt className="text-slate-500">จำนวนพนักงาน</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                {dataState.rows.length.toLocaleString('th-TH')} คน
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <dt className="text-slate-500">อัปเดตล่าสุด</dt>
              <dd className="text-xs font-medium text-slate-700 tabular-nums text-right">
                {formatThaiDateTime(dataState.updatedAt)}
              </dd>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <dt className="text-slate-500">URL ที่บันทึกไว้</dt>
              <dd className="text-xs font-medium text-slate-700">
                {config.scriptUrl ? 'ตั้งค่าแล้ว' : 'ยังไม่ได้ระบุ'}
              </dd>
            </div>
          </dl>

          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onResetToMock}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>กลับไปใช้ข้อมูลตัวอย่าง (10 คน)</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Fallback for Google Workspace Restricted Web Apps: Open Link + Paste JSON OR Upload CSV */}
      <section className="rounded-xl bg-white border border-slate-200/90 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <FileJson className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                นำเข้าข้อมูลโดยตรง (JSON หรือไฟล์ CSV) — กรณีบัญชีองค์กรจำกัดสิทธิ์ภายนอก
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                เปิดลิงก์ Apps Script ในแท็บใหม่ด้วยบัญชีองค์กรแล้วคัดลอก JSON มาวาง หรือเลือกไฟล์ .csv ที่ดาวน์โหลดจาก Google Sheet (ไฟล์ → ดาวน์โหลด → CSV) ได้ทันที
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {previewEndpointUrl && (
              <a
                href={previewEndpointUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-700/25 bg-teal-50/70 px-3.5 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100/70 transition-colors whitespace-nowrap shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5 text-teal-700" />
                <span>เปิดลิงก์ชีตในแท็บใหม่</span>
              </a>
            )}
            <input
              ref={csvFileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => csvFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5 text-teal-700" />
              <span>อัปโหลดไฟล์ CSV</span>
            </button>
          </div>
        </div>

        <textarea
          value={rawJsonInput}
          onChange={(e) => setRawJsonInput(e.target.value)}
          rows={4}
          placeholder='วาง JSON ที่คัดลอกมาจากหน้าเว็บ Apps Script เช่น { "updatedAt": "...", "count": ..., "rows": [...] }'
          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-600 transition-colors"
        />

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            ข้อมูลที่นำเข้าจะถูกบันทึกไว้ในเครื่อง (localStorage) และอัปเดตทันทีทั้งเช็คลิสต์ แดชบอร์ด และรายชื่อพนักงาน
          </span>
          <button
            type="button"
            onClick={handleManualImport}
            disabled={!rawJsonInput.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-teal-700 bg-white px-4 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
          >
            <FileJson className="h-4 w-4" />
            <span>นำเข้าข้อมูล JSON</span>
          </button>
        </div>
      </section>

      {/* Collapsible JSON Format & Apps Script Reference */}
      <section className="rounded-xl bg-white border border-slate-200/90 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowGuide((prev) => !prev)}
          className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-slate-50/70 transition-colors"
          aria-expanded={showGuide}
        >
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              รูปแบบ JSON ที่รองรับและตัวอย่างโค้ด Google Apps Script
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              ดูโครงสร้างคอลัมน์จาก Google Sheet และตัวอย่างฟังก์ชัน doGet(e) สำหรับเชื่อมต่อ
            </p>
          </div>
          {showGuide ? (
            <ChevronUp className="h-5 w-5 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" />
          )}
        </button>

        {showGuide && (
          <div className="px-6 pb-6 pt-2 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-2">
                รูปแบบ JSON Response ที่ระบบรองรับ
              </div>
              <pre className="rounded-lg bg-slate-900 text-slate-100 p-4 text-xs font-mono overflow-x-auto leading-relaxed">
                {EXPECTED_JSON_SAMPLE}
              </pre>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700">
                  ตัวอย่างโค้ด Google Apps Script (Code.gs)
                </span>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-900"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>คัดลอกแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>คัดลอกโค้ด</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="rounded-lg bg-slate-900 text-slate-100 p-4 text-xs font-mono overflow-x-auto leading-relaxed max-h-80">
                {SAMPLE_APPS_SCRIPT}
              </pre>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
