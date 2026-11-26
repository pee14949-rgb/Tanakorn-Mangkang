import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Download,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import type {
  AttendanceStatus,
  AttendanceStore,
  EmployeeRow,
} from '../types/manpower';
import { downloadCsv, formatThaiDate } from '../services/sheetSync';

interface EmployeesViewProps {
  employees: EmployeeRow[];
  attendanceStore: AttendanceStore;
}

type SortField =
  | 'รหัสพนักงาน'
  | 'รายชื่อพนักงาน'
  | 'Level'
  | 'ส่วนงาน'
  | 'ช่องทางหลัก (Channel)'
  | 'สังกัด';

const STATUS_LABEL_TH: Record<AttendanceStatus, { label: string; color: string }> = {
  present: { label: 'มา', color: 'text-emerald-700' },
  late: { label: 'สาย', color: 'text-amber-700' },
  absent: { label: 'ขาด', color: 'text-rose-700' },
  leave: { label: 'ลา', color: 'text-sky-700' },
};

export function EmployeesView({
  employees,
  attendanceStore,
}: EmployeesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [affiliationFilter, setAffiliationFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('รหัสพนักงาน');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRow | null>(
    null,
  );

  const filterOptions = useMemo(() => {
    const uniqueSorted = (selector: (e: EmployeeRow) => string) =>
      Array.from(new Set(employees.map(selector))).sort((a, b) =>
        a.localeCompare(b, 'th'),
      );
    return {
      sections: uniqueSorted((e) => e.ส่วนงาน),
      channels: uniqueSorted((e) => e['ช่องทางหลัก (Channel)']),
      departments: uniqueSorted((e) => e.แผนก),
      affiliations: uniqueSorted((e) => e.สังกัด),
      levels: uniqueSorted((e) => e.Level),
    };
  }, [employees]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = employees.filter((emp) => {
      if (sectionFilter !== 'all' && emp.ส่วนงาน !== sectionFilter) return false;
      if (channelFilter !== 'all' && emp['ช่องทางหลัก (Channel)'] !== channelFilter)
        return false;
      if (deptFilter !== 'all' && emp.แผนก !== deptFilter) return false;
      if (affiliationFilter !== 'all' && emp.สังกัด !== affiliationFilter)
        return false;
      if (levelFilter !== 'all' && emp.Level !== levelFilter) return false;

      if (q) {
        const hay = [
          emp.รหัสพนักงาน,
          emp.รายชื่อพนักงาน,
          emp.ตำแหน่ง,
          emp.Level,
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

    return [...filtered].sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      const cmp = av.localeCompare(bv, 'th', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [
    employees,
    searchQuery,
    sectionFilter,
    channelFilter,
    deptFilter,
    affiliationFilter,
    levelFilter,
    sortField,
    sortDir,
  ]);

  const hasFilters =
    searchQuery.trim() !== '' ||
    sectionFilter !== 'all' ||
    channelFilter !== 'all' ||
    deptFilter !== 'all' ||
    affiliationFilter !== 'all' ||
    levelFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setSectionFilter('all');
    setChannelFilter('all');
    setDeptFilter('all');
    setAffiliationFilter('all');
    setLevelFilter('all');
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'รหัสพนักงาน',
      'รายชื่อพนักงาน',
      'Level',
      'ตำแหน่ง',
      'แผนก',
      'ส่วนงาน',
      'ช่องทางหลัก (Channel)',
      'ช่องทางย่อย',
      'สังกัด',
    ];
    const rows = filteredAndSorted.map((emp) => [
      emp.รหัสพนักงาน,
      emp.รายชื่อพนักงาน,
      emp.Level,
      emp.ตำแหน่ง,
      emp.แผนก,
      emp.ส่วนงาน,
      emp['ช่องทางหลัก (Channel)'],
      emp.ช่องทางย่อย,
      emp.สังกัด,
    ]);
    downloadCsv('atc-employees-directory.csv', headers, rows);
  };

  const selectedEmployeeHistory = useMemo(() => {
    if (!selectedEmployee) return [];
    const empId = selectedEmployee.รหัสพนักงาน;
    return Object.entries(attendanceStore)
      .filter(([, dayMap]) => Boolean(dayMap[empId]))
      .map(([date, dayMap]) => ({
        date,
        entry: dayMap[empId],
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14);
  }, [selectedEmployee, attendanceStore]);

  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-white border border-slate-200/90 overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-4 sm:px-5 border-b border-slate-200/80 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหารหัสพนักงาน, รายชื่อ, ตำแหน่ง, แผนก, ส่วนงาน, ช่องทาง..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-600 transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredAndSorted.length === 0}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4 text-slate-500" />
              <span>ส่งออก CSV</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              aria-label="กรองตามส่วนงาน"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 focus:border-teal-600"
            >
              <option value="all">ทุกส่วนงาน ({filterOptions.sections.length})</option>
              {filterOptions.sections.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              aria-label="กรองตามช่องทางหลัก"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 focus:border-teal-600"
            >
              <option value="all">ทุกช่องทางหลัก ({filterOptions.channels.length})</option>
              {filterOptions.channels.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              aria-label="กรองตามแผนก"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 focus:border-teal-600"
            >
              <option value="all">ทุกแผนก ({filterOptions.departments.length})</option>
              {filterOptions.departments.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <select
              value={affiliationFilter}
              onChange={(e) => setAffiliationFilter(e.target.value)}
              aria-label="กรองตามสังกัด"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 focus:border-teal-600"
            >
              <option value="all">ทุกสังกัด ({filterOptions.affiliations.length})</option>
              {filterOptions.affiliations.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              aria-label="กรองตาม Level"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 focus:border-teal-600"
            >
              <option value="all">ทุก Level ({filterOptions.levels.length})</option>
              {filterOptions.levels.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
            <span className="tabular-nums">
              พบพนักงาน {filteredAndSorted.length.toLocaleString('th-TH')} จากทั้งหมด{' '}
              {employees.length.toLocaleString('th-TH')} คน · คลิกที่แถวเพื่อดูรายละเอียด
            </span>
            {hasFilters && (
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

        {/* Directory Table (all 9 columns from Google Sheet) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <th className="py-3 pl-5 pr-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('รหัสพนักงาน')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>รหัสพนักงาน</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('รายชื่อพนักงาน')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>รายชื่อพนักงาน</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('Level')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>Level</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">ตำแหน่ง</th>
                <th className="py-3 px-3 whitespace-nowrap">แผนก</th>
                <th className="py-3 px-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('ส่วนงาน')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>ส่วนงาน</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('ช่องทางหลัก (Channel)')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>ช่องทางหลัก (Channel)</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">ช่องทางย่อย</th>
                <th className="py-3 pl-3 pr-5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('สังกัด')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    <span>สังกัด</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 px-5 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      ไม่พบข้อมูลพนักงานที่ตรงกับเงื่อนไขการค้นหา
                    </p>
                    {hasFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>ล้างตัวกรองทั้งหมด</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((emp) => (
                  <tr
                    key={emp.รหัสพนักงาน}
                    onClick={() => setSelectedEmployee(emp)}
                    className="hover:bg-teal-50/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 pl-5 pr-3 font-mono text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap">
                      {emp.รหัสพนักงาน}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">
                      {emp.รายชื่อพนักงาน}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs font-semibold text-teal-800 whitespace-nowrap">
                      {emp.Level}
                    </td>
                    <td className="py-3 px-3 text-slate-700 min-w-[170px]">
                      {emp.ตำแหน่ง}
                    </td>
                    <td className="py-3 px-3 text-slate-600 min-w-[150px]">
                      {emp.แผนก}
                    </td>
                    <td className="py-3 px-3 text-slate-800 min-w-[170px]">
                      {emp.ส่วนงาน}
                    </td>
                    <td className="py-3 px-3 font-medium text-teal-900 whitespace-nowrap">
                      {emp['ช่องทางหลัก (Channel)']}
                    </td>
                    <td className="py-3 px-3 text-slate-600 min-w-[140px]">
                      {emp.ช่องทางย่อย}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-slate-600 whitespace-nowrap">
                      {emp.สังกัด}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Slide-over Employee Detail Drawer */}
      {selectedEmployee && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="รายละเอียดพนักงาน"
        >
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setSelectedEmployee(null)}
          />
          <div className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-y-auto">
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200">
              <div>
                <div className="font-mono text-xs font-semibold text-teal-800 tabular-nums">
                  {selectedEmployee.รหัสพนักงาน} · {selectedEmployee.Level}
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {selectedEmployee.รายชื่อพนักงาน}
                </h2>
                <p className="text-sm text-slate-600">
                  {selectedEmployee.ตำแหน่ง}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-3">
                  ข้อมูลสังกัดและโครงสร้างงาน
                </h3>
                <dl className="divide-y divide-slate-100 text-sm">
                  {(
                    [
                      ['แผนก', selectedEmployee.แผนก],
                      ['ส่วนงาน', selectedEmployee.ส่วนงาน],
                      ['ช่องทางหลัก (Channel)', selectedEmployee['ช่องทางหลัก (Channel)']],
                      ['ช่องทางย่อย', selectedEmployee.ช่องทางย่อย],
                      ['สังกัด', selectedEmployee.สังกัด],
                      ['ระดับ (Level)', selectedEmployee.Level],
                    ] as [string, string][]
                  ).map(([label, value]) => (
                    <div
                      key={label}
                      className="py-2.5 flex items-baseline justify-between gap-4"
                    >
                      <dt className="text-slate-500 shrink-0">{label}</dt>
                      <dd className="font-medium text-slate-900 text-right">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-3">
                  ประวัติการเช็คชื่อล่าสุด (บันทึกในเครื่อง)
                </h3>
                {selectedEmployeeHistory.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    ยังไม่มีประวัติการเช็คชื่อสำหรับพนักงานรายนี้
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 text-xs">
                    {selectedEmployeeHistory.map(({ date, entry }) => {
                      const meta = STATUS_LABEL_TH[entry.status];
                      return (
                        <li
                          key={date}
                          className="py-2.5 flex items-start justify-between gap-3"
                        >
                          <div>
                            <div className="font-medium text-slate-800">
                              {formatThaiDate(date)}
                            </div>
                            {entry.note && (
                              <div className="mt-0.5 text-slate-500">
                                หมายเหตุ: {entry.note}
                              </div>
                            )}
                          </div>
                          <span className={`font-semibold shrink-0 ${meta.color}`}>
                            {meta.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
