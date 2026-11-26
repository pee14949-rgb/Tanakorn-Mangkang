import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AttendanceEntry, EmployeeRow } from '../types/manpower';
import { formatThaiDate } from '../services/sheetSync';

interface DashboardViewProps {
  employees: EmployeeRow[];
  selectedDate: string;
  dayAttendance: Record<string, AttendanceEntry>;
}

const TEAL_PALETTE = [
  '#0F766E',
  '#0D9488',
  '#115E59',
  '#14B8A6',
  '#0E7490',
  '#2DD4BF',
  '#134E4A',
  '#0891B2',
];

interface GroupDatum {
  name: string;
  shortName: string;
  count: number;
  percent: number;
}

function shortenLabel(label: string, maxLen = 18): string {
  const cleaned = label.replace(/^ส่วนงาน/, '');
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1)}…`;
}

export function DashboardView({
  employees,
  selectedDate,
  dayAttendance,
}: DashboardViewProps) {
  const total = employees.length;

  const bySection = useMemo<GroupDatum[]>(() => {
    const counts = new Map<string, number>();
    for (const emp of employees) {
      const key = emp.ส่วนงาน || 'ไม่ระบุ';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        shortName: shortenLabel(name, 20),
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'));
  }, [employees, total]);

  const byChannel = useMemo<GroupDatum[]>(() => {
    const counts = new Map<string, number>();
    for (const emp of employees) {
      const key = emp['ช่องทางหลัก (Channel)'] || 'ไม่ระบุ';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        shortName: shortenLabel(name, 22),
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'));
  }, [employees, total]);

  const byAffiliation = useMemo<GroupDatum[]>(() => {
    const counts = new Map<string, number>();
    for (const emp of employees) {
      const key = emp.สังกัด || 'ไม่ระบุ';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        shortName: name,
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'));
  }, [employees, total]);

  const byLevel = useMemo<GroupDatum[]>(() => {
    const counts = new Map<string, number>();
    for (const emp of employees) {
      const key = emp.Level || 'ไม่ระบุ';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        shortName: name,
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.name.localeCompare(a.name, 'en'));
  }, [employees, total]);

  const attendanceSummary = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let leave = 0;
    for (const emp of employees) {
      const st = dayAttendance[emp.รหัสพนักงาน]?.status;
      if (st === 'present') present += 1;
      else if (st === 'late') late += 1;
      else if (st === 'absent') absent += 1;
      else if (st === 'leave') leave += 1;
    }
    const onDuty = present + late;
    const rate = total > 0 ? Math.round((onDuty / total) * 100) : 0;
    return { present, late, absent, leave, onDuty, rate };
  }, [employees, dayAttendance, total]);

  const sectionAttendanceRows = useMemo(() => {
    const map = new Map<
      string,
      {
        section: string;
        total: number;
        present: number;
        late: number;
        absent: number;
        leave: number;
      }
    >();

    for (const emp of employees) {
      const sec = emp.ส่วนงาน || 'ไม่ระบุ';
      const current = map.get(sec) ?? {
        section: sec,
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
      };
      current.total += 1;
      const st = dayAttendance[emp.รหัสพนักงาน]?.status;
      if (st === 'present') current.present += 1;
      else if (st === 'late') current.late += 1;
      else if (st === 'absent') current.absent += 1;
      else if (st === 'leave') current.leave += 1;
      map.set(sec, current);
    }

    return Array.from(map.values()).sort(
      (a, b) => b.total - a.total || a.section.localeCompare(b.section, 'th'),
    );
  }, [employees, dayAttendance]);

  if (employees.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-slate-200/90 p-10 text-center">
        <p className="text-base font-medium text-slate-800">
          ยังไม่มีข้อมูลพนักงานสำหรับแสดงผลบนแดชบอร์ด
        </p>
        <p className="mt-1 text-sm text-slate-500">
          กรุณาตรวจสอบการเชื่อมต่อ Google Sheet หรือรีเซ็ตกลับไปใช้ข้อมูลตัวอย่าง
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border border-slate-200/90 p-5">
          <div className="text-xs font-medium text-slate-500">
            กำลังคน Active ทั้งหมด
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              {total.toLocaleString('th-TH')}
            </span>
            <span className="text-xs text-slate-500">คน</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500 tabular-nums">
            กระจายใน {byAffiliation.length} สังกัด
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200/90 p-5">
          <div className="text-xs font-medium text-slate-500">
            จำนวนส่วนงาน
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-teal-800 tabular-nums">
              {bySection.length.toLocaleString('th-TH')}
            </span>
            <span className="text-xs text-slate-500">ส่วนงาน</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500 truncate">
            ใหญ่ที่สุด: {bySection[0]?.name ?? '-'}
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200/90 p-5">
          <div className="text-xs font-medium text-slate-500">
            ช่องทางหลัก (Channel)
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-teal-800 tabular-nums">
              {byChannel.length.toLocaleString('th-TH')}
            </span>
            <span className="text-xs text-slate-500">ช่องทาง</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500 truncate">
            หลัก: {byChannel[0]?.name ?? '-'} ({byChannel[0]?.count ?? 0} คน)
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200/90 p-5">
          <div className="text-xs font-medium text-slate-500">
            อัตราเข้าปฏิบัติงานประจำวัน
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-emerald-700 tabular-nums">
              {attendanceSummary.rate}%
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              ({attendanceSummary.onDuty}/{total} คน)
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-500 tabular-nums">
            มา {attendanceSummary.present} · สาย {attendanceSummary.late} · ขาด{' '}
            {attendanceSummary.absent} · ลา {attendanceSummary.leave}
          </div>
        </div>
      </div>

      {/* Primary Charts Row: Headcount by Section & Headcount by Channel */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        {/* Chart 1: จำนวนคนแยกตามส่วนงาน */}
        <section className="rounded-xl bg-white border border-slate-200/90 p-5 sm:p-6 flex flex-col">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                จำนวนคนแยกตามส่วนงาน
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                เปรียบเทียบกำลังคน Active ในแต่ละส่วนงาน ({bySection.length} ส่วนงาน)
              </p>
            </div>
            <span className="text-xs font-medium text-teal-800 tabular-nums whitespace-nowrap">
              รวม {total.toLocaleString('th-TH')} คน
            </span>
          </div>

          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={bySection}
                margin={{ top: 10, right: 16, left: -12, bottom: 24 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                />
                <XAxis
                  dataKey="shortName"
                  tick={{ fill: '#475569', fontSize: 12 }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={56}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#F0FDFA' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload as GroupDatum;
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm text-xs">
                        <div className="font-semibold text-slate-900">
                          {item.name}
                        </div>
                        <div className="mt-1 text-slate-600 tabular-nums">
                          กำลังคน:{' '}
                          <span className="font-semibold text-teal-800">
                            {item.count.toLocaleString('th-TH')} คน
                          </span>{' '}
                          ({item.percent}%)
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {bySection.map((entry, idx) => (
                    <Cell
                      key={entry.name}
                      fill={TEAL_PALETTE[idx % TEAL_PALETTE.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Chart 2: จำนวนคนแยกตามช่องทางหลัก (Channel) */}
        <section className="rounded-xl bg-white border border-slate-200/90 p-5 sm:p-6 flex flex-col">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                จำนวนคนแยกตามช่องทางหลัก (Channel)
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                การกระจายตัวของพนักงานตามช่องทางให้บริการหลัก ({byChannel.length} ช่องทาง)
              </p>
            </div>
            <span className="text-xs font-medium text-teal-800 tabular-nums whitespace-nowrap">
              รวม {total.toLocaleString('th-TH')} คน
            </span>
          </div>

          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byChannel}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 10, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#E2E8F0"
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: '#64748B', fontSize: 12 }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={126}
                  tick={{ fill: '#334155', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#F0FDFA' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload as GroupDatum;
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm text-xs">
                        <div className="font-semibold text-slate-900">
                          {item.name}
                        </div>
                        <div className="mt-1 text-slate-600 tabular-nums">
                          กำลังคน:{' '}
                          <span className="font-semibold text-teal-800">
                            {item.count.toLocaleString('th-TH')} คน
                          </span>{' '}
                          ({item.percent}%)
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={32}>
                  {byChannel.map((entry, idx) => (
                    <Cell
                      key={entry.name}
                      fill={TEAL_PALETTE[idx % TEAL_PALETTE.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Secondary Row: Daily Attendance by Section + Affiliation / Level Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
        {/* Table: Daily Attendance Summary by Section */}
        <section className="xl:col-span-2 rounded-xl bg-white border border-slate-200/90 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                สรุปเช็คลิสต์ประจำวันแยกตามส่วนงาน
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                ข้อมูล ณ วันที่ {formatThaiDate(selectedDate)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="py-3 pl-5 pr-3">ส่วนงาน</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Active</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">มา</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">สาย</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">ขาด</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">ลา</th>
                  <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">เข้าปฏิบัติงาน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sectionAttendanceRows.map((row) => {
                  const rate =
                    row.total > 0
                      ? Math.round(((row.present + row.late) / row.total) * 100)
                      : 0;
                  return (
                    <tr key={row.section} className="hover:bg-slate-50/70">
                      <td className="py-3 pl-5 pr-3 font-medium text-slate-800">
                        {row.section}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-900 tabular-nums">
                        {row.total}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-700 font-medium tabular-nums">
                        {row.present}
                      </td>
                      <td className="py-3 px-3 text-right text-amber-700 font-medium tabular-nums">
                        {row.late}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-700 font-medium tabular-nums">
                        {row.absent}
                      </td>
                      <td className="py-3 px-3 text-right text-sky-700 font-medium tabular-nums">
                        {row.leave}
                      </td>
                      <td className="py-3 pl-3 pr-5 text-right tabular-nums">
                        <div className="inline-flex items-center gap-2.5">
                          <div className="hidden sm:block w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-teal-600"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className="font-semibold text-slate-800 w-10 text-right">
                            {rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Distribution by Affiliation & Level */}
        <section className="rounded-xl bg-white border border-slate-200/90 p-5 sm:p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              สัดส่วนตามสังกัด
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              การกระจายกำลังคนตามศูนย์ปฏิบัติการ / สังกัด
            </p>
            <div className="mt-4 space-y-3">
              {byAffiliation.map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 truncate pr-2">
                      {item.name}
                    </span>
                    <span className="text-slate-600 tabular-nums shrink-0">
                      {item.count} คน ({item.percent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#0F766E]"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-5 border-t border-slate-200/80">
            <h3 className="text-sm font-semibold text-slate-900">
              โครงสร้างตามระดับ (Level)
            </h3>
            <div className="mt-3 divide-y divide-slate-100">
              {byLevel.map((item) => (
                <div
                  key={item.name}
                  className="py-2 flex items-center justify-between text-xs"
                >
                  <span className="font-mono font-semibold text-teal-900">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-slate-800 font-medium">
                      {item.count.toLocaleString('th-TH')} คน
                    </span>
                    <span className="text-slate-400 w-9 text-right">
                      {item.percent}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
