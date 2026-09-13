"use client"

import { useEffect, useMemo, useState, type MouseEvent } from "react"
import { useData } from "@/components/base/providers/data-provider"
import { useToast } from "@/hooks/use-toast"
import type { Specialty, SpecialtyExamFieldType, SpecialtyExamTemplate, SpecialtyExamTemplateField } from "@/types/medical"
import { Card } from "@/components/base/ui/card"
import { Button } from "@/components/base/ui/button"
import { Input } from "@/components/base/ui/input"
import { Label } from "@/components/base/ui/label"
import { Textarea } from "@/components/base/ui/textarea"
import { Checkbox } from "@/components/base/ui/checkbox"
import { StatusBadge } from "@/components/base/feedback/status-badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/base/ui/select"
import { Plus, Pencil, Trash2, FolderHeart, Users, Save, FilePlus2, Eye, LayoutTemplate, ArrowUp, ArrowDown } from "lucide-react"
import { ExamTemplateRenderer } from "@/components/shared/exam-template-renderer"

const fieldTypes: Array<{ value: SpecialtyExamFieldType; label: string }> = [
  { value: "text", label: "Một dòng" },
  { value: "textarea", label: "Nhiều dòng" },
  { value: "number", label: "Số" },
  { value: "select", label: "Chọn danh sách" },
  { value: "checkbox", label: "Đánh dấu" },
]

const emptyTemplate: SpecialtyExamTemplate = { fields: [] }

const emptyForm = {
  name: "",
  code: "",
  description: "",
  status: "active" as Specialty["status"],
}

const normalizeTemplate = (template?: SpecialtyExamTemplate): SpecialtyExamTemplate => ({
  fields: Array.isArray(template?.fields) ? template.fields : [],
})

const slugifyFieldId = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

const parseOptions = (value?: string[]) => (value ?? []).join(", ")

const normalizeOptions = (value: string) =>
  value
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean)

interface TemplateFieldItemProps {
  field: SpecialtyExamTemplateField
  index: number
  totalFields: number
  updateField: (index: number, patch: Partial<SpecialtyExamTemplateField>) => void
  removeField: (index: number) => void
  moveField: (index: number, direction: "up" | "down") => void
}

function TemplateFieldItem({ field, index, totalFields, updateField, removeField, moveField }: TemplateFieldItemProps) {
  const [optionsText, setOptionsText] = useState(parseOptions(field.options))

  useEffect(() => {
    setOptionsText(parseOptions(field.options))
  }, [field.options])

  const handleOptionsChange = (val: string) => {
    setOptionsText(val)
    updateField(index, { options: normalizeOptions(val) })
  }

  return (
    <div className="group relative rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-border/80 hover:shadow-md shrink-0">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tên mục
          </Label>
          <Input
            className="border-input bg-muted/50 font-medium transition-colors focus:bg-background"
            value={field.label}
            onChange={(e) => {
              const label = e.target.value
              updateField(index, {
                label,
                id: slugifyFieldId(label) || `field_${index + 1}`,
              })
            }}
            placeholder="Ví dụ: Huyết áp"
          />
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            onClick={() => moveField(index, "up")}
            disabled={index === 0}
            title="Di chuyển lên"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            onClick={() => moveField(index, "down")}
            disabled={index === totalFields - 1}
            title="Di chuyển xuống"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => removeField(index)}
            title="Xóa mục"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Loại dữ liệu
          </Label>
          <Select
            value={field.type}
            onValueChange={(value) =>
              updateField(index, {
                type: value as SpecialtyExamFieldType,
                options: value === "select" ? field.options ?? [] : [],
              })
            }
          >
            <SelectTrigger className="border-input bg-muted/50 focus:bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fieldTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center pt-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground/85">
            <Checkbox
              className="border-input"
              checked={!!field.required}
              onCheckedChange={(checked) => updateField(index, { required: checked === true })}
            />
            Bắt buộc điền
          </label>
        </div>
      </div>

      {field.type === "select" && (
        <div className="mt-4 space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Lựa chọn (cách nhau bằng dấu phẩy)
          </Label>
          <Input
            className="border-input bg-background"
            value={optionsText}
            onChange={(e) => handleOptionsChange(e.target.value)}
            placeholder="Nhẹ, Trung bình, Nặng"
          />
        </div>
      )}
    </div>
  )
}

export function SpecialtiesContent() {
  const {
    specialties,
    doctors,
    addSpecialty,
    updateSpecialty,
    updateSpecialtyStatus,
    deleteSpecialty,
    ensureSpecialtiesLoaded,
    ensureDoctorsLoaded,
  } = useData()
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Specialty | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<Specialty | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>("")
  const [templateDraft, setTemplateDraft] = useState<SpecialtyExamTemplate>(emptyTemplate)
  const [templateError, setTemplateError] = useState("")
  const [viewMode, setViewMode] = useState<"builder" | "preview">("builder")

  useEffect(() => {
    ensureSpecialtiesLoaded()
    ensureDoctorsLoaded()
  }, [ensureSpecialtiesLoaded, ensureDoctorsLoaded])

  const selectedSpecialty = useMemo(
    () => specialties.find((s) => s.id === selectedSpecialtyId) ?? specialties[0],
    [specialties, selectedSpecialtyId],
  )

  const specialtyDoctors = useMemo(
    () => doctors.filter((doctor) => doctor.specialtyId === selectedSpecialty?.id),
    [doctors, selectedSpecialty?.id],
  )

  const deleteTargetDoctorCount = deleteTarget
    ? doctors.filter((doctor) => doctor.specialtyId === deleteTarget.id).length || deleteTarget.doctorCount
    : 0
  const deleteTargetInUse = deleteTargetDoctorCount > 0
  const deleteTargetInactive = deleteTarget?.status === "inactive"

  useEffect(() => {
    if (!selectedSpecialty) return
    setSelectedSpecialtyId(selectedSpecialty.id)
    setTemplateDraft(normalizeTemplate(selectedSpecialty.examTemplate))
    setTemplateError("")
  }, [selectedSpecialty?.id])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (s: Specialty) => {
    setEditing(s)
    setForm({ name: s.name, code: s.code, description: s.description, status: s.status })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.code.trim()) return
    try {
      if (editing) {
        await updateSpecialty(editing.id, { ...form, examTemplate: normalizeTemplate(editing.examTemplate), version: editing.version })
        toast({
          title: "Cập nhật thành công",
          description: `Đã cập nhật thông tin chuyên khoa ${form.name}.`,
        })
      } else {
        await addSpecialty({ ...form, examTemplate: emptyTemplate })
        toast({
          title: "Thêm thành công",
          description: `Đã thêm chuyên khoa ${form.name} mới.`,
        })
      }
      setDialogOpen(false)
    } catch (error) {
      toast({
        title: "Không thể lưu chuyên khoa",
        description: error instanceof Error ? error.message : "Vui lòng thử lại.",
        variant: "destructive",
      })
    }
  }

  const updateField = (index: number, patch: Partial<SpecialtyExamTemplateField>) => {
    setTemplateDraft((prev) => ({
      fields: prev.fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)),
    }))
    setTemplateError("")
  }

  const addField = () => {
    const nextIndex = templateDraft.fields.length + 1
    setTemplateDraft((prev) => ({
      fields: [
        ...prev.fields,
        {
          id: `field_${nextIndex}`,
          label: `Trường ${nextIndex}`,
          type: "text",
          required: false,
          options: [],
        },
      ],
    }))
  }

  const removeField = (index: number) => {
    setTemplateDraft((prev) => ({ fields: prev.fields.filter((_, fieldIndex) => fieldIndex !== index) }))
    setTemplateError("")
  }

  const moveField = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return
    if (direction === "down" && index === templateDraft.fields.length - 1) return

    const nextIndex = direction === "up" ? index - 1 : index + 1
    const nextFields = [...templateDraft.fields]
    const temp = nextFields[index]
    nextFields[index] = nextFields[nextIndex]
    nextFields[nextIndex] = temp

    setTemplateDraft({ fields: nextFields })
    setTemplateError("")
  }

  const validateTemplate = (template: SpecialtyExamTemplate) => {
    const ids = new Set<string>()
    for (const field of template.fields) {
      const id = field.id.trim()
      const label = field.label.trim()
      if (!id || !label) return "Mỗi trường cần có mã và nhãn."
      if (ids.has(id)) return `Mã trường "${id}" bị trùng.`
      ids.add(id)
      if (field.type === "select" && (!field.options || field.options.length === 0)) {
        return `Trường "${label}" cần ít nhất một lựa chọn.`
      }
    }
    return ""
  }

  const saveTemplate = async () => {
    if (!selectedSpecialty) return
    const nextTemplate = {
      fields: templateDraft.fields.map((field) => ({
        ...field,
        id: field.id.trim(),
        label: field.label.trim(),
        options: field.type === "select" ? field.options ?? [] : [],
      })),
    }
    const error = validateTemplate(nextTemplate)
    if (error) {
      setTemplateError(error)
      return
    }

    try {
      await updateSpecialty(selectedSpecialty.id, {
        name: selectedSpecialty.name,
        code: selectedSpecialty.code,
        description: selectedSpecialty.description,
        status: selectedSpecialty.status,
        examTemplate: nextTemplate,
        version: selectedSpecialty.version,
      })
      setTemplateDraft(nextTemplate)
      setTemplateError("")
      toast({
        title: "Lưu thành công",
        description: `Đã lưu cấu hình template khám cho chuyên khoa ${selectedSpecialty.name}.`,
      })
    } catch (error) {
      toast({
        title: "Không thể lưu template",
        description: error instanceof Error ? error.message : "Vui lòng thử lại.",
        variant: "destructive",
      })
    }
  }

  const openDelete = (specialty: Specialty) => {
    setDeleteTarget(specialty)
    setDeleteError("")
  }

  const handleStatusChange = async (specialty: Specialty, active: boolean) => {
    try {
      await updateSpecialtyStatus(specialty.id, active)
      toast({
        title: active ? "Kích hoạt thành công" : "Tạm ngừng thành công",
        description: active
          ? `Đã kích hoạt chuyên khoa ${specialty.name}.`
          : `Đã tạm ngừng chuyên khoa ${specialty.name}.`,
      })
      setDeleteTarget(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vui lòng thử lại."
      setDeleteError(message)
      toast({
        title: active ? "Không thể kích hoạt" : "Không thể tạm ngừng",
        description: message,
        variant: "destructive",
      })
    }
  }

  const handleDeleteAction = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!deleteTarget || deleteBusy) return

    setDeleteBusy(true)
    setDeleteError("")
    try {
      if (deleteTargetInUse) {
        await updateSpecialtyStatus(deleteTarget.id, false)
        toast({
          title: "Tạm ngừng thành công",
          description: `Đã tạm ngừng chuyên khoa ${deleteTarget.name}.`,
        })
        setDeleteTarget(null)
      } else {
        await deleteSpecialty(deleteTarget.id)
        toast({
          title: "Xóa thành công",
          description: `Đã xóa chuyên khoa ${deleteTarget.name}.`,
        })
        setDeleteTarget(null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vui lòng thử lại."
      setDeleteError(message)
      toast({
        title: "Không thể xóa chuyên khoa",
        description: message,
        variant: "destructive",
      })
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {specialties.length === 0 ? (
        <Card className="p-10 text-center space-y-4">
          <FolderHeart className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Chưa có chuyên khoa nào trong hệ thống.</p>
          <Button onClick={openAdd} className="gap-1.5 mx-auto">
            <Plus className="w-4 h-4" />
            Thêm chuyên khoa
          </Button>
        </Card>
      ) : (
        selectedSpecialty && (
          <Card className="p-6 flex flex-col h-[calc(100vh-210px)] min-h-[550px] shadow-sm">
            {/* Top row: Dropdown selection + Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5 shrink-0">
              <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Chuyên khoa đang chọn</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedSpecialty?.id || ""}
                      onValueChange={setSelectedSpecialtyId}
                    >
                      <SelectTrigger className="w-[320px] bg-card font-semibold text-foreground border-border">
                        <SelectValue placeholder="Chọn chuyên khoa" />
                      </SelectTrigger>
                      <SelectContent>
                        {specialties.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.code}){s.status === "inactive" ? " • Tạm ngừng" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 border border-border hover:bg-muted"
                        title="Chỉnh sửa thông tin chuyên khoa"
                        onClick={() => openEdit(selectedSpecialty)}
                      >
                        <Pencil className="w-4 h-4 text-foreground" />
                      </Button>
                      {selectedSpecialty.status === "inactive" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => handleStatusChange(selectedSpecialty, true)}
                        >
                          Kích hoạt lại
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 border border-border hover:bg-destructive/10 text-destructive"
                        title={selectedSpecialty.status === "inactive" ? "Xóa vĩnh viễn" : "Xóa chuyên khoa"}
                        onClick={() => openDelete(selectedSpecialty)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-end pt-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground leading-normal">
                      Mã chuyên khoa: <span className="font-mono font-semibold bg-muted px-1 py-0.5 rounded text-muted-foreground">{selectedSpecialty.code}</span>
                    </p>
                    <StatusBadge tone={selectedSpecialty.status === "inactive" ? "warning" : "success"}>
                      {selectedSpecialty.status === "inactive" ? "Tạm ngừng" : "Hoạt động"}
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-md truncate mt-1" title={selectedSpecialty.description}>
                    {selectedSpecialty.description || "Không có mô tả."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto">
                <Button variant="outline" onClick={openAdd} className="gap-1.5 h-10 text-sm">
                  <Plus className="w-4 h-4" />
                  Thêm chuyên khoa
                </Button>
                 <Button onClick={saveTemplate} className="gap-1.5 h-10 text-sm bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Save className="w-4 h-4" />
                  Lưu template khám
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 overflow-hidden pt-4">
              <div className="rounded-lg border border-border p-4 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Bác sĩ thuộc chuyên khoa
                  </h3>
                  <span className="text-xs text-muted-foreground">{specialtyDoctors.length}</span>
                </div>
                <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                  {specialtyDoctors.map((doctor) => (
                    <div key={doctor.id} className="rounded-md bg-muted/50 px-3 py-2">
                      <p className="text-sm font-medium text-foreground">{doctor.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doctor.title} {doctor.phone ? `• ${doctor.phone}` : ""}
                      </p>
                    </div>
                  ))}
                  {specialtyDoctors.length === 0 && (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Chưa có bác sĩ thuộc chuyên khoa này.
                    </p>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 rounded-lg border border-border p-4 flex flex-col h-full overflow-hidden bg-card">
                <div className="flex items-center justify-between gap-3 shrink-0 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold">Template khám bệnh</h3>
                    <p className="text-xs text-muted-foreground">
                      Các mục này sẽ xuất hiện khi bác sĩ khám bệnh theo chuyên khoa.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-muted p-1 rounded-lg">
                      <button
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === "builder" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        onClick={() => setViewMode("builder")}
                      >
                        <LayoutTemplate className="w-3.5 h-3.5" />
                        Cấu hình
                      </button>
                      <button
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === "preview" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        onClick={() => setViewMode("preview")}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Xem trước
                      </button>
                    </div>
                    {viewMode === "builder" && (
                      <Button variant="outline" size="sm" onClick={addField} className="gap-2">
                        <FilePlus2 className="w-4 h-4" />
                        Thêm mục
                      </Button>
                    )}
                  </div>
                </div>

                {templateError && (
                  <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive shrink-0 mb-3">
                    {templateError}
                  </div>
                )}

                {viewMode === "builder" ? (
                  <div className="space-y-4 overflow-y-auto flex-1 pr-2 pb-4">
                    {templateDraft.fields.map((field, index) => (
                      <TemplateFieldItem
                        key={`field-item-${index}`}
                        field={field}
                        index={index}
                        totalFields={templateDraft.fields.length}
                        updateField={updateField}
                        removeField={removeField}
                        moveField={moveField}
                      />
                    ))}
                    {templateDraft.fields.length === 0 && (
                      <div className="rounded-xl border-2 border-dashed border-border bg-muted/40 py-12 flex flex-col items-center justify-center gap-2 text-center">
                        <FilePlus2 className="w-8 h-8 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">Chưa có mục khám riêng</p>
                        <p className="text-xs text-muted-foreground/80">Bấm “Thêm mục” để tạo template.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 border border-border rounded-xl bg-card overflow-hidden flex flex-col h-full">
                    <div className="bg-muted/30 px-6 py-4 border-b border-border">
                      <h4 className="text-base font-semibold text-foreground">Xem trước giao diện Bác sĩ</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Giao diện này sẽ hiển thị khi bác sĩ tạo bệnh án mới.</p>
                    </div>
                    <div className="p-8 bg-card flex-1 overflow-y-auto">
                      <ExamTemplateRenderer template={templateDraft} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )
      )}

      {/* Dialogs */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Chỉnh sửa chuyên khoa" : "Thêm chuyên khoa mới"}</DialogTitle>
            <DialogDescription>Nhập thông tin chuyên khoa.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2 col-span-2">
                <Label htmlFor="sp-name">Tên chuyên khoa</Label>
                <Input id="sp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sp-code">Mã</Label>
                <Input id="sp-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sp-desc">Mô tả</Label>
              <Textarea
                id="sp-desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSubmit}>{editing ? "Lưu thay đổi" : "Thêm mới"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) {
            setDeleteTarget(null)
            setDeleteError("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTargetInUse ? "Không thể xóa vĩnh viễn" : "Xóa chuyên khoa?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargetInUse ? (
                <span>
                  Chuyên khoa &quot;{deleteTarget?.name}&quot; đang có {deleteTargetDoctorCount} bác sĩ nên không thể xóa vĩnh viễn. Bạn có thể tạm ngừng chuyên khoa để ẩn khỏi đăng ký và chọn mới.
                </span>
              ) : (
                <span>
                  Bạn có chắc muốn xóa vĩnh viễn chuyên khoa &quot;{deleteTarget?.name}&quot;? Hành động này không thể hoàn tác.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className={deleteTargetInUse ? "bg-amber-600 text-white hover:bg-amber-700" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
              disabled={deleteBusy || (deleteTargetInUse && deleteTargetInactive)}
              onClick={handleDeleteAction}
            >
              {deleteBusy
                ? "Đang xử lý..."
                : deleteTargetInUse
                  ? deleteTargetInactive ? "Đã tạm ngừng" : "Tạm ngừng chuyên khoa"
                  : "Xóa vĩnh viễn"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
