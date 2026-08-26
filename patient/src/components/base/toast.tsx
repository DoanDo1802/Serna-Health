'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, type, title, message, duration };
      
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title?: string) => {
      showToast({ type: 'success', title: title || 'Thành công', message });
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, title?: string) => {
      showToast({ type: 'error', title: title || 'Có lỗi xảy ra', message });
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, title?: string) => {
      showToast({ type: 'info', title: title || 'Thông báo', message });
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, title?: string) => {
      showToast({ type: 'warning', title: title || 'Cảnh báo', message });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      {/* Bottom Right Toast Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-[380px] w-[calc(100vw-48px)] sm:w-[380px] pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto w-full bg-[#ffffff] text-[#141311] border border-[#e8e4dc] p-4 rounded-2xl shadow-[0_16px_45px_rgba(0,0,0,0.12)] flex items-start gap-3.5 animate-in slide-in-from-bottom-5 fade-in duration-300 transition-all font-sans"
          >
            {/* Icon based on type */}
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && (
                <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              {toast.type === 'error' && (
                <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
                  <AlertCircle className="w-4 h-4" />
                </div>
              )}
              {toast.type === 'warning' && (
                <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              )}
              {toast.type === 'info' && (
                <div className="w-7 h-7 rounded-full bg-[#ede8dc] text-[#141311] flex items-center justify-center border border-[#dcd6ca]">
                  <Info className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-1">
              {toast.title && (
                <h4 className="text-xs font-bold text-[#141311] mb-0.5 tracking-tight">
                  {toast.title}
                </h4>
              )}
              <p className="text-xs text-[#555147] leading-relaxed font-medium m-0 break-words">
                {toast.message}
              </p>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 rounded-md text-[#8e897e] hover:text-[#141311] hover:bg-black/5 transition-colors cursor-pointer bg-transparent border-none"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
