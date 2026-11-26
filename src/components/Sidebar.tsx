import {
  BarChart3,
  ClipboardCheck,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import type { DataState, NavigationTab } from '../types/manpower';
import { formatThaiDateTime } from '../services/sheetSync';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  dataState: DataState;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: {
  id: NavigationTab;
  label: string;
  description: string;
  icon: typeof ClipboardCheck;
}[] = [
  {
    id: 'checklist',
    label: 'เช็คลิสต์รายวัน',
    description: 'บันทึกสถานะเข้างานประจำวัน',
    icon: ClipboardCheck,
  },
  {
    id: 'dashboard',
    label: 'แดชบอร์ด',
    description: 'ภาพรวมส่วนงานและช่องทาง',
    icon: BarChart3,
  },
  {
    id: 'employees',
    label: 'พนักงาน',
    description: 'ทะเบียนรายชื่อกำลังคนทั้งหมด',
    icon: Users,
  },
  {
    id: 'sync',
    label: 'Sync จากชีต',
    description: 'ตั้งค่าเชื่อมต่อ Google Sheet',
    icon: RefreshCw,
  },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  dataState,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const handleSelect = (tab: NavigationTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#0B3F41] text-white">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 border border-teal-400/30">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-teal-200"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2L3 7l9 5 9-5-9-5z" />
              <path d="M3 12l9 5 9-5" />
              <path d="M3 17l9 5 9-5" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="font-display text-[15px] font-bold tracking-tight text-white truncate">
              ATC Manpower
            </div>
            <div className="text-xs text-teal-200/80 truncate">
              Control Tower
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden rounded-md p-1.5 text-teal-100/80 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="ปิดเมนู"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1.5" aria-label="เมนูหลัก">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition-colors duration-150 ${
                isActive
                  ? 'bg-teal-600/90 text-white shadow-xs'
                  : 'text-teal-50/80 hover:bg-white/8 hover:text-white'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'text-teal-300/75 group-hover:text-teal-100'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-tight whitespace-nowrap truncate">
                  {item.label}
                </div>
                <div
                  className={`text-[11px] leading-tight mt-0.5 truncate ${
                    isActive ? 'text-teal-100/90' : 'text-teal-200/55'
                  }`}
                >
                  {item.description}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Quiet Data Source Footer */}
      <div className="px-5 py-4 border-t border-white/10 text-xs text-teal-100/75 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-teal-200/70">แหล่งข้อมูล</span>
          <span className="font-medium text-white whitespace-nowrap">
            {dataState.source === 'sheet' ? 'Google Sheet' : 'ข้อมูลตัวอย่าง'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-teal-200/70">กำลังคน Active</span>
          <span className="font-mono tabular-nums font-medium text-white">
            {dataState.rows.length.toLocaleString('th-TH')} คน
          </span>
        </div>
        <div className="pt-1 text-[11px] text-teal-200/60 truncate">
          อัปเดต: {formatThaiDateTime(dataState.updatedAt)}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64 border-r border-teal-950/15">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[82vw] shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
