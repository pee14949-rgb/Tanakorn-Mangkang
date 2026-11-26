import { useCallback, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import type {
  AttendanceStatus,
  AttendanceStore,
  DataState,
  NavigationTab,
  SheetConfig,
} from './types/manpower';
import { getTodayIsoDate } from './data/mockData';
import {
  clearCachedDataState,
  fetchFromGoogleSheet,
  getMockDataState,
  importFromCsvText,
  importFromRawJsonText,
  loadAttendanceStore,
  loadInitialDataState,
  loadSheetConfig,
  saveAttendanceStore,
  saveSheetConfig,
} from './services/sheetSync';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ChecklistView } from './components/ChecklistView';
import { DashboardView } from './components/DashboardView';
import { EmployeesView } from './components/EmployeesView';
import { SyncSettingsView } from './components/SyncSettingsView';

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('checklist');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [sheetConfig, setSheetConfig] = useState<SheetConfig>(() =>
    loadSheetConfig(),
  );
  const [dataState, setDataState] = useState<DataState>(() =>
    loadInitialDataState(),
  );
  const [attendanceStore, setAttendanceStore] = useState<AttendanceStore>(() =>
    loadAttendanceStore(),
  );
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getTodayIsoDate(),
  );

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncSuccessMessage, setLastSyncSuccessMessage] = useState<
    string | null
  >(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 5500);
  }, []);

  const handleSaveConfig = useCallback((nextConfig: SheetConfig) => {
    saveSheetConfig(nextConfig);
    setSheetConfig(nextConfig);
    setSyncError(null);
  }, []);

  const performSync = useCallback(
    async (configToUse: SheetConfig) => {
      saveSheetConfig(configToUse);
      setSheetConfig(configToUse);
      setIsSyncing(true);
      setSyncError(null);
      setLastSyncSuccessMessage(null);

      try {
        const fetched = await fetchFromGoogleSheet(configToUse);
        setDataState(fetched);
        const msg = `Sync สำเร็จ: ดึงข้อมูลพนักงานล่าสุด ${fetched.rows.length.toLocaleString('th-TH')} คนเรียบร้อยแล้ว`;
        setLastSyncSuccessMessage(msg);
        showToast('success', msg);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก Google Sheet';
        setSyncError(message);
        showToast('error', message);
      } finally {
        setIsSyncing(false);
      }
    },
    [showToast],
  );

  const handleImportRawJson = useCallback(
    (rawText: string) => {
      setSyncError(null);
      setLastSyncSuccessMessage(null);
      try {
        const imported = importFromRawJsonText(rawText);
        setDataState(imported);
        const msg = `นำเข้าข้อมูลสำเร็จ: อัปเดตพนักงานจำนวน ${imported.rows.length.toLocaleString('th-TH')} คนเรียบร้อยแล้ว`;
        setLastSyncSuccessMessage(msg);
        showToast('success', msg);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'ไม่สามารถอ่านข้อมูล JSON ได้ กรุณาตรวจสอบรูปแบบข้อมูล';
        setSyncError(message);
        showToast('error', message);
      }
    },
    [showToast],
  );

  const handleImportCsvText = useCallback(
    (csvText: string) => {
      setSyncError(null);
      setLastSyncSuccessMessage(null);
      try {
        const imported = importFromCsvText(csvText);
        setDataState(imported);
        const msg = `นำเข้าไฟล์ CSV สำเร็จ: อัปเดตพนักงานจำนวน ${imported.rows.length.toLocaleString('th-TH')} คนเรียบร้อยแล้ว`;
        setLastSyncSuccessMessage(msg);
        showToast('success', msg);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'ไม่สามารถอ่านไฟล์ CSV ได้ กรุณาตรวจสอบรูปแบบไฟล์';
        setSyncError(message);
        showToast('error', message);
      }
    },
    [showToast],
  );

  const handleTopBarSync = useCallback(() => {
    if (!sheetConfig.scriptUrl.trim()) {
      if (activeTab === 'sync') {
        const msg = 'กรุณาระบุ URL ของ Google Apps Script ก่อนกด Sync จากชีต';
        setSyncError(msg);
        showToast('error', msg);
      } else {
        setActiveTab('sync');
      }
      return;
    }
    void performSync(sheetConfig);
  }, [activeTab, sheetConfig, performSync, showToast]);

  const handleResetToMock = useCallback(() => {
    clearCachedDataState();
    const mock = getMockDataState();
    setDataState(mock);
    setSyncError(null);
    setLastSyncSuccessMessage(null);
    showToast('success', 'สลับกลับไปแสดงข้อมูลตัวอย่าง (Mock Data) จำนวน 10 คนแล้ว');
  }, [showToast]);

  const handleUpdateAttendanceStatus = useCallback(
    (employeeId: string, status: AttendanceStatus) => {
      setAttendanceStore((prev) => {
        const prevDay = prev[selectedDate] ?? {};
        const prevEntry = prevDay[employeeId];
        const next: AttendanceStore = {
          ...prev,
          [selectedDate]: {
            ...prevDay,
            [employeeId]: {
              status,
              note: prevEntry?.note,
              updatedAt: new Date().toISOString(),
            },
          },
        };
        saveAttendanceStore(next);
        return next;
      });
    },
    [selectedDate],
  );

  const handleUpdateAttendanceNote = useCallback(
    (employeeId: string, note: string) => {
      setAttendanceStore((prev) => {
        const prevDay = prev[selectedDate] ?? {};
        const prevEntry = prevDay[employeeId];
        const next: AttendanceStore = {
          ...prev,
          [selectedDate]: {
            ...prevDay,
            [employeeId]: {
              status: prevEntry?.status ?? 'present',
              note: note || undefined,
              updatedAt: new Date().toISOString(),
            },
          },
        };
        saveAttendanceStore(next);
        return next;
      });
    },
    [selectedDate],
  );

  const handleBulkMarkPresent = useCallback(
    (employeeIds: string[]) => {
      if (employeeIds.length === 0) return;
      const nowIso = new Date().toISOString();
      setAttendanceStore((prev) => {
        const prevDay = { ...(prev[selectedDate] ?? {}) };
        for (const id of employeeIds) {
          prevDay[id] = {
            status: 'present',
            note: prevDay[id]?.note,
            updatedAt: nowIso,
          };
        }
        const next: AttendanceStore = {
          ...prev,
          [selectedDate]: prevDay,
        };
        saveAttendanceStore(next);
        return next;
      });
      showToast(
        'success',
        `บันทึกสถานะ "มาทำงาน" ให้พนักงานที่แสดง ${employeeIds.length.toLocaleString('th-TH')} คนแล้ว`,
      );
    },
    [selectedDate, showToast],
  );

  const dayAttendance = attendanceStore[selectedDate] ?? {};

  return (
    <div className="min-h-screen bg-[#F4F7F7] text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        dataState={dataState}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="lg:pl-64 flex flex-col min-h-screen">
        <TopBar
          activeTab={activeTab}
          dataState={dataState}
          hasConfiguredUrl={Boolean(sheetConfig.scriptUrl.trim())}
          isSyncing={isSyncing}
          onSyncNow={handleTopBarSync}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
          <div className="mx-auto max-w-[1400px]">
            {activeTab === 'checklist' && (
              <ChecklistView
                employees={dataState.rows}
                selectedDate={selectedDate}
                onChangeDate={setSelectedDate}
                dayAttendance={dayAttendance}
                onUpdateStatus={handleUpdateAttendanceStatus}
                onUpdateNote={handleUpdateAttendanceNote}
                onBulkMarkPresent={handleBulkMarkPresent}
                isMockMode={dataState.source === 'mock'}
                onGoToSync={() => setActiveTab('sync')}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardView
                employees={dataState.rows}
                selectedDate={selectedDate}
                dayAttendance={dayAttendance}
              />
            )}

            {activeTab === 'employees' && (
              <EmployeesView
                employees={dataState.rows}
                attendanceStore={attendanceStore}
              />
            )}

            {activeTab === 'sync' && (
              <SyncSettingsView
                config={sheetConfig}
                onChangeConfig={setSheetConfig}
                dataState={dataState}
                isSyncing={isSyncing}
                syncError={syncError}
                lastSyncSuccessMessage={lastSyncSuccessMessage}
                onSaveConfig={handleSaveConfig}
                onSaveAndSync={performSync}
                onImportRawJson={handleImportRawJson}
                onImportCsvText={handleImportCsvText}
                onResetToMock={handleResetToMock}
              />
            )}
          </div>
        </main>
      </div>

      {/* Non-intrusive Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 max-w-md rounded-xl border bg-white px-4 py-3 shadow-lg flex items-start gap-3 border-slate-200"
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <p className="text-sm text-slate-800 leading-snug">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-700 p-0.5 shrink-0"
            aria-label="ปิดการแจ้งเตือน"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
