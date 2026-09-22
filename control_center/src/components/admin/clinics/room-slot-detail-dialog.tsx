"use client"

import React, { useEffect, useState } from "react"
import type { FacilityFloorElement, Room, RoomAssignments } from "@/lib/api"
import { departmentsApi, servicesApi, type Department, type Service } from "@/lib/api"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/base/ui/dialog"
import { Button } from "@/components/base/ui/button"
import { Input } from "@/components/base/ui/input"
import { Label } from "@/components/base/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/base/ui/select"
import { Textarea } from "@/components/base/ui/textarea"
import { RotateCcw, RotateCw, Trash2 } from "lucide-react"
import {
  ELEMENT_LABELS,
  type CornerConfig,
  type DoorSide,
  parseNotesAndCorners,
  formatNotesWithCorners,
  ROTATE_DOOR_CW,
  ROTATE_DOOR_CCW,
  rotateCornersCW,
  rotateCornersCCW,
  type RotationAngle,
} from "./floor-plan-types"
import { CornerStyleControls } from "./corner-style-controls"

interface RoomSlotDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  element: FacilityFloorElement | null
  room?: (Room & { etag?: string | null }) | null
  departments?: Department[]
  services?: Service[]
  existingRooms?: Room[]
  getAssignments: (roomId: string) => Promise<{ data: RoomAssignments; etag: string | null }>
  onUpdateElement: (element: FacilityFloorElement, update: ElementUpdate) => Promise<void>
  onCreateRoom?: (data: { code: string; name: string }) => Promise<Room & { etag?: string | null }>
  onUpdateRoom: (room: Room & { etag?: string | null }, data: { code: string; name: string }) => Promise<Room & { etag?: string | null }>
  onReplaceAssignments: (room: Room & { etag?: string | null }, departmentIds: string[], serviceIds: string[], etag: string) => Promise<Room & { etag?: string | null }>
  onRemoveElement: (element: FacilityFloorElement) => Promise<void>
}

type ElementUpdate = Pick<FacilityFloorElement, "label" | "gridX" | "gridY" | "gridWidth" | "gridHeight" | "zIndex" | "doorSide" | "notes"> & { roomId?: string | null }

export function RoomSlotDetailDialog({
  open,
  onOpenChange,
  element,
  room,
  departments,
  services,
  existingRooms,
  getAssignments,
  onUpdateElement,
  onCreateRoom,
  onUpdateRoom,
  onReplaceAssignments,
  onRemoveElement,
}: RoomSlotDetailDialogProps) {
  const [loadedDepartments, setLoadedDepartments] = useState<Department[]>([])
  const [loadedServices, setLoadedServices] = useState<Service[]>([])

  const activeDepartments = departments && departments.length > 0 ? departments : loadedDepartments
  const activeServices = services && services.length > 0 ? services : loadedServices

  useEffect(() => {
    if (!open) return
    if ((!departments || departments.length === 0) && loadedDepartments.length === 0) {
      void departmentsApi.list().then((page) => setLoadedDepartments(page.items)).catch(() => {})
    }
    if ((!services || services.length === 0) && loadedServices.length === 0) {
      void servicesApi.list().then((page) => setLoadedServices(page.items)).catch(() => {})
    }
  }, [open, departments, services, loadedDepartments.length, loadedServices.length])

  const [label, setLabel] = useState("")
  const [code, setCode] = useState("")
  const [roomName, setRoomName] = useState("")
  const [gridX, setGridX] = useState(0)
  const [gridY, setGridY] = useState(0)
  const [gridWidth, setGridWidth] = useState(1)
  const [gridHeight, setGridHeight] = useState(1)
  const [doorSide, setDoorSide] = useState<string>("NONE")
  const [notes, setNotes] = useState("")
  const [corners, setCorners] = useState<CornerConfig>({})
  const [rotation, setRotation] = useState<RotationAngle>(0)
  const [departmentIds, setDepartmentIds] = useState<string[]>([])
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [assignmentEtag, setAssignmentEtag] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isRoom = element?.elementType === "ROOM"

  useEffect(() => {
    if (!element) return
    const isRoomElement = element.elementType === "ROOM"
    const { notes: cleanNotes, corners: parsedCorners, rotation: parsedRotation, sourceRoomId } = parseNotesAndCorners(element.notes)
    setLabel(element.label)
    setGridX(element.gridX)
    setGridY(element.gridY)
    setGridWidth(element.gridWidth)
    setGridHeight(element.gridHeight)
    setDoorSide(element.doorSide ?? "NONE")
    setNotes(cleanNotes)
    setCorners(parsedCorners)
    setRotation(parsedRotation)

    let initialCode = room?.code ?? ""
    let initialRoomName = room?.name ?? ""
    if (!initialRoomName && isRoomElement) {
      initialRoomName = element.label.replace(/\s*\(Bản sao\)/gi, "").trim() || element.label
    }

    if (!initialCode && isRoomElement) {
      const match = element.label.match(/([A-Za-z]+)(\d+)/)
      if (match) {
        const prefix = match[1].toUpperCase()
        let num = parseInt(match[2], 10)
        const existingCodes = new Set(existingRooms?.map((r) => r.code.toUpperCase()) ?? [])
        let candidate = `${prefix}${num}`
        while (existingCodes.has(candidate)) {
          num += 1
          candidate = `${prefix}${num}`
        }
        initialCode = candidate
        if (initialRoomName.includes(match[0])) {
          initialRoomName = initialRoomName.replace(match[0], candidate)
        }
      } else {
        const simpleMatch = element.label.match(/[A-Za-z0-9]+/)
        if (simpleMatch) initialCode = simpleMatch[0].toUpperCase()
      }
    }

    setCode(initialCode)
    setRoomName(initialRoomName)

    setDepartmentIds([])
    setServiceIds([])
    setAssignmentEtag(null)

    if (room) {
      void getAssignments(room.id).then((result) => {
        setDepartmentIds(result.data.departmentIds)
        setServiceIds(result.data.serviceIds)
        setAssignmentEtag(result.etag ?? `"${result.data.version}"`)
      })
    } else if (isRoomElement && sourceRoomId) {
      void getAssignments(sourceRoomId)
        .then((result) => {
          setDepartmentIds(result.data.departmentIds)
          setServiceIds(result.data.serviceIds)
        })
        .catch(() => {
          // Source room assignments couldn't be loaded, ignore
        })
    }
  }, [element, room, open, getAssignments, existingRooms])

  const toggle = (values: string[], value: string) => values.includes(value) ? values.filter((id) => id !== value) : [...values, value]

  const visibleServices = React.useMemo(() => {
    if (departmentIds.length === 0) return []
    return activeServices.filter((s) => s.active && Boolean(s.departmentId && departmentIds.includes(s.departmentId)))
  }, [activeServices, departmentIds])

  const handleToggleDepartment = (deptId: string) => {
    const nextDeptIds = toggle(departmentIds, deptId)
    setDepartmentIds(nextDeptIds)
    if (!nextDeptIds.includes(deptId)) {
      const allowedServiceIds = new Set(
        activeServices
          .filter((s) => Boolean(s.departmentId && nextDeptIds.includes(s.departmentId)))
          .map((s) => s.id)
      )
      setServiceIds((prev) => prev.filter((id) => allowedServiceIds.has(id)))
    }
  }

  const rotate = (dir: "CW" | "CCW") => {
    setGridWidth(gridHeight)
    setGridHeight(gridWidth)
    if (doorSide && doorSide !== "NONE") {
      const mapped = dir === "CW" ? ROTATE_DOOR_CW[doorSide as DoorSide] : ROTATE_DOOR_CCW[doorSide as DoorSide]
      if (mapped) setDoorSide(mapped)
    }
    setCorners(dir === "CW" ? rotateCornersCW(corners) : rotateCornersCCW(corners))
    setRotation(dir === "CW" ? ((rotation + 90) % 360 as RotationAngle) : ((rotation + 270) % 360 as RotationAngle))
  }

  const save = async () => {
    if (!element) return
    setBusy(true)
    try {
      const { propType } = parseNotesAndCorners(element.notes)
      const formattedNotes = formatNotesWithCorners(notes.trim(), corners, rotation, propType)

      if (isRoom) {
        let currentRoom = room
        let currentAssignmentEtag = assignmentEtag

        // If this room is not yet linked to a catalog room (e.g. copied/duplicated room)
        if (!currentRoom && onCreateRoom) {
          const finalCode = (code.trim() || label.trim()).toUpperCase()
          const finalName = roomName.trim() || label.trim()
          currentRoom = await onCreateRoom({ code: finalCode, name: finalName })
          currentAssignmentEtag = currentRoom.etag ?? `"${currentRoom.version}"`
        } else if (currentRoom && (currentRoom.code !== code.trim() || currentRoom.name !== roomName.trim())) {
          currentRoom = await onUpdateRoom(currentRoom, { code: code.trim().toUpperCase(), name: roomName.trim() })
          currentAssignmentEtag = `"${currentRoom.version}"`
        }

        if (currentRoom && (departmentIds.length > 0 || serviceIds.length > 0 || currentAssignmentEtag)) {
          await onReplaceAssignments(currentRoom, departmentIds, serviceIds, currentAssignmentEtag ?? `"${currentRoom.version}"`)
        }

        await onUpdateElement(element, {
          roomId: currentRoom?.id ?? element.roomId ?? null,
          label: currentRoom?.name ?? (roomName.trim() || label.trim()),
          gridX,
          gridY,
          gridWidth,
          gridHeight,
          zIndex: element.zIndex,
          doorSide: doorSide === "NONE" ? null : (doorSide as FacilityFloorElement["doorSide"]),
          notes: formattedNotes,
        })
      } else {
        await onUpdateElement(element, {
          label: label.trim(),
          gridX,
          gridY,
          gridWidth,
          gridHeight,
          zIndex: element.zIndex,
          doorSide: doorSide === "NONE" ? null : (doorSide as FacilityFloorElement["doorSide"]),
          notes: formattedNotes,
        })
      }

      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  if (!element) return null

  return (
    <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader className="pb-1">
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-base">Chi tiết {ELEMENT_LABELS[element.elementType]}</DialogTitle>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold">
                {ELEMENT_LABELS[element.elementType]}
              </span>
              {isRoom && (
                <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold">
                  {room ? (room.active ? "Đã gán danh mục" : "Tạm ngừng") : "Chờ gán"}
                </span>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs">
            {isRoom
              ? "Chỉnh sửa thông tin phòng khám, chuyên khoa phụ trách và dịch vụ khám."
              : "Chỉnh sửa phần tử kiến trúc trên lưới."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 py-1">
          {isRoom && (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Tên phòng</Label>
                <Input
                  className="h-8 text-xs"
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  placeholder="vd: Phòng Khám Nội"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mã phòng</Label>
                <Input
                  className="h-8 text-xs"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="vd: A102"
                />
              </div>
            </div>
          )}
          {!isRoom && (
            <div className="space-y-1">
              <Label className="text-xs">Tên hiển thị</Label>
              <Input className="h-8 text-xs" value={label} onChange={(event) => setLabel(event.target.value)} />
            </div>
          )}

          {/* Coordinates */}
          <div className="grid grid-cols-4 gap-2">
            <GridInput label="X" value={gridX} onChange={setGridX} />
            <GridInput label="Y" value={gridY} onChange={setGridY} />
            <GridInput label="Rộng" value={gridWidth} onChange={setGridWidth} min={1} />
            <GridInput label="Cao" value={gridHeight} onChange={setGridHeight} min={1} />
          </div>

          {/* Door Side and Rotation in 1 row */}
          <div className="grid grid-cols-2 gap-2.5 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Hướng cửa</Label>
              <Select value={doorSide} onValueChange={setDoorSide}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Không có</SelectItem>
                  <SelectItem value="NORTH">Bắc (↑)</SelectItem>
                  <SelectItem value="EAST">Đông (→)</SelectItem>
                  <SelectItem value="SOUTH">Nam (↓)</SelectItem>
                  <SelectItem value="WEST">Tây (←)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Xoay phần tử:</span>
                <span className="font-bold text-primary">{rotation}°</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => rotate("CW")}>
                  <RotateCw className="mr-1 h-3 w-3 text-primary" /> +90°
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => rotate("CCW")}>
                  <RotateCcw className="mr-1 h-3 w-3 text-muted-foreground" /> -90°
                </Button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs">Ghi chú</Label>
            <Input
              className="h-8 text-xs"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ghi chú thêm..."
            />
          </div>

          {/* Compact Corner Style Controls */}
          <div className="border-t pt-2">
            <CornerStyleControls corners={corners} onChange={setCorners} disabled={busy} compact />
          </div>

          {/* Side-by-side Departments & Services */}
          {isRoom && (
            <div className="grid grid-cols-2 gap-2.5 border-t pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Chuyên khoa có thể sử dụng</Label>
                <div className="max-h-28 overflow-y-auto rounded border p-1.5 space-y-1 bg-muted/20">
                  {activeDepartments
                    .filter((department) => department.active)
                    .map((department) => (
                      <label key={department.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
                        <input
                          type="checkbox"
                          className="rounded border-input text-primary"
                          checked={departmentIds.includes(department.id)}
                          onChange={() => handleToggleDepartment(department.id)}
                        />
                        <span className="truncate">{department.name}</span>
                      </label>
                    ))}
                  {activeDepartments.filter((d) => d.active).length === 0 && (
                    <p className="text-[11px] text-muted-foreground py-2 text-center">Chưa có chuyên khoa</p>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Dịch vụ có thể sử dụng</Label>
                  {visibleServices.length > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {serviceIds.filter((id) => visibleServices.some((s) => s.id === id)).length}/{visibleServices.length}
                    </span>
                  )}
                </div>
                <div className="max-h-28 overflow-y-auto rounded border p-1.5 space-y-1 bg-muted/20">
                  {departmentIds.length === 0 ? (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 py-3 px-2 text-center leading-relaxed">
                      Vui lòng chọn chuyên khoa trước để hiển thị dịch vụ tương ứng.
                    </p>
                  ) : visibleServices.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-3 text-center">
                      Chưa có dịch vụ nào thuộc chuyên khoa đã chọn.
                    </p>
                  ) : (
                    visibleServices.map((service) => (
                      <label key={service.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
                        <input
                          type="checkbox"
                          className="rounded border-input text-primary"
                          checked={serviceIds.includes(service.id)}
                          onChange={() => setServiceIds(toggle(serviceIds, service.id))}
                        />
                        <span className="truncate">{service.name}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0 font-mono">
                          {service.code}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between pt-2">
          <Button
            variant="outline"
            className="h-8 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            disabled={busy}
            onClick={() =>
              void (async () => {
                setBusy(true)
                try {
                  await onRemoveElement(element)
                  onOpenChange(false)
                } finally {
                  setBusy(false)
                }
              })()
            }
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Gỡ khỏi mặt bằng
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button
              className="h-8 text-xs"
              disabled={busy || (isRoom ? !code.trim() || !roomName.trim() : !label.trim())}
              onClick={() => void save()}
            >
              {busy ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GridInput({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (value: number) => void; min?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input className="h-8 text-xs" type="number" min={min} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  )
}
