import { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageSquare,
  RotateCcw,
  Search,
} from 'lucide-react';
import type {
  AttendanceEntry,
  AttendanceStatus,
  EmployeeRow,
} from '../types/manpower';
import { downloadCsv, formatThaiDate } from '../services/sheetSync';
import { getTodayIsoDate } from '../data/mockData';

interface ChecklistViewProps {
  employees: EmployeeRow[];
  selectedDate: string;
  onChangeDate: (date: string) => void;
  dayAttendance: Record<string, AttendanceEntry>;
  onUpdateStatus: (employeeId: string, status: AttendanceStatus) => void;
  onUpdateNote: (employeeId: string, note: string) => void;
  onBulkMarkPresent: (employeeIds: string[]) => void;
  isMockMode: boolean;
  onGoToSync: () => void;
}

type StatusFilter = 'all' | AttendanceStatus | 'unchecked';

const STATUS_OPTIONS: {
  key: AttendanceStatus;
  label: string;
  activeClass: string;
}[] = [
  {
    key: 'present',
    label: 'มา',
    activeClass: 'bg-emerald-600 text-white border-emerald-600',
  },
  {
    key: 'late',
    label: 'สาย',
    activeClass: 'bg-amber-600 text-white border-amber-600',
  },
  {
    key: 'absent',
    label: 'ขาด',
    activeClass: 'bg-rose-600 text-white border-rose-600',
  },
  {
    key: 'leave',
    label: 'ลา',
    activeClass: 'bg-sky-600 text-white border-sky-600',
  },
];

const STATUS_LABEL_TH: Record<AttendanceStatus, string> = {
  present: 'มา',
  late: 'สาย',
  absent: 'ขาด',
  leave: 'ลา',
};

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export function ChecklistView({
  employees,
  selectedDate,
  onChangeDate,
  dayAttendance,
  onUpdateStatus,
  onUpdateNote,
  onBulkMarkPresent,
  isMockMode,
  onGoToSync,
}: ChecklistViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const sections = useMemo(
    () => Array.from(new Set(employees.map((e) => e.ส่วนงาน))).sort((a, b) => a.localeCompare(b, 'th')),
    [employees],
  );
  const channels = useMemo(
    () =>
      Array.from(new Set(employees.map((e) => e['ช่องทางหลัก (Channel)']))).sort((a, b) =>
        a.localeCompare(b, 'th'),
      ),
    [employees],
  );
  const departments = useMemo(
    () => Array.from(new Set(employees.map((e) => e.แผนก))).sort((a, b) => a.localeCompare(b, 'th')),
    [employees],
  );

  // Summary counts across ALL active employees for the selected date
  const summary = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let leave = 0;
    let unchecked = 0;

    for (const emp of employees) {
      const entry = dayAttendance[emp.รหัสพนักงาน];
      if (!entry) {
        unchecked += 1;
      } else if (entry.status === 'present') {
        present += 1;
      } else if (entry.status === 'late') {
        late += 1;
      } else if (entry.status === 'absent') {
        absent += 1;
      } else if (entry.status === 'leave') {
        leave += 1;
      }
    }

    const total = employees.length;
    const attended = present + late;
    const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 0;

    return { total, present, late, absent, leave, unchecked, attendanceRate };
  }, [employees, dayAttendance]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employees.filter((emp) => {
      if (sectionFilter !== 'all' && emp.ส่วนงาน !== sectionFilter) return false;
      if (channelFilter !== 'all' && emp['ช่องทางหลัก (Channel)'] !== channelFilter) return false;
      if (deptFilter !== 'all' && emp.แผนก !== deptFilter) return false;

      const entry = dayAttendance[emp.รหัสพนักงาน];
      if (statusFilter === 'unchecked' && entry) return false;
      if (
        statusFilter !== 'all' &&
        statusFilter !== 'unchecked' &&
        entry?.status !== statusFilter
      ) {
        return false;
      }

      if (q) {
        const hay = [
          emp.รหัสพนักงาน,
          emp.รายชื่อพนักงาน,
          emp.ตำแหน่ง,
          emp.แผนก,
          emp.ส่วนงาน,
          emp['ช่องทางหลัก (Channel)'],
          emp.ช่องทางย่อย,
          emp.สังกัด,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [
    employees,
    dayAttendance,
    searchQuery,
    sectionFilter,
    channelFilter,
    deptFilter,
    statusFilter,
  ]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    sectionFilter !== 'all' ||
    channelFilter !== 'all' ||
    deptFilter !== 'all' ||
    statusFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setSectionFilter('all');
    setChannelFilter('all');
    setDeptFilter('all');
    setStatusFilter('all');
  };

  const handleOpenNote = (empId: string) => {
    setEditingNoteId(empId);
    setNoteDraft(dayAttendance[empId]?.note ?? '');
  };

  const handleSaveNote = (empId: string) => {
    onUpdateNote(empId, noteDraft.trim());
    setEditingNoteId(null);
  };

  const handleExportCsv = () => {
    const headers = [
      'วันที่',
      'รหัสพนักงาน',
      'รายชื่อพนักงาน',
      'Level',
      'ตำแหน่ง',
      'แผนก',
      'ส่วนงาน',
      'ช่องทางหลัก (Channel)',
      'ช่องทางย่อย',
      'สังกัด',
      'สถานะ',
      'หมายเหตุ',
    ];
    const rows = filteredEmployees.map((emp) => {
      const entry = dayAttendance[emp.รหัสพนักงาน];
      return [
        selectedDate,
        emp.รหัสพนักงาน,
        emp.รายชื่อพนักงาน,
        emp.Level,
        emp.ตำแหน่ง,
        emp.แผนก,
        emp.ส่วนงาน,
        emp['ช่องทางหลัก (Channel)'],
        emp.ช่องทางย่อย,
        emp.สังกัด,
        entry ? STATUS_LABEL_TH[entry.status] : 'ยังไม่เช็ค',
        entry?.note ?? '',
      ];
    });
    downloadCsv(`atc-checklist-${selectedDate}.csv`, headers, rows);
  };

  const today = getTodayIsoDate();

  return (
    <div className="space-y-6">
      {/* Subtle Mock Data Notice */}
      {isMockMode && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-teal-50/80 border border-teal-200/80 px-4 py-3 text-sm text-teal-950">
          <p className="leading-relaxed">
            ขณะนี้แสดงข้อมูลตัวอย่าง (Mock Data) จำนวน 10 คน คุณสามารถเชื่อมต่อ Google Sheet ของจริงได้ทันทีที่หน้าตั้งค่า
          </p>
          <button
            type="button"
            onClick={onGoToSync}
            className="text-sm font-semibold text-teal-800 hover:text-teal-950 underline underline-offset-4 whitespace-nowrap shrink-0 self-start sm:self-center"
          >
            ตั้งค่าเชื่อมต่อ Google Sheet
          </button>
        </div>
      )}

      {/* Date Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl bg-white border border-slate-200/90 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/70 p-1">
            <button
              type="button"
              onClick={() => onChangeDate(shiftIsoDate(selectedDate, -1))}
              className="rounded-md p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
              aria-label="วันก่อนหน้า"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <label className="relative flex items-center gap-2 px-2 py-1 text-sm font-medium text-slate-800 cursor-pointer">
              <Calendar className="h-4 w-4 text-teal-700 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) onChangeDate(e.target.value);
                }}
                className="bg-transparent text-sm font-medium text-slate-900 tabular-nums focus:outline-none cursor-pointer"
                aria-label="เลือกวันที่"
              />
            </label>
            <button
              type="button"
              onClick={() => onChangeDate(shiftIsoDate(selectedDate, 1))}
              className="rounded-md p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
              aria-label="วันถัดไป"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {selectedDate !== today && (
            <button
              type="button"
              onClick={() => onChangeDate(today)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              กลับไปวันนี้
            </button>
          )}

          <span className="text-sm text-slate-600">
            {formatThaiDate(selectedDate)}
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              onBulkMarkPresent(filteredEmployees.map((e) => e.รหัสพนักงาน))
            }
            disabled={filteredEmployees.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-700/25 bg-teal-50/70 px-3.5 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100/70 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <CheckCheck className="h-4 w-4 text-teal-700" />
            <span>ตั้งที่แสดงเป็น "มา"</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredEmployees.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>ส่งออก CSV</span>
          </button>
        </div>
      </div>

      {/* 5 Summary KPI Cards: Active / มา / สาย / ขาด / ลา */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`text-left rounded-xl bg-white p-4 border transition-colors ${
            statusFilter === 'all'
              ? 'border-teal-700 ring-1 ring-teal-700/20'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Active ทั้งหมด</span>
            <span className="tabular-nums text-teal-700 font-semibold">
              {summary.attendanceRate}% เข้างาน
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              {summary.total.toLocaleString('th-TH')}
            </span>
            <span className="text-xs text-slate-500">คน</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {summary.unchecked > 0
              ? `ยังไม่เช็คชื่อ ${summary.unchecked} คน`
              : 'เช็คชื่อครบทุกคนแล้ว'}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter(statusFilter === 'present' ? 'all' : 'present')
          }
          className={`text-left rounded-xl bg-white p-4 border transition-colors ${
            statusFilter === 'present'
              ? 'border-emerald-600 ring-1 ring-emerald-600/20'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-emerald-700">
            <span>มาทำงาน (มา)</span>
            <span className="tabular-nums text-slate-500">
              {summary.total > 0
                ? Math.round((summary.present / summary.total) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tracking-tight text-emerald-700 tabular-nums">
              {summary.present.toLocaleString('th-TH')}
            </span>
            <span className="text-xs text-slate-500">คน</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">ปฏิบัติงานตรงเวลา</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'late' ? 'all' : 'late')}
          className={`text-left rounded-xl bg-white p-4 border transition-colors ${
            statusFilter === 'late'
              ? 'border-amber-600 ring-1 ring-amber-600/20'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-amber-700">
            <span>มาสาย (สาย)</span>
            <span className="tabular-nums text-slate-500">
              {summary.total > 0
                ? Math.round((summary.late / summary.total) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tracking-tight text-amber-700 tabular-nums">
              {summary.late.toLocaleString('th-TH')}
            </span>
            <span className="text-xs text-slate-500">คน</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">เข้างานหลังเวลาเริ่มกะ</div>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter(statusFilter === 'absent' ? 'all' : 'absent')
          }
          className={`text-left rounded-xl bg-white p-4 border transition-colors ${
            statusFilter === 'absent'
              ? 'border-rose-600 ring-1 ring-rose-600/20'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-rose-700">
            <span>ขาดงาน (ขาด)</span>
            <span className="tabular-nums text-slate-500">
              {summary.total > 0
                ? Math.round((summary.absent / summary.total) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tracking-tight text-rose-700 tabular-nums">
              {summary.absent.toLocaleString('th-TH')}
            </span>
            <span className="text-xs text-slate-500">คน</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">ไม่พบการเข้างาน / รอติดตาม</div>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter(statusFilter === 'leave' ? 'all' : 'leave')
          }
          className={`text-left rounded-xl bg-white p-4 border transition-colors col-span-2 sm:col-span-1 ${
            statusFilter === 'leave'
              ? 'border-sky-600 ring-1 ring-sky-600/20'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-sky-700">
            <span>ลางาน (ลา)</span>
            <span className="tabular-nums text-slate-500">
              {summary.total > 0
                ? Math.round((summary.leave / summary.total) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tracking-tight text-sky-700 tabular-nums">
              {summary.leave.toLocaleString('th-TH')}
            </span>
            <span className="text-xs text-slate-500">คน</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500">ลาป่วย / ลากิจ / พักร้อน</div>
        </button>
      </div>

      {/* Main Table Panel (Search + Filters + Checklist Table) */}
      <section className="rounded-xl bg-white border border-slate-200/90 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 sm:px-5 border-b border-slate-200/80 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหารหัสพนักงาน, ชื่อ-นามสกุล, ตำแหน่ง, ช่องทางย่อย..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-600 transition-colors"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 lg:flex lg:items-center">
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                aria-label="กรองตามส่วนงาน"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600"
              >
                <option value="all">ทุกส่วนงาน ({sections.length})</option>
                {sections.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                aria-label="กรองตามช่องทางหลัก"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600"
              >
                <option value="all">ทุกช่องทางหลัก ({channels.length})</option>
                {channels.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                aria-label="กรองตามแผนก"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600"
              >
                <option value="all">ทุกแผนก ({departments.length})</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Segmented Status Filter Bar + Result Count */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100/90 p-1">
              {(
                [
                  { id: 'all', label: 'ทั้งหมด' },
                  { id: 'present', label: 'มา' },
                  { id: 'late', label: 'สาย' },
                  { id: 'absent', label: 'ขาด' },
                  { id: 'leave', label: 'ลา' },
                  { id: 'unchecked', label: 'ยังไม่เช็ค' },
                ] as { id: StatusFilter; label: string }[]
              ).map((tab) => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-teal-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="tabular-nums">
                แสดง {filteredEmployees.length.toLocaleString('th-TH')} จาก{' '}
                {employees.length.toLocaleString('th-TH')} คน
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 font-medium text-teal-700 hover:text-teal-900 whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>ล้างตัวกรอง</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Employee Checklist Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <th className="py-3 pl-5 pr-3 whitespace-nowrap">รหัสพนักงาน</th>
                <th className="py-3 px-3 whitespace-nowrap">รายชื่อพนักงาน / ตำแหน่ง</th>
                <th className="py-3 px-3 whitespace-nowrap">ส่วนงาน / แผนก</th>
                <th className="py-3 px-3 whitespace-nowrap">ช่องทางหลัก / ช่องทางย่อย</th>
                <th className="py-3 px-3 whitespace-nowrap">สังกัด</th>
                <th className="py-3 px-3 whitespace-nowrap">สถานะประจำวัน</th>
                <th className="py-3 pl-3 pr-5 whitespace-nowrap">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-5 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      ไม่พบรายชื่อพนักงานตามเงื่อนไขที่เลือก
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      ลองปรับคำค้นหาหรือล้างตัวกรองเพื่อดูรายชื่อทั้งหมด
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>ล้างตัวกรองทั้งหมด</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const entry = dayAttendance[emp.รหัสพนักงาน];
                  const isEditingNote = editingNoteId === emp.รหัสพนักงาน;
                  return (
                    <tr
                      key={emp.รหัสพนักงาน}
                      className="hover:bg-teal-50/30 transition-colors"
                    >
                      <td className="py-3.5 pl-5 pr-3 align-middle whitespace-nowrap">
                        <span className="font-mono text-xs font-medium text-slate-700 tabular-nums">
                          {emp.รหัสพนักงาน}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 align-middle min-w-[200px]">
                        <div className="font-medium text-slate-900 leading-snug">
                          {emp.รายชื่อพนักงาน}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                          <span>{emp.ตำแหน่ง}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-slate-600">{emp.Level}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-middle min-w-[180px]">
                        <div className="text-sm text-slate-800 leading-snug">
                          {emp.ส่วนงาน}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {emp.แผนก}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-middle min-w-[165px]">
                        <div className="text-sm font-medium text-teal-900 leading-snug">
                          {emp['ช่องทางหลัก (Channel)']}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {emp.ช่องทางย่อย}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 align-middle whitespace-nowrap text-xs text-slate-600">
                        {emp.สังกัด}
                      </td>

                      <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                        <div
                          className="inline-flex items-center gap-1"
                          role="group"
                          aria-label={`สถานะเข้างานของ ${emp.รายชื่อพนักงาน}`}
                        >
                          {STATUS_OPTIONS.map((opt) => {
                            const selected = entry?.status === opt.key;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() =>
                                  onUpdateStatus(emp.รหัสพนักงาน, opt.key)
                                }
                                className={`min-w-[42px] px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                                  selected
                                    ? opt.activeClass
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                                aria-pressed={selected}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      <td className="py-3.5 pl-3 pr-5 align-middle min-w-[170px]">
                        {isEditingNote ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveNote(emp.รหัสพนักงาน);
                                if (e.key === 'Escape') setEditingNoteId(null);
                              }}
                              placeholder="ระบุเหตุผล..."
                              autoFocus
                              className="w-36 rounded-md border border-teal-600 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveNote(emp.รหัสพนักงาน)}
                              className="rounded-md bg-teal-700 px-2 py-1 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap"
                            >
                              บันทึก
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenNote(emp.รหัสพนักงาน)}
                            className="group inline-flex items-center gap-1.5 text-left text-xs text-slate-500 hover:text-teal-800 max-w-[200px]"
                          >
                            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-teal-700" />
                            <span className="truncate">
                              {entry?.note ? entry.note : 'เพิ่มหมายเหตุ'}
                            </span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
