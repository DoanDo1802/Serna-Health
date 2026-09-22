"use client"

import { useEffect, useMemo, useState } from "react"
import { useData } from "@/components/base/providers/data-provider"
import { treatmentTemplatesApi } from "@/lib/api"
import type { TreatmentTemplate, TreatmentTemplateDetail, TreatmentTemplateRequest, TreatmentTemplateResponse } from "@/types/medical"
import { Badge } from "@/components/base/ui/badge"
import { Button } from "@/components/base/ui/button"
import { Card } from "@/components/base/ui/card"
import { Input } from "@/components/base/ui/input"
import { Label } from "@/components/base/ui/label"
import { Textarea } from "@/components/base/ui/textarea"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/base/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/base/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/base/ui/table"
import { ClipboardList, Pencil, Plus, Search, Trash2, X } from "lucide-react"

type TemplateForm = {
  icd10Code: string
  templateName: string
  description: string
  details: Array<{
    medicineId: string
    quantity: number
    dosage: string
  }>
}

const emptyDetail = { medicineId: "", quantity: 1, dosage: "" }

const emptyForm: TemplateForm = {
  icd10Code: "",
  templateName: "",
  description: "",
  details: [{ ...emptyDetail }],
}

const mapTemplate = (template: TreatmentTemplateResponse): TreatmentTemplate => ({
  id: String(template.id),
  icd10Code: template.icd10Code,
  icd10Name: template.icd10Name,
  templateName: template.templateName,
  description: template.description ?? "",
  details: template.details ?? [],
})

const toForm = (template: TreatmentTemplate): TemplateForm => ({
  icd10Code: template.icd10Code,
  templateName: template.templateName,
  description: template.description ?? "",
  details: template.details.length
    ? template.details.map((detail) => ({
        medicineId: String(detail.medicineId),
        quantity: detail.quantity,
        dosage: detail.dosage,
      }))
    : [{ ...emptyDetail }],
})

export function TreatmentTemplatesContent() {
  const { medicines, icdCodes, ensureMedicinesLoaded, ensureIcdLoaded } = useData()
  useEffect(() => { ensureMedicinesLoaded(); ensureIcdLoaded() }, [ensureMedicinesLoaded, ensureIcdLoaded])
  const [templates, setTemplates] = useState<TreatmentTemplate[]>([])
  const [search, setSearch] = useState("")
  const [icdFilter, setIcdFilter] = useState("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TreatmentTemplate | null>(null)
  const [form, setForm] = useState<TemplateForm>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<TreatmentTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [formError, setFormError] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const loadTemplates = async (icd10Code = icdFilter) => {
    setLoading(true)
    setError("")
    try {
      const data = await treatmentTemplatesApi.list({ icd10Code: icd10Code === "all" ? undefined : icd10Code })
      setTemplates(data.map(mapTemplate))
    } catch (loadError) {
      console.error("Không thể tải combo thuốc", loadError)
      setError(loadError instanceof Error ? loadError.message : "Không thể tải combo thuốc")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates(icdFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icdFilter])

  const icdNameByCode = useMemo(() => {
    const map = new Map<string, string>()
    icdCodes.forEach((code) => map.set(code.code, code.name))
    return map
  }, [icdCodes])

  const medicineById = useMemo(() => {
    const map = new Map<string, (typeof medicines)[number]>()
    medicines.forEach((medicine) => map.set(medicine.id, medicine))
    return map
  }, [medicines])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return templates.filter((template) => {
      if (!q) return true
      const diseaseName = template.icd10Name ?? icdNameByCode.get(template.icd10Code) ?? ""
      const medicinesText = template.details
        .map((detail) => detail.medicineName ?? medicineById.get(String(detail.medicineId))?.name ?? "")
        .join(" ")
      return (
        template.templateName.toLowerCase().includes(q) ||
        template.icd10Code.toLowerCase().includes(q) ||
        diseaseName.toLowerCase().includes(q) ||
        medicinesText.toLowerCase().includes(q)
      )
    })
  }, [templates, search, icdNameByCode, medicineById])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const activePage = Math.min(currentPage, totalPages || 1)
  const paginatedItems = filtered.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage)

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm, details: [{ ...emptyDetail }], icd10Code: icdFilter === "all" ? "" : icdFilter })
    setFormError("")
    setDialogOpen(true)
  }

  const openEdit = (template: TreatmentTemplate) => {
    setEditing(template)
    setForm(toForm(template))
    setFormError("")
    setDialogOpen(true)
  }

  const updateDetail = (index: number, patch: Partial<TemplateForm["details"][number]>) => {
    setForm((prev) => ({
      ...prev,
      details: prev.details.map((detail, detailIndex) => (detailIndex === index ? { ...detail, ...patch } : detail)),
    }))
  }

  const addDetail = () => {
    setForm((prev) => ({ ...prev, details: [...prev.details, { ...emptyDetail }] }))
  }

  const removeDetail = (index: number) => {
    setForm((prev) => ({
      ...prev,
      details: prev.details.length === 1 ? [{ ...emptyDetail }] : prev.details.filter((_, detailIndex) => detailIndex !== index),
    }))
  }

  const validateForm = () => {
    if (!form.icd10Code) return "Vui lòng chọn mã ICD-10."
    if (!form.templateName.trim()) return "Vui lòng nhập tên combo thuốc."
    if (!form.details.length) return "Vui lòng thêm ít nhất một thuốc."

    const selectedIds = new Set<string>()
    for (const detail of form.details) {
      if (!detail.medicineId) return "Vui lòng chọn thuốc cho tất cả dòng."
      if (!Number(detail.quantity) || Number(detail.quantity) < 1) return "Số lượng thuốc phải lớn hơn 0."
      if (!detail.dosage.trim()) return "Vui lòng nhập liều dùng cho tất cả thuốc."
      if (selectedIds.has(detail.medicineId)) return "Một thuốc không được chọn trùng trong cùng combo."
      selectedIds.add(detail.medicineId)
    }

    return ""
  }

  const buildPayload = (): TreatmentTemplateRequest => ({
    icd10Code: form.icd10Code,
    templateName: form.templateName.trim(),
    description: form.description.trim(),
    medicines: form.details.map((detail) => ({
      medicineId: Number(detail.medicineId),
      quantity: Number(detail.quantity),
      dosage: detail.dosage.trim(),
    })),
  })

  const handleSubmit = async () => {
    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setFormError("")
    try {
      if (editing) {
        await treatmentTemplatesApi.update(editing.id, buildPayload())
      } else {
        await treatmentTemplatesApi.create(buildPayload())
      }
      setDialogOpen(false)
      await loadTemplates(icdFilter)
    } catch (submitError) {
      console.error("Không thể lưu combo thuốc", submitError)
      setFormError(submitError instanceof Error ? submitError.message : "Không thể lưu combo thuốc")
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await treatmentTemplatesApi.delete(deleteTarget.id)
      setDeleteTarget(null)
      await loadTemplates(icdFilter)
    } catch (deleteError) {
      console.error("Không thể xóa combo thuốc", deleteError)
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa combo thuốc")
    } finally {
      setSaving(false)
    }
  }

  const medicineSummary = (details: TreatmentTemplateDetail[]) => {
    const names = details.map((detail) => detail.medicineName ?? medicineById.get(String(detail.medicineId))?.name ?? `Thuốc #${detail.medicineId}`)
    const visible = names.slice(0, 3)
    return { visible, hiddenCount: Math.max(names.length - visible.length, 0) }
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 md:p-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm combo, ICD-10, tên bệnh, thuốc..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setCurrentPage(1)
                }}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select
              value={icdFilter}
              onValueChange={(value) => {
                setIcdFilter(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-9 text-sm w-full sm:w-72">
                <SelectValue placeholder="Lọc ICD-10" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                <SelectItem value="all">Tất cả ICD-10</SelectItem>
                {icdCodes.map((code) => (
                  <SelectItem key={code.code} value={code.code}>
                    {code.code} - {code.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openAdd} className="h-9 text-sm gap-2">
            <Plus className="w-4 h-4" />
            Thêm combo thuốc
          </Button>
        </div>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto min-h-[580px]">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[20%] min-w-[160px]">ICD-10</TableHead>
                <TableHead className="w-[30%] min-w-[220px]">Combo</TableHead>
                <TableHead className="w-[35%] min-w-[260px]">Thuốc trong combo</TableHead>
                <TableHead className="w-[8%] text-center">Số thuốc</TableHead>
                <TableHead className="w-[7%] text-right min-w-[90px]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                    Đang tải combo thuốc...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                    Chưa có combo thuốc phù hợp.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((template) => {
                  const summary = medicineSummary(template.details)
                  return (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="secondary" className="font-mono font-semibold">
                            {template.icd10Code}
                          </Badge>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {template.icd10Name ?? icdNameByCode.get(template.icd10Code) ?? "Chưa có tên bệnh"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <ClipboardList className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium text-foreground">{template.templateName}</p>
                            {template.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {summary.visible.map((name) => (
                            <Badge key={name} variant="outline" className="max-w-[180px] truncate">
                              {name}
                            </Badge>
                          ))}
                          {summary.hiddenCount > 0 && <Badge variant="secondary">+{summary.hiddenCount} thuốc</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">{template.details.length}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(template)} className="h-8 w-8">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(template)} className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-muted-foreground">
            <span>
              Trang {activePage}/{totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))} disabled={activePage === 1}>
                Trước
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))} disabled={activePage === totalPages}>
                Sau
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa combo thuốc" : "Thêm combo thuốc"}</DialogTitle>
            <DialogDescription>Chọn ICD-10 và các thuốc mặc định cho combo.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/20 dark:text-red-300">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ICD-10</Label>
                <Select value={form.icd10Code} onValueChange={(value) => setForm((prev) => ({ ...prev, icd10Code: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn mã ICD-10" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {icdCodes.map((code) => (
                      <SelectItem key={code.code} value={code.code}>
                        {code.code} - {code.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tên combo</Label>
                <Input
                  value={form.templateName}
                  onChange={(event) => setForm((prev) => ({ ...prev, templateName: event.target.value }))}
                  placeholder="VD: Combo viêm họng nhẹ"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Ghi chú chỉ định, cách dùng chung..."
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Thuốc trong combo</Label>
                <Button type="button" variant="outline" size="sm" onClick={addDetail} className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  Thêm thuốc
                </Button>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 border border-dashed rounded-lg p-2 bg-secondary/5">
                {form.details.map((detail, index) => {
                  return (
                    <div key={index} className="space-y-2 rounded-lg border border-border p-2 bg-secondary/10">
                      {/* Dòng 1: Chọn thuốc */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground w-6 text-center">#{index + 1}</span>
                        <div className="flex-1">
                          <Select value={detail.medicineId} onValueChange={(value) => updateDetail(index, { medicineId: value })}>
                            <SelectTrigger className="h-8 text-xs w-full">
                              <SelectValue placeholder="Chọn thuốc" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[250px] overflow-y-auto">
                              {medicines.map((medicine) => (
                                <SelectItem key={medicine.id} value={medicine.id}>
                                  {medicine.name} ({medicine.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Dòng 2: Số lượng, Liều dùng và Nút xóa */}
                      <div className="grid grid-cols-[80px_1fr_32px] gap-2 items-center pl-8">
                        <Input
                          type="number"
                          min={1}
                          placeholder="SL"
                          value={detail.quantity || ""}
                          onChange={(event) => updateDetail(index, { quantity: Number(event.target.value) })}
                          className="h-8 text-xs"
                        />
                        <Input
                          value={detail.dosage}
                          onChange={(event) => updateDetail(index, { dosage: event.target.value })}
                          placeholder="Liều dùng (VD: 1 viên x 2 lần/ngày)"
                          className="h-8 text-xs"
                        />
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeDetail(index)} 
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Đang lưu..." : editing ? "Cập nhật" : "Tạo combo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa combo thuốc?</AlertDialogTitle>
            <AlertDialogDescription>
              Combo "{deleteTarget?.templateName}" sẽ bị xóa khỏi mã ICD-10 {deleteTarget?.icd10Code}. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={saving} className="bg-red-600 hover:bg-red-700">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
