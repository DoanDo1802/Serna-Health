'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/use-auth-store';
import { NovaLogo } from '@/components/base/nova-logo';
import { BorderBeam } from 'border-beam';
import {
  Search,
  Plus,
  Mic,
  MicOff,
  Settings,
  LogOut,
  ChevronDown,
  LayoutGrid,
  SquarePen,
  Eye,
  GraduationCap,
  Video,
  FileText,
  Calendar,
  UserCheck,
  Sparkles,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  MoreVertical,
  MoreHorizontal,
  X,
  Command,
  ArrowLeft,
  ArrowUp,
} from 'lucide-react';
import { BookingPage } from '@/components/features/booking/booking-page';
import { PatientProfilePage } from '@/components/features/patient/patient-profile-page';
import '@/styles/gemini.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: {
    label: string;
    view: 'booking' | 'profile' | 'search';
  };
  timestamp: string;
}

export function GeminiDashboard() {
  const router = useRouter();
  const { currentEmail, initSession, logout } = useAuthStore();

  const [activeView, setActiveView] = useState<'home' | 'booking' | 'profile'>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('Flash');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'spark'>('chat');

  // Chat state
  const [inputPrompt, setInputPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Border beam is active only while user is typing or while AI is generating response
  const isBeamActive = isThinking || inputPrompt.trim().length > 0;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initSession();
  }, [initSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Global shortcuts (⌘K for search, ESC to close modals/menus)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsModelDropdownOpen(false);
        setIsUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const displayName = currentEmail
    ? currentEmail.split('@')[0]
    : 'Đoàn';

  const handleSendMessage = useCallback(
    (textToSend?: string) => {
      const text = (textToSend !== undefined ? textToSend : inputPrompt).trim();
      if (!text) return;

      const userMsg: Message = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputPrompt('');
      setIsThinking(true);
      if (typeof document !== 'undefined') {
        (document.activeElement as HTMLElement)?.blur();
      }

      setTimeout(() => {
        let reply = '';
        let action: Message['action'] = undefined;

        const lower = text.toLowerCase();
        if (lower.includes('đặt lịch') || lower.includes('khám') || lower.includes('hẹn')) {
          reply =
            'Tôi có thể hỗ trợ bạn đặt lịch khám ngay lập tức với các bác sĩ chuyên khoa tại NOVAMED.';
          action = { label: 'Mở Đặt Lịch Khám', view: 'booking' };
        } else if (lower.includes('hồ sơ') || lower.includes('cccd') || lower.includes('thông tin')) {
          reply =
            'Bạn có thể xem và cập nhật hồ sơ bệnh nhân, số CCCD/Hộ chiếu và liên hệ khẩn cấp tại mục Hồ sơ bệnh nhân.';
          action = { label: 'Xem Hồ Sơ Bệnh Nhân', view: 'profile' };
        } else if (lower === 'chào' || lower === 'hello' || lower === 'hi') {
          reply = `Chào ${displayName}! Mình có thể hỗ trợ gì cho bạn hôm nay?`;
        } else {
          reply = `Chào ${displayName}! Mình có thể hỗ trợ giải đáp thắc mắc về sức khỏe, giúp bạn đặt lịch khám hoặc quản lý hồ sơ y tế.`;
        }

        const botMsg: Message = {
          id: `${Date.now() + 1}-${Math.random().toString(36).slice(2, 9)}`,
          role: 'assistant',
          content: reply,
          action,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, botMsg]);
        setIsThinking(false);
      }, 750);
    },
    [inputPrompt, displayName]
  );

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = async () => {
    await logout().catch(console.error);
    router.push('/login');
  };

  // Recent history matching user screenshot
  const recentHistory = [
    'Hướng dẫn cài đặt VPN trên máy Mac',
    'Địa điểm World Cup 1958',
    'Đối thủ của Pháp tại World Cup 1998',
    'Pháp Thắng Brazil World Cup 1998',
    'Tối ưu PEAK trên Mac CrossOver',
    'Kỷ Lục Ghi Bàn EURO 1984',
    '**Mbappé: Đáp án Đúng**',
    'Steven Gerrard Ra Mắt Liverpool',
    'Hướng dẫn tắt Gemini trên Chrome',
    'Hỏi cách tắt chức năng',
    'Chung Kết Euro 2016: Bồ Đào Nha Vô Đ...',
    'Cài Đặt Trợ Năng Trong Game',
    'Chơi game Windows trên Mac',
    'Joshua Kimmich: Lời giải đáp',
  ];

  // Radial glow ONLY when on home and no messages yet. Once chat starts or on other pages: pure dark black!
  const showGlow = activeView === 'home' && messages.length === 0;

  return (
    <div className={`gemini-scope flex relative ${showGlow ? 'has-glow' : 'pure-dark'}`}>
      {/* =========================================================================
          1. LEFT SIDEBAR (Collapsed or Expanded)
          ========================================================================= */}
      <aside
        className={`h-full transition-all duration-200 ease-out flex flex-col shrink-0 relative z-30 select-none ${
          isSidebarOpen
            ? 'w-[280px] bg-[#0c0d0f] border-r border-white/[0.07]'
            : 'w-[64px] bg-transparent'
        }`}
      >
        {/* If COLLAPSED: Show slim icon rail */}
        {!isSidebarOpen ? (
          <div className="h-full flex flex-col justify-between items-center py-3">
            {/* Top icon stack */}
            <div className="flex flex-col items-center gap-2">
              {/* Top button: Logo by default -> switches to Panel Toggle on hover with tooltip 'Mở thanh bên' (Pure CSS group-hover, never gets stuck) */}
              <div className="relative group">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="gemini-icon-btn"
                  aria-label="Mở thanh bên"
                >
                  {/* Default: Nova logo */}
                  <span className="group-hover:hidden flex items-center justify-center">
                    <NovaLogo size={20} />
                  </span>

                  {/* On Hover: PanelLeft icon */}
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white hidden group-hover:block"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="4" />
                    <path d="M9 3v18" />
                  </svg>
                </button>

                {/* Tooltip pill: strictly rendered via pure CSS group-hover */}
                <div className="gemini-tooltip-pill hidden group-hover:block pointer-events-none">
                  Mở thanh bên
                </div>
              </div>

              {/* Eye / Vision icon */}
              <button
                onClick={() => setActiveView('home')}
                className="gemini-icon-btn"
                title="Chế độ xem"
              >
                <Eye className="w-5 h-5 text-white/70 hover:text-white" strokeWidth={1.8} />
              </button>

              {/* Square with Pen (New chat) */}
              <button
                onClick={() => {
                  setActiveView('home');
                  setMessages([]);
                }}
                className="gemini-icon-btn"
                title="Cuộc trò chuyện mới"
              >
                <SquarePen className="w-5 h-5 text-white/70 hover:text-white" strokeWidth={1.8} />
              </button>

              {/* Search */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="gemini-icon-btn"
                title="Tìm kiếm trong các cuộc trò chuyện"
              >
                <Search className="w-5 h-5 text-white/70 hover:text-white" strokeWidth={1.8} />
              </button>

              {/* Sinh viên (Đặt khám) */}
              <button
                onClick={() => setActiveView('booking')}
                className={`gemini-icon-btn ${activeView === 'booking' ? 'active' : ''}`}
                title="Đặt lịch khám"
              >
                <GraduationCap className="w-5 h-5 text-white/70 hover:text-white" strokeWidth={1.8} />
              </button>

              {/* Video icon */}
              <button
                onClick={() => setActiveView('home')}
                className="gemini-icon-btn"
                title="Video"
              >
                <Video className="w-5 h-5 text-white/70 hover:text-white" strokeWidth={1.8} />
              </button>

              {/* 4-Grid Library icon */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="gemini-icon-btn"
                title="Thư viện"
              >
                <LayoutGrid className="w-5 h-5 text-white/70 hover:text-white" strokeWidth={1.8} />
              </button>
            </div>

            {/* Bottom items: Settings + Purple Avatar 'đ' */}
            <div className="flex flex-col items-center gap-3 relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="gemini-icon-btn"
                title="Cài đặt"
              >
                <Settings className="w-5 h-5 text-white/70 hover:text-white" strokeWidth={1.8} />
              </button>

              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="gemini-avatar"
                title={currentEmail || 'Tài khoản'}
              >
                đ
              </button>
            </div>
          </div>
        ) : (
          /* If EXPANDED: 100% exact replica of user screenshot */
          <div className="h-full flex flex-col justify-between py-3 px-3">
            {/* Top section */}
            <div className="flex flex-col gap-3">
              {/* Row 1: Logo + Gemini + Toggle button */}
              <div className="flex items-center justify-between px-1">
                <div
                  onClick={() => {
                    setActiveView('home');
                    setMessages([]);
                  }}
                  className="flex items-center gap-2.5 cursor-pointer"
                >
                  <NovaLogo size={22} />
                  <span className="text-[17px] font-semibold text-white tracking-tight" style={{ fontFamily: 'Google Sans Flex, sans-serif' }}>
                    NOVAMED
                  </span>
                </div>

                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="gemini-icon-btn"
                  title="Thu gọn thanh bên"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="4" />
                    <path d="M9 3v18" />
                  </svg>
                </button>
              </div>

              {/* Row 2: Tab Switcher (Trò chuyện | Spark BETA) */}
              <div className="bg-[#141517] p-1 rounded-full flex items-center">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-1 px-3 rounded-full text-[13px] font-medium transition-colors ${
                    activeTab === 'chat'
                      ? 'bg-[#202124] text-white shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Trò chuyện
                </button>
                <button
                  onClick={() => setActiveTab('spark')}
                  className={`flex-1 py-1 px-3 rounded-full text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    activeTab === 'spark'
                      ? 'bg-[#202124] text-white shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <span>Spark</span>
                  <span className="text-[9.5px] font-semibold px-1 py-0.5 bg-white/10 rounded text-white/70">
                    BETA
                  </span>
                </button>
              </div>

              {/* Row 3: Action list */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => {
                    setActiveView('home');
                    setMessages([]);
                  }}
                  className="flex items-center gap-3.5 px-3 py-2 rounded-full hover:bg-white/[0.06] text-white/90 text-[13.5px] transition-colors cursor-pointer text-left"
                >
                  <SquarePen className="w-4 h-4 text-white/70" strokeWidth={1.8} />
                  <span>Cuộc trò chuyện mới</span>
                </button>

                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="flex items-center gap-3.5 px-3 py-2 rounded-full hover:bg-white/[0.06] text-white/90 text-[13.5px] transition-colors cursor-pointer text-left"
                >
                  <Search className="w-4 h-4 text-white/70" strokeWidth={1.8} />
                  <span className="truncate">Tìm kiếm trong các cuộc trò chuyện</span>
                </button>

                <button
                  onClick={() => setActiveView('booking')}
                  className={`flex items-center gap-3.5 px-3 py-2 rounded-full text-[13.5px] transition-colors cursor-pointer text-left ${
                    activeView === 'booking'
                      ? 'bg-white/[0.1] text-white font-medium'
                      : 'hover:bg-white/[0.06] text-white/90'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 text-white/70" strokeWidth={1.8} />
                  <span>Sinh viên (Đặt khám)</span>
                </button>

                <button
                  onClick={() => setActiveView('profile')}
                  className={`flex items-center gap-3.5 px-3 py-2 rounded-full text-[13.5px] transition-colors cursor-pointer text-left ${
                    activeView === 'profile'
                      ? 'bg-white/[0.1] text-white font-medium'
                      : 'hover:bg-white/[0.06] text-white/90'
                  }`}
                >
                  <Video className="w-4 h-4 text-white/70" strokeWidth={1.8} />
                  <span>Video (Hồ sơ y tế)</span>
                </button>

                <button
                  className="flex items-center gap-3.5 px-3 py-2 rounded-full bg-white/[0.08] text-white text-[13.5px] transition-colors cursor-pointer text-left"
                >
                  <LayoutGrid className="w-4 h-4 text-white" strokeWidth={1.8} />
                  <span className="font-medium">Thư viện</span>
                </button>
              </div>
            </div>

            {/* Middle Section: Scrollable Sổ ghi chú + Gần đây */}
            <div className="flex-1 overflow-y-auto gemini-dark-scrollbar py-3 flex flex-col gap-4">
              {/* Sổ ghi chú */}
              <div>
                <span className="px-3 text-xs text-white/50 font-medium">Sổ ghi chú</span>
                <div className="flex flex-col gap-0.5 mt-1.5">
                  <button
                    onClick={() => setActiveView('booking')}
                    className="flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-white/[0.06] text-white/80 text-[13px] text-left transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-white/60" />
                    <span>Sổ ghi chú mới</span>
                  </button>

                  <button
                    onClick={() => setActiveView('profile')}
                    className="flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-white/[0.06] text-white/80 text-[13px] text-left transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-white/60 shrink-0" />
                    <span className="truncate">Machine Learning Model Evaluati...</span>
                  </button>

                  <button
                    onClick={() => setActiveView('profile')}
                    className="flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-white/[0.06] text-white/80 text-[13px] text-left transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-white/60 shrink-0" />
                    <span className="truncate">Mô Tả và Yêu Cầu Hệ Thống Thư V...</span>
                  </button>

                  <button
                    onClick={() => setIsSearchOpen(true)}
                    className="flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-white/[0.06] text-white/60 text-[13px] text-left transition-colors cursor-pointer"
                  >
                    <MoreHorizontal className="w-4 h-4 text-white/50 shrink-0" />
                    <span>Tất cả sổ ghi chú</span>
                  </button>
                </div>
              </div>

              {/* Gần đây */}
              <div>
                <span className="px-3 text-xs text-white/50 font-medium">Gần đây</span>
                <div className="flex flex-col gap-0.5 mt-1.5">
                  {recentHistory.map((title, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveView('home');
                        handleSendMessage(title.replace(/\*/g, ''));
                      }}
                      className="px-3 py-1.5 rounded-xl text-[13.5px] text-white/75 hover:text-white hover:bg-white/[0.06] text-left truncate transition-colors cursor-pointer"
                    >
                      {title}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom section: User profile & Settings */}
            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between px-1 relative">
              <div
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
              >
                <div className="gemini-avatar">đ</div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[13.5px] font-medium text-white leading-tight truncate">
                    đoàn đỗ
                  </span>
                  <span className="text-[11.5px] text-white/50 leading-tight mt-0.5">
                    Pro
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="gemini-icon-btn"
                title="Cài đặt"
              >
                <Settings className="w-4 h-4 text-white/60 hover:text-white" />
              </button>
            </div>
          </div>
        )}

        {/* Invisible edge area with arrow cursor to expand sidebar on click */}
        {!isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-0 -right-1.5 w-3 h-full cursor-e-resize z-40"
            title="Nhấn để mở thanh bên"
          />
        )}

        {/* User Account & Settings Dropdown Menu (Accessible in BOTH Collapsed and Expanded states) */}
        {isUserMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsUserMenuOpen(false)}
            />
            <div
              className={`absolute bg-[#1e1f20] border border-white/[0.12] rounded-2xl shadow-2xl z-50 p-2 text-sm flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100 ${
                isSidebarOpen
                  ? 'bottom-14 left-3 w-64'
                  : 'bottom-3 left-[70px] w-64'
              }`}
              style={{
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.85), 0 0 1px rgba(255, 255, 255, 0.2)',
              }}
            >
              <div className="px-3 py-2 border-b border-white/[0.08]">
                <p className="font-medium text-white truncate">{displayName || 'đoàn đỗ'}</p>
                <p className="text-xs text-white/50 truncate">{currentEmail || 'patient@medicore.vn'}</p>
              </div>
              <button
                onClick={() => {
                  setActiveView('profile');
                  setIsUserMenuOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.06] text-white/80 hover:text-white cursor-pointer transition-colors text-left"
              >
                <UserCheck className="w-4 h-4" />
                <span>Hồ sơ bệnh nhân</span>
              </button>
              <button
                onClick={() => {
                  setActiveView('booking');
                  setIsUserMenuOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.06] text-white/80 hover:text-white cursor-pointer transition-colors text-left"
              >
                <Calendar className="w-4 h-4" />
                <span>Đặt lịch khám</span>
              </button>
              <div className="h-[1px] bg-white/[0.08] my-1" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-500/15 text-red-400 hover:text-red-300 cursor-pointer transition-colors text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </>
        )}
      </aside>

      {/* =========================================================================
          2. MAIN STAGE CANVAS
          ========================================================================= */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Top right icon matching user screenshot 2 (MoreVertical ⋮) */}
        <div className="absolute top-4 right-5 z-20 flex items-center gap-2">
          {activeView !== 'home' && (
            <button
              onClick={() => setActiveView('home')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-medium backdrop-blur-md transition-all cursor-pointer mr-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại</span>
            </button>
          )}
          <button
            className="text-white/50 hover:text-white transition-colors cursor-pointer p-1 rounded-full hover:bg-white/[0.06]"
            title="Tùy chọn khác"
          >
            <MoreVertical className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>

        {/* View A: BOOKING PAGE */}
        {activeView === 'booking' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 pt-16 animate-in fade-in duration-150">
            <div className="max-w-6xl mx-auto">
              <BookingPage />
            </div>
          </div>
        )}

        {/* View B: PATIENT PROFILE PAGE */}
        {activeView === 'profile' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 pt-16 animate-in fade-in duration-150">
            <div className="max-w-6xl mx-auto">
              <PatientProfilePage />
            </div>
          </div>
        )}

        {/* View C: HOME */}
        {activeView === 'home' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {messages.length === 0 ? (
              /* Zero state: 'Tiếp theo sẽ là gì, đoàn?' with glowing center */
              <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-12">
                <h1 className="text-[32px] sm:text-[34px] font-normal tracking-tight text-[#e3e3e3] mb-8 text-center">
                  Tiếp theo sẽ là gì, đoàn?
                </h1>

                {/* Centered prompt capsule with BorderBeam */}
                <div className="relative w-full max-w-[680px] flex items-center justify-center">
                  <BorderBeam
                    size="md"
                    colorVariant="colorful"
                    active={true}
                    strength={0.85}
                    borderRadius={9999}
                    theme="dark"
                    className="w-full max-w-[680px]"
                  >
                    <div className="gemini-capsule" style={{ maxWidth: '100%' }}>
                      <button
                        type="button"
                        onClick={() => setActiveView('booking')}
                        className="text-white/60 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
                        title="Thêm"
                      >
                        <Plus className="w-5 h-5" strokeWidth={1.8} />
                      </button>

                      <input
                        type="text"
                        value={inputPrompt}
                        onChange={(e) => setInputPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="Hỏi NOVAMED AI..."
                      />

                      <div className="flex items-center gap-2.5 relative">
                        <button
                          type="button"
                          onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-xs text-white/70 hover:text-white transition-colors cursor-pointer"
                        >
                          <span>{selectedModel}</span>
                          <ChevronDown className="w-3 h-3 opacity-60" />
                        </button>

                        {isModelDropdownOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setIsModelDropdownOpen(false)}
                            />
                            <div className="absolute right-8 bottom-10 w-44 bg-[#282a2d] border border-white/[0.1] rounded-2xl shadow-xl z-50 py-1.5 text-xs flex flex-col">
                              {['Flash', 'MediCore 2.5', 'Pro'].map((model) => (
                                <button
                                  key={model}
                                  onClick={() => {
                                    setSelectedModel(model);
                                    setIsModelDropdownOpen(false);
                                  }}
                                  className={`px-3 py-2 text-left hover:bg-white/[0.08] transition-colors ${
                                    selectedModel === model ? 'text-[#8ab4f8] font-medium' : 'text-white/80'
                                  }`}
                                >
                                  {model}
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => setIsListening(!isListening)}
                          className={`text-white/60 hover:text-white p-1 transition-colors cursor-pointer ${
                            isListening ? 'text-red-400 animate-pulse' : ''
                          }`}
                          title={isListening ? 'Đang nghe...' : 'Nhập bằng giọng nói'}
                        >
                          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" strokeWidth={1.8} />}
                        </button>

                        {inputPrompt.trim().length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleSendMessage()}
                            className="p-1.5 rounded-full bg-[#8ab4f8] text-[#041e49] hover:bg-[#aecbfa] transition-all cursor-pointer ml-1"
                          >
                            <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        )}
                      </div>
                    </div>
                  </BorderBeam>
                </div>
              </div>
            ) : (
              /* Active Chat screen (100% replica of user screenshot 2) */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto gemini-dark-scrollbar px-6 sm:px-12 lg:px-24 py-8 max-w-4xl w-full mx-auto space-y-6">
                  {messages.map((msg) => (
                    <div key={msg.id} className="w-full">
                      {msg.role === 'user' ? (
                        /* User message: Right-aligned rounded pill matching screenshot 2 */
                        <div className="flex justify-end mb-6">
                          <div className="bg-[#282a2d] text-white px-5 py-2.5 rounded-full text-[14px]">
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                        /* Gemini response: Left-aligned with actions below matching screenshot 2 */
                        <div className="flex flex-col items-start max-w-2xl">
                          <p className="text-[#e3e3e3] text-[14.5px] leading-relaxed m-0 font-normal">
                            {msg.content}
                          </p>

                          {msg.action && (
                            <div className="mt-3">
                              <button
                                onClick={() => {
                                  if (msg.action?.view === 'booking') setActiveView('booking');
                                  if (msg.action?.view === 'profile') setActiveView('profile');
                                }}
                                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#8ab4f8] text-[#041e49] font-medium text-xs hover:bg-[#aecbfa] transition-colors cursor-pointer"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>{msg.action.label}</span>
                              </button>
                            </div>
                          )}

                          {/* Action icons below reply matching screenshot 2 */}
                          <div className="flex items-center gap-3 mt-3 text-white/40">
                            <button
                              className="hover:text-white transition-colors cursor-pointer p-0.5"
                              title="Hài lòng"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="hover:text-white transition-colors cursor-pointer p-0.5"
                              title="Chưa hài lòng"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleSendMessage(messages[messages.length - 2]?.content)}
                              className="hover:text-white transition-colors cursor-pointer p-0.5"
                              title="Tạo lại câu trả lời"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCopy(msg.id, msg.content)}
                              className="hover:text-white transition-colors cursor-pointer p-0.5"
                              title="Sao chép"
                            >
                              {copiedId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-green-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              className="hover:text-white transition-colors cursor-pointer p-0.5"
                              title="Thêm"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {isThinking && (
                    <div className="flex gap-2 items-center py-2 text-white/40 text-xs">
                      <div className="w-2 h-2 rounded-full bg-[#8ab4f8] animate-bounce" />
                      <div
                        className="w-2 h-2 rounded-full bg-[#8ab4f8] animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                      <div
                        className="w-2 h-2 rounded-full bg-[#8ab4f8] animate-bounce"
                        style={{ animationDelay: '0.4s' }}
                      />
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom fixed prompt capsule in active chat */}
                <div className="p-4 sm:p-6 pb-4 max-w-3xl w-full mx-auto">
                  <BorderBeam
                    size="md"
                    colorVariant="colorful"
                    active={isBeamActive}
                    strength={isBeamActive ? 0.85 : 0}
                    borderRadius={9999}
                    theme="dark"
                    className="w-full max-w-[680px] mx-auto"
                  >
                    <div className="gemini-capsule" style={{ maxWidth: '100%' }}>
                      <button
                        type="button"
                        onClick={() => setActiveView('booking')}
                        className="text-white/60 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
                      >
                        <Plus className="w-5 h-5" strokeWidth={1.8} />
                      </button>
                      <input
                        type="text"
                        value={inputPrompt}
                        onChange={(e) => setInputPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="Hỏi NOVAMED AI..."
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsListening(!isListening)}
                          className={`text-white/60 hover:text-white p-1 ${isListening ? 'text-red-400' : ''}`}
                        >
                          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendMessage()}
                          disabled={!inputPrompt.trim()}
                          className={`p-1.5 rounded-full transition-all ${
                            inputPrompt.trim()
                              ? 'bg-[#8ab4f8] text-[#041e49]'
                              : 'text-white/30 cursor-not-allowed'
                          }`}
                        >
                          <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  </BorderBeam>
                  {/* Disclaimer text below capsule matching screenshot 2 */}
                  <p className="text-[11.5px] text-center text-white/40 mt-2.5 m-0 font-normal">
                    NOVAMED là trợ lý AI y tế và có thể mắc sai sót. Vui lòng xác nhận lại thông tin quan trọng với bác sĩ.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* =========================================================================
          3. GLOBAL SEARCH MODAL (⌘K)
          ========================================================================= */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] bg-black/60 backdrop-blur-md px-4 animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setIsSearchOpen(false)} />
          <div className="relative w-full max-w-xl bg-[#1e1f20] border border-white/[0.12] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center px-6 border-b border-white/[0.08]">
              <Search className="w-5 h-5 text-white/50 mr-3.5 shrink-0" strokeWidth={1.8} />
              <input
                autoFocus
                className="flex-1 bg-transparent py-4 border-none outline-none ring-0 shadow-none text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-0"
                placeholder="Tìm kiếm hồ sơ, bác sĩ hoặc chức năng..."
              />
              <kbd
                onClick={() => setIsSearchOpen(false)}
                className="hidden sm:inline-flex items-center justify-center h-6 px-2 text-[11px] font-bold font-mono text-white/60 bg-white/[0.06] rounded-md cursor-pointer"
              >
                ESC
              </kbd>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="ml-3 p-1.5 rounded-full text-white/50 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={1.8} />
              </button>
            </div>
            <div className="p-6 py-8 flex flex-col items-center justify-center text-center">
              <Command className="w-8 h-8 text-white/30 mb-2" strokeWidth={1.8} />
              <p className="text-xs text-white/60 font-medium m-0">
                Tìm nhanh khoa khám, bác sĩ hoặc hồ sơ bệnh án
              </p>
              <div className="flex gap-2 mt-3.5">
                <button
                  onClick={() => {
                    setActiveView('booking');
                    setIsSearchOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-xs text-white/80 transition-colors cursor-pointer"
                >
                  📅 Đặt lịch khám
                </button>
                <button
                  onClick={() => {
                    setActiveView('profile');
                    setIsSearchOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-xs text-white/80 transition-colors cursor-pointer"
                >
                  📋 Hồ sơ bệnh nhân
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GeminiDashboard;
