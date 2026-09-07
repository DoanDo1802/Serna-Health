'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/use-auth-store';
import {
  Search,
  LayoutDashboard,
  UserCheck,
  FileText,
  Calendar,
  Activity,
  CreditCard,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Command,
  X,
} from 'lucide-react';
import { useMounted } from '@/hooks/use-mounted';
import { PatientProfilePage } from '@/components/features/patient/patient-profile-page';
import { BookingPage } from '@/components/features/booking/booking-page';

export type NavItemData = {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: number | string;
  shortcut?: string;
  children?: NavItemData[];
};

export type NavGroupData = {
  heading?: string;
  items: NavItemData[];
};

export const mockNavGroups: NavGroupData[] = [
  {
    items: [
      { id: 'search', title: 'Tìm kiếm', icon: Search, shortcut: '⌘K' },
      { id: 'home', title: 'Tổng quan', icon: LayoutDashboard },
      { id: 'profile', title: 'Hồ sơ bệnh nhân', icon: UserCheck },
      { id: 'booking', title: 'Đặt lịch khám', icon: Calendar },
    ],
  },
  {
    heading: 'Dịch Vụ Y Tế',
    items: [
      { id: 'records', title: 'Bệnh án điện tử', icon: FileText },
      { id: 'prescriptions', title: 'Đơn thuốc', icon: Activity },
      { id: 'billing', title: 'Thanh toán viện phí', icon: CreditCard },
    ],
  },
];

export const mockBottomItems: NavItemData[] = [
  { id: 'settings', title: 'Cài đặt', icon: Settings, shortcut: '⌘,' },
  { id: 'logout', title: 'Đăng xuất', icon: LogOut },
];

export function WorkspaceSwitcher({
  selected,
  onSelect,
}: {
  selected?: string;
  onSelect?: (ws: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [internalSelected, setInternalSelected] = useState('MediCore Patient');

  const current = selected || internalSelected;
  const handleSelect = onSelect || setInternalSelected;

  return (
    <div className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-3 py-2.5 mb-2 rounded-2xl hover:bg-surface-container cursor-pointer transition-colors select-none group border border-transparent hover:border-outline-variant/60"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm shadow-card">
            {current.charAt(0)}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-[14px] font-semibold leading-tight text-content-primary truncate max-w-[140px]">
              {current}
            </span>
            <span className="text-xs text-content-muted leading-tight mt-0.5 font-medium">
              Hệ Thống Y Tế
            </span>
          </div>
        </div>
        <ChevronDown
          className="w-4 h-4 text-content-muted group-hover:text-content-primary transition-colors shrink-0"
          strokeWidth={2}
        />
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-[56px] left-0 w-full bg-surface border border-outline-variant rounded-2xl shadow-floating z-50 py-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100">
            {['MediCore Patient', 'Phòng Khám Đa Khoa', 'Trung Tâm Tiêm Chủng'].map((ws) => (
              <div
                key={ws}
                onClick={() => {
                  handleSelect(ws);
                  setIsOpen(false);
                }}
                className={`px-3.5 py-2.5 mx-1.5 text-sm rounded-xl cursor-pointer transition-colors ${current === ws ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-content-primary hover:bg-surface-container'}`}
              >
                {ws}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function NavItem({
  item,
  activeId,
  onSelect,
  level = 0,
}: {
  item: NavItemData;
  activeId: string;
  onSelect: (id: string) => void;
  level?: number;
}) {
  const isActive = activeId === item.id;
  const hasChildren = !!item.children;
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    } else {
      onSelect(item.id);
    }
  };

  return (
    <div className="flex flex-col w-full">
      <div
        className={`group flex items-center justify-between px-3.5 py-2.5 rounded-full cursor-pointer transition-all duration-200 select-none
          ${isActive
            ? 'bg-primary-container text-on-primary-container font-semibold shadow-xs'
            : 'text-content-secondary hover:bg-surface-container hover:text-content-primary'
          }
        `}
        style={{ paddingLeft: `${level * 14 + 14}px` }}
        onClick={handleClick}
      >
        <div className="flex items-center gap-3.5">
          <item.icon
            className={`w-[18px] h-[18px] transition-colors
              ${isActive ? 'text-on-primary-container' : 'text-content-muted group-hover:text-content-primary'}
            `}
            strokeWidth={isActive ? 2.2 : 1.8}
          />
          <span className="text-[14px] leading-none tracking-tight truncate">{item.title}</span>
        </div>

        <div className="flex items-center gap-2">
          {item.shortcut && (
            <kbd className="hidden group-hover:inline-flex items-center justify-center h-5 px-1.5 text-[10.5px] font-semibold font-mono text-content-muted bg-surface border border-outline-variant rounded-md shadow-xs">
              {item.shortcut}
            </kbd>
          )}
          {item.badge && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full bg-primary text-white">
              {item.badge}
            </span>
          )}
          {hasChildren && (
            <ChevronRight
              className={`w-4 h-4 text-content-muted transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
              strokeWidth={2}
            />
          )}
        </div>
      </div>

      {hasChildren && (
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
        >
          <div className="overflow-hidden min-h-0 relative flex flex-col gap-0.5 mt-0.5">
            <div
              className="absolute top-0 bottom-0 border-l border-outline-variant"
              style={{ left: `${level * 14 + 20}px` }}
            />
            {item.children!.map((child) => (
              <NavItem
                key={child.id}
                item={child}
                activeId={activeId}
                onSelect={onSelect}
                level={level + 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SidebarNav({
  className = '',
  activeId,
  onSelect,
  activeWorkspace,
  onWorkspaceSelect,
}: {
  className?: string;
  activeId?: string;
  onSelect?: (id: string) => void;
  activeWorkspace?: string;
  onWorkspaceSelect?: (ws: string) => void;
}) {
  const [internalId, setInternalId] = useState('home');
  const currentId = activeId !== undefined ? activeId : internalId;
  const handleSelect = onSelect || setInternalId;

  return (
    <div
      className={`flex flex-col w-[285px] h-full bg-surface border-r border-outline-variant p-3.5 font-sans ${className}`}
    >
      <WorkspaceSwitcher selected={activeWorkspace} onSelect={onWorkspaceSelect} />

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col gap-5 mt-1">
        {mockNavGroups.map((group, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            {group.heading && (
              <span className="px-3.5 mb-1 text-[11px] font-bold tracking-wider text-content-muted uppercase">
                {group.heading}
              </span>
            )}
            {group.items.map((item) => (
              <NavItem key={item.id} item={item} activeId={currentId} onSelect={handleSelect} />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-auto pt-3 border-t border-outline-variant flex flex-col gap-1">
        {mockBottomItems.map((item) => (
          <NavItem key={item.id} item={item} activeId={currentId} onSelect={handleSelect} />
        ))}
      </div>
    </div>
  );
}

const allItems = [...mockNavGroups.flatMap((g) => g.items), ...mockBottomItems];
const flattenItems = (items: NavItemData[]): NavItemData[] => {
  return items.reduce((acc, item) => {
    acc.push(item);
    if (item.children) acc.push(...flattenItems(item.children));
    return acc;
  }, [] as NavItemData[]);
};
const flatMockData = flattenItems(allItems);

export function SidebarNavPreview({ initialActiveId = 'home' }: { initialActiveId?: string }) {
  const router = useRouter();
  const { currentEmail, logout } = useAuthStore();
  const mounted = useMounted();
  const [isOpen, setIsOpen] = useState(true);
  const [activeId, setActiveId] = useState(initialActiveId);
  const [activeWorkspace, setActiveWorkspace] = useState('MediCore Patient');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const activeItem = flatMockData.find((i) => i.id === activeId);
  const activeTitle = activeItem ? activeItem.title : 'Dashboard';

  const handleSelect = async (id: string) => {
    if (id === 'search') {
      setIsSearchOpen(true);
      return;
    }
    if (id === 'logout') {
      logout().catch((err) => console.error('Logout error:', err));
      router.replace('/');
      return;
    }
    setActiveId(id);
  };

  // Global keyboard shortcuts (Cmd+K / Ctrl+K and ESC)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-canvas font-sans selection:bg-primary-container selection:text-on-primary-container">
      {/* Pinned Left Sidebar */}
      <div
        className={`h-full transition-all duration-300 ease-in-out shrink-0 overflow-hidden bg-surface border-r border-outline-variant ${isOpen ? 'w-[285px] opacity-100' : 'w-0 opacity-0 border-none'
          }`}
      >
        <SidebarNav
          className="w-[285px] border-none bg-transparent"
          activeId={activeId}
          onSelect={handleSelect}
          activeWorkspace={activeWorkspace}
          onWorkspaceSelect={setActiveWorkspace}
        />
      </div>

      {/* Main Workspace Canvas (Google Gemini Canvas) */}
      <div className="flex-1 bg-canvas flex flex-col min-w-0 h-full overflow-hidden transition-all duration-300">
        {/* Top Header Bar */}
        <div className="h-16 border-b border-outline-variant flex items-center px-6 sm:px-8 justify-between bg-surface shrink-0 shadow-xs">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-full text-content-secondary hover:bg-surface-container hover:text-content-primary transition-colors cursor-pointer"
              title={isOpen ? 'Thu gọn sidebar' : 'Mở rộng sidebar'}
            >
              {isOpen ? (
                <PanelLeftClose className="w-5 h-5" strokeWidth={1.8} />
              ) : (
                <PanelLeftOpen className="w-5 h-5" strokeWidth={1.8} />
              )}
            </button>
            <div className="flex items-center gap-2.5 text-[14px] text-content-secondary">
              <span className="truncate">{activeWorkspace}</span>
              <span>/</span>
              <span className="font-semibold text-content-primary truncate">{activeTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="w-72 h-10 bg-surface-container hover:bg-surface-container-high rounded-full hidden md:flex items-center justify-between px-4 text-[13.5px] text-content-secondary hover:text-content-primary transition-all cursor-pointer border border-transparent hover:border-outline-variant"
            >
              <span className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-content-muted" />
                <span>Tìm kiếm hồ sơ, lịch khám...</span>
              </span>
              <kbd className="text-[11px] font-mono border border-outline-variant rounded-md px-1.5 py-0.5 bg-surface font-semibold text-content-primary">
                ⌘K
              </kbd>
            </button>
            <div
              className="w-9 h-9 bg-primary text-white font-bold text-sm rounded-full flex items-center justify-center shadow-card uppercase"
              title={mounted && currentEmail ? currentEmail : 'Tài khoản bệnh nhân'}
            >
              {mounted && currentEmail ? currentEmail.charAt(0).toUpperCase() : 'P'}
            </div>
          </div>
        </div>

        {/* Content Canvas */}
        {activeId === 'profile' ? (
          <PatientProfilePage />
        ) : activeId === 'booking' || activeId === 'calendar' ? (
          <BookingPage />
        ) : (
          <div className="flex-1 p-6 sm:p-8 lg:p-10 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-content-primary m-0">
                  {activeTitle}
                </h1>
                <p className="text-sm text-content-secondary m-0 mt-1.5 font-medium">
                  Hệ thống chăm sóc: {activeWorkspace}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="h-36 bg-surface rounded-3xl border border-outline-variant shadow-card p-6 flex flex-col justify-between hover:shadow-card-hover transition-all">
                <span className="text-xs font-mono font-bold text-content-muted uppercase tracking-wider">
                  Trạng thái hệ thống
                </span>
                <p className="text-3xl font-bold text-content-primary">Sẵn sàng khám</p>
              </div>
              <div className="h-36 bg-surface rounded-3xl border border-outline-variant shadow-card p-6 flex flex-col justify-between hover:shadow-card-hover transition-all">
                <span className="text-xs font-mono font-bold text-content-muted uppercase tracking-wider">
                  Lịch khám sắp tới
                </span>
                <p className="text-3xl font-bold text-content-primary">0 Lịch hẹn</p>
              </div>
            </div>

            <div className="w-full bg-surface rounded-3xl border border-outline-variant shadow-card p-6 sm:p-8">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-content-primary m-0">Hoạt Động Gần Đây</h3>
                <span className="text-xs font-mono font-medium text-content-muted">
                  Cập nhật vừa xong
                </span>
              </div>
              <div className="w-full h-[1px] bg-outline-variant mb-6" />

              <div className="flex flex-col gap-3.5">
                <div className="w-full py-4 px-5 bg-surface-container rounded-2xl text-sm font-medium text-content-secondary">
                  Chào mừng bạn đến với Cổng thông tin Bệnh nhân MediCore.
                </div>
                <div className="w-full py-4 px-5 bg-surface-container rounded-2xl text-sm font-medium text-content-secondary">
                  Vui lòng cập nhật đầy đủ Hồ sơ bệnh nhân và CCCD/Hộ chiếu tại mục &quot;Hồ sơ bệnh
                  nhân&quot;.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Global Quick Search Modal (Google Style) */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/35 backdrop-blur-sm px-4 animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setIsSearchOpen(false)} />
          <div className="relative w-full max-w-xl bg-surface border border-outline-variant rounded-3xl shadow-floating overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center px-6 border-b border-outline-variant">
              <Search className="w-5 h-5 text-content-muted mr-3.5 shrink-0" strokeWidth={1.8} />
              <input
                autoFocus
                className="flex-1 bg-transparent py-4 border-none outline-none ring-0 shadow-none text-base text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-0"
                placeholder="Tìm kiếm hồ sơ, tài liệu hoặc thao tác..."
              />
              <kbd
                onClick={() => setIsSearchOpen(false)}
                className="hidden sm:inline-flex items-center justify-center h-6 px-2 text-[11px] font-bold font-mono text-content-muted bg-surface-container rounded-md cursor-pointer hover:text-content-primary transition-colors"
              >
                ESC
              </kbd>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="ml-3 p-1.5 rounded-full text-content-muted hover:bg-surface-container hover:text-content-primary transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={1.8} />
              </button>
            </div>
            <div className="p-6 py-12 flex flex-col items-center justify-center">
              <Command className="w-9 h-9 text-content-muted/40 mb-3" strokeWidth={1.8} />
              <p className="text-sm text-content-muted font-medium m-0">
                Nhập từ khóa tìm kiếm hồ sơ...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SidebarNavPreview;
