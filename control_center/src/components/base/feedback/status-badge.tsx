import { cn } from "@/lib/utils"

type Tone = "success" | "warning" | "danger" | "neutral"

const toneClasses: Record<Tone, string> = {
  success: "bg-primary/10 text-primary border border-primary/20",
  warning: "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive border border-destructive/20",
  neutral: "bg-muted text-muted-foreground border border-border",
}

export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  )
}
