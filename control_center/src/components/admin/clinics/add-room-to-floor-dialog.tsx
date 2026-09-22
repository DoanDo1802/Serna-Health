"use client"

import React, { useMemo, useState } from "react"
import type { Room } from "@/lib/api"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/base/ui/dialog"
import { Button } from "@/components/base/ui/button"
import { Label } from "@/components/base/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/base/ui/select"

interface AddRoomToFloorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  floorName: string
  rooms: Room[]
  usedRoomIds: Set<string>
  onSelectRoom: (roomId: string) => void
}

export function AddRoomToFloorDialog({ open, onOpenChange, floorName, rooms, usedRoomIds, onSelectRoom }: AddRoomToFloorDialogProps) {
  const [roomId, setRoomId] = useState("")
  const availableRooms = useMemo(() => rooms.filter((room) => room.active && !usedRoomIds.has(room.id)), [rooms, usedRoomIds])

  const close = (value: boolean) => {
    if (!value) setRoomId("")
    onOpenChange(value)
  }

  const startPlacement = () => {
    if (!roomId) return
    onSelectRoom(roomId)
    close(false)
  }

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader><DialogTitle>Đặt phòng vào {floorName}</DialogTitle><DialogDescription>Chọn phòng rồi kéo trên lưới để xác định vị trí và kích thước. Mã, tên, chuyên khoa và dịch vụ chỉnh sửa trong chi tiết phòng.</DialogDescription></DialogHeader>
      <div className="space-y-2 py-2"><Label htmlFor="unplaced-room">Phòng chưa đặt</Label><Select value={roomId} onValueChange={setRoomId}><SelectTrigger id="unplaced-room"><SelectValue placeholder="Chọn phòng" /></SelectTrigger><SelectContent>{availableRooms.map((room) => <SelectItem key={room.id} value={room.id}>{room.code} — {room.name}</SelectItem>)}</SelectContent></Select>{availableRooms.length === 0 && <p className="text-xs text-muted-foreground">Không có phòng hoạt động chưa được đặt vào mặt bằng.</p>}</div>
      <DialogFooter><Button variant="outline" onClick={() => close(false)}>Hủy</Button><Button disabled={!roomId} onClick={startPlacement}>Chọn vị trí trên lưới</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
