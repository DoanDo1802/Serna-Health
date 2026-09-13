'use client'

import { useToast } from '@/hooks/use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/base/ui/toast'
import { AlertCircle, Info } from 'lucide-react'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const isDestructive = props.variant === 'destructive'

        return (
          <Toast key={id} {...props}>
            <div className="flex gap-3.5 items-start">
              {isDestructive ? (
                <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-4.5 w-4.5" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Info className="h-4.5 w-4.5" />
                </div>
              )}
              <div className="grid gap-0.5">
                {title && (
                  <ToastTitle className="text-[13px] font-bold text-foreground">
                    {title}
                  </ToastTitle>
                )}
                {description && (
                  <ToastDescription className="text-xs text-muted-foreground font-medium leading-relaxed">
                    {description}
                  </ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
