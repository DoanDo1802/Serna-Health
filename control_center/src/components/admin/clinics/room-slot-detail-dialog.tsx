"use client"

import React, { useEffect, useState } from "react"
import type { Department, FacilityFloorElement, Room, RoomAssignments, Service } from "@/lib/api"
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
  departments: Department[]
  services: Service[]
  getAssignments: (roomId: string) => Promise<{ data: RoomAssignments; etag: string | null }>
  onUpdateElement: (element: FacilityFloorElement, update: ElementUpdate) => Promise<void>
  onUpdateRoom: (room: Room & { etag?: string | null }, data: { code: string; name: string }) => Promise<Room & { etag?: string | null }>
  onReplaceAssignments: (room: Room & { etag?: string | null }, departmentIds: string[], serviceIds: string[], etag: string) => Promise<Room & { etag?: string | null }>
  onRemoveElement: (element: FacilityFloorElement) => Promise<void>
}

type ElementUpdate = Pick<FacilityFloorElement, "label" | "gridX" | "gridY" | "gridWidth" | "gridHeight" | "zIndex" | "doorSide" | "notes">

export function RoomSlotDetailDialog({ open, onOpenChange, element, room, departments, services, getAssignments, onUpdateElement, onUpdateRoom, onReplaceAssignments, onRemoveElement }: RoomSlotDetailDialogProps) {
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

  useEffect(() => {
    if (!element) return
    const { notes: cleanNotes, corners: parsedCorners, rotation: parsedRotation } = parseNotesAndCorners(element.notes)
    setLabel(element.label)
    setGridX(element.gridX)
    setGridY(element.gridY)
    setGridWidth(element.gridWidth)
    setGridHeight(element.gridHeight)
    setDoorSide(element.doorSide ?? "NONE")
    setNotes(cleanNotes)
    setCorners(parsedCorners)
    setRotation(parsedRotation)
    setCode(room?.code ?? "")
    setRoomName(room?.name ?? "")
    setDepartmentIds([])
    setServiceIds([])
    setAssignmentEtag(null)
    if (room) {
      void getAssignments(room.id).then((result) => {
        setDepartmentIds(result.data.departmentIds)
        setServiceIds(result.data.serviceIds)
        setAssignmentEtag(result.etag ?? `"${result.data.version}"`)
      })
    }
  }, [element, room, open, getAssignments])

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
      const formattedNotes = formatNotesWithCorners(notes.trim(), corners, rotation)
      await onUpdateElement(element, { label: label.trim(), gridX, gridY, gridWidth, gridHeight, zIndex: element.zIndex, doorSide: doorSide === "NONE" ? null : doorSide as FacilityFloorElement["doorSide"], notes: formattedNotes })
      let currentRoom = room
      let currentAssignmentEtag = assignmentEtag
      if (room && (room.code !== code.trim() || room.name !== roomName.trim())) {
        currentRoom = await onUpdateRoom(room, { code: code.trim().toUpperCase(), name: roomName.trim() })
        currentAssignmentEtag = `"${currentRoom.version}"`
      }
      if (currentRoom && currentAssignmentEtag) await onReplaceAssignments(currentRoom, departmentIds, serviceIds, currentAssignmentEtag)
      onOpenChange(false)
    } finally { setBusy(false) }
  }

  return <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
    <DialogHeader><DialogTitle>Chi tiết {ELEMENT_LABELS[element.elementType]}</DialogTitle><DialogDescription>{room ? "Chỉnh sửa phòng vật lý, năng lực khai thác và vị trí trên lưới." : "Chỉnh sửa phần tử kiến trúc trên lưới."}</DialogDescription></DialogHeader>
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2"><span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold">{ELEMENT_LABELS[element.elementType]}</span>{room && <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold">{room.active ? "Hoạt động" : "Tạm ngừng"}</span>}</div>
      {room && <div className="grid grid-cols-3 gap-3"><div className="col-span-2 space-y-1.5"><Label>Tên phòng</Label><Input value={roomName} onChange={(event) => setRoomName(event.target.value)} /></div><div className="space-y-1.5"><Label>Mã phòng</Label><Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></div></div>}
      {!room && <div className="space-y-1.5"><Label>Tên hiển thị</Label><Input value={label} onChange={(event) => setLabel(event.target.value)} /></div>}
      <div className="grid grid-cols-4 gap-2"><GridInput label="X" value={gridX} onChange={setGridX} /><GridInput label="Y" value={gridY} onChange={setGridY} /><GridInput label="Rộng" value={gridWidth} onChange={setGridWidth} min={1} /><GridInput label="Cao" value={gridHeight} onChange={setGridHeight} min={1} /></div>
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
      <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Hướng cửa</Label><Select value={doorSide} onValueChange={setDoorSide}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Không có</SelectItem><SelectItem value="NORTH">Bắc</SelectItem><SelectItem value="EAST">Đông</SelectItem><SelectItem value="SOUTH">Nam</SelectItem><SelectItem value="WEST">Tây</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label>Ghi chú</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Ghi chú thêm..." /></div></div>
      <div className="border-t pt-3">
        <CornerStyleControls corners={corners} onChange={setCorners} disabled={busy} />
      </div>
      {room && <><div className="border-t pt-3"><Label>Chuyên khoa có thể sử dụng</Label><div className="mt-2 grid max-h-32 grid-cols-2 gap-2 overflow-y-auto rounded border p-2">{departments.filter((department) => department.active).map((department) => <label key={department.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={departmentIds.includes(department.id)} onChange={() => setDepartmentIds(toggle(departmentIds, department.id))} />{department.name}</label>)}</div></div><div><Label>Dịch vụ có thể sử dụng</Label><div className="mt-2 grid max-h-32 grid-cols-2 gap-2 overflow-y-auto rounded border p-2">{services.filter((service) => service.active).map((service) => <label key={service.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={serviceIds.includes(service.id)} onChange={() => setServiceIds(toggle(serviceIds, service.id))} />{service.name}</label>)}</div></div></>}
    </div>
    <DialogFooter className="flex-row justify-between sm:justify-between"><Button variant="outline" className="text-rose-600" disabled={busy} onClick={() => void (async () => { setBusy(true); try { await onRemoveElement(element); onOpenChange(false) } finally { setBusy(false) } })()}><Trash2 className="mr-1 h-3.5 w-3.5" />Gỡ khỏi mặt bằng</Button><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Hủy</Button><Button disabled={busy || !label.trim() || (room ? !code.trim() || !roomName.trim() : false)} onClick={() => void save()}>{busy ? "Đang lưu..." : "Lưu"}</Button></div></DialogFooter>
  </DialogContent></Dialog>
}

function GridInput({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (value: number) => void; min?: number }) { return <div className="space-y-1"><Label>{label}</Label><Input type="number" min={min} value={value} onChange={(event) => onChange(Number(event.target.value))} /></div> }
