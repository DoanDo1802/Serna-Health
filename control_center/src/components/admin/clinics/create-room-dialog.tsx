"use client"

import React, { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/base/ui/dialog"
import { Button } from "@/components/base/ui/button"
import { Input } from "@/components/base/ui/input"
import { Label } from "@/components/base/ui/label"
import type { Room } from "@/lib/api"

interface CreateRoomDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  room?: Room | null
  onCreate?: (data: { code: string; name: string }) => Promise<{ id: string }>
  onUpdate?: (room: Room, data: { code: string; name: string }) => Promise<void>
  onCreated?: (roomId: string) => void
}

export function CreateRoomDialog({ open, onOpenChange, room, onCreate, onUpdate, onCreated }: CreateRoomDialogProps) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  const isEdit = !!room

  useEffect(() => {
    if (open) {
      if (room) {
        setCode(room.code)
        setName(room.name)
      } else {
        setCode("")
        setName("")
      }
    }
  }, [open, room])

  const submit = async () => {
    if (!code.trim() || !name.trim()) return
    setBusy(true)
    try {
      if (isEdit && room && onUpdate) {
        await onUpdate(room, { code: code.trim().toUpperCase(), name: name.trim() })
        onOpenChange(false)
      } else if (onCreate) {
        const created = await onCreate({ code: code.trim().toUpperCase(), name: name.trim() })
        setCode("")
        setName("")
        onCreated?.(created.id)
        onOpenChange(false)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Chỉnh sửa phòng" : "Tạo phòng vật lý"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Cập nhật mã phòng và tên phòng trong danh mục cơ sở y tế."
              : "Tạo mã và tên phòng trước. Sau khi lưu, kéo trên lưới để đặt vị trí và kích thước."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="room-code">Mã phòng *</Label>
            <Input
              id="room-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="P.201"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="room-name">Tên phòng *</Label>
            <Input
              id="room-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Phòng khám Nội tổng quát"
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button disabled={busy || !code.trim() || !name.trim()} onClick={() => void submit()}>
            {busy ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo rồi đặt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
