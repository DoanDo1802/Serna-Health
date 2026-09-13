import { useState } from "react"
import type { SpecialtyExamTemplate } from "@/types/medical"
import { Input } from "@/components/base/ui/input"
import { Label } from "@/components/base/ui/label"
import { Textarea } from "@/components/base/ui/textarea"
import { Checkbox } from "@/components/base/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/base/ui/select"

export interface ExamTemplateRendererProps {
  template: SpecialtyExamTemplate
  value?: Record<string, any>
  onChange?: (value: Record<string, any>) => void
  readonly?: boolean
}

export function ExamTemplateRenderer({ template, value, onChange, readonly = false }: ExamTemplateRendererProps) {
  const [internalValue, setInternalValue] = useState<Record<string, any>>({})

  const currentValues = value ?? internalValue

  const handleChange = (id: string, val: any) => {
    if (readonly) return
    const next = { ...currentValues, [id]: val }
    setInternalValue(next)
    onChange?.(next)
  }

  if (!template || !template.fields || template.fields.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm italic text-muted-foreground">
        Chuyên khoa này chưa có mẫu khám bệnh.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
      {template.fields.map((field) => {
        const isTextarea = field.type === "textarea";
        const isCheckbox = field.type === "checkbox";

        return (
          <div
            key={field.id}
            className={`${isTextarea ? "md:col-span-2" : ""} flex flex-col justify-start`}
          >
            {isCheckbox ? (
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id={`field-${field.id}`}
                  checked={!!currentValues[field.id]}
                  onCheckedChange={(checked) => handleChange(field.id, checked === true)}
                  disabled={readonly}
                />
                <Label
                  htmlFor={`field-${field.id}`}
                  className="text-sm font-medium text-foreground cursor-pointer select-none"
                >
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
              </div>
            ) : (
              <div className="space-y-2">
                <Label
                  htmlFor={`field-${field.id}`}
                  className="block text-xs font-medium text-muted-foreground"
                >
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>

                {field.type === "text" && (
                  <Input
                    id={`field-${field.id}`}
                    className="w-full bg-card"
                    value={currentValues[field.id] || ""}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    disabled={readonly}
                    placeholder={`Nhập ${field.label.toLowerCase()}`}
                  />
                )}

                {field.type === "textarea" && (
                  <Textarea
                    id={`field-${field.id}`}
                    className="w-full bg-card"
                    value={currentValues[field.id] || ""}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    disabled={readonly}
                    placeholder={`Nhập ${field.label.toLowerCase()}`}
                    rows={3}
                  />
                )}

                {field.type === "number" && (
                  <Input
                    id={`field-${field.id}`}
                    className="w-full bg-card"
                    type="number"
                    value={currentValues[field.id] || ""}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    disabled={readonly}
                    placeholder={`Nhập ${field.label.toLowerCase()}`}
                  />
                )}

                {field.type === "select" && (
                  <Select
                    value={currentValues[field.id] || ""}
                    onValueChange={(val) => handleChange(field.id, val)}
                    disabled={readonly}
                  >
                    <SelectTrigger id={`field-${field.id}`} className="w-full bg-card">
                      <SelectValue placeholder={`Chọn ${field.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((opt, i) => (
                        <SelectItem key={`${opt}-${i}`} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
