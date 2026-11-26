export type NavigationTab = 'checklist' | 'dashboard' | 'employees' | 'sync';

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave';

export interface EmployeeRow {
  Level: string;
  ตำแหน่ง: string;
  รหัสพนักงาน: string;
  รายชื่อพนักงาน: string;
  แผนก: string;
  ส่วนงาน: string;
  'ช่องทางหลัก (Channel)': string;
  ช่องทางย่อย: string;
  สังกัด: string;
}

export interface SheetSyncPayload {
  updatedAt: string;
  count: number;
  rows: EmployeeRow[];
}

export interface SheetConfig {
  scriptUrl: string;
  secretKey: string;
  sheetName?: string;
}

export interface AttendanceEntry {
  status: AttendanceStatus;
  note?: string;
  updatedAt: string;
}

/** Map of date (YYYY-MM-DD) -> employeeId -> AttendanceEntry */
export type AttendanceStore = Record<string, Record<string, AttendanceEntry>>;

export interface DataState {
  source: 'mock' | 'sheet';
  updatedAt: string;
  count: number;
  rows: EmployeeRow[];
}
