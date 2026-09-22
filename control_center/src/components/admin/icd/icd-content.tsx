"use client"

import { useState, useMemo, useEffect } from "react"
import { useData } from "@/components/base/providers/data-provider"
import type { IcdCode } from "@/types/medical"
import { Card } from "@/components/base/ui/card"
import { Button } from "@/components/base/ui/button"
import { Input } from "@/components/base/ui/input"
import { Label } from "@/components/base/ui/label"
import { Textarea } from "@/components/base/ui/textarea"
import { Badge } from "@/components/base/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/base/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/base/ui/dialog"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/base/ui/select"
import { Search, Plus, Pencil, Trash2, Stethoscope } from "lucide-react"

const CHAPTERS = [
  "Bệnh nhiễm trùng và ký sinh trùng",
  "Khối u (Bướu tân sinh)",
  "Bệnh máu và cơ quan tạo máu",
  "Bệnh nội tiết, dinh dưỡng và chuyển hóa",
  "Rối loạn tâm thần và hành vi",
  "Bệnh hệ thần kinh",
  "Bệnh hệ tuần hoàn",
  "Bệnh hệ hô hấp",
  "Bệnh hệ tiêu hóa",
  "Bệnh hệ cơ - xương khớp",
]

const emptyForm: Omit<IcdCode, "id"> = {
  code: "",
  name: "",
  category: CHAPTERS[0],
  description: "",
}

export function IcdContent() {
  const { icdCodes, addIcd, updateIcd, deleteIcd, ensureIcdLoaded } = useData()
  useEffect(() => { ensureIcdLoaded() }, [ensureIcdLoaded])
  const [search, setSearch] = useState("")
  const [chapterFilter, setChapterFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<IcdCode, "id">>(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [groupFilter, setGroupFilter] = useState<string>("all")

  // Dynamically extract all unique disease groups from icdCodes
  const allGroups = useMemo(() => {
    const list = new Set<string>()
    icdCodes.forEach((c) => {
      if (c.category) {
        list.add(c.category)
      }
    })
    CHAPTERS.forEach((ch) => list.add(ch))
    return Array.from(list)
  }, [icdCodes])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return icdCodes.filter((c) => {
      const matchesSearch =
        c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      const matchesGroup = groupFilter === "all" || c.category === groupFilter
      return matchesSearch && matchesGroup
    })
  }, [icdCodes, search, groupFilter])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const activePage = Math.min(currentPage, totalPages || 1)
  const paginatedItems = useMemo(() => {
    return filtered.slice(
      (activePage - 1) * itemsPerPage,
      activePage * itemsPerPage
    )
  }, [filtered, activePage, itemsPerPage])

  const openAdd = () => {
    setForm(emptyForm)
    setEditingId(null)
    setDialogOpen(true)
  }

  const openEdit = (c: IcdCode) => {
    setForm({ code: c.code, name: c.name, category: c.category, description: c.description })
    setEditingId(c.id)
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!form.code.trim() || !form.name.trim()) return
    if (editingId) {
      updateIcd(editingId, form)
    } else {
      addIcd(form)
    }
    setDialogOpen(false)
  }

  const confirmDelete = () => {
    if (deleteId) deleteIcd(deleteId)
    setDeleteId(null)
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 md:p-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo mã hoặc tên bệnh..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select 
              value={groupFilter} 
              onValueChange={(val) => {
                setGroupFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-9 text-sm w-full sm:w-64">
                <SelectValue placeholder="Nhóm bệnh" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                <SelectItem value="all">Tất cả nhóm bệnh</SelectItem>
                {allGroups.map((ch) => (
                  <SelectItem key={ch} value={ch}>
                    {ch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openAdd} className="h-9 text-sm gap-2">
            <Plus className="w-4 h-4" />
            Thêm mã ICD-10
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto min-h-[580px]">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[15%] min-w-[100px]">Mã ICD-10</TableHead>
                <TableHead className="w-[48%]">Tên bệnh</TableHead>
                <TableHead className="w-[27%] hidden md:table-cell">Nhóm bệnh</TableHead>
                <TableHead className="w-[10%] text-right min-w-[80px]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-sm">
                    Không tìm thấy mã bệnh nào.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono font-semibold">
                        {c.code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <Stethoscope className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">{c.name}</p>
                          {c.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {c.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {c.category}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="w-4 h-4" />
                          <span className="sr-only">Sửa</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(c.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">Xóa</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* PHÂN TRANG */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border bg-card/50">
            <p className="text-xs text-muted-foreground">
              Hiển thị <span className="font-medium">{((activePage - 1) * itemsPerPage) + 1}</span> đến{" "}
              <span className="font-medium">
                {Math.min(activePage * itemsPerPage, filtered.length)}
              </span>{" "}
              trong tổng số <span className="font-medium">{filtered.length}</span> mã bệnh
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={activePage === 1}
                className="h-8 px-2 text-xs"
              >
                Trước
              </Button>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const p = idx + 1;
                return (
                  <Button
                    key={p}
                    variant={activePage === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(p)}
                    className="h-8 w-8 text-xs p-0"
                  >
                    {p}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={activePage === totalPages}
                className="h-8 px-2 text-xs"
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Chỉnh sửa mã ICD-10" : "Thêm mã ICD-10"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="icd-code">Mã ICD-10</Label>
                <Input
                  id="icd-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="A00"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="icd-name">Tên bệnh</Label>
                <Input
                  id="icd-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Bệnh tả"
                />
              </div>
            </div>
             <div className="space-y-1.5">
              <Label>Nhóm bệnh</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {allGroups.map((ch) => (
                    <SelectItem key={ch} value={ch}>
                      {ch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="icd-desc">Mô tả</Label>
              <Textarea
                id="icd-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Mô tả chi tiết về bệnh..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSubmit}>{editingId ? "Lưu thay đổi" : "Thêm mới"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa mã ICD-10?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Mã bệnh sẽ bị xóa khỏi danh mục.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
