import type { LucideIcon } from "lucide-react"
import {
  Accessibility,
  Armchair,
  Building2,
  ChevronUp,
  ChevronsUpDown,
  Compass,
  DoorOpen,
  LayoutGrid,
  Maximize,
  ShieldAlert,
  Sun,
  Wrench,
} from "lucide-react"
import type { DoorSide, FacilityElementType, FacilityFloor, FacilityFloorElement } from "@/lib/api"

export type { FacilityElementType, DoorSide }
export type FloorConfig = FacilityFloor
export type RoomLayoutSlot = FacilityFloorElement

export type FloorPlanTool = {
  elementType: FacilityElementType
  roomId?: string
  customLabel?: string
}

export type CanvasDisplayMode = "cad" | "functional"

export const ELEMENT_LABELS: Record<FacilityElementType, string> = {
  ROOM: "Phòng bệnh / Khám",
  WALKWAY: "Hành lang",
  ELEVATOR: "Thang máy",
  STAIRS: "Thang bộ",
  WC: "Khu vệ sinh",
  RECEPTION: "Quầy tiếp đón",
  EQUIPMENT: "Kho / Kỹ thuật",
  WAITING_AREA: "Sảnh chờ",
  EMERGENCY_EXIT: "Lối thoát hiểm",
  OTHER: "Giếng trời / Khoảng mở",
}

export const FLOOR_PLAN_TOOLS: FacilityElementType[] = [
  "ROOM",
  "WALKWAY",
  "ELEVATOR",
  "STAIRS",
  "WC",
  "RECEPTION",
  "EQUIPMENT",
  "WAITING_AREA",
  "EMERGENCY_EXIT",
  "OTHER",
]

export const ELEMENT_ICONS: Record<FacilityElementType, LucideIcon> = {
  ROOM: Building2,
  WALKWAY: DoorOpen,
  ELEVATOR: ChevronUp,
  STAIRS: ChevronsUpDown,
  WC: Accessibility,
  RECEPTION: Armchair,
  EQUIPMENT: Wrench,
  WAITING_AREA: Armchair,
  EMERGENCY_EXIT: ShieldAlert,
  OTHER: Sun,
}

export const DOOR_SIDE_LABELS: Record<DoorSide, string> = {
  NORTH: "Cửa phía Bắc (Trên)",
  SOUTH: "Cửa phía Nam (Dưới)",
  EAST: "Cửa phía Đông (Phải)",
  WEST: "Cửa phía Tây (Trái)",
}

export function defaultElementLabel(elementType: FacilityElementType, customLabel?: string) {
  if (customLabel) return customLabel
  if (elementType === "ROOM") return "Phòng mới"
  if (elementType === "OTHER") return "GIẾNG TRỜI"
  if (elementType === "WAITING_AREA") return "SẢNH CHỜ"
  if (elementType === "ELEVATOR") return "THANG MÁY"
  if (elementType === "STAIRS") return "THANG BỘ"
  if (elementType === "WC") return "NHÀ VỆ SINH"
  return ELEMENT_LABELS[elementType]
}

export type CornerType = "square" | "round" | "chamfer"

export interface CornerConfig {
  tl?: CornerType // Top-Left (Tây Bắc)
  tr?: CornerType // Top-Right (Đông Bắc)
  br?: CornerType // Bottom-Right (Đông Nam)
  bl?: CornerType // Bottom-Left (Tây Nam)
}

export const CORNER_LABELS: Record<CornerType, string> = {
  square: "Vuông 90°",
  round: "Bo tròn (Fillet)",
  chamfer: "Vát góc 45°",
}

export type RotationAngle = 0 | 90 | 180 | 270

export const ROTATE_DOOR_CW: Record<DoorSide, DoorSide> = {
  NORTH: "EAST",
  EAST: "SOUTH",
  SOUTH: "WEST",
  WEST: "NORTH",
}

export const ROTATE_DOOR_CCW: Record<DoorSide, DoorSide> = {
  NORTH: "WEST",
  WEST: "SOUTH",
  SOUTH: "EAST",
  EAST: "NORTH",
}

export function rotateCornersCW(corners: CornerConfig): CornerConfig {
  return {
    tl: corners.bl,
    tr: corners.tl,
    br: corners.tr,
    bl: corners.br,
  }
}

export function rotateCornersCCW(corners: CornerConfig): CornerConfig {
  return {
    tl: corners.tr,
    tr: corners.br,
    br: corners.bl,
    bl: corners.tl,
  }
}

export function parseNotesAndCorners(rawNotes?: string | null): {
  notes: string
  corners: CornerConfig
  rotation: RotationAngle
} {
  if (!rawNotes) return { notes: "", corners: {}, rotation: 0 }
  let cleanNotes = rawNotes
  let corners: CornerConfig = {}
  let rotation: RotationAngle = 0

  const cornerMatch = cleanNotes.match(/<!--corners:(\{.*?\})-->/)
  if (cornerMatch) {
    try {
      corners = JSON.parse(cornerMatch[1]) as CornerConfig
      cleanNotes = cleanNotes.replace(cornerMatch[0], "")
    } catch {}
  }

  const rotMatch = cleanNotes.match(/<!--rotation:(0|90|180|270)-->/)
  if (rotMatch) {
    rotation = parseInt(rotMatch[1], 10) as RotationAngle
    cleanNotes = cleanNotes.replace(rotMatch[0], "")
  }

  return { notes: cleanNotes.trim(), corners, rotation }
}

export function formatNotesWithCorners(
  notes: string,
  corners: CornerConfig,
  rotation: RotationAngle = 0
): string | null {
  const hasCorners = Boolean(corners.tl || corners.tr || corners.br || corners.bl)
  const cleanNotes = notes
    .replace(/<!--corners:\{.*?\}-->/g, "")
    .replace(/<!--rotation:\d+-->/g, "")
    .trim()

  const tags: string[] = []
  if (hasCorners) tags.push(`<!--corners:${JSON.stringify(corners)}-->`)
  if (rotation !== 0) tags.push(`<!--rotation:${rotation}-->`)

  if (tags.length === 0) return cleanNotes || null
  return cleanNotes ? `${cleanNotes} ${tags.join(" ")}` : tags.join(" ")
}

