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

  if (!element) return null
  const toggle = (values: string[], value: string) => values.includes(value) ? values.filter((id) => id !== value) : [...values, value]

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

  return (
    <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Chi tiết {ELEMENT_LABELS[element.elementType]}</DialogTitle>
          <DialogDescription>
            {isRoom
              ? "Chỉnh sửa thông tin phòng khám, chuyên khoa phụ trách và dịch vụ khám."
              : "Chỉnh sửa phần tử kiến trúc trên lưới."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold">
              {ELEMENT_LABELS[element.elementType]}
            </span>
            {isRoom && (
              <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold">
                {room ? (room.active ? "Đã gán danh mục" : "Tạm ngừng") : "Phòng sao chép (Chờ gán)"}
              </span>
            )}
          </div>
          {isRoom && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Tên phòng</Label>
                <Input
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  placeholder="vd: Phòng Khám Nội"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mã phòng</Label>
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="vd: A102"
                />
              </div>
            </div>
          )}
          {!isRoom && (
            <div className="space-y-1.5">
              <Label>Tên hiển thị</Label>
              <Input value={label} onChange={(event) => setLabel(event.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            <GridInput label="X" value={gridX} onChange={setGridX} />
            <GridInput label="Y" value={gridY} onChange={setGridY} />
            <GridInput label="Rộng" value={gridWidth} onChange={setGridWidth} min={1} />
            <GridInput label="Cao" value={gridHeight} onChange={setGridHeight} min={1} />
          </div>
          <div className="flex items-center justify-between rounded-md border bg-muted/40 p-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">Xoay phần tử:</span>
              <span className="font-bold text-primary">{rotation}°</span>
            </div>
            <div className="flex gap-1.5">
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => rotate("CW")}>
                <RotateCw className="mr-1 h-3 w-3 text-primary" />
                Quay 90° thuận
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => rotate("CCW")}>
                <RotateCcw className="mr-1 h-3 w-3 text-muted-foreground" />
                Quay 90° ngược
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hướng cửa</Label>
              <Select value={doorSide} onValueChange={setDoorSide}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Không có</SelectItem>
                  <SelectItem value="NORTH">Bắc</SelectItem>
                  <SelectItem value="EAST">Đông</SelectItem>
                  <SelectItem value="SOUTH">Nam</SelectItem>
                  <SelectItem value="WEST">Tây</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ghi chú</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                placeholder="Ghi chú thêm..."
              />
            </div>
          </div>
          <div className="border-t pt-3">
            <CornerStyleControls corners={corners} onChange={setCorners} disabled={busy} />
          </div>
          {isRoom && (
            <>
              <div className="border-t pt-3">
                <Label>Chuyên khoa có thể sử dụng</Label>
                <div className="mt-2 grid max-h-32 grid-cols-2 gap-2 overflow-y-auto rounded border p-2">
                  {activeDepartments
                    .filter((department) => department.active)
                    .map((department) => (
                      <label key={department.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={departmentIds.includes(department.id)}
                          onChange={() => setDepartmentIds(toggle(departmentIds, department.id))}
                        />
                        {department.name}
                      </label>
                    ))}
                </div>
              </div>
              <div>
                <Label>Dịch vụ có thể sử dụng</Label>
                <div className="mt-2 grid max-h-32 grid-cols-2 gap-2 overflow-y-auto rounded border p-2">
                  {activeServices
                    .filter((service) => service.active)
                    .map((service) => (
                      <label key={service.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={serviceIds.includes(service.id)}
                          onChange={() => setServiceIds(toggle(serviceIds, service.id))}
                        />
                        {service.name}
                      </label>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="outline"
            className="text-rose-600"
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
            <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button
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

function GridInput({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (value: number) => void; min?: number }) { return <div className="space-y-1"><Label>{label}</Label><Input type="number" min={min} value={value} onChange={(event) => onChange(Number(event.target.value))} /></div> }
