import { Menu, RefreshCw } from 'lucide-react';
import type { DataState, NavigationTab } from '../types/manpower';
import { formatThaiDateTime } from '../services/sheetSync';

interface TopBarProps {
  activeTab: NavigationTab;
  dataState: DataState;
  hasConfiguredUrl: boolean;
  isSyncing: boolean;
  onSyncNow: () => void;
  onOpenMobileMenu: () => void;
}

const TAB_META: Record<NavigationTab, { title: string; breadcrumb: string }> = {
  checklist: {
    title: 'เช็คลิสต์รายวัน',
    breadcrumb: 'ATC Manpower Control Tower / เช็คลิสต์รายวัน',
  },
  dashboard: {
    title: 'แดชบอร์ดภาพรวมกำลังคน',
    breadcrumb: 'ATC Manpower Control Tower / แดชบอร์ด',
  },
  employees: {
    title: 'รายชื่อพนักงานทั้งหมด',
    breadcrumb: 'ATC Manpower Control Tower / พนักงาน',
  },
  sync: {
    title: 'ตั้งค่า / เชื่อมต่อ Google Sheet',
    breadcrumb: 'ATC Manpower Control Tower / Sync จากชีต',
  },
};

export function TopBar({
  activeTab,
  dataState,
  hasConfiguredUrl,
  isSyncing,
  onSyncNow,
  onOpenMobileMenu,
}: TopBarProps) {
  const meta = TAB_META[activeTab];

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200/80">
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 h-16">
        {/* Zone 1: Menu button (mobile) + Page Title & Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="เปิดเมนูนำทาง"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="hidden sm:block text-xs text-slate-500 truncate">
              {meta.breadcrumb}
            </p>
            <h1 className="text-base sm:text-lg font-semibold text-slate-900 leading-tight truncate">
              {meta.title}
            </h1>
          </div>
        </div>

        {/* Zone 2 & 3: Quiet Sync Metadata + Primary Sync Action */}
        <div className="flex items-center gap-5 shrink-0">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
            <span>
              {dataState.source === 'sheet'
                ? 'เชื่อมต่อ Google Sheet'
                : 'ข้อมูลตัวอย่าง (Mock Data)'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {dataState.rows.length.toLocaleString('th-TH')} คน
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {formatThaiDateTime(dataState.updatedAt)}
            </span>
          </div>

          <button
            type="button"
            onClick={onSyncNow}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-medium text-white hover:bg-[#0D5F59] active:bg-[#0B4F4A] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`h-4 w-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`}
            />
            <span>
              {isSyncing
                ? 'กำลัง Sync...'
                : hasConfiguredUrl
                  ? 'Sync จากชีต'
                  : 'เชื่อมต่อชีต'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
