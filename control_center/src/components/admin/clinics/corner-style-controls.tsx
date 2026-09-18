"use client"

import React from "react"
import { Button } from "@/components/base/ui/button"
import type { CornerConfig, CornerType } from "./floor-plan-types"

interface CornerStyleControlsProps {
  corners: CornerConfig
  onChange: (corners: CornerConfig) => void
  disabled?: boolean
  compact?: boolean
}

const NEXT_CORNER: Record<CornerType, CornerType> = {
  square: "round",
  round: "chamfer",
  chamfer: "square",
}

const CORNER_SYMBOL: Record<CornerType, string> = {
  square: "90°",
  round: "╭ Bo",
  chamfer: "◤ Vát",
}

export function CornerStyleControls({ corners, onChange, disabled, compact }: CornerStyleControlsProps) {
  const currentTL: CornerType = corners.tl ?? "square"
  const currentTR: CornerType = corners.tr ?? "square"
  const currentBR: CornerType = corners.br ?? "square"
  const currentBL: CornerType = corners.bl ?? "square"

  const cycle = (cornerKey: "tl" | "tr" | "br" | "bl") => {
    if (disabled) return
    const current = corners[cornerKey] ?? "square"
    const next = NEXT_CORNER[current]
    onChange({ ...corners, [cornerKey]: next === "square" ? undefined : next })
  }

  const setCorner = (cornerKey: "tl" | "tr" | "br" | "bl", type: CornerType) => {
    if (disabled) return
    onChange({ ...corners, [cornerKey]: type === "square" ? undefined : type })
  }

  const setAll = (type: CornerType) => {
    if (disabled) return
    if (type === "square") onChange({})
    else onChange({ tl: type, tr: type, br: type, bl: type })
  }

  const cornerButtonClass = (type: CornerType) => {
    if (type === "chamfer")
      return "border-amber-500/80 bg-amber-50 text-amber-900 font-bold dark:bg-amber-950/40 dark:text-amber-200"
    if (type === "round")
      return "border-blue-500/80 bg-blue-50 text-blue-900 font-bold dark:bg-blue-950/40 dark:text-blue-200"
    return "border-border bg-background text-muted-foreground hover:text-foreground"
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-muted-foreground">
          Kiểu góc (Bo tròn / Vát 45°):
        </label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            className="h-5 px-1.5 text-[10px]"
            onClick={() => setAll("square")}
            title="Đưa cả 4 góc về vuông 90°"
          >
            Vuông
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            className="h-5 px-1.5 text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400"
            onClick={() => setAll("round")}
            title="Bo cong cả 4 góc"
          >
            Bo cả 4
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            className="h-5 px-1.5 text-[10px] text-amber-600 hover:text-amber-700 dark:text-amber-400"
            onClick={() => setAll("chamfer")}
            title="Vát chéo cả 4 góc"
          >
            Vát cả 4
          </Button>
        </div>
      </div>

      {/* 2x2 Room Corner Interactive Matrix */}
      <div className="rounded-lg border bg-muted/30 p-2">
        <div className="grid grid-cols-2 gap-2">
          {/* Top-Left (Tây Bắc) */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => cycle("tl")}
            className={`flex flex-col items-start rounded-md border p-1.5 text-left transition-all ${cornerButtonClass(
              currentTL
            )}`}
            title="Click để đổi kiểu góc Tây Bắc (Vuông -> Bo tròn -> Vát 45°)"
          >
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">↖ Tây Bắc (TL)</span>
            <span className="mt-0.5 text-xs font-semibold">{CORNER_SYMBOL[currentTL]}</span>
          </button>

          {/* Top-Right (Đông Bắc) */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => cycle("tr")}
            className={`flex flex-col items-end rounded-md border p-1.5 text-right transition-all ${cornerButtonClass(
              currentTR
            )}`}
            title="Click để đổi kiểu góc Đông Bắc (Vuông -> Bo tròn -> Vát 45°)"
          >
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">↗ Đông Bắc (TR)</span>
            <span className="mt-0.5 text-xs font-semibold">
              {currentTR === "round" ? "Bo ╮" : currentTR === "chamfer" ? "Vát ◥" : "90°"}
            </span>
          </button>

          {/* Bottom-Left (Tây Nam) */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => cycle("bl")}
            className={`flex flex-col items-start rounded-md border p-1.5 text-left transition-all ${cornerButtonClass(
              currentBL
            )}`}
            title="Click để đổi kiểu góc Tây Nam (Vuông -> Bo tròn -> Vát 45°)"
          >
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">↙ Tây Nam (BL)</span>
            <span className="mt-0.5 text-xs font-semibold">
              {currentBL === "round" ? "Bo ╰" : currentBL === "chamfer" ? "Vát ◣" : "90°"}
            </span>
          </button>

          {/* Bottom-Right (Đông Nam) */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => cycle("br")}
            className={`flex flex-col items-end rounded-md border p-1.5 text-right transition-all ${cornerButtonClass(
              currentBR
            )}`}
            title="Click để đổi kiểu góc Đông Nam (Vuông -> Bo tròn -> Vát 45°)"
          >
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">↘ Đông Nam (BR)</span>
            <span className="mt-0.5 text-xs font-semibold">
              {currentBR === "round" ? "Bo ╯" : currentBR === "chamfer" ? "Vát ◢" : "90°"}
            </span>
          </button>
        </div>

        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          Click từng góc để chuyển lần lượt: <strong>Vuông 90° → Bo tròn (Fillet) → Vát chéo 45° (Chamfer)</strong>
        </p>
      </div>
    </div>
  )
}
