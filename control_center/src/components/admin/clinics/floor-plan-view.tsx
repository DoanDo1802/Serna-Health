"use client"

import React, { useMemo, useRef, useState } from "react"
import {
  Compass,
  Copy,
  CopyPlus,
  GripVertical,
  Maximize2,
  Minus,
  Palette,
  RotateCcw,
  RotateCw,
  Settings2,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react"
import type { DoorSide, FacilityFloor, FacilityFloorElement, FacilityFloorSymbol, Room } from "@/lib/api"
import { Button } from "@/components/base/ui/button"
import { Badge } from "@/components/base/ui/badge"
import {
  type CanvasDisplayMode,
  ELEMENT_ICONS,
  ELEMENT_LABELS,
  type FloorPlanTool,
  parseNotesAndCorners,
} from "./floor-plan-types"

export type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"
export type DragMode = "move" | ResizeDirection

interface FloorPlanViewProps {
  floor: FacilityFloor
  elements: FacilityFloorElement[]
  symbols?: FacilityFloorSymbol[]
  rooms: Room[]
  isDesignMode: boolean
  selectedElementId?: string | null
  activeTool: FloorPlanTool | null
  isCreating?: boolean
  displayMode?: CanvasDisplayMode
  onSelectElement: (element: FacilityFloorElement) => void
  onAddElement?: () => void
  onCancelTool: () => void
  onCreateGeometry: (tool: FloorPlanTool, geometry: Geometry) => Promise<void> | void
  onPersistGeometry: (element: FacilityFloorElement, geometry: Geometry) => Promise<void> | void
  onQuickDoorSideChange?: (element: FacilityFloorElement, doorSide: DoorSide | null) => Promise<void> | void
  onChangeDisplayMode?: (mode: CanvasDisplayMode) => void
  onRotateElement?: (element: FacilityFloorElement, direction?: "CW" | "CCW") => void
  onCopyElement?: (element: FacilityFloorElement) => void
  onDuplicateElement?: (element: FacilityFloorElement) => void
  onPasteElement?: () => void
  onRemoveElement?: (element: FacilityFloorElement) => void
  onDeselect?: () => void
  canPaste?: boolean
  onEditFloor?: () => void
  onDeleteFloor?: () => void
}

export type Geometry = Pick<FacilityFloorElement, "gridX" | "gridY" | "gridWidth" | "gridHeight">
type DragState = { element: FacilityFloorElement; startX: number; startY: number; original: Geometry; mode: DragMode }
type CreateState = { startX: number; startY: number; geometry: Geometry; invalid: boolean }

function computeCandidate(
  original: Geometry,
  deltaX: number,
  deltaY: number,
  mode: DragMode,
  maxCols: number,
  maxRows: number
): Geometry {
  if (mode === "move") {
    const x = Math.max(0, Math.min(original.gridX + deltaX, maxCols - original.gridWidth))
    const y = Math.max(0, Math.min(original.gridY + deltaY, maxRows - original.gridHeight))
    return { gridX: x, gridY: y, gridWidth: original.gridWidth, gridHeight: original.gridHeight }
  }

  let x = original.gridX
  let y = original.gridY
  let w = original.gridWidth
  let h = original.gridHeight

  // Horizontal resizing (e, ne, se = right edge; w, nw, sw = left edge)
  if (mode === "e" || mode === "ne" || mode === "se") {
    w = Math.max(1, Math.min(original.gridWidth + deltaX, maxCols - x))
  } else if (mode === "w" || mode === "nw" || mode === "sw") {
    const rawX = original.gridX + deltaX
    const rightEdge = original.gridX + original.gridWidth
    x = Math.max(0, Math.min(rawX, rightEdge - 1))
    w = rightEdge - x
  }

  // Vertical resizing (s, se, sw = bottom edge; n, ne, nw = top edge)
  if (mode === "s" || mode === "se" || mode === "sw") {
    h = Math.max(1, Math.min(original.gridHeight + deltaY, maxRows - y))
  } else if (mode === "n" || mode === "ne" || mode === "nw") {
    const rawY = original.gridY + deltaY
    const bottomEdge = original.gridY + original.gridHeight
    y = Math.max(0, Math.min(rawY, bottomEdge - 1))
    h = bottomEdge - y
  }

  return { gridX: x, gridY: y, gridWidth: w, gridHeight: h }
}

const functionalThemes: Record<FacilityFloorElement["elementType"], string> = {
  ROOM: "bg-amber-50/90 border-amber-600 text-amber-950 dark:bg-amber-950/30 dark:border-amber-500 dark:text-amber-100",
  WALKWAY: "bg-slate-100/90 border-slate-400 text-slate-800 dark:bg-slate-800/40 dark:border-slate-500 dark:text-slate-200",
  ELEVATOR: "bg-violet-50/90 border-violet-600 text-violet-950 dark:bg-violet-950/30 dark:border-violet-500 dark:text-violet-100",
  STAIRS: "bg-slate-100/90 border-slate-600 text-slate-800 dark:bg-slate-900/40 dark:border-slate-400 dark:text-slate-200",
  WC: "bg-sky-50/90 border-sky-600 text-sky-950 dark:bg-sky-950/30 dark:border-sky-500 dark:text-sky-100",
  RECEPTION: "bg-indigo-50/90 border-indigo-600 text-indigo-950 dark:bg-indigo-950/30 dark:border-indigo-500 dark:text-indigo-100",
  EQUIPMENT: "bg-cyan-50/90 border-cyan-600 text-cyan-950 dark:bg-cyan-950/30 dark:border-cyan-500 dark:text-cyan-100",
  WAITING_AREA: "bg-emerald-50/90 border-emerald-600 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-500 dark:text-emerald-100",
  EMERGENCY_EXIT: "bg-rose-50/90 border-rose-600 text-rose-950 dark:bg-rose-950/30 dark:border-rose-500 dark:text-rose-100",
  OTHER: "bg-muted border-muted-foreground text-foreground",
}

export function intersects(first: Geometry, second: Geometry) {
  return (
    first.gridX < second.gridX + second.gridWidth &&
    first.gridX + first.gridWidth > second.gridX &&
    first.gridY < second.gridY + second.gridHeight &&
    first.gridY + first.gridHeight > second.gridY
  )
}

export function FloorPlanView({
  floor,
  elements,
  symbols = [],
  rooms,
  isDesignMode,
  selectedElementId,
  activeTool,
  isCreating,
  displayMode = "cad",
  onSelectElement,
  onAddElement,
  onCancelTool,
  onCreateGeometry,
  onPersistGeometry,
  onQuickDoorSideChange,
  onChangeDisplayMode,
  onRotateElement,
  onCopyElement,
  onDuplicateElement,
  onPasteElement,
  onRemoveElement,
  onDeselect,
  canPaste,
  onEditFloor,
  onDeleteFloor,
}: FloorPlanViewProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const createRef = useRef<CreateState | null>(null)
  const didDragRef = useRef(false)
  const [preview, setPreview] = useState<{ id: string; geometry: Geometry; invalid: boolean } | null>(null)
  const [createPreview, setCreatePreview] = useState<CreateState | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms])

  const geometryFor = (element: FacilityFloorElement): Geometry =>
    preview?.id === element.id ? preview.geometry : element

  const cellAt = (clientX: number, clientY: number) => {
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!bounds) return null
    return {
      gridX: Math.max(0, Math.min(floor.gridColumns - 1, Math.floor((clientX - bounds.left) / (bounds.width / floor.gridColumns)))),
      gridY: Math.max(0, Math.min(floor.gridRows - 1, Math.floor((clientY - bounds.top) / (bounds.height / floor.gridRows)))),
    }
  }

  const rectangle = (startX: number, startY: number, endX: number, endY: number): Geometry => ({
    gridX: Math.min(startX, endX),
    gridY: Math.min(startY, endY),
    gridWidth: Math.abs(endX - startX) + 1,
    gridHeight: Math.abs(endY - startY) + 1,
  })

  const previewCreate = (startX: number, startY: number, endX: number, endY: number): CreateState => {
    const geometry = rectangle(startX, startY, endX, endY)
    return {
      startX,
      startY,
      geometry,
      invalid: elements.some((element) => intersects(geometry, geometryFor(element))),
    }
  }

  const updatePreview = (event: React.PointerEvent<HTMLDivElement>) => {
    const create = createRef.current
    if (create) {
      const cell = cellAt(event.clientX, event.clientY)
      if (cell) setCreatePreview(previewCreate(create.startX, create.startY, cell.gridX, cell.gridY))
      return
    }
    const drag = dragRef.current
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!drag || !bounds) return
    const deltaX = Math.round((event.clientX - drag.startX) / (bounds.width / floor.gridColumns))
    const deltaY = Math.round((event.clientY - drag.startY) / (bounds.height / floor.gridRows))
    if (deltaX !== 0 || deltaY !== 0) {
      didDragRef.current = true
    }
    const candidate: Geometry = computeCandidate(
      drag.original,
      deltaX,
      deltaY,
      drag.mode,
      floor.gridColumns,
      floor.gridRows
    )
    setPreview({
      id: drag.element.id,
      geometry: candidate,
      invalid: elements.some((element) => element.id !== drag.element.id && intersects(candidate, geometryFor(element))),
    })
  }

  const finishDrag = async () => {
    const drag = dragRef.current
    const current = preview
    dragRef.current = null
    setPreview(null)
    setTimeout(() => {
      didDragRef.current = false
    }, 120)
    if (!drag || !current || current.invalid || JSON.stringify(current.geometry) === JSON.stringify(drag.original)) return
    await onPersistGeometry(drag.element, current.geometry)
  }

  const finishCreate = async () => {
    const tool = activeTool
    const current = createPreview ?? createRef.current
    createRef.current = null
    setCreatePreview(null)
    if (!tool || !current || current.invalid) return
    setCreateError(null)
    try {
      await onCreateGeometry(tool, current.geometry)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Không thể tạo phần tử. Hãy thử vẽ lại.")
    }
  }

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>, element: FacilityFloorElement, mode: DragMode) => {
    if (!isDesignMode || activeTool) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      element,
      startX: event.clientX,
      startY: event.clientY,
      original: { gridX: element.gridX, gridY: element.gridY, gridWidth: element.gridWidth, gridHeight: element.gridHeight },
      mode,
    }
  }

  const beginCreate = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDesignMode || !activeTool || isCreating || event.target !== event.currentTarget) return
    const cell = cellAt(event.clientX, event.clientY)
    if (!cell) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setCreateError(null)
    const state = previewCreate(cell.gridX, cell.gridY, cell.gridX, cell.gridY)
    createRef.current = state
    setCreatePreview(state)
  }

  const cancelTool = () => {
    dragRef.current = null
    createRef.current = null
    setPreview(null)
    setCreatePreview(null)
    setCreateError(null)
    onCancelTool()
  }

  const keyboardMove = async (event: React.KeyboardEvent<HTMLDivElement>, element: FacilityFloorElement) => {
    if (!isDesignMode || activeTool) return
    if (event.key === "r" || event.key === "R") {
      event.preventDefault()
      onRotateElement?.(element, event.shiftKey ? "CCW" : "CW")
      return
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return
    event.preventDefault()
    const amount = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1
    const next: Geometry = { gridX: element.gridX, gridY: element.gridY, gridWidth: element.gridWidth, gridHeight: element.gridHeight }
    if (event.shiftKey) {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") next.gridWidth += amount
      else next.gridHeight += amount
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") next.gridX += amount
    else next.gridY += amount
    next.gridWidth = Math.max(1, Math.min(next.gridWidth, floor.gridColumns))
    next.gridHeight = Math.max(1, Math.min(next.gridHeight, floor.gridRows))
    next.gridX = Math.max(0, Math.min(next.gridX, floor.gridColumns - next.gridWidth))
    next.gridY = Math.max(0, Math.min(next.gridY, floor.gridRows - next.gridHeight))
    if (!elements.some((other) => other.id !== element.id && intersects(next, other))) {
      await onPersistGeometry(element, next)
    }
  }

  const changeZoom = (amount: number) =>
    setZoom((current) => Math.max(0.6, Math.min(1.6, Math.round((current + amount) * 10) / 10)))

  return (
    <div className="space-y-3">
      {/* Consolidated Canvas Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border bg-card px-3 py-2 text-xs shadow-2xs">
        {/* Left: Floor Name, Grid Badge, Display Mode Switcher */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-foreground tracking-tight">{floor.name}</span>
            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 h-5 font-medium">
              {floor.gridColumns} × {floor.gridRows}
            </Badge>
          </div>

          <div className="h-4 w-px bg-border mx-0.5" />

          {onChangeDisplayMode && (
            <div className="flex rounded-md border bg-muted/60 p-0.5">
              <button
                type="button"
                onClick={() => onChangeDisplayMode("cad")}
                className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  displayMode === "cad" ? "bg-background shadow-xs text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Compass className="h-3 w-3" />
                Bản vẽ CAD
              </button>
              <button
                type="button"
                onClick={() => onChangeDisplayMode("functional")}
                className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  displayMode === "functional" ? "bg-background shadow-xs text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Palette className="h-3 w-3" />
                Màu phân loại
              </button>
            </div>
          )}
        </div>

        {/* Right: Zoom Controls & Floor Actions */}
        <div className="flex items-center gap-1.5">
          {/* Zoom Group */}
          <div className="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5">
            <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Thu nhỏ" disabled={zoom <= 0.6} onClick={() => changeZoom(-0.1)}>
              <Minus className="h-3 w-3" />
            </Button>
            <span className="min-w-9 text-center tabular-nums text-[11px] font-medium text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Phóng to" disabled={zoom >= 1.6} onClick={() => changeZoom(0.1)}>
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" aria-label="Reset zoom" disabled={zoom === 1} onClick={() => setZoom(1)}>
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>

          {(onEditFloor || onDeleteFloor) && (
            <>
              <div className="h-4 w-px bg-border mx-0.5" />
              {onEditFloor && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={onEditFloor}
                  title="Cấu hình kích thước và thông tin tầng"
                >
                  <Settings2 className="mr-1 h-3.5 w-3.5" /> Cấu hình
                </Button>
              )}
              {onDeleteFloor && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  onClick={onDeleteFloor}
                  title="Xóa tầng này"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {activeTool && (
        <div className="flex items-center justify-between rounded-lg border-2 border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-medium">
          <span className="flex items-center gap-2 text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {isCreating
              ? "Đang lưu phần tử lên hệ thống..."
              : `Đang chọn [${ELEMENT_LABELS[activeTool.elementType]}]: Kéo chuột trên vùng trống để vẽ.`}
          </span>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-primary hover:bg-primary/20" disabled={isCreating} onClick={cancelTool}>
            <X className="mr-1 h-3.5 w-3.5" /> Hủy
          </Button>
        </div>
      )}

      {createError && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {createError}
        </p>
      )}

      {/* Main Drawing Canvas Container */}
      <div
        onClick={(event) => {
          if (event.target === event.currentTarget && !didDragRef.current) {
            onDeselect?.()
          }
        }}
        className="overflow-auto rounded-xl border-2 border-slate-800 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-zinc-950"
      >
        <div style={{ width: `${zoom * 100}%` }} className="mx-auto min-w-[640px] transition-[width] duration-150">
          {/* CSS Grid Canvas */}
          <div
            ref={canvasRef}
            role="grid"
            aria-label="Lưới mặt bằng kiến trúc"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                cancelTool()
                onDeselect?.()
              }
            }}
            onClick={() => {
              if (!didDragRef.current) {
                onDeselect?.()
              }
            }}
            onPointerDown={beginCreate}
            onPointerMove={updatePreview}
            onPointerUp={() => void (createRef.current ? finishCreate() : finishDrag())}
            onPointerCancel={cancelTool}
            className={`relative min-w-[600px] select-none gap-px bg-slate-200 dark:bg-slate-800 ${
              activeTool ? "cursor-crosshair" : ""
            } ${displayMode === "cad" ? "border-2 border-slate-900 dark:border-slate-300" : "border rounded-md"}`}
            style={{
              aspectRatio: `${floor.gridColumns} / ${floor.gridRows}`,
              display: "grid",
              gridTemplateColumns: `repeat(${floor.gridColumns}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${floor.gridRows}, minmax(0, 1fr))`,
            }}
          >
            {/* Creating Preview Box */}
            {createPreview && activeTool && (
              <div
                className={`pointer-events-none border-2 border-dashed p-1 flex flex-col items-center justify-center text-center ${
                  functionalThemes[activeTool.elementType]
                } ${createPreview.invalid ? "border-rose-600 bg-rose-100 dark:bg-rose-950/40" : "opacity-85 ring-2 ring-primary"}`}
                style={{
                  gridColumn: `${createPreview.geometry.gridX + 1} / span ${createPreview.geometry.gridWidth}`,
                  gridRow: `${createPreview.geometry.gridY + 1} / span ${createPreview.geometry.gridHeight}`,
                  zIndex: 999,
                }}
              >
                <span className="text-[10px] font-bold truncate max-w-full">
                  {createPreview.invalid ? "Vị trí chồng lấn!" : ELEMENT_LABELS[activeTool.elementType]}
                </span>
                <span className="mt-0.5 rounded-xs bg-slate-950/85 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white shadow-xs">
                  {createPreview.geometry.gridWidth} × {createPreview.geometry.gridHeight}
                </span>
              </div>
            )}

            {/* Architectural Vector Symbols (Walls, Arcs, Free-floating doors) */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              viewBox={`0 0 ${floor.gridColumns} ${floor.gridRows}`}
              aria-label="Ký hiệu kiến trúc"
            >
              {symbols.map((symbol) => (
                <ArchitecturalSymbol key={symbol.id} symbol={symbol} />
              ))}
            </svg>

            {/* Floor Plan Elements (Rooms, Elevators, Stairs, WC, Skywell) */}
            {elements.map((element) => {
              const geometry = geometryFor(element)
              const room = element.roomId ? roomById.get(element.roomId) : undefined
              const isInvalid = preview?.id === element.id && preview.invalid
              const isSelected = selectedElementId === element.id
              const { corners } = parseNotesAndCorners(element.notes)

              const CHAMFER = 22
              const hasChamfer = corners.tl === "chamfer" || corners.tr === "chamfer" || corners.br === "chamfer" || corners.bl === "chamfer"

              const clipPath = hasChamfer
                ? `polygon(${[
                    corners.tl === "chamfer" ? `0px ${CHAMFER}px, ${CHAMFER}px 0px` : "0% 0%",
                    corners.tr === "chamfer" ? `calc(100% - ${CHAMFER}px) 0px, 100% ${CHAMFER}px` : "100% 0%",
                    corners.br === "chamfer" ? `100% calc(100% - ${CHAMFER}px), calc(100% - ${CHAMFER}px) 100%` : "100% 100%",
                    corners.bl === "chamfer" ? `${CHAMFER}px 100%, 0px calc(100% - ${CHAMFER}px)` : "0% 100%",
                  ].join(", ")})`
                : undefined

              return (
                <div
                  key={element.id}
                  role="gridcell"
                  tabIndex={isDesignMode && !activeTool ? 0 : -1}
                  onKeyDown={(event) => void keyboardMove(event, element)}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelectElement(element)
                  }}
                  onPointerDown={(event) => beginDrag(event, element, "move")}
                  className={`group relative overflow-visible ${
                    isDesignMode && !activeTool ? "cursor-move" : "cursor-pointer"
                  } ${
                    isSelected ? "z-30" : ""
                  }`}
                  style={{
                    gridColumn: `${geometry.gridX + 1} / span ${geometry.gridWidth}`,
                    gridRow: `${geometry.gridY + 1} / span ${geometry.gridHeight}`,
                    zIndex: isSelected ? 30 : element.zIndex + 1,
                  }}
                >
                  {/* Visual Room Body (Background, theme borders, chamfer/round clipping) */}
                  <div
                    className={`absolute inset-0 transition-shadow ${
                      displayMode === "cad"
                        ? "border-2 border-slate-900 bg-white text-slate-900 dark:border-slate-200 dark:bg-slate-900 dark:text-slate-100"
                        : functionalThemes[element.elementType]
                    } ${
                      isSelected ? "ring-2 ring-primary ring-offset-2" : ""
                    } ${
                      isInvalid ? "border-rose-600 bg-rose-100 dark:bg-rose-950/40" : ""
                    }`}
                    style={{
                      clipPath,
                      borderTopLeftRadius: corners.tl === "round" ? "20px" : undefined,
                      borderTopRightRadius: corners.tr === "round" ? "20px" : undefined,
                      borderBottomRightRadius: corners.br === "round" ? "20px" : undefined,
                      borderBottomLeftRadius: corners.bl === "round" ? "20px" : undefined,
                    }}
                  >
                    {/* Grip Icon for Design Mode */}
                    {isDesignMode && !activeTool && (
                      <GripVertical className="absolute left-0.5 top-0.5 h-3 w-3 text-slate-400 opacity-40 group-hover:opacity-100" />
                    )}

                    {/* Architectural 90° Swing Door CAD Symbol */}
                    {element.doorSide && (
                      <CadDoor side={element.doorSide} />
                    )}

                    {/* Element Specific CAD Architectural Representations */}
                    <ElementContent
                      element={element}
                      room={room}
                      displayMode={displayMode}
                      gridWidth={geometry.gridWidth}
                      gridHeight={geometry.gridHeight}
                    />
                  </div>

                  {/* Chamfer diagonal cut borders */}
                  {corners.tl === "chamfer" && (
                    <svg className="pointer-events-none absolute left-0 top-0 z-20 h-[22px] w-[22px] overflow-visible text-slate-900 dark:text-slate-200">
                      <line x1="0" y1="22" x2="22" y2="0" stroke="currentColor" strokeWidth="2.5" />
                    </svg>
                  )}
                  {corners.tr === "chamfer" && (
                    <svg className="pointer-events-none absolute right-0 top-0 z-20 h-[22px] w-[22px] overflow-visible text-slate-900 dark:text-slate-200">
                      <line x1="0" y1="0" x2="22" y2="22" stroke="currentColor" strokeWidth="2.5" />
                    </svg>
                  )}
                  {corners.br === "chamfer" && (
                    <svg className="pointer-events-none absolute bottom-0 right-0 z-20 h-[22px] w-[22px] overflow-visible text-slate-900 dark:text-slate-200">
                      <line x1="22" y1="0" x2="0" y2="22" stroke="currentColor" strokeWidth="2.5" />
                    </svg>
                  )}
                  {corners.bl === "chamfer" && (
                    <svg className="pointer-events-none absolute bottom-0 left-0 z-20 h-[22px] w-[22px] overflow-visible text-slate-900 dark:text-slate-200">
                      <line x1="22" y1="22" x2="0" y2="0" stroke="currentColor" strokeWidth="2.5" />
                    </svg>
                  )}

                  {/* Live Dimension Tooltip strictly while Resizing or Moving */}
                  {preview?.id === element.id && (
                    <div
                      className={`pointer-events-none absolute ${
                        geometry.gridY === 0 ? "-bottom-10" : "-top-10"
                      } left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-md bg-slate-950/95 px-3 py-1.5 text-xs font-mono font-bold text-white shadow-2xl ring-2 ring-emerald-500/50 backdrop-blur-md whitespace-nowrap animate-in fade-in zoom-in-95 duration-75`}
                    >
                      <Maximize2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-emerald-300 font-extrabold">{geometry.gridWidth} × {geometry.gridHeight}</span>
                      <span className="text-[11px] text-slate-300 font-normal">
                        (X:{geometry.gridX}, Y:{geometry.gridY})
                      </span>
                      {preview.invalid && (
                        <span className="ml-1 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] text-white font-bold animate-pulse">
                          Trùng lấn!
                        </span>
                      )}
                    </div>
                  )}

                  {/* 4-Direction & Corner Resize Handles in Design Mode */}
                  {isDesignMode && !activeTool && (
                    <>
                      {/* Edge Handles (Visible when selected for 4-direction resizing) */}
                      {isSelected && (
                        <>
                          {/* Top Edge (North) */}
                          <div
                            role="button"
                            aria-label="Kéo cạnh trên"
                            title="Kéo mở rộng / thu nhỏ cạnh trên"
                            onPointerDown={(event) => beginDrag(event, element, "n")}
                            className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-2.5 w-10 rounded-full bg-primary border border-background shadow-xs hover:scale-110 cursor-ns-resize z-40 transition-transform before:absolute before:-inset-2.5 before:content-['']"
                          />
                          {/* Bottom Edge (South) */}
                          <div
                            role="button"
                            aria-label="Kéo cạnh dưới"
                            title="Kéo mở rộng / thu nhỏ cạnh dưới"
                            onPointerDown={(event) => beginDrag(event, element, "s")}
                            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-2.5 w-10 rounded-full bg-primary border border-background shadow-xs hover:scale-110 cursor-ns-resize z-40 transition-transform before:absolute before:-inset-2.5 before:content-['']"
                          />
                          {/* Left Edge (West) */}
                          <div
                            role="button"
                            aria-label="Kéo cạnh trái"
                            title="Kéo mở rộng / thu nhỏ cạnh trái"
                            onPointerDown={(event) => beginDrag(event, element, "w")}
                            className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-10 rounded-full bg-primary border border-background shadow-xs hover:scale-110 cursor-ew-resize z-40 transition-transform before:absolute before:-inset-2.5 before:content-['']"
                          />
                          {/* Right Edge (East) */}
                          <div
                            role="button"
                            aria-label="Kéo cạnh phải"
                            title="Kéo mở rộng / thu nhỏ cạnh phải"
                            onPointerDown={(event) => beginDrag(event, element, "e")}
                            className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-10 rounded-full bg-primary border border-background shadow-xs hover:scale-110 cursor-ew-resize z-40 transition-transform before:absolute before:-inset-2.5 before:content-['']"
                          />
                          {/* Corner Handles: Top-Left, Top-Right, Bottom-Left */}
                          <div
                            role="button"
                            aria-label="Kéo góc trên trái"
                            onPointerDown={(event) => beginDrag(event, element, "nw")}
                            className="absolute -top-1.5 -left-1.5 h-3 w-3 rounded-xs bg-background border-2 border-primary shadow-xs hover:scale-125 cursor-nwse-resize z-40 transition-transform"
                          />
                          <div
                            role="button"
                            aria-label="Kéo góc trên phải"
                            onPointerDown={(event) => beginDrag(event, element, "ne")}
                            className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-xs bg-background border-2 border-primary shadow-xs hover:scale-125 cursor-nesw-resize z-40 transition-transform"
                          />
                          <div
                            role="button"
                            aria-label="Kéo góc dưới trái"
                            onPointerDown={(event) => beginDrag(event, element, "sw")}
                            className="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-xs bg-background border-2 border-primary shadow-xs hover:scale-125 cursor-nesw-resize z-40 transition-transform"
                          />
                        </>
                      )}

                      {/* Bottom-Right Corner (South-East) Handle - Always visible in design mode */}
                      <div
                        role="button"
                        aria-label="Đổi kích thước góc dưới phải"
                        title="Kéo góc để chỉnh kích thước"
                        onPointerDown={(event) => beginDrag(event, element, "se")}
                        className={`absolute -bottom-1.5 -right-1.5 flex h-4 w-4 cursor-se-resize items-center justify-center rounded-xs shadow-xs transition-transform ${
                          isSelected
                            ? "bg-primary text-primary-foreground scale-110 z-40 ring-1 ring-background"
                            : "bg-slate-800/80 text-white hover:scale-110 z-30 dark:bg-slate-200 dark:text-slate-900"
                        }`}
                      >
                        <Maximize2 className="h-2.5 w-2.5" />
                      </div>
                    </>
                  )}

                  {/* Floating Action Bar in Design Mode for Selected Element (Hidden while actively dragging/resizing to prevent overlap) */}
                  {isDesignMode && !activeTool && isSelected && !preview && (
                    <div
                      onPointerDown={(event) => event.stopPropagation()}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      className={`pointer-events-auto absolute ${
                        geometry.gridY <= 1 ? "-bottom-16" : "-top-16"
                      } left-1/2 -translate-x-1/2 z-40 flex ${
                        geometry.gridY <= 1 ? "flex-col-reverse" : "flex-col"
                      } items-center animate-in fade-in zoom-in-95 duration-100`}
                    >
                      <div
                        onPointerDown={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        className="flex items-center gap-1 rounded-full border-2 border-emerald-500/60 bg-background/95 px-2 py-0.5 shadow-xl backdrop-blur-md text-foreground ring-1 ring-black/10"
                      >
                        {/* Current Dimensions Badge directly in the toolbar */}
                        <div
                          className="flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200 px-1 select-none"
                          title={`Kích thước: ${geometry.gridWidth} cột × ${geometry.gridHeight} hàng (Vị trí X:${geometry.gridX}, Y:${geometry.gridY})`}
                        >
                          <Maximize2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>{geometry.gridWidth} × {geometry.gridHeight}</span>
                        </div>

                        <div className="h-3.5 w-px bg-border mx-0.5" />

                        {onRotateElement && (
                          <>
                            <button
                              type="button"
                              aria-label="Xoay 90° thuận"
                              title="Xoay 90° thuận (Phím tắt: R)"
                              onPointerDown={(event) => event.stopPropagation()}
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation()
                                event.preventDefault()
                                onRotateElement(element, "CW")
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/60 transition-all hover:scale-110 active:scale-95 cursor-pointer"
                            >
                              <RotateCw className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Xoay 90° ngược"
                              title="Xoay 90° ngược (Phím tắt: Shift+R)"
                              onPointerDown={(event) => event.stopPropagation()}
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation()
                                event.preventDefault()
                                onRotateElement(element, "CCW")
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-all hover:scale-110 active:scale-95 cursor-pointer"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                            <div className="h-3.5 w-px bg-border mx-0.5" />
                          </>
                        )}
                        {onDuplicateElement && (
                          <button
                            type="button"
                            aria-label="Nhân bản"
                            title="Nhân bản cùng kích thước (Phím tắt: Ctrl+D)"
                            onPointerDown={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation()
                              event.preventDefault()
                              onDuplicateElement(element)
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/60 transition-all hover:scale-110 active:scale-95 cursor-pointer"
                          >
                            <CopyPlus className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {onCopyElement && (
                          <button
                            type="button"
                            aria-label="Sao chép"
                            title="Sao chép vào bộ nhớ tạm (Phím tắt: Ctrl+C)"
                            onPointerDown={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation()
                              event.preventDefault()
                              onCopyElement(element)
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-all hover:scale-110 active:scale-95 cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {onRemoveElement && (
                          <>
                            <div className="h-3.5 w-px bg-border mx-0.5" />
                            <button
                              type="button"
                              aria-label="Xóa phần tử"
                              title="Xóa phần tử khỏi mặt bằng (Phím tắt: Delete hoặc Backspace)"
                              onPointerDown={(event) => event.stopPropagation()}
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation()
                                event.preventDefault()
                                onRemoveElement(element)
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-rose-600 hover:bg-rose-100 hover:text-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/60 transition-all hover:scale-110 active:scale-95 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                      <div className="h-4 w-0.5 bg-emerald-500/40 pointer-events-none" />
                    </div>
                  )}
                </div>
              )
            })}

            {/* Empty State message */}
            {elements.length === 0 && !createPreview && (
              <div className="pointer-events-none col-span-full row-span-full flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <Compass className="h-8 w-8 stroke-1 text-slate-400" />
                <p className="font-medium">Chưa có phần tử nào trên mặt bằng này.</p>
                <p className="text-xs">
                  {activeTool
                    ? `Đang chọn [${ELEMENT_LABELS[activeTool.elementType]}]. Hãy kéo chuột trên lưới để vẽ.`
                    : "Chọn công cụ ở thanh bên trái rồi kéo trên lưới để vẽ."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Architectural CAD Door Component
 * Draws proportional 90° swing door with door leaf line and circular sweep arc
 */
function CadDoor({ side }: { side: DoorSide }) {
  if (side === "SOUTH") {
    return (
      <div className="pointer-events-none absolute bottom-0 left-1.5 z-20 h-5 w-5">
        <svg viewBox="0 0 20 20" className="h-full w-full overflow-visible">
          <line x1="-1" y1="20" x2="18" y2="20" stroke="white" strokeWidth="2.5" />
          <line x1="0" y1="18" x2="0" y2="22" stroke="#0f172a" strokeWidth="1.2" />
          <line x1="17" y1="18" x2="17" y2="22" stroke="#0f172a" strokeWidth="1.2" />
          <line x1="0" y1="20" x2="0" y2="3" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
          <path d="M 0 3 A 17 17 0 0 1 17 20" fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="2 1.5" />
        </svg>
      </div>
    )
  }

  if (side === "NORTH") {
    return (
      <div className="pointer-events-none absolute left-1.5 top-0 z-20 h-5 w-5">
        <svg viewBox="0 0 20 20" className="h-full w-full overflow-visible">
          <line x1="-1" y1="0" x2="18" y2="0" stroke="white" strokeWidth="2.5" />
          <line x1="0" y1="-2" x2="0" y2="2" stroke="#0f172a" strokeWidth="1.2" />
          <line x1="17" y1="-2" x2="17" y2="2" stroke="#0f172a" strokeWidth="1.2" />
          <line x1="0" y1="0" x2="0" y2="17" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
          <path d="M 0 17 A 17 17 0 0 0 17 0" fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="2 1.5" />
        </svg>
      </div>
    )
  }

  if (side === "WEST") {
    return (
      <div className="pointer-events-none absolute left-0 top-1.5 z-20 h-5 w-5">
        <svg viewBox="0 0 20 20" className="h-full w-full overflow-visible">
          <line x1="0" y1="-1" x2="0" y2="18" stroke="white" strokeWidth="2.5" />
          <line x1="-2" y1="0" x2="2" y2="0" stroke="#0f172a" strokeWidth="1.2" />
          <line x1="-2" y1="17" x2="2" y2="17" stroke="#0f172a" strokeWidth="1.2" />
          <line x1="0" y1="0" x2="17" y2="0" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
          <path d="M 17 0 A 17 17 0 0 1 0 17" fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="2 1.5" />
        </svg>
      </div>
    )
  }

  // EAST
  return (
    <div className="pointer-events-none absolute right-0 top-1.5 z-20 h-5 w-5">
      <svg viewBox="0 0 20 20" className="h-full w-full overflow-visible">
        <line x1="20" y1="-1" x2="20" y2="18" stroke="white" strokeWidth="2.5" />
        <line x1="18" y1="0" x2="22" y2="0" stroke="#0f172a" strokeWidth="1.2" />
        <line x1="18" y1="17" x2="22" y2="17" stroke="#0f172a" strokeWidth="1.2" />
        <line x1="20" y1="0" x2="3" y2="0" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
        <path d="M 3 0 A 17 17 0 0 0 20 17" fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="2 1.5" />
      </svg>
    </div>
  )
}

/**
 * Architectural Element Content
 * Clean representation: Only display user's label and user's notes!
 */
function ElementContent({
  element,
  room,
  displayMode,
  gridWidth,
  gridHeight,
}: {
  element: FacilityFloorElement
  room?: Room
  displayMode: CanvasDisplayMode
  gridWidth: number
  gridHeight: number
}) {
  const isCad = displayMode === "cad"
  const label = element.elementType === "ROOM" ? room?.name ?? element.label : element.label
  const code = room?.code ?? ""
  const { notes: cleanNotes, rotation = 0, propType } = parseNotesAndCorners(element.notes)
  const isPlant = propType === "plant" || label.toUpperCase().includes("CÂY") || label.toUpperCase().includes("PLANT")
  const isWall = propType === "wall" || label.toUpperCase().includes("TƯỜNG") || label.toUpperCase().includes("VÁCH")
  const isCashier = propType === "cashier" || element.elementType === "RECEPTION" || label.toUpperCase().includes("THU NGÂN") || label.toUpperCase().includes("TIẾP NHẬN") || label.toUpperCase().includes("TIẾP ĐÓN")
  const isBench = propType === "bench" || (element.elementType === "WAITING_AREA" && !label.toUpperCase().includes("SẢNH CHỜ RỘNG")) || label.toUpperCase().includes("GHẾ") || label.toUpperCase().includes("SOFA")
  const isSkywell =
    element.elementType === "OTHER" &&
    !isPlant &&
    !isWall &&
    (label.toUpperCase().includes("TRỜI") || label.toUpperCase().includes("GIẾNG") || label.toUpperCase().includes("THÔNG TẦNG"))

  // PLANT (Chậu cây cảnh): Top-down architectural potted plant
  if (isPlant) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center p-1 select-none overflow-hidden">
        <svg viewBox="0 0 100 100" className="h-full w-full max-h-16 max-w-16 drop-shadow-xs">
          {/* Ceramic Pot Base */}
          <rect x="24" y="24" width="52" height="52" rx="12" fill="#f8fafc" stroke="#1e293b" strokeWidth="3" className="dark:fill-slate-800 dark:stroke-slate-200" />
          {/* Inner Soil Ring */}
          <circle cx="50" cy="50" r="20" fill="#78350f" fillOpacity="0.12" stroke="#92400e" strokeWidth="1.5" strokeDasharray="3 2" />
          {/* Organic Radiating Lush Green Leaves */}
          <g fill="#10b981" stroke="#047857" strokeWidth="1.5" className="dark:fill-emerald-500 dark:stroke-emerald-300">
            <path d="M 50 30 C 44 14 56 14 50 30 Z" />
            <path d="M 50 70 C 44 86 56 86 50 70 Z" />
            <path d="M 30 50 C 14 44 14 56 30 50 Z" />
            <path d="M 70 50 C 86 44 86 56 70 50 Z" />
            <path d="M 36 36 C 22 22 30 18 36 36 Z" />
            <path d="M 64 36 C 78 22 70 18 64 36 Z" />
            <path d="M 36 64 C 22 78 18 70 36 64 Z" />
            <path d="M 64 64 C 78 78 82 70 64 64 Z" />
            {/* Center Foliage Node */}
            <circle cx="50" cy="50" r="7" fill="#059669" stroke="#065f46" strokeWidth="1.5" />
          </g>
        </svg>
        {cleanNotes && (
          <span className="mt-0.5 text-[8px] font-semibold text-emerald-800 dark:text-emerald-300 truncate max-w-full">
            {cleanNotes}
          </span>
        )}
      </div>
    )
  }

  // WALL / PARTITION (Tường / Vách ngăn kiến trúc)
  if (isWall) {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 select-none overflow-hidden">
        <svg className="absolute inset-0 h-full w-full opacity-35" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id={`wall-hatch-${element.id}`} width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" strokeWidth="2.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#wall-hatch-${element.id})`} />
        </svg>
        <span className="relative z-10 text-[9px] font-bold tracking-widest uppercase opacity-80">
          {label !== "TƯỜNG" ? label : ""}
        </span>
      </div>
    )
  }

  // RECEPTION / CASHIER (Quầy thu ngân / Tiếp đón với bàn quầy và biểu tượng nhân viên)
  if (isCashier) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-between p-1 text-center select-none overflow-hidden">
        {/* Title & Subtitle */}
        <div className="flex flex-col items-center justify-center w-full z-10">
          <span className="text-[10px] font-bold tracking-tight text-slate-950 dark:text-white uppercase truncate max-w-full">
            {label || "QUẦY THU NGÂN"}
          </span>
          {cleanNotes && (
            <span className="text-[8px] font-medium text-slate-600 dark:text-slate-400 truncate max-w-full">
              {cleanNotes}
            </span>
          )}
        </div>

        {/* Curved Counter Desk with Staff/Cashier Icon - rotates with rotation angle */}
        <div className="relative flex flex-1 w-full items-center justify-center min-h-0">
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full max-h-20 max-w-20 drop-shadow-xs transition-transform duration-200"
          >
            <g transform={`rotate(${rotation}, 50, 50)`}>
              {/* Staff Head & Shoulders sitting behind desk */}
              <circle
                cx="50"
                cy="34"
                r="7"
                fill="#0f172a"
                className="dark:fill-slate-100"
              />
              <path
                d="M 36 50 C 36 42, 64 42, 64 50 Z"
                fill="#0f172a"
                className="dark:fill-slate-100"
              />
              {/* Elongated Counter Desk */}
              <rect
                x="14"
                y="50"
                width="72"
                height="18"
                rx="6"
                fill="#ffffff"
                stroke="#0f172a"
                strokeWidth="2.5"
                className="dark:fill-slate-800 dark:stroke-slate-100"
              />
              {/* Counter top partition / payment ledge */}
              <line
                x1="22"
                y1="59"
                x2="78"
                y2="59"
                stroke="#94a3b8"
                strokeWidth="2"
                strokeLinecap="round"
                className="dark:stroke-slate-500"
              />
              {/* Cash Register / Monitor on Desk */}
              <rect
                x="44"
                y="52"
                width="12"
                height="5"
                rx="1"
                fill="#475569"
                className="dark:fill-slate-400"
              />
            </g>
          </svg>
        </div>
      </div>
    )
  }

  // BENCH / WAITING AREA (Băng ghế chờ / Sofa sảnh)
  if (isBench) {
    const isRotatedVertical = rotation === 90 || rotation === 270
    const seatCount = Math.max(2, Math.min(6, Math.floor((isRotatedVertical ? gridHeight : gridWidth) / 1.5)))
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-between p-1 text-center select-none overflow-hidden">
        <div className="flex flex-col items-center justify-center w-full z-10">
          <span className="text-[10px] font-bold tracking-wider text-slate-900 dark:text-slate-100 uppercase truncate max-w-full">
            {label || "SẢNH CHỜ"}
          </span>
          {cleanNotes && (
            <span className="text-[8px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-full">
              {cleanNotes}
            </span>
          )}
        </div>

        {/* Row of Connected Seats / Sofa with rotation */}
        <div className="relative flex flex-1 w-full items-center justify-center min-h-0">
          <div
            className="flex items-center justify-center gap-1 my-0.5 transition-transform duration-200"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {Array.from({ length: seatCount }).map((_, idx) => (
              <div
                key={idx}
                className="relative flex flex-col items-center justify-end rounded-xs border border-slate-800 bg-slate-100/90 p-0.5 shadow-2xs dark:border-slate-200 dark:bg-slate-800"
                style={{ width: "18px", height: "15px" }}
              >
                {/* Seat backrest */}
                <div className="h-1.5 w-full rounded-xs bg-slate-400 dark:bg-slate-600 -mt-0.5" />
                {/* Cushion */}
                <div className="h-2 w-full rounded-xs bg-white dark:bg-slate-700 mt-0.5 border border-slate-300 dark:border-slate-600" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ELEVATOR: CAD Box with diagonal intersecting cross lines (X)
  if (element.elementType === "ELEVATOR") {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden p-1">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <rect x="6" y="6" width="88" height="88" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-900 dark:text-slate-100" />
          <line x1="6" y1="6" x2="94" y2="94" stroke="currentColor" strokeWidth="1.8" className="text-slate-700 dark:text-slate-300" />
          <line x1="94" y1="6" x2="6" y2="94" stroke="currentColor" strokeWidth="1.8" className="text-slate-700 dark:text-slate-300" />
        </svg>
        <span className="relative z-10 rounded-xs bg-white/95 px-1 py-0.5 text-[9px] font-bold tracking-wider text-slate-950 shadow-xs dark:bg-slate-900/95 dark:text-white">
          {label || "THANG MÁY"}
        </span>
        {cleanNotes && (
          <span className="relative z-10 mt-0.5 max-w-full truncate text-[8px] text-slate-600 dark:text-slate-400">
            {cleanNotes}
          </span>
        )}
      </div>
    )
  }

  // STAIRS: CAD Parallel treads + directional arrow line matching rotation
  if (element.elementType === "STAIRS") {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden p-1">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {rotation === 90 ? (
            // Arrow pointing RIGHT, treads vertical
            <>
              {[14, 26, 38, 50, 62, 74, 86].map((x) => (
                <line key={x} x1={x} y1="4" x2={x} y2="96" stroke="currentColor" strokeWidth="1.5" className="text-slate-400 dark:text-slate-600" />
              ))}
              <line x1="8" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="2" className="text-slate-900 dark:text-slate-100" />
              <polygon points="96,50 86,43 86,57" fill="currentColor" className="text-slate-900 dark:text-slate-100" />
              <circle cx="8" cy="50" r="3" fill="currentColor" className="text-slate-900 dark:text-slate-100" />
            </>
          ) : rotation === 180 ? (
            // Arrow pointing DOWN, treads horizontal
            <>
              {[14, 26, 38, 50, 62, 74, 86].map((y) => (
                <line key={y} x1="4" y1={y} x2="96" y2={y} stroke="currentColor" strokeWidth="1.5" className="text-slate-400 dark:text-slate-600" />
              ))}
              <line x1="50" y1="8" x2="50" y2="90" stroke="currentColor" strokeWidth="2" className="text-slate-900 dark:text-slate-100" />
              <polygon points="50,96 43,86 57,86" fill="currentColor" className="text-slate-900 dark:text-slate-100" />
              <circle cx="50" cy="8" r="3" fill="currentColor" className="text-slate-900 dark:text-slate-100" />
            </>
          ) : rotation === 270 ? (
            // Arrow pointing LEFT, treads vertical
            <>
              {[14, 26, 38, 50, 62, 74, 86].map((x) => (
                <line key={x} x1={x} y1="4" x2={x} y2="96" stroke="currentColor" strokeWidth="1.5" className="text-slate-400 dark:text-slate-600" />
              ))}
              <line x1="92" y1="50" x2="10" y2="50" stroke="currentColor" strokeWidth="2" className="text-slate-900 dark:text-slate-100" />
              <polygon points="4,50 14,43 14,57" fill="currentColor" className="text-slate-900 dark:text-slate-100" />
              <circle cx="92" cy="50" r="3" fill="currentColor" className="text-slate-900 dark:text-slate-100" />
            </>
          ) : (
            // Arrow pointing UP, treads horizontal (rotation === 0)
            <>
              {[14, 26, 38, 50, 62, 74, 86].map((y) => (
                <line key={y} x1="4" y1={y} x2="96" y2={y} stroke="currentColor" strokeWidth="1.5" className="text-slate-400 dark:text-slate-600" />
              ))}
              <line x1="50" y1="92" x2="50" y2="10" stroke="currentColor" strokeWidth="2" className="text-slate-900 dark:text-slate-100" />
              <polygon points="50,4 43,14 57,14" fill="currentColor" className="text-slate-900 dark:text-slate-100" />
              <circle cx="50" cy="92" r="3" fill="currentColor" className="text-slate-900 dark:text-slate-100" />
            </>
          )}
        </svg>
        <span className="relative z-10 rounded-xs bg-white/95 px-1 py-0.5 text-[9px] font-bold tracking-wider text-slate-950 shadow-xs dark:bg-slate-900/95 dark:text-white">
          {label || "THANG BỘ"}
        </span>
        {cleanNotes && (
          <span className="relative z-10 mt-0.5 max-w-full truncate text-[8px] text-slate-600 dark:text-slate-400">
            {cleanNotes}
          </span>
        )}
      </div>
    )
  }

  // WC: Top-down porcelain toilet fixtures that rotate dynamically with the room
  if (element.elementType === "WC") {
    const isHorizontalWall = rotation === 0 || rotation === 180
    const wallUnits = isHorizontalWall ? gridWidth : gridHeight
    const toiletCount = wallUnits >= 6 ? 3 : wallUnits >= 3 ? 2 : 1

    const renderToilet = (idx: number) => (
      <svg
        key={idx}
        className="h-5 w-4 shrink-0 text-slate-800 dark:text-slate-200 transition-transform duration-200"
        style={{ transform: `rotate(${rotation}deg)` }}
        viewBox="0 0 20 28"
        fill="none"
      >
        <rect x="2" y="2" width="16" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.1" />
        <path d="M 4 8 C 4 19 6 26 10 26 C 14 26 16 19 16 8 Z" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.05" />
        <ellipse cx="10" cy="17" rx="3.5" ry="5.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    )

    const toiletList = Array.from({ length: toiletCount }, (_, i) => renderToilet(i))

    if (rotation === 90) {
      // 90° CW: Toilets along West (left) wall, facing East. Label on Right.
      return (
        <div className="relative flex h-full w-full flex-row items-center justify-between overflow-hidden p-1.5">
          <div className="flex h-full flex-col items-center justify-around gap-1 py-1">
            {toiletList}
          </div>
          <div className="flex flex-1 flex-col items-center justify-center text-center pl-1">
            <span className="text-[10px] font-bold tracking-wider text-slate-900 dark:text-slate-100">
              {label || "NHÀ VỆ SINH"}
            </span>
            {cleanNotes && (
              <span className="max-w-full truncate text-[8px] text-slate-500 font-medium">
                {cleanNotes}
              </span>
            )}
          </div>
        </div>
      )
    }

    if (rotation === 180) {
      // 180°: Toilets along North (top) wall, facing South. Label at Bottom.
      return (
        <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden p-1.5">
          <div className="flex w-full items-center justify-around gap-1 px-1">
            {toiletList}
          </div>
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-bold tracking-wider text-slate-900 dark:text-slate-100">
              {label || "NHÀ VỆ SINH"}
            </span>
            {cleanNotes && (
              <span className="max-w-full truncate text-[8px] text-slate-500 font-medium">
                {cleanNotes}
              </span>
            )}
          </div>
        </div>
      )
    }

    if (rotation === 270) {
      // 270°: Toilets along East (right) wall, facing West. Label on Left.
      return (
        <div className="relative flex h-full w-full flex-row items-center justify-between overflow-hidden p-1.5">
          <div className="flex flex-1 flex-col items-center justify-center text-center pr-1">
            <span className="text-[10px] font-bold tracking-wider text-slate-900 dark:text-slate-100">
              {label || "NHÀ VỆ SINH"}
            </span>
            {cleanNotes && (
              <span className="max-w-full truncate text-[8px] text-slate-500 font-medium">
                {cleanNotes}
              </span>
            )}
          </div>
          <div className="flex h-full flex-col items-center justify-around gap-1 py-1">
            {toiletList}
          </div>
        </div>
      )
    }

    // rotation === 0 (Default): Toilets at bottom (South), Label at top
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden p-1.5">
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-bold tracking-wider text-slate-900 dark:text-slate-100">
            {label || "NHÀ VỆ SINH"}
          </span>
          {cleanNotes && (
            <span className="max-w-full truncate text-[8px] text-slate-500 font-medium">
              {cleanNotes}
            </span>
          )}
        </div>
        <div className="flex w-full items-center justify-around gap-1 px-1">
          {toiletList}
        </div>
      </div>
    )
  }

  // SKYWELL (Giếng trời): Rectangular void with diagonal dashed lines intersecting in the center
  if (isSkywell) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center border-2 border-dashed border-slate-900 bg-slate-50/50 p-2 text-center dark:border-slate-100 dark:bg-slate-900/30 overflow-hidden select-none">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <line x1="0" y1="0" x2="35" y2="50" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" className="text-slate-700 dark:text-slate-300" />
          <line x1="0" y1="100" x2="35" y2="50" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" className="text-slate-700 dark:text-slate-300" />
          <line x1="100" y1="0" x2="65" y2="50" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" className="text-slate-700 dark:text-slate-300" />
          <line x1="100" y1="100" x2="65" y2="50" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" className="text-slate-700 dark:text-slate-300" />
        </svg>
        <span className="relative z-10 font-serif text-xs sm:text-sm font-bold tracking-widest text-slate-900 dark:text-white uppercase">
          {label || "GIẾNG TRỜI"}
        </span>
        {cleanNotes && (
          <span className="relative z-10 mt-0.5 text-[9px] font-medium text-slate-600 dark:text-slate-400">
            {cleanNotes}
          </span>
        )}
      </div>
    )
  }

  // STANDARD ROOM / WAITING / OTHER (Only display code, label and user's notes)
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-0.5 overflow-hidden p-1 text-center">
      {!isCad && (
        <Badge variant="outline" className="max-w-full gap-1 truncate border-current bg-background/60 px-1 py-0 text-[9px]">
          {React.createElement(ELEMENT_ICONS[element.elementType], { className: "h-2.5 w-2.5 shrink-0" })}
          {ELEMENT_LABELS[element.elementType]}
        </Badge>
      )}

      {/* Primary Room Code or Label */}
      <span className="max-w-full truncate text-xs font-bold uppercase tracking-tight text-slate-950 dark:text-white sm:text-sm">
        {code ? (code.startsWith("P") ? code : `P. ${code}`) : label}
      </span>

      {/* Secondary Room Name if code exists and label is distinct */}
      {code && label && label !== code && (
        <span className="max-w-full truncate text-[10px] font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </span>
      )}

      {/* User Notes (Only shown if user actually provided notes!) */}
      {cleanNotes && (
        <span className="max-w-full truncate text-[9px] font-medium text-slate-500 dark:text-slate-400">
          {cleanNotes}
        </span>
      )}
    </div>
  )
}

/**
 * Free-floating Architectural Symbols
 */
function ArchitecturalSymbol({ symbol }: { symbol: FacilityFloorSymbol }) {
  const stroke = "currentColor"
  const common = { fill: "none", stroke, strokeWidth: 0.18, vectorEffect: "non-scaling-stroke" as const }
  const geometry = symbol.geometry

  if (symbol.symbolType === "WALL_STRAIGHT" || symbol.symbolType === "PARTITION") {
    const line = geometry as Extract<typeof geometry, { start: unknown }>
    return (
      <line
        x1={line.start.x}
        y1={line.start.y}
        x2={line.end.x}
        y2={line.end.y}
        {...common}
        strokeWidth={line.thickness * 0.22}
        className="text-slate-900 dark:text-white"
      />
    )
  }

  if (symbol.symbolType === "WALL_CURVED") {
    const arc = geometry as Extract<typeof geometry, { center: unknown }>
    return (
      <path
        d={arcPath(arc.center.x, arc.center.y, arc.radius, arc.startAngle, arc.sweepAngle)}
        {...common}
        strokeWidth={arc.thickness * 0.22}
        className="text-slate-900 dark:text-white"
      />
    )
  }

  if (symbol.symbolType === "DOOR") {
    const door = geometry as Extract<typeof geometry, { hinge: unknown }>
    const end = polarPoint(door.hinge.x, door.hinge.y, door.radius, door.startAngle + door.sweepAngle)
    return (
      <g className="text-slate-900 dark:text-white">
        <path
          d={arcPath(door.hinge.x, door.hinge.y, door.radius, door.startAngle, door.sweepAngle)}
          {...common}
          strokeWidth={0.12}
          strokeDasharray="0.14 0.1"
        />
        <line x1={door.hinge.x} y1={door.hinge.y} x2={end.x} y2={end.y} {...common} strokeWidth={0.2} />
      </g>
    )
  }

  const footprint = geometry as Extract<typeof geometry, { width: unknown }>
  const cx = footprint.x + footprint.width / 2
  const cy = footprint.y + footprint.height / 2
  return (
    <g transform={`rotate(${footprint.rotation} ${cx} ${cy})`} className="text-slate-800 dark:text-slate-200">
      <rect x={footprint.x} y={footprint.y} width={footprint.width} height={footprint.height} {...common} fill="rgba(255,255,255,.65)" strokeWidth={0.22} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="0.75" className="fill-current font-bold">
        {symbol.label}
      </text>
    </g>
  )
}

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) }
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, sweepAngle: number) {
  const start = polarPoint(cx, cy, radius, startAngle)
  const end = polarPoint(cx, cy, radius, startAngle + sweepAngle)
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${Math.abs(sweepAngle) > 180 ? 1 : 0} ${
    sweepAngle >= 0 ? 1 : 0
  } ${end.x} ${end.y}`
}
