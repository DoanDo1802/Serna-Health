"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  Accessibility,
  AlertTriangle,
  Armchair,
  Building,
  Building2,
  Check,
  ChevronUp,
  ChevronsUpDown,
  ClipboardPaste,
  Compass,
  Copy,
  CopyPlus,
  DoorOpen,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  PencilRuler,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  Trash2,
  Wrench,
  X,
} from "lucide-react"
import {
  ApiError,
  departmentsApi,
  facilityLayoutApi,
  roomsApi,
  servicesApi,
  type Department,
  type DoorSide,
  type FacilityFloor,
  type FacilityFloorElement,
  type FacilityFloorSymbol,
  type Room,
  type Service,
} from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Card } from "@/components/base/ui/card"
import { Button } from "@/components/base/ui/button"
import { Input } from "@/components/base/ui/input"
import { Badge } from "@/components/base/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/base/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/base/ui/table"
import { FloorPlanView, intersects, type Geometry } from "./floor-plan-view"
import { AddRoomToFloorDialog } from "./add-room-to-floor-dialog"
import { CreateRoomDialog } from "./create-room-dialog"
import { FloorDialog } from "./floor-dialog"
import { RoomSlotDetailDialog } from "./room-slot-detail-dialog"
import {
  type CanvasDisplayMode,
  type CornerConfig,
  defaultElementLabel,
  DOOR_SIDE_LABELS,
  ELEMENT_LABELS,
  type FloorPlanTool,
  formatNotesWithCorners,
  parseNotesAndCorners,
  ROTATE_DOOR_CW,
  ROTATE_DOOR_CCW,
  rotateCornersCW,
  rotateCornersCCW,
  type RotationAngle,
} from "./floor-plan-types"
import { CornerStyleControls } from "./corner-style-controls"

type RoomWithEtag = Room & { etag?: string | null }
type FloorInput = Omit<FacilityFloor, "id" | "version" | "createdAt" | "updatedAt">
type ElementInput = Omit<FacilityFloorElement, "id" | "floorId" | "version" | "createdAt" | "updatedAt">

type LeftTab = "tools" | "unplaced" | "properties"

export function ClinicsContent() {
  const { toast } = useToast()
  const [departments, setDepartments] = useState<Department[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [rooms, setRooms] = useState<RoomWithEtag[]>([])
  const [floors, setFloors] = useState<FacilityFloor[]>([])
  const [elements, setElements] = useState<FacilityFloorElement[]>([])
  const [symbols, setSymbols] = useState<FacilityFloorSymbol[]>([])
  const [floorEtags, setFloorEtags] = useState<Record<string, string>>({})
  const [elementEtags, setElementEtags] = useState<Record<string, string>>({})
  const [selectedFloorId, setSelectedFloorId] = useState("")
  const [selectedElement, setSelectedElement] = useState<FacilityFloorElement | null>(null)
  const [serverElements, setServerElements] = useState<FacilityFloorElement[]>([])
  const [stagedDeletedIds, setStagedDeletedIds] = useState<Set<string>>(new Set())
  const [isSavingDesign, setIsSavingDesign] = useState(false)
  const [unsavedWarning, setUnsavedWarning] = useState<{ action: "switch_floor" | "exit_design"; targetFloorId?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [designMode, setDesignMode] = useState(true)
  const [viewMode, setViewMode] = useState<"floorplan" | "list">("floorplan")
  const [displayMode, setDisplayMode] = useState<CanvasDisplayMode>("cad")
  const [leftTab, setLeftTab] = useState<LeftTab>("tools")
  const [search, setSearch] = useState("")
  const [floorDialogOpen, setFloorDialogOpen] = useState(false)
  const [editingFloor, setEditingFloor] = useState<FacilityFloor | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [roomDialogOpen, setRoomDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [activeTool, setActiveTool] = useState<FloorPlanTool | null>(null)
  const [creatingElement, setCreatingElement] = useState(false)
  const [floorToDelete, setFloorToDelete] = useState<FacilityFloor | null>(null)
  const [editingRoom, setEditingRoom] = useState<RoomWithEtag | null>(null)
  const [roomToDelete, setRoomToDelete] = useState<RoomWithEtag | null>(null)
  const [clipboard, setClipboard] = useState<Omit<FacilityFloorElement, "id" | "floorId" | "version" | "createdAt" | "updatedAt"> | null>(null)

  // Local state for Quick Inspector inputs to ensure smooth typing
  const [inspectorLabel, setInspectorLabel] = useState("")
  const [inspectorNotes, setInspectorNotes] = useState("")
  const [inspectorCorners, setInspectorCorners] = useState<CornerConfig>({})

  const currentFloor = useMemo(() => floors.find((floor) => floor.id === selectedFloorId) ?? null, [floors, selectedFloorId])
  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms])
  const placedRoomIds = useMemo(() => new Set(elements.flatMap((element) => (element.roomId ? [element.roomId] : []))), [elements])

  // Helper to determine if an element has modified geometry, label, door, notes, or zIndex
  const isElementModified = useCallback((curr: FacilityFloorElement, orig?: FacilityFloorElement) => {
    if (!orig) return true
    return (
      curr.gridX !== orig.gridX ||
      curr.gridY !== orig.gridY ||
      curr.gridWidth !== orig.gridWidth ||
      curr.gridHeight !== orig.gridHeight ||
      curr.label !== orig.label ||
      (curr.doorSide ?? null) !== (orig.doorSide ?? null) ||
      (curr.notes ?? null) !== (orig.notes ?? null) ||
      curr.zIndex !== orig.zIndex
    )
  }, [])

  // Calculate batch diff between working state (elements + stagedDeletedIds) and server snapshot
  const dirtyChanges = useMemo(() => {
    const created = elements.filter((e) => e.id.startsWith("draft-"))
    const serverMap = new Map(serverElements.map((e) => [e.id, e]))
    const updated = elements.filter((e) => !e.id.startsWith("draft-") && isElementModified(e, serverMap.get(e.id)))
    const deletedCount = stagedDeletedIds.size
    return {
      created,
      updated,
      deletedCount,
      total: created.length + updated.length + deletedCount,
    }
  }, [elements, serverElements, stagedDeletedIds, isElementModified])

  const isDirty = dirtyChanges.total > 0

  // Sync quick inspector inputs whenever selectedElement changes
  useEffect(() => {
    if (selectedElement) {
      const { notes: cleanNotes, corners: parsedCorners } = parseNotesAndCorners(selectedElement.notes)
      setInspectorLabel(selectedElement.label)
      setInspectorNotes(cleanNotes)
      setInspectorCorners(parsedCorners)
    }
  }, [selectedElement])

  const loadCatalog = useCallback(async () => {
    const [departmentPage, servicePage, roomPage, floorPage] = await Promise.all([
      departmentsApi.list(),
      servicesApi.list(),
      roomsApi.list(),
      facilityLayoutApi.listFloors(),
    ])
    setDepartments(departmentPage.items)
    setServices(servicePage.items)
    setRooms(roomPage.items)
    setFloors(floorPage.items)
    setSelectedFloorId((current) => current || floorPage.items[0]?.id || "")
  }, [])

  const loadElements = useCallback(async (floorId: string) => {
    if (!floorId) {
      setElements([])
      setServerElements([])
      setStagedDeletedIds(new Set())
      setSymbols([])
      return
    }
    const [page, symbolPage] = await Promise.all([facilityLayoutApi.listElements(floorId), facilityLayoutApi.listSymbols(floorId)])
    setElements(page.items)
    setServerElements(page.items)
    setStagedDeletedIds(new Set())
    setSymbols(symbolPage.items)
    const etags: Record<string, string> = {}
    for (const element of page.items) {
      etags[element.id] = `"${element.version}"`
    }
    setElementEtags(etags)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await loadCatalog()
    } catch (error) {
      toast({
        title: "Không thể tải quản lý phòng khám",
        description: error instanceof Error ? error.message : "Vui lòng thử lại.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [loadCatalog, toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    void loadElements(selectedFloorId).catch((error) =>
      toast({
        title: "Không thể tải mặt bằng",
        description: error instanceof Error ? error.message : "Vui lòng thử lại.",
        variant: "destructive",
      })
    )
  }, [selectedFloorId, loadElements, toast])

  const reloadAfterConflict = async (error: unknown) => {
    if (!(error instanceof ApiError) || (error.status !== 412 && error.status !== 404)) return false
    await refresh()
    if (selectedFloorId) await loadElements(selectedFloorId)
    toast({
      title: "Dữ liệu đã thay đổi",
      description: "Mặt bằng đã được đồng bộ lại với máy chủ.",
      variant: "destructive",
    })
    return true
  }

  const floorPayload = (floor: FacilityFloor): FloorInput => ({
    code: floor.code,
    name: floor.name,
    level: floor.level,
    description: floor.description ?? null,
    gridColumns: floor.gridColumns,
    gridRows: floor.gridRows,
  })

  const elementPayload = (element: FacilityFloorElement): ElementInput => ({
    roomId: element.roomId ?? null,
    elementType: element.elementType,
    label: element.label,
    gridX: element.gridX,
    gridY: element.gridY,
    gridWidth: element.gridWidth,
    gridHeight: element.gridHeight,
    zIndex: element.zIndex,
    doorSide: element.doorSide ?? null,
    notes: element.notes ?? null,
  })

  const saveFloor = async (data: FloorInput) => {
    try {
      if (editingFloor) {
        const result = await facilityLayoutApi.updateFloor(
          editingFloor.id,
          data,
          floorEtags[editingFloor.id] ?? `"${editingFloor.version}"`
        )
        setFloors((current) => current.map((floor) => (floor.id === result.data.id ? result.data : floor)))
        setFloorEtags((current) => ({ ...current, [result.data.id]: result.etag ?? `"${result.data.version}"` }))
      } else {
        const result = await facilityLayoutApi.createFloor(data)
        setFloors((current) => [...current, result.data])
        setFloorEtags((current) => ({ ...current, [result.data.id]: result.etag ?? `"${result.data.version}"` }))
        setSelectedFloorId(result.data.id)
      }
      toast({ title: "Đã lưu tầng" })
    } catch (error) {
      if (!(await reloadAfterConflict(error)))
        toast({
          title: "Không thể lưu tầng",
          description: error instanceof Error ? error.message : "Vui lòng thử lại.",
          variant: "destructive",
        })
      throw error
    }
  }

  const createRoom = async (data: { code: string; name: string }) => {
    try {
      const result = await roomsApi.create(data)
      const newRoom: RoomWithEtag = { ...result.data, etag: result.etag }
      setRooms((current) => [...current, newRoom])
      toast({ title: "Đã tạo phòng mới trong danh mục" })
      return newRoom
    } catch (error) {
      toast({
        title: "Không thể tạo phòng",
        description: error instanceof Error ? error.message : "Vui lòng thử lại.",
        variant: "destructive",
      })
      throw error
    }
  }

  const updateRoomData = async (room: Room, data: { code: string; name: string }) => {
    try {
      const existingWithEtag = rooms.find((r) => r.id === room.id)
      const etag = existingWithEtag?.etag ?? `"${room.version}"`
      const result = await roomsApi.update(room.id, data, etag)
      const updated: RoomWithEtag = { ...result.data, etag: result.etag }
      setRooms((current) => current.map((r) => (r.id === room.id ? updated : r)))
      toast({ title: "Đã cập nhật thông tin phòng" })
    } catch (error) {
      toast({
        title: "Không thể cập nhật phòng",
        description: error instanceof Error ? error.message : "Vui lòng thử lại.",
        variant: "destructive",
      })
      throw error
    }
  }

  const deleteRoomData = async (room: RoomWithEtag) => {
    try {
      const etag = room.etag ?? `"${room.version}"`
      await roomsApi.delete(room.id, etag)
      setRooms((current) => current.filter((r) => r.id !== room.id))
      setRoomToDelete(null)
      toast({ title: "Đã xóa phòng khỏi danh mục" })
    } catch (error) {
      toast({
        title: "Không thể xóa phòng",
        description: error instanceof Error ? error.message : "Vui lòng thử lại.",
        variant: "destructive",
      })
    }
  }

  const createFromDraw = async (tool: FloorPlanTool, geometry: Geometry) => {
    if (!currentFloor) return
    if (tool.elementType === "ROOM") {
      const room = tool.roomId ? roomById.get(tool.roomId) : null
      if (!room) {
        setActiveTool(null)
        setRoomDialogOpen(true)
        toast({
          title: "Chưa chọn phòng",
          description: "Chọn hoặc tạo phòng trước, rồi kéo trên lưới để đặt phòng.",
          variant: "destructive",
        })
        return
      }
      const newElement: FacilityFloorElement = {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        floorId: currentFloor.id,
        roomId: room.id,
        elementType: "ROOM",
        label: room.name,
        ...geometry,
        zIndex: 0,
        doorSide: "SOUTH",
        notes: null,
        version: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setElements((current) => [...current, newElement])
      setSelectedElement(newElement)
      setActiveTool(null)
      return
    }

    const defaultLabel = defaultElementLabel(tool.elementType, tool.customLabel)
    const newElement: FacilityFloorElement = {
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      floorId: currentFloor.id,
      roomId: null,
      elementType: tool.elementType,
      label: defaultLabel,
      ...geometry,
      zIndex: 0,
      doorSide: null,
      notes: null,
      version: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setElements((current) => [...current, newElement])
    setSelectedElement(newElement)
    setActiveTool(null)
  }

  const updateElement = async (
    element: FacilityFloorElement,
    update: Pick<FacilityFloorElement, "label" | "gridX" | "gridY" | "gridWidth" | "gridHeight" | "zIndex" | "doorSide" | "notes">
  ) => {
    setElements((current) =>
      current.map((item) => (item.id === element.id ? { ...item, ...update } : item))
    )
    setSelectedElement((current) => (current?.id === element.id ? { ...current, ...update } : current))
  }

  const removeElement = async (element: FacilityFloorElement) => {
    if (element.id.startsWith("draft-")) {
      setElements((current) => current.filter((item) => item.id !== element.id))
    } else {
      setStagedDeletedIds((current) => new Set([...current, element.id]))
      setElements((current) => current.filter((item) => item.id !== element.id))
    }
    setSelectedElement(null)
  }

  // Quick Door Side change directly from Inspector (in-memory draft)
  const setQuickDoorSide = async (element: FacilityFloorElement, doorSide: DoorSide | null) => {
    await updateElement(element, {
      label: element.label,
      gridX: element.gridX,
      gridY: element.gridY,
      gridWidth: element.gridWidth,
      gridHeight: element.gridHeight,
      zIndex: element.zIndex,
      doorSide,
      notes: element.notes ?? null,
    })
  }

  // Quick Corner Style change directly from Inspector (in-memory draft)
  const setQuickCorners = async (element: FacilityFloorElement, newCorners: CornerConfig) => {
    setInspectorCorners(newCorners)
    const formattedNotes = formatNotesWithCorners(inspectorNotes.trim(), newCorners)
    await updateElement(element, {
      label: element.label,
      gridX: element.gridX,
      gridY: element.gridY,
      gridWidth: element.gridWidth,
      gridHeight: element.gridHeight,
      zIndex: element.zIndex,
      doorSide: element.doorSide ?? null,
      notes: formattedNotes,
    })
  }

  // Save quick inspector edits (label & notes) (in-memory draft)
  const saveInspectorChanges = async () => {
    if (!selectedElement) return
    const trimmedLabel = inspectorLabel.trim() || selectedElement.label
    const formattedNotes = formatNotesWithCorners(inspectorNotes.trim(), inspectorCorners)
    if (trimmedLabel !== selectedElement.label || formattedNotes !== (selectedElement.notes ?? null)) {
      await updateElement(selectedElement, {
        label: trimmedLabel,
        gridX: selectedElement.gridX,
        gridY: selectedElement.gridY,
        gridWidth: selectedElement.gridWidth,
        gridHeight: selectedElement.gridHeight,
        zIndex: selectedElement.zIndex,
        doorSide: selectedElement.doorSide ?? null,
        notes: formattedNotes,
      })
    }
  }

  // Rotate an element by 90 degrees (CW or CCW) with center-preserving pivot and collision avoidance
  const rotateElement = (element: FacilityFloorElement, direction: "CW" | "CCW" = "CW") => {
    if (!currentFloor) return

    // Ensure we use the latest state of the element
    const current = elements.find((e) => e.id === element.id) ?? element
    const { notes: cleanNotes, corners, rotation } = parseNotesAndCorners(current.notes)

    // 1. Swap width and height
    const newWidth = current.gridHeight
    const newHeight = current.gridWidth

    // 2. Center-preserving pivot with floor clamping
    const cx = current.gridX + current.gridWidth / 2
    const cy = current.gridY + current.gridHeight / 2
    const targetX = Math.max(0, Math.min(currentFloor.gridColumns - newWidth, Math.round(cx - newWidth / 2)))
    const targetY = Math.max(0, Math.min(currentFloor.gridRows - newHeight, Math.round(cy - newHeight / 2)))

    // 3. Collision avoidance: check if candidate position intersects other elements
    const intersects = (candidate: { gridX: number; gridY: number; gridWidth: number; gridHeight: number }, other: FacilityFloorElement) => {
      if (other.id === current.id) return false
      return (
        candidate.gridX < other.gridX + other.gridWidth &&
        candidate.gridX + candidate.gridWidth > other.gridX &&
        candidate.gridY < other.gridY + other.gridHeight &&
        candidate.gridY + candidate.gridHeight > other.gridY
      )
    }

    // Try candidate offsets [dx, dy] around target
    const offsets: [number, number][] = [
      [0, 0],
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [1, -1], [-1, 1], [1, 1],
      [-2, 0], [2, 0], [0, -2], [0, 2],
      [-2, -1], [2, -1], [-2, 1], [2, 1],
      [-1, -2], [1, -2], [-1, 2], [1, 2],
      [-3, 0], [3, 0], [0, -3], [0, 3],
    ]

    let resolvedX: number | null = null
    let resolvedY: number | null = null

    for (const [dx, dy] of offsets) {
      const cxTest = targetX + dx
      const cyTest = targetY + dy
      if (
        cxTest >= 0 &&
        cyTest >= 0 &&
        cxTest + newWidth <= currentFloor.gridColumns &&
        cyTest + newHeight <= currentFloor.gridRows
      ) {
        const candidate = { gridX: cxTest, gridY: cyTest, gridWidth: newWidth, gridHeight: newHeight }
        if (!elements.some((other) => intersects(candidate, other))) {
          resolvedX = cxTest
          resolvedY = cyTest
          break
        }
      }
    }

    if (resolvedX === null || resolvedY === null) {
      toast({
        title: "Không thể xoay phần tử",
        description: "Vị trí sau khi xoay bị chồng lấn với phần tử khác. Hãy kéo phần tử ra chỗ trống hơn để xoay.",
        variant: "destructive",
      })
      return
    }

    // 4. Rotate door orientation
    let newDoorSide: DoorSide | null = current.doorSide ?? null
    if (newDoorSide) {
      newDoorSide = direction === "CW" ? ROTATE_DOOR_CW[newDoorSide] : ROTATE_DOOR_CCW[newDoorSide]
    }

    // 5. Rotate corners
    const newCorners = direction === "CW" ? rotateCornersCW(corners) : rotateCornersCCW(corners)

    // 6. Rotate angle metadata (0 -> 90 -> 180 -> 270 -> 0)
    const newRotation: RotationAngle =
      direction === "CW"
        ? ((rotation + 90) % 360 as RotationAngle)
        : ((rotation + 270) % 360 as RotationAngle)

    const newNotes = formatNotesWithCorners(cleanNotes, newCorners, newRotation)

    // Update inspector local inputs if this is the selected element
    if (selectedElement?.id === current.id) {
      setInspectorCorners(newCorners)
    }

    // Apply to in-memory draft elements
    updateElement(current, {
      label: current.label,
      gridX: resolvedX,
      gridY: resolvedY,
      gridWidth: newWidth,
      gridHeight: newHeight,
      zIndex: current.zIndex,
      doorSide: newDoorSide,
      notes: newNotes,
    })

    toast({
      title: `Đã xoay 90° (${newRotation}°)`,
      description: `Kích thước: ${newWidth}×${newHeight}${newDoorSide ? ` · Cửa: ${DOOR_SIDE_LABELS[newDoorSide]}` : ""}`,
    })
  }

  // Copy element to in-memory clipboard
  const copyElement = useCallback((element: FacilityFloorElement) => {
    setClipboard({
      roomId: null, // duplicate does not conflict with unique physical room assignment
      elementType: element.elementType,
      label: element.label,
      gridX: element.gridX,
      gridY: element.gridY,
      gridWidth: element.gridWidth,
      gridHeight: element.gridHeight,
      zIndex: element.zIndex,
      doorSide: element.doorSide ?? null,
      notes: element.notes ?? null,
    })
    toast({
      title: "Đã sao chép vào bộ nhớ tạm",
      description: `"${element.label}" (${element.gridWidth}×${element.gridHeight}) - Nhấn phím Ctrl+V để đặt lên mặt bằng.`,
    })
  }, [toast])

  // Paste element from clipboard onto the floor
  const pasteElement = useCallback(() => {
    if (!clipboard || !currentFloor) {
      toast({
        title: "Bộ nhớ tạm trống",
        description: "Chọn một phần tử trên sơ đồ và nhấn Ctrl+C hoặc nút Sao chép trước.",
        variant: "destructive",
      })
      return
    }

    // Candidate location: offset by +2, +2 from previous
    let targetX = Math.min(clipboard.gridX + 2, Math.max(0, currentFloor.gridColumns - clipboard.gridWidth))
    let targetY = Math.min(clipboard.gridY + 2, Math.max(0, currentFloor.gridRows - clipboard.gridHeight))

    const collides = (x: number, y: number) => {
      const candidate: Geometry = { gridX: x, gridY: y, gridWidth: clipboard.gridWidth, gridHeight: clipboard.gridHeight }
      return elements.some((other) => intersects(candidate, other))
    }

    if (collides(targetX, targetY)) {
      let found = false
      for (let dy = 0; dy <= currentFloor.gridRows - clipboard.gridHeight; dy += 1) {
        for (let dx = 0; dx <= currentFloor.gridColumns - clipboard.gridWidth; dx += 1) {
          if (!collides(dx, dy)) {
            targetX = dx
            targetY = dy
            found = true
            break
          }
        }
        if (found) break
      }
    }

    const newId = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const finalX = Math.max(0, Math.min(currentFloor.gridColumns - clipboard.gridWidth, targetX))
    const finalY = Math.max(0, Math.min(currentFloor.gridRows - clipboard.gridHeight, targetY))
    const newElement: FacilityFloorElement = {
      id: newId,
      floorId: currentFloor.id,
      roomId: null,
      elementType: clipboard.elementType,
      label: `${clipboard.label} (Bản sao)`,
      gridX: finalX,
      gridY: finalY,
      gridWidth: clipboard.gridWidth,
      gridHeight: clipboard.gridHeight,
      zIndex: clipboard.zIndex,
      doorSide: clipboard.doorSide,
      notes: clipboard.notes,
      version: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setElements((current) => [...current, newElement])
    setSelectedElement(newElement)
    setLeftTab("properties")

    // Update clipboard anchor for sequential pastes
    setClipboard((prev) =>
      prev
        ? {
            ...prev,
            gridX: Math.min(finalX + 2, Math.max(0, currentFloor.gridColumns - clipboard.gridWidth)),
            gridY: Math.min(finalY + 2, Math.max(0, currentFloor.gridRows - clipboard.gridHeight)),
          }
        : null
    )

    toast({
      title: "Đã dán phần tử thành công",
      description: `"${newElement.label}" (${newElement.gridWidth}×${newElement.gridHeight}) tại vị trí X=${finalX}, Y=${finalY}.`,
    })
  }, [clipboard, currentFloor, elements, toast])

  // Direct Duplicate (Copy + Immediate Paste)
  const duplicateElement = useCallback((element: FacilityFloorElement) => {
    if (!currentFloor) return
    const targetWidth = element.gridWidth
    const targetHeight = element.gridHeight

    // Candidate location: try adjacent right, then down
    let targetX = element.gridX + targetWidth + 1
    let targetY = element.gridY
    if (targetX + targetWidth > currentFloor.gridColumns) {
      targetX = element.gridX
      targetY = element.gridY + targetHeight + 1
    }

    const collides = (x: number, y: number) => {
      const candidate: Geometry = { gridX: x, gridY: y, gridWidth: targetWidth, gridHeight: targetHeight }
      return elements.some((other) => intersects(candidate, other))
    }

    if (
      targetX + targetWidth > currentFloor.gridColumns ||
      targetY + targetHeight > currentFloor.gridRows ||
      collides(targetX, targetY)
    ) {
      let found = false
      for (let dy = 0; dy <= currentFloor.gridRows - targetHeight; dy += 1) {
        for (let dx = 0; dx <= currentFloor.gridColumns - targetWidth; dx += 1) {
          if (!collides(dx, dy)) {
            targetX = dx
            targetY = dy
            found = true
            break
          }
        }
        if (found) break
      }
    }

    const newId = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const finalX = Math.max(0, Math.min(currentFloor.gridColumns - targetWidth, targetX))
    const finalY = Math.max(0, Math.min(currentFloor.gridRows - targetHeight, targetY))
    const newElement: FacilityFloorElement = {
      id: newId,
      floorId: currentFloor.id,
      roomId: null,
      elementType: element.elementType,
      label: `${element.label} (Bản sao)`,
      gridX: finalX,
      gridY: finalY,
      gridWidth: targetWidth,
      gridHeight: targetHeight,
      zIndex: element.zIndex,
      doorSide: element.doorSide ?? null,
      notes: element.notes ?? null,
      version: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setElements((current) => [...current, newElement])
    setSelectedElement(newElement)
    setLeftTab("properties")

    toast({
      title: "Đã nhân bản phần tử",
      description: `"${newElement.label}" (${newElement.gridWidth}×${newElement.gridHeight}) tại vị trí X=${finalX}, Y=${finalY}.`,
    })
  }, [currentFloor, elements, toast])

  // Global Keyboard Shortcuts for Rotate, Copy, Paste, Duplicate
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return
      }

      const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0
      const isCmdOrCtrl = isMac ? event.metaKey : event.ctrlKey

      if (isCmdOrCtrl) {
        if ((event.key === "c" || event.key === "C") && selectedElement) {
          event.preventDefault()
          copyElement(selectedElement)
        } else if ((event.key === "v" || event.key === "V") && clipboard) {
          event.preventDefault()
          pasteElement()
        } else if ((event.key === "d" || event.key === "D") && selectedElement) {
          event.preventDefault()
          duplicateElement(selectedElement)
        }
      } else if (designMode && selectedElement && !activeTool) {
        if (event.key === "r" || event.key === "R") {
          event.preventDefault()
          rotateElement(selectedElement, event.shiftKey ? "CCW" : "CW")
        } else if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault()
          void removeElement(selectedElement)
        } else if (event.key === "Escape") {
          event.preventDefault()
          setSelectedElement(null)
          setActiveTool(null)
        }
      } else if (event.key === "Escape") {
        setSelectedElement(null)
        setActiveTool(null)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedElement, clipboard, copyElement, pasteElement, duplicateElement, designMode, activeTool, rotateElement])

  // Batch Save all changes to the database
  const saveAllDesignChanges = async () => {
    if (!currentFloor || !isDirty) return
    setIsSavingDesign(true)
    try {
      // 1. Delete removed elements
      for (const id of stagedDeletedIds) {
        const orig = serverElements.find((e) => e.id === id)
        const etag = elementEtags[id] ?? `"${orig?.version ?? 0}"`
        try {
          await facilityLayoutApi.deleteElement(id, etag)
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            // Already removed on server, consider successfully deleted
            continue
          }
          throw error
        }
      }

      // 2. Update modified existing elements
      for (const el of dirtyChanges.updated) {
        const etag = elementEtags[el.id] ?? `"${el.version}"`
        try {
          await facilityLayoutApi.updateElement(el.id, elementPayload(el), etag)
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            // Element no longer exists on server, skip
            continue
          }
          throw error
        }
      }

      // 3. Create newly drawn elements
      for (const el of dirtyChanges.created) {
        await facilityLayoutApi.createElement(currentFloor.id, elementPayload(el))
      }

      // 4. Reload authoritative snapshot from server
      await loadElements(currentFloor.id)
      setSelectedElement(null)

      toast({
        title: "Đã lưu thiết kế mặt bằng",
        description: `Đã lưu thành công ${dirtyChanges.total} thay đổi vào cơ sở dữ liệu.`,
      })
    } catch (error) {
      if (!(await reloadAfterConflict(error))) {
        toast({
          title: "Không thể lưu thiết kế",
          description: error instanceof Error ? error.message : "Có lỗi xảy ra khi lưu mặt bằng.",
          variant: "destructive",
        })
      }
    } finally {
      setIsSavingDesign(false)
    }
  }

  // Discard in-memory edits and revert back to server snapshot
  const discardDesignChanges = () => {
    setElements([...serverElements])
    setStagedDeletedIds(new Set())
    setSelectedElement(null)
    setActiveTool(null)
    toast({
      title: "Đã hủy các thay đổi",
      description: "Mặt bằng đã được khôi phục về trạng thái lưu gần nhất.",
    })
  }

  // Safely toggle design mode
  const handleToggleDesignMode = () => {
    if (designMode && isDirty) {
      setUnsavedWarning({ action: "exit_design" })
      return
    }
    setDesignMode((value) => {
      if (value) setActiveTool(null)
      return !value
    })
  }

  // Safely switch floors with dirty guard
  const handleSelectFloor = (floorId: string) => {
    if (floorId === selectedFloorId) return
    if (isDirty) {
      setUnsavedWarning({ action: "switch_floor", targetFloorId: floorId })
      return
    }
    setSelectedFloorId(floorId)
    setSelectedElement(null)
    setActiveTool(null)
  }

  const handleConfirmDiscardWarning = () => {
    if (!unsavedWarning) return
    discardDesignChanges()
    if (unsavedWarning.action === "switch_floor" && unsavedWarning.targetFloorId) {
      setSelectedFloorId(unsavedWarning.targetFloorId)
    } else if (unsavedWarning.action === "exit_design") {
      setDesignMode(false)
      setActiveTool(null)
    }
    setUnsavedWarning(null)
  }

  const handleConfirmSaveWarning = async () => {
    if (!unsavedWarning) return
    await saveAllDesignChanges()
    if (unsavedWarning.action === "switch_floor" && unsavedWarning.targetFloorId) {
      setSelectedFloorId(unsavedWarning.targetFloorId)
    } else if (unsavedWarning.action === "exit_design") {
      setDesignMode(false)
      setActiveTool(null)
    }
    setUnsavedWarning(null)
  }

  // Tool selection helper that activates design mode
  const selectTool = (tool: FloorPlanTool) => {
    setDesignMode(true)
    setActiveTool((curr) => {
      if (!curr) return tool
      if (curr.elementType === tool.elementType && curr.roomId === tool.roomId && curr.customLabel === tool.customLabel) {
        return null
      }
      return tool
    })
  }

  const filteredElements = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return elements
    return elements.filter((element) => {
      const room = element.roomId ? roomById.get(element.roomId) : undefined
      return `${element.label} ${room?.code ?? ""} ${room?.name ?? ""}`.toLowerCase().includes(query)
    })
  }, [elements, roomById, search])

  const selectedRoom = selectedElement?.roomId ? roomById.get(selectedElement.roomId) ?? null : null
  const unplacedRooms = useMemo(
    () => rooms.filter((room) => room.active && !placedRoomIds.has(room.id)),
    [rooms, placedRoomIds]
  )

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: View Mode Switcher */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border bg-muted p-1">
              <Button size="sm" variant={viewMode === "floorplan" ? "default" : "ghost"} onClick={() => setViewMode("floorplan")}>
                <LayoutGrid className="mr-1 h-3.5 w-3.5" />
                Sơ đồ
              </Button>
              <Button size="sm" variant={viewMode === "list" ? "default" : "ghost"} onClick={() => setViewMode("list")}>
                <List className="mr-1 h-3.5 w-3.5" />
                Danh sách
              </Button>
            </div>
          </div>

          {/* Right: Design Mode Controls & Save/Discard (Moved to right, styled with primary theme) */}
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {designMode && isDirty && (
              <div className="flex flex-wrap items-center gap-1.5 animate-in fade-in duration-200">
                <Badge
                  variant="outline"
                  className="h-8 gap-1.5 border-amber-400 bg-amber-50 px-2.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  {dirtyChanges.total} thay đổi chưa lưu
                </Badge>
                <Button
                  size="sm"
                  className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                  onClick={() => void saveAllDesignChanges()}
                  disabled={isSavingDesign}
                >
                  {isSavingDesign ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Lưu thiết kế
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950/30"
                  onClick={discardDesignChanges}
                  disabled={isSavingDesign}
                  title="Hủy các thay đổi và khôi phục sơ đồ gốc"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Hủy thay đổi
                </Button>
              </div>
            )}

            {designMode && !isDirty && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground px-1">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-medium text-emerald-700 dark:text-emerald-400">Đã lưu tất cả</span>
              </div>
            )}

            {/* Design Mode Toggle Button - styled in tune with page primary theme */}
            <Button
              size="sm"
              variant={designMode ? "default" : "outline"}
              onClick={handleToggleDesignMode}
              className={
                designMode
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs"
                  : "border-primary/40 text-primary hover:bg-primary/10 hover:text-primary font-semibold shadow-2xs"
              }
            >
              <PencilRuler className="mr-1.5 h-3.5 w-3.5" />
              {designMode ? "Chế độ Thiết kế (Bật)" : "Bật Chế độ Thiết kế"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Split Layout: Left Toolbar vs Right Canvas */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT TOOLBAR PANEL */}
        <aside className="w-full shrink-0 lg:w-96 xl:w-[400px] space-y-3">
          {/* 1. BẢNG MẶT BẰNG CÁC TẦNG */}
          <Card className="overflow-hidden shadow-2xs">
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Building className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Mặt bằng tầng
                </span>
                <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px] font-mono font-semibold">
                  {floors.length}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-6.5 px-2 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 border-primary/30"
                onClick={() => {
                  setEditingFloor(null)
                  setFloorDialogOpen(true)
                }}
                title="Thêm tầng mới"
              >
                <Plus className="mr-1 h-3 w-3" />
                Tầng mới
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b bg-muted/20 text-[11px] font-semibold text-muted-foreground">
                    <TableHead className="h-7 px-3 py-1 font-semibold">Tầng</TableHead>
                    <TableHead className="h-7 px-2 py-1 text-center font-semibold">Lưới</TableHead>
                    <TableHead className="h-7 px-2 py-1 text-center font-semibold">Trạng thái</TableHead>
                    <TableHead className="h-7 px-2 py-1 text-right font-semibold">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {floors.map((floor) => {
                    const isSelected = floor.id === selectedFloorId
                    return (
                      <TableRow
                        key={floor.id}
                        onClick={() => handleSelectFloor(floor.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/10 font-medium hover:bg-primary/15"
                            : "hover:bg-muted/60 text-muted-foreground"
                        }`}
                      >
                        <TableCell className="px-3 py-2 font-medium">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                isSelected ? "bg-primary ring-2 ring-primary/30" : "bg-muted-foreground/30"
                              }`}
                            />
                            <span className={`truncate ${isSelected ? "font-bold text-foreground" : "text-foreground/90"}`}>
                              {floor.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2 text-center font-mono text-[11px] tabular-nums text-muted-foreground">
                          {floor.gridColumns}×{floor.gridRows}
                        </TableCell>
                        <TableCell className="px-2 py-2 text-center">
                          {isSelected ? (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4.5 bg-primary text-primary-foreground font-semibold">
                              Đang xem
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground hover:text-foreground">
                              Chọn
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-2 text-right">
                          <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              title={`Cấu hình ${floor.name}`}
                              onClick={() => {
                                setEditingFloor(floor)
                                setFloorDialogOpen(true)
                              }}
                            >
                              <Settings2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              title={`Xóa ${floor.name}`}
                              onClick={() => setFloorToDelete(floor)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* 2. CÔNG CỤ VẼ & THUỘC TÍNH */}
          <Card className="p-3 space-y-3 shadow-2xs">
            {/* Smart 3-Tab Selector: [Công cụ] | [Chưa đặt (X)] | [Thuộc tính] */}
            <div className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/60 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setLeftTab("tools")}
                className={`flex items-center justify-center gap-1 rounded py-1 font-semibold transition-all ${
                  leftTab === "tools" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                Công cụ
              </button>
              <button
                type="button"
                onClick={() => setLeftTab("unplaced")}
                className={`flex items-center justify-center gap-1 rounded py-1 font-semibold transition-all ${
                  leftTab === "unplaced" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                Chưa đặt ({unplacedRooms.length})
              </button>
              <button
                type="button"
                disabled={!selectedElement}
                onClick={() => setLeftTab("properties")}
                className={`flex items-center justify-center gap-1 rounded py-1 font-semibold transition-all ${
                  leftTab === "properties"
                    ? "bg-background shadow-xs text-foreground font-bold"
                    : selectedElement
                    ? "text-primary hover:text-foreground font-bold"
                    : "opacity-40 cursor-not-allowed text-muted-foreground"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Thuộc tính
                {selectedElement && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </button>
            </div>

            {/* TAB 1: CAD DRAWING TOOLS */}
            {leftTab === "tools" && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                {/* 1. Không gian & Phòng */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span>1. Không gian & Phòng</span>
                    <span className="text-[10px] text-muted-foreground">Kéo trên lưới</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* ROOM */}
                    <Button
                      size="sm"
                      variant={activeTool?.elementType === "ROOM" && !activeTool.roomId ? "default" : "outline"}
                      className="h-8 justify-start text-xs font-medium"
                      onClick={() => selectTool({ elementType: "ROOM" })}
                    >
                      <Building2 className="mr-1.5 h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">Phòng</span>
                    </Button>
                    {/* WAITING_AREA */}
                    <Button
                      size="sm"
                      variant={activeTool?.elementType === "WAITING_AREA" ? "default" : "outline"}
                      className="h-8 justify-start text-xs font-medium"
                      onClick={() => selectTool({ elementType: "WAITING_AREA", customLabel: "SẢNH CHỜ" })}
                    >
                      <Armchair className="mr-1.5 h-3.5 w-3.5 text-teal-600 shrink-0" />
                      <span className="truncate">Sảnh chờ</span>
                    </Button>
                    {/* WALKWAY */}
                    <Button
                      size="sm"
                      variant={activeTool?.elementType === "WALKWAY" ? "default" : "outline"}
                      className="h-8 justify-start text-xs font-medium"
                      onClick={() => selectTool({ elementType: "WALKWAY", customLabel: "HÀNH LANG" })}
                    >
                      <DoorOpen className="mr-1.5 h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">Hành lang</span>
                    </Button>
                    {/* RECEPTION */}
                    <Button
                      size="sm"
                      variant={activeTool?.elementType === "RECEPTION" ? "default" : "outline"}
                      className="h-8 justify-start text-xs font-medium"
                      onClick={() => selectTool({ elementType: "RECEPTION", customLabel: "TIẾP ĐÓN" })}
                    >
                      <Armchair className="mr-1.5 h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      <span className="truncate">Tiếp đón</span>
                    </Button>
                    {/* EQUIPMENT */}
                    <Button
                      size="sm"
                      variant={activeTool?.elementType === "EQUIPMENT" ? "default" : "outline"}
                      className="h-8 justify-start text-xs font-medium"
                      onClick={() => selectTool({ elementType: "EQUIPMENT", customLabel: "KHO / THIẾT BỊ" })}
                    >
                      <Wrench className="mr-1.5 h-3.5 w-3.5 text-cyan-600 shrink-0" />
                      <span className="truncate">Kho / Thiết bị</span>
                    </Button>
                    {/* EMERGENCY_EXIT */}
                    <Button
                      size="sm"
                      variant={activeTool?.elementType === "EMERGENCY_EXIT" ? "default" : "outline"}
                      className="h-8 justify-start text-xs font-medium"
                      onClick={() => selectTool({ elementType: "EMERGENCY_EXIT", customLabel: "THOÁT HIỂM" })}
                    >
                      <ShieldAlert className="mr-1.5 h-3.5 w-3.5 text-rose-600 shrink-0" />
                      <span className="truncate">Thoát hiểm</span>
                    </Button>
                  </div>
                </div>

                {/* 2. Ký hiệu kiến trúc CAD */}
                <div className="border-t pt-2.5">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span>2. Ký hiệu kiến trúc CAD</span>
                    <span className="text-[10px] text-muted-foreground">Kéo trên lưới</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* ELEVATOR */}
                    <Button
                      size="sm"
                      variant={activeTool?.elementType === "ELEVATOR" ? "default" : "outline"}
                      className="h-8 justify-start text-xs font-medium"
                      onClick={() => selectTool({ elementType: "ELEVATOR", customLabel: "THANG MÁY" })}
                    >
                      <ChevronUp className="mr-1.5 h-3.5 w-3.5 text-violet-600 shrink-0" />
                      <span className="truncate">Thang máy</span>
                    </Button>
                    {/* STAIRS */}
                    <Button
                      size="sm"
                      variant={activeTool?.elementType === "STAIRS" ? "default" : "outline"}
                      className="h-8 justify-start text-xs font-medium"
                      onClick={() => selectTool({ elementType: "STAIRS", customLabel: "THANG BỘ" })}
                    >
                      <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5 text-slate-600 shrink-0" />
                      <span className="truncate">Thang bộ</span>
                    </Button>
                    {/* WC */}
                    <Button
                      size="sm"
                      variant={activeTool?.elementType === "WC" ? "default" : "outline"}
                      className="h-8 justify-start text-xs font-medium"
                      onClick={() => selectTool({ elementType: "WC", customLabel: "WC" })}
                    >
                      <Accessibility className="mr-1.5 h-3.5 w-3.5 text-sky-600 shrink-0" />
                      <span className="truncate">Khu vệ sinh</span>
                    </Button>
                    {/* SKYWELL */}
                    <Button
                      size="sm"
                      variant={activeTool?.elementType === "OTHER" ? "default" : "outline"}
                      className="h-8 justify-start text-xs font-medium"
                      onClick={() => selectTool({ elementType: "OTHER", customLabel: "GIẾNG TRỜI" })}
                    >
                      <Sun className="mr-1.5 h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">Giếng trời</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: UNPLACED CATALOG ROOMS */}
            {leftTab === "unplaced" && (
              <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">Phòng từ danh mục:</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      setEditingRoom(null)
                      setRoomDialogOpen(true)
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Tạo phòng
                  </Button>
                </div>

                <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                  {unplacedRooms.map((room) => (
                    <div
                      key={room.id}
                      className={`flex items-center justify-between gap-1 rounded-lg border p-2 text-xs transition-colors ${
                        activeTool?.roomId === room.id ? "border-primary bg-primary/10 font-bold" : "hover:bg-muted"
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-1">
                        <span className="font-bold text-foreground">{room.code}</span>
                        <span className="mx-1 text-muted-foreground">—</span>
                        <span className="truncate text-muted-foreground">{room.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title="Chỉnh sửa phòng"
                          onClick={() => {
                            setEditingRoom(room)
                            setRoomDialogOpen(true)
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                          title="Xóa phòng"
                          onClick={() => setRoomToDelete(room)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant={activeTool?.roomId === room.id ? "default" : "outline"}
                          className="h-6 px-2 text-[11px]"
                          disabled={!currentFloor}
                          onClick={() => {
                            if (activeTool?.roomId === room.id) {
                              setActiveTool(null)
                            } else {
                              selectTool({
                                elementType: "ROOM",
                                roomId: room.id,
                                customLabel: `${room.code} - ${room.name}`,
                              })
                            }
                          }}
                        >
                          {activeTool?.roomId === room.id ? "Đang chọn" : "Đặt lên lưới"}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {unplacedRooms.length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Tất cả các phòng trong danh mục đã được đặt vào mặt bằng.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: PROPERTIES INSPECTOR */}
            {leftTab === "properties" && selectedElement && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Badge variant="default" className="text-[10px] shrink-0">
                      {ELEMENT_LABELS[selectedElement.elementType]}
                    </Badge>
                    <span className="truncate text-xs font-bold text-foreground">
                      {selectedRoom?.name ?? selectedElement.label}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    title="Đóng thuộc tính"
                    onClick={() => {
                      setSelectedElement(null)
                      setLeftTab("tools")
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Editable Name / Label */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                    Tên hiển thị / Mã phòng:
                  </label>
                  <Input
                    className="h-7 text-xs bg-background"
                    value={inspectorLabel}
                    onChange={(e) => setInspectorLabel(e.target.value)}
                    onBlur={() => void saveInspectorChanges()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveInspectorChanges()
                    }}
                    placeholder="vd: P. 214, Kho vật tư..."
                  />
                </div>

                {/* Editable Notes */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                    Ghi chú riêng của phòng:
                  </label>
                  <Input
                    className="h-7 text-xs bg-background"
                    value={inspectorNotes}
                    onChange={(e) => setInspectorNotes(e.target.value)}
                    onBlur={() => void saveInspectorChanges()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveInspectorChanges()
                    }}
                    placeholder="Nhập ghi chú tùy ý..."
                  />
                </div>

                {/* Door Side Setting for 90° CAD Swing Door */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                    Hướng mở cửa 90° (Bản vẽ CAD):
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {(["NORTH", "SOUTH", "EAST", "WEST"] as DoorSide[]).map((side) => (
                      <Button
                        key={side}
                        size="sm"
                        variant={selectedElement.doorSide === side ? "default" : "outline"}
                        className="h-7 px-1 text-[10px] font-bold"
                        onClick={() => void setQuickDoorSide(selectedElement, side)}
                      >
                        {side === "NORTH" ? "Bắc ↑" : side === "SOUTH" ? "Nam ↓" : side === "EAST" ? "Đông →" : "Tây ←"}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant={!selectedElement.doorSide ? "secondary" : "outline"}
                      className="h-7 px-1 text-[10px]"
                      onClick={() => void setQuickDoorSide(selectedElement, null)}
                      title="Không có cửa"
                    >
                      ✕ Bỏ
                    </Button>
                  </div>
                </div>

                {/* Corner Styles Setting (Bo tròn / Vát 45°) */}
                <div className="border-t pt-2">
                  <CornerStyleControls
                    corners={inspectorCorners}
                    onChange={(newCorners) => void setQuickCorners(selectedElement, newCorners)}
                  />
                </div>

                {/* Rotation Controls */}
                <div className="border-t pt-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Xoay hướng phần tử:
                    </label>
                    <span className="text-[10px] font-bold text-primary">
                      {parseNotesAndCorners(selectedElement.notes).rotation}°
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs font-medium"
                      onClick={() => rotateElement(selectedElement, "CW")}
                      title="Xoay 90° theo chiều kim đồng hồ (Phím tắt: R)"
                    >
                      <RotateCw className="mr-1 h-3 w-3 text-primary" />
                      Quay 90° thuận
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs font-medium"
                      onClick={() => rotateElement(selectedElement, "CCW")}
                      title="Xoay 90° ngược chiều kim đồng hồ (Phím tắt: Shift+R)"
                    >
                      <RotateCcw className="mr-1 h-3 w-3 text-muted-foreground" />
                      Quay 90° ngược
                    </Button>
                  </div>
                </div>

                {/* Duplicate & Copy Buttons */}
                <div className="space-y-1.5 border-t pt-2">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Sao chép & Nhân bản
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs font-medium"
                      onClick={() => duplicateElement(selectedElement)}
                      title="Nhân bản ngay cùng kích thước (Phím tắt: Ctrl+D)"
                    >
                      <CopyPlus className="mr-1 h-3 w-3 text-emerald-600" />
                      Nhân bản (Ctrl+D)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs font-medium"
                      onClick={() => copyElement(selectedElement)}
                      title="Sao chép vào bộ nhớ tạm (Phím tắt: Ctrl+C)"
                    >
                      <Copy className="mr-1 h-3 w-3 text-muted-foreground" />
                      Sao chép (Ctrl+C)
                    </Button>
                  </div>
                </div>

                {/* Coordinates and Dimensions */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2">
                  <span>Vị trí: X={selectedElement.gridX}, Y={selectedElement.gridY}</span>
                  <span>Kích thước: {selectedElement.gridWidth} × {selectedElement.gridHeight}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setDetailOpen(true)}
                  >
                    <Settings2 className="mr-1 h-3 w-3" />
                    Chi tiết & Khoa
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                    onClick={() => void removeElement(selectedElement)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Gỡ khỏi sơ đồ
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </aside>

        {/* RIGHT MAIN CANVAS AREA */}
        <main className="min-w-0 flex-1">
          <Card className="p-3 sm:p-4">
            {loading ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Đang tải dữ liệu mặt bằng...</p>
            ) : currentFloor ? (
              <>
                {viewMode === "floorplan" ? (
                  <FloorPlanView
                    floor={currentFloor}
                    elements={elements}
                    symbols={symbols}
                    rooms={rooms}
                    isDesignMode={designMode}
                    selectedElementId={selectedElement?.id}
                    activeTool={activeTool}
                    isCreating={creatingElement}
                    displayMode={displayMode}
                    onChangeDisplayMode={setDisplayMode}
                    onSelectElement={(element) => {
                      setSelectedElement(element)
                      setLeftTab("properties")
                    }}
                    onCancelTool={() => setActiveTool(null)}
                    onCreateGeometry={createFromDraw}
                    onPersistGeometry={(element, geometry) =>
                      updateElement(element, {
                        ...geometry,
                        label: element.label,
                        zIndex: element.zIndex,
                        doorSide: element.doorSide ?? null,
                        notes: element.notes ?? null,
                      })
                    }
                    onQuickDoorSideChange={setQuickDoorSide}
                    onRotateElement={rotateElement}
                    onCopyElement={copyElement}
                    onDuplicateElement={duplicateElement}
                    onPasteElement={pasteElement}
                    onRemoveElement={removeElement}
                    onDeselect={() => setSelectedElement(null)}
                    canPaste={Boolean(clipboard)}
                    onEditFloor={() => {
                      setEditingFloor(currentFloor)
                      setFloorDialogOpen(true)
                    }}
                    onDeleteFloor={() => setFloorToDelete(currentFloor)}
                  />
                ) : (
                  <div className="divide-y overflow-hidden rounded-lg border">
                    {filteredElements.map((element) => {
                      const room = element.roomId ? roomById.get(element.roomId) : null
                      return (
                        <button
                          type="button"
                          key={element.id}
                          className="flex w-full items-center justify-between p-3 text-left hover:bg-muted"
                          onClick={() => {
                            setSelectedElement(element)
                            setDetailOpen(true)
                          }}
                        >
                          <div>
                            <div className="text-sm font-medium">{room?.name ?? element.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {element.elementType} · X {element.gridX}, Y {element.gridY} · {element.gridWidth} ×{" "}
                              {element.gridHeight} {element.doorSide ? `· Cửa: ${element.doorSide}` : ""}
                            </div>
                            {element.notes && (
                              <div className="mt-0.5 text-xs text-primary font-medium">{element.notes}</div>
                            )}
                          </div>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      )
                    })}
                    {filteredElements.length === 0 && (
                      <p className="p-10 text-center text-sm text-muted-foreground">Chưa có phần tử phù hợp.</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Chưa có tầng nào. Hãy tạo tầng mới để bắt đầu thiết kế mặt bằng.
              </div>
            )}
          </Card>
        </main>
      </div>

      {/* Dialogs */}
      {currentFloor && (
        <AddRoomToFloorDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          floorName={currentFloor.name}
          rooms={rooms}
          usedRoomIds={placedRoomIds}
          onSelectRoom={(roomId) => {
            setDesignMode(true)
            setActiveTool({ elementType: "ROOM", roomId })
          }}
        />
      )}

      <CreateRoomDialog
        open={roomDialogOpen}
        onOpenChange={(open) => {
          setRoomDialogOpen(open)
          if (!open) setEditingRoom(null)
        }}
        room={editingRoom}
        onCreate={createRoom}
        onUpdate={updateRoomData}
        onCreated={(roomId) => {
          setDesignMode(true)
          setActiveTool({ elementType: "ROOM", roomId })
        }}
      />

      <FloorDialog open={floorDialogOpen} onOpenChange={setFloorDialogOpen} floor={editingFloor} onSave={saveFloor} />

      <RoomSlotDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        element={selectedElement}
        room={selectedRoom}
        departments={departments}
        services={services}
        getAssignments={roomsApi.assignments}
        onUpdateElement={updateElement}
        onUpdateRoom={async (room, data) => {
          const result = await roomsApi.update(room.id, data, room.etag ?? `"${room.version}"`)
          const updated = { ...result.data, etag: result.etag }
          setRooms((current) => current.map((item) => (item.id === room.id ? updated : item)))
          return updated
        }}
        onReplaceAssignments={async (room, departmentIds, serviceIds, etag) => {
          const result = await roomsApi.replaceAssignments(room.id, { departmentIds, serviceIds }, etag)
          const updated = { ...room, version: result.data.version, etag: result.etag }
          setRooms((current) => current.map((item) => (item.id === room.id ? updated : item)))
          return updated
        }}
        onRemoveElement={removeElement}
      />

      {/* Delete Floor Alert */}
      <AlertDialog open={!!floorToDelete} onOpenChange={(open) => !open && setFloorToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa tầng {floorToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Chỉ xóa được tầng không còn phần tử nào trên mặt bằng. Vui lòng gỡ hết các phòng hoặc phần tử trước khi xóa tầng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                if (!floorToDelete) return
                void facilityLayoutApi
                  .deleteFloor(floorToDelete.id, floorEtags[floorToDelete.id] ?? `"${floorToDelete.version}"`)
                  .then(() => {
                    setFloors((current) => current.filter((floor) => floor.id !== floorToDelete.id))
                    setSelectedFloorId("")
                    setFloorToDelete(null)
                    toast({ title: "Đã xóa tầng" })
                  })
                  .catch((error) =>
                    toast({
                      title: "Không thể xóa tầng",
                      description: error instanceof Error ? error.message : "Gỡ hết phần tử trước.",
                      variant: "destructive",
                    })
                  )
              }}
            >
              Xóa tầng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Room Alert */}
      <AlertDialog open={!!roomToDelete} onOpenChange={(open) => !open && setRoomToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa phòng {roomToDelete?.code} — {roomToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ xóa phòng hoàn toàn khỏi danh mục cơ sở y tế. Bạn chỉ có thể xóa phòng khi phòng chưa có lịch trực nào liên kết.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => {
                if (roomToDelete) void deleteRoomData(roomToDelete)
              }}
            >
              Xóa phòng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Changes Confirmation Alert */}
      <AlertDialog open={!!unsavedWarning} onOpenChange={(open) => !open && setUnsavedWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Bạn có {dirtyChanges.total} thay đổi chưa lưu
            </AlertDialogTitle>
            <AlertDialogDescription>
              {unsavedWarning?.action === "switch_floor"
                ? "Bạn đang chuyển sang tầng khác. Nếu tiếp tục mà không lưu, các thay đổi trên mặt bằng tầng hiện tại sẽ bị hủy bỏ."
                : "Bạn đang tắt chế độ thiết kế. Nếu tiếp tục mà không lưu, các thay đổi vừa chỉnh sửa sẽ bị hủy bỏ."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={isSavingDesign}>Tiếp tục chỉnh sửa</AlertDialogCancel>
            <Button
              variant="outline"
              className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900"
              onClick={handleConfirmDiscardWarning}
              disabled={isSavingDesign}
            >
              Hủy thay đổi & Tiếp tục
            </Button>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={(e) => {
                e.preventDefault()
                void handleConfirmSaveWarning()
              }}
              disabled={isSavingDesign}
            >
              {isSavingDesign ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Lưu & Tiếp tục
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
