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
  X 
} from 'lucide-react';
import { useMounted } from '@/hooks/use-mounted';
import { PatientProfilePage } from '@/components/features/patient/patient-profile-page';

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
      { id: 'calendar', title: 'Lịch khám bệnh', icon: Calendar },
    ]
  },
  {
    heading: 'Dịch Vụ Y Tế',
    items: [
      { id: 'records', title: 'Bệnh án điện tử', icon: FileText },
      { id: 'prescriptions', title: 'Đơn thuốc', icon: Activity },
      { id: 'billing', title: 'Thanh toán viện phí', icon: CreditCard },
    ]
  }
];

export const mockBottomItems: NavItemData[] = [
  { id: 'settings', title: 'Cài đặt', icon: Settings, shortcut: '⌘,' },
  { id: 'logout', title: 'Đăng xuất', icon: LogOut },
];

export function WorkspaceSwitcher({ selected, onSelect }: { selected?: string, onSelect?: (ws: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [internalSelected, setInternalSelected] = useState('Acme Corp');
  
  const current = selected || internalSelected;
  const handleSelect = onSelect || setInternalSelected;

  return (
    <div className="relative">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-3 py-2.5 mb-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors select-none group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary text-content-inverse flex items-center justify-center font-bold text-sm shadow-sm">
            {current.charAt(0)}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-[14.5px] font-bold leading-tight text-content-primary truncate max-w-[140px]">{current}</span>
            <span className="text-xs text-content-muted leading-tight mt-0.5 font-medium">Pro Plan</span>
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-content-muted group-hover:text-content-primary transition-colors shrink-0" strokeWidth={1.8} />
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-[56px] left-0 w-full bg-surface border border-border rounded-2xl shadow-2xl z-50 py-1.5 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100">
            {['Acme Corp', 'Personal Workspace', 'Client Sandbox'].map(ws => (
              <div 
                key={ws}
                onClick={() => { handleSelect(ws); setIsOpen(false); }}
                className={`px-3.5 py-2.5 mx-1.5 text-sm rounded-xl cursor-pointer transition-colors ${current === ws ? 'bg-primary/10 text-primary font-bold' : 'text-content-primary hover:bg-black/5 dark:hover:bg-white/5'}`}
              >
                {ws}
              </div>
            ))}
            <div className="h-px bg-border/80 my-1 mx-2" />
            <div className="px-3.5 py-2 mx-1.5 text-sm text-content-muted hover:bg-black/5 dark:hover:bg-white/5 rounded-xl cursor-pointer flex items-center gap-2 transition-colors font-medium">
              <span className="text-base leading-none mb-0.5">+</span> Create Workspace
            </div>
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
  level = 0
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
        className={`group flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 select-none
          ${isActive 
            ? 'bg-black/5 dark:bg-white/10 text-content-primary font-bold' 
            : 'text-content-secondary hover:bg-black/5 dark:hover:bg-white/5 hover:text-content-primary'
          }
        `}
        style={{ paddingLeft: `${level * 14 + 12}px` }}
        onClick={handleClick}
      >
        <div className="flex items-center gap-3">
          <item.icon 
            className={`w-[18px] h-[18px] transition-colors
              ${isActive ? 'text-content-primary' : 'text-content-muted group-hover:text-content-primary'}
            `} 
            strokeWidth={1.8} 
          />
          <span className="text-[14px] font-medium tracking-wide truncate">
            {item.title}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {item.shortcut && (
             <kbd className="hidden group-hover:inline-flex items-center justify-center h-5.5 px-2 text-[11px] font-semibold font-mono text-content-muted bg-surface border border-border rounded-md shadow-xs">
               {item.shortcut}
             </kbd>
          )}
          {item.badge && (
            <span className="flex items-center justify-center min-w-[22px] h-5.5 px-2 text-[11px] font-bold rounded-full bg-primary/10 text-primary">
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
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
            isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0 relative flex flex-col gap-0.5 mt-0.5">
            <div 
              className="absolute top-0 bottom-0 border-l border-border"
              style={{ left: `${level * 14 + 20}px` }}
            />
            {item.children!.map(child => (
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
  onWorkspaceSelect
}: { 
  className?: string,
  activeId?: string,
  onSelect?: (id: string) => void,
  activeWorkspace?: string,
  onWorkspaceSelect?: (ws: string) => void
}) {
  const [internalId, setInternalId] = useState('home');
  const currentId = activeId !== undefined ? activeId : internalId;
  const handleSelect = onSelect || setInternalId;

  return (
    <div className={`flex flex-col w-[285px] h-full bg-[#ffffff] border-r border-[#e8e4dc] p-3.5 font-sans ${className}`}>
      <WorkspaceSwitcher selected={activeWorkspace} onSelect={onWorkspaceSelect} />

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col gap-5 mt-1">
        {mockNavGroups.map((group, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            {group.heading && (
              <span className="px-3 mb-1 text-[11.5px] font-bold tracking-wider text-[#8e897e] uppercase">
                {group.heading}
              </span>
            )}
            {group.items.map(item => (
              <NavItem 
                key={item.id} 
                item={item} 
                activeId={currentId} 
                onSelect={handleSelect} 
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-auto pt-3 border-t border-[#e8e4dc] flex flex-col gap-1">
        {mockBottomItems.map(item => (
          <NavItem 
            key={item.id} 
            item={item} 
            activeId={currentId} 
            onSelect={handleSelect} 
          />
        ))}
      </div>
    </div>
  );
}

const allItems = [...mockNavGroups.flatMap(g => g.items), ...mockBottomItems];
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
  const { currentEmail, initSession, logout } = useAuthStore();
  const mounted = useMounted();
  const [isOpen, setIsOpen] = useState(true);
  const [activeId, setActiveId] = useState(initialActiveId);
  const [activeWorkspace, setActiveWorkspace] = useState('MediCore Patient');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  React.useEffect(() => {
    initSession();
  }, [initSession]);

  const activeItem = flatMockData.find(i => i.id === activeId);
  const activeTitle = activeItem ? activeItem.title : 'Dashboard';

  const handleSelect = async (id: string) => {
    if (id === 'search') {
      setIsSearchOpen(true);
      return;
    }
    if (id === 'logout') {
      await logout();
      router.push('/login');
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
    <div className="flex w-screen h-screen overflow-hidden bg-[#f8f6f0] font-sans selection:bg-primary selection:text-content-inverse">
      {/* Pinned Pure White Left Sidebar */}
      <div 
        className={`h-full transition-all duration-300 ease-in-out shrink-0 overflow-hidden bg-[#ffffff] border-r border-[#e8e4dc] ${
          isOpen ? 'w-[285px] opacity-100' : 'w-0 opacity-0 border-none'
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
      
      {/* Main Workspace Canvas (Warm Beige Background) */}
      <div className="flex-1 bg-[#f8f6f0] flex flex-col min-w-0 h-full overflow-hidden transition-all duration-300">
         {/* Top Header Bar (Pure White) */}
         <div className="h-16 border-b border-[#e8e4dc] flex items-center px-6 sm:px-8 justify-between bg-[#ffffff] shrink-0 shadow-xs">
           <div className="flex items-center gap-3.5">
             <button 
               onClick={() => setIsOpen(!isOpen)}
               className="p-2 rounded-lg text-content-secondary hover:bg-black/5 dark:hover:bg-white/5 hover:text-content-primary transition-colors cursor-pointer"
               title={isOpen ? 'Thu gọn sidebar' : 'Mở rộng sidebar'}
             >
               {isOpen ? <PanelLeftClose className="w-5 h-5" strokeWidth={1.8} /> : <PanelLeftOpen className="w-5 h-5" strokeWidth={1.8} />}
             </button>
             <div className="flex items-center gap-2.5 text-[15px] text-[#8e897e]">
               <span className="truncate">{activeWorkspace}</span>
               <span>/</span>
               <span className="font-bold text-[#141311] truncate">{activeTitle}</span>
             </div>
           </div>
           
           <div className="flex items-center gap-3.5">
             <button
               type="button"
               onClick={() => setIsSearchOpen(true)}
               className="w-72 h-10 bg-[#f8f6f0] rounded-xl hidden md:flex items-center justify-between px-3.5 text-[13.5px] text-[#8e897e] hover:bg-[#f1ede3] hover:text-[#141311] transition-colors cursor-pointer border border-[#e8e4dc]"
             >
               <span className="flex items-center gap-2.5">
                 <Search className="w-4 h-4" />
                 <span>Tìm kiếm hồ sơ, lịch khám...</span>
               </span>
               <kbd className="text-[11px] font-mono border border-[#e8e4dc] rounded-md px-1.5 py-0.5 bg-[#ffffff] font-semibold text-[#141311]">⌘K</kbd>
             </button>
              <div 
                className="w-9 h-9 bg-[#141311] text-white font-bold text-sm rounded-full flex items-center justify-center border border-[#e8e4dc] shadow-sm uppercase"
                title={mounted && currentEmail ? currentEmail : 'Tài khoản bệnh nhân'}
              >
                {mounted && currentEmail ? currentEmail.charAt(0).toUpperCase() : 'P'}
              </div>
           </div>
         </div>

         {/* Content Canvas */}
         {activeId === 'profile' ? (
           <PatientProfilePage />
         ) : (
           <div className="flex-1 p-6 sm:p-8 lg:p-10 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
             <div className="flex items-center justify-between mb-8">
               <div>
                 <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#141311] m-0">
                   {activeTitle}
                 </h1>
                 <p className="text-sm text-[#8e897e] m-0 mt-1.5 font-medium">
                   Hệ thống chăm sóc: {activeWorkspace}
                 </p>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
               <div className="h-36 bg-[#ffffff] rounded-2xl border border-[#e8e4dc] shadow-xs p-6 flex flex-col justify-between hover:border-[#cbc5b8] hover:shadow-sm transition-all">
                 <span className="text-xs font-mono font-bold text-[#8e897e] uppercase tracking-wider">Trạng thái hệ thống</span>
                 <p className="text-3xl font-bold text-[#141311]">Sẵn sàng khám</p>
               </div>
               <div className="h-36 bg-[#ffffff] rounded-2xl border border-[#e8e4dc] shadow-xs p-6 flex flex-col justify-between hover:border-[#cbc5b8] hover:shadow-sm transition-all">
                 <span className="text-xs font-mono font-bold text-[#8e897e] uppercase tracking-wider">Lịch khám sắp tới</span>
                 <p className="text-3xl font-bold text-[#141311]">0 Lịch hẹn</p>
               </div>
             </div>

             <div className="w-full bg-[#ffffff] rounded-2xl border border-[#e8e4dc] shadow-xs p-6 sm:p-8">
               <div className="flex items-center justify-between mb-5">
                 <h3 className="text-base font-bold text-[#141311] m-0">Hoạt Động Gần Đây</h3>
                 <span className="text-xs font-mono font-medium text-[#8e897e]">Cập nhật vừa xong</span>
               </div>
               <div className="w-full h-[1px] bg-[#e8e4dc] mb-6" />
               
               <div className="flex flex-col gap-3.5">
                 <div className="w-full py-4 px-5 bg-[#fbf9f5] border border-[#e8e4dc]/80 rounded-xl text-sm font-medium text-[#555147]">
                   Chào mừng bạn đến với Cổng thông tin Bệnh nhân MediCore.
                 </div>
                 <div className="w-full py-4 px-5 bg-[#fbf9f5] border border-[#e8e4dc]/80 rounded-xl text-sm font-medium text-[#555147]">
                   Vui lòng cập nhật đầy đủ Hồ sơ bệnh nhân và CCCD/Hộ chiếu tại mục &quot;Hồ sơ bệnh nhân&quot;.
                 </div>
               </div>
             </div>
           </div>
         )}
      </div>

      {/* Global Quick Search Modal (Pure White & Well Spaced) */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[22vh] sm:pt-[24vh] bg-black/45 backdrop-blur-sm px-4 animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setIsSearchOpen(false)} />
          <div className="relative w-full max-w-xl bg-[#ffffff] border border-[#e8e4dc] rounded-[24px] shadow-[0_25px_70px_rgba(0,0,0,0.22)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center px-6 border-b border-[#e8e4dc]">
              <Search className="w-5 h-5 text-[#8e897e] mr-3.5 shrink-0" strokeWidth={1.8} />
              <input 
                autoFocus
                className="flex-1 bg-transparent py-4.5 border-none outline-none ring-0 shadow-none text-base text-[#141311] placeholder:text-[#8e897e] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                style={{ outline: 'none', boxShadow: 'none', border: 'none' }}
                placeholder="Search projects, docs, or actions..."
              />
              <kbd 
                onClick={() => setIsSearchOpen(false)}
                className="hidden sm:inline-flex items-center justify-center h-6 px-2 text-[11px] font-bold font-mono text-[#8e897e] bg-[#f8f6f0] border border-[#e8e4dc] rounded-md cursor-pointer hover:text-[#141311] transition-colors"
              >
                ESC
              </kbd>
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="ml-3 p-1.5 rounded-lg text-[#8e897e] hover:bg-black/5 hover:text-[#141311] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={1.8} />
              </button>
            </div>
            <div className="p-6 py-12 flex flex-col items-center justify-center">
               <Command className="w-9 h-9 text-[#8e897e]/40 mb-3" strokeWidth={1.8} />
               <p className="text-sm text-[#8e897e] font-medium m-0">Type a command or search...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SidebarNavPreview;
