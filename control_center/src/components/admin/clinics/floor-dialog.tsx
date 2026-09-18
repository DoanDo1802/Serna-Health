"use client"

import React, { useEffect, useState } from "react"
import type { FacilityFloor } from "@/lib/api"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/base/ui/dialog"
import { Button } from "@/components/base/ui/button"
import { Input } from "@/components/base/ui/input"
import { Label } from "@/components/base/ui/label"
import { Textarea } from "@/components/base/ui/textarea"

interface FloorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  floor?: FacilityFloor | null
  onSave: (data: Omit<FacilityFloor, "id" | "version" | "createdAt" | "updatedAt">) => Promise<void>
}

export function FloorDialog({ open, onOpenChange, floor, onSave }: FloorDialogProps) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [level, setLevel] = useState(1)
  const [description, setDescription] = useState("")
  const [gridColumns, setGridColumns] = useState(16)
  const [gridRows, setGridRows] = useState(12)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setCode(floor?.code ?? "")
    setName(floor?.name ?? "")
    setLevel(floor?.level ?? 1)
    setDescription(floor?.description ?? "")
    setGridColumns(floor?.gridColumns ?? 16)
    setGridRows(floor?.gridRows ?? 12)
  }, [floor, open])

  const submit = async () => {
    if (!code.trim() || !name.trim()) return
    setBusy(true)
    try {
      await onSave({ code: code.trim().toUpperCase(), name: name.trim(), level, description: description.trim() || null, gridColumns, gridRows })
      onOpenChange(false)
    } catch {
      // Parent handler reports API failures through the application toast.
    } finally {
      setBusy(false)
    }
  }

  return <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>{floor ? "Chỉnh sửa tầng" : "Tạo tầng mới"}</DialogTitle>
        <DialogDescription>Thiết lập lưới tương đối để thiết kế mặt bằng. Không lưu kích thước thực tế.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="floor-code">Mã tầng *</Label><Input id="floor-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="T1, B1..." /></div>
          <div className="space-y-1.5"><Label htmlFor="floor-level">Thứ tự tầng</Label><Input id="floor-level" type="number" value={level} onChange={(event) => setLevel(Number(event.target.value))} /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="floor-name">Tên tầng *</Label><Input id="floor-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="floor-columns">Số cột lưới</Label><Input id="floor-columns" type="number" min="1" max="100" value={gridColumns} onChange={(event) => setGridColumns(Number(event.target.value))} /></div>
          <div className="space-y-1.5"><Label htmlFor="floor-rows">Số hàng lưới</Label><Input id="floor-rows" type="number" min="1" max="100" value={gridRows} onChange={(event) => setGridRows(Number(event.target.value))} /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="floor-description">Mô tả</Label><Textarea id="floor-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></div>
      </div>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Hủy</Button><Button disabled={busy || !code.trim() || !name.trim()} onClick={() => void submit()}>{busy ? "Đang lưu..." : floor ? "Lưu thay đổi" : "Tạo tầng"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
