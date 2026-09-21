"use client"

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { Badge } from "@/components/base/ui/badge"
import { Button } from "@/components/base/ui/button"
import { Card } from "@/components/base/ui/card"
import { Input } from "@/components/base/ui/input"
import { Label } from "@/components/base/ui/label"
import { Textarea } from "@/components/base/ui/textarea"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/base/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  ApiError,
  departmentsApi,
  personnelApi,
  type Department,
  type Personnel,
  type PersonnelProvisionRequest,
  type PersonnelType,
  type PersonnelUpdateRequest,
} from "@/lib/api"
import { Ban, LoaderCircle, Pencil, Plus, Search, UserRoundCog } from "lucide-react"

type PersonnelForm = {
  type: PersonnelType
  email: string
  initialPassword: string
  staffCode: string
  fullName: string
  departmentId: string
  phone: string
  dateOfBirth: string
  gender: "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED"
  address: string
  professionalTitle: string
  academicDegree: string
  specialtyDesignation: string
  licenseNumber: string
  licensingAuthority: string
  licenseIssuedOn: string
  licenseExpiresOn: string
  yearsExperience: string
  biography: string
  avatarUrl: string
}

const emptyForm = (): PersonnelForm => ({
  type: "DOCTOR",
  email: "",
  initialPassword: "",
  staffCode: "",
  fullName: "",
  departmentId: "",
  phone: "",
  dateOfBirth: "",
  gender: "UNSPECIFIED",
  address: "",
  professionalTitle: "",
  academicDegree: "",
  specialtyDesignation: "",
  licenseNumber: "",
  licensingAuthority: "",
  licenseIssuedOn: "",
  licenseExpiresOn: "",
  yearsExperience: "0",
  biography: "",
  avatarUrl: "",
})

function messageFor(error: unknown) {
  if (error instanceof ApiError && error.code === "CONCURRENCY_STALE_VERSION") {
    return "Dữ liệu đã được thay đổi bởi phiên khác. Hãy tải lại rồi thử lại."
  }
  return error instanceof Error ? error.message : "Không thể hoàn tất yêu cầu. Vui lòng thử lại."
}

function typeLabel(type: PersonnelType) {
  return type === "DOCTOR" ? "Bác sĩ" : "Nhân viên"
}

function statusLabel(personnel: Personnel) {
  return personnel.active && personnel.accountStatus === "ACTIVE" ? "Đang hoạt động" : "Đã ngừng"
}

function phoneForDisplay(phone: string) {
  const vietnameseMobile = phone.match(/^\+84([35789]\d{8})$/)
  return vietnameseMobile ? `0${vietnameseMobile[1]}` : phone
}

function canonicalPhone(phone: string) {
  const value = phone.trim().replace(/[\s.-]/g, "")
  if (/^0[35789]\d{8}$/.test(value)) return `+84${value.slice(1)}`
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null
}

function formFromPersonnel(personnel: Personnel): PersonnelForm {
  const profile = personnel.doctorProfile
  return {
    type: personnel.type,
    email: "",
    initialPassword: "",
    staffCode: personnel.staffCode,
    fullName: personnel.fullName,
    departmentId: personnel.departmentId ?? "",
    phone: profile ? phoneForDisplay(profile.phone) : "",
    dateOfBirth: profile?.dateOfBirth ?? "",
    gender: profile?.gender ?? "UNSPECIFIED",
    address: profile?.address ?? "",
    professionalTitle: profile?.professionalTitle ?? "",
    academicDegree: profile?.academicDegree ?? "",
    specialtyDesignation: profile?.specialtyDesignation ?? "",
    licenseNumber: profile?.licenseNumber ?? "",
    licensingAuthority: profile?.licensingAuthority ?? "",
    licenseIssuedOn: profile?.licenseIssuedOn ?? "",
    licenseExpiresOn: profile?.licenseExpiresOn ?? "",
    yearsExperience: String(profile?.yearsExperience ?? 0),
    biography: profile?.biography ?? "",
    avatarUrl: profile?.avatarUrl ?? "",
  }
}

function doctorProfile(form: PersonnelForm, phone: string) {
  return {
    phone,
    dateOfBirth: form.dateOfBirth,
    gender: form.gender,
    address: form.address.trim(),
    professionalTitle: form.professionalTitle.trim(),
    academicDegree: form.academicDegree.trim(),
    specialtyDesignation: form.specialtyDesignation.trim(),
    licenseNumber: form.licenseNumber.trim(),
    licensingAuthority: form.licensingAuthority.trim(),
    licenseIssuedOn: form.licenseIssuedOn,
    licenseExpiresOn: form.licenseExpiresOn || null,
    yearsExperience: Number(form.yearsExperience),
    biography: form.biography.trim() || null,
    avatarUrl: form.avatarUrl.trim() || null,
  }
}

export function DoctorsContent() {
  const { toast } = useToast()
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<PersonnelType | "ALL">("ALL")
  const [activeFilter, setActiveFilter] = useState<"ACTIVE" | "INACTIVE" | "ALL">("ACTIVE")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Personnel | null>(null)
  const [editingEtag, setEditingEtag] = useState<string | null>(null)
  const [form, setForm] = useState<PersonnelForm>(emptyForm)
  const [deactivateTarget, setDeactivateTarget] = useState<Personnel | null>(null)
  const [deactivateEtag, setDeactivateEtag] = useState<string | null>(null)
  const [deactivationReason, setDeactivationReason] = useState("")
  const [deactivating, setDeactivating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [personnelPage, departmentPage] = await Promise.all([
        personnelApi.list({ active: activeFilter === "ALL" ? undefined : activeFilter === "ACTIVE" }),
        departmentsApi.list(true),
      ])
      setPersonnel(personnelPage.items)
      setDepartments(departmentPage.items)
    } catch (error) {
      toast({ variant: "destructive", title: "Không tải được dữ liệu", description: messageFor(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
    // Filter state intentionally owns API reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter])

  const departmentName = (departmentId?: string | null) =>
    departments.find((department) => department.id === departmentId)?.name ?? "—"

  const visiblePersonnel = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return personnel.filter((entry) => {
      const matchesType = typeFilter === "ALL" || entry.type === typeFilter
      const matchesQuery = !needle || [entry.fullName, entry.displayEmail, entry.staffCode]
        .some((value) => value.toLowerCase().includes(needle))
      return matchesType && matchesQuery
    })
  }, [personnel, query, typeFilter])

  const openCreate = () => {
    setEditing(null)
    setEditingEtag(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  const openEdit = async (entry: Personnel) => {
    setSaving(true)
    try {
      const current = await personnelApi.get(entry.accountId)
      setEditing(current.data)
      setEditingEtag(current.etag ?? `"${current.data.accountVersion}"`)
      setForm(formFromPersonnel(current.data))
      setDialogOpen(true)
    } catch (error) {
      toast({ variant: "destructive", title: "Không mở được hồ sơ", description: messageFor(error) })
    } finally {
      setSaving(false)
    }
  }

  const openDeactivate = async (entry: Personnel) => {
    setDeactivating(true)
    try {
      const current = await personnelApi.get(entry.accountId)
      setDeactivateTarget(current.data)
      setDeactivateEtag(current.etag ?? `"${current.data.accountVersion}"`)
      setDeactivationReason("")
    } catch (error) {
      toast({ variant: "destructive", title: "Không mở được hồ sơ", description: messageFor(error) })
    } finally {
      setDeactivating(false)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const phone = form.type === "DOCTOR" ? canonicalPhone(form.phone) : null
    if (form.type === "DOCTOR" && !phone) {
      toast({ variant: "destructive", title: "Số điện thoại không hợp lệ", description: "Nhập số di động Việt Nam 10 chữ số, bắt đầu bằng 0; ví dụ 0349568452." })
      return
    }

    setSaving(true)
    try {
      if (editing) {
        const payload: PersonnelUpdateRequest = {
          type: form.type,
          staffCode: form.staffCode.trim(),
          fullName: form.fullName.trim(),
          ...(form.type === "DOCTOR" ? { departmentId: form.departmentId ? form.departmentId : null, doctorProfile: doctorProfile(form, phone!) } : {}),
        }
        await personnelApi.update(editing.accountId, payload, editingEtag ?? `"${editing.accountVersion}"`)
        toast({ title: "Đã cập nhật nhân sự", description: "Thông tin nhân sự đã được lưu." })
      } else {
        const payload: PersonnelProvisionRequest = {
          type: form.type,
          email: form.email.trim(),
          initialPassword: form.initialPassword,
          staffCode: form.staffCode.trim(),
          fullName: form.fullName.trim(),
          ...(form.type === "DOCTOR" ? { departmentId: form.departmentId ? form.departmentId : null, doctorProfile: doctorProfile(form, phone!) } : {}),
        }
        await personnelApi.provision(payload)
        toast({ title: "Đã tạo tài khoản", description: "Mật khẩu chỉ được dùng khi tạo và không được hiển thị lại." })
      }
      setDialogOpen(false)
      await load()
    } catch (error) {
      toast({ variant: "destructive", title: editing ? "Không thể cập nhật" : "Không thể tạo tài khoản", description: messageFor(error) })
    } finally {
      setSaving(false)
    }
  }

  const confirmDeactivate = async () => {
    if (!deactivateTarget || !deactivateEtag || !deactivationReason.trim()) return
    setDeactivating(true)
    try {
      await personnelApi.deactivate(deactivateTarget.accountId, deactivationReason.trim(), deactivateEtag)
      toast({ title: "Đã ngừng tài khoản", description: "Tài khoản, phiên đăng nhập và quyền đang hiệu lực đã được vô hiệu hóa." })
      setDeactivateTarget(null)
      await load()
    } catch (error) {
      toast({ variant: "destructive", title: "Không thể ngừng tài khoản", description: messageFor(error) })
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <Card className="gap-0 overflow-hidden animate-slide-in-up">
      <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9 text-sm"
            placeholder="Tìm theo họ tên, email hoặc mã nhân sự..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as PersonnelType | "ALL")}
        >
          <option value="ALL">Tất cả loại</option>
          <option value="DOCTOR">Bác sĩ</option>
          <option value="STAFF">Nhân viên</option>
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value as "ACTIVE" | "INACTIVE" | "ALL")}
        >
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="INACTIVE">Đã ngừng</option>
          <option value="ALL">Tất cả trạng thái</option>
        </select>
        <Button onClick={openCreate} className="h-9 shrink-0 gap-1.5 text-sm">
          <Plus className="h-4 w-4" />
          Tạo tài khoản
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[190px]">Nhân sự</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead className="hidden lg:table-cell">Khoa/phòng ban</TableHead>
              <TableHead className="hidden md:table-cell">Thông tin hành nghề</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" /> Đang tải nhân sự...
                </TableCell>
              </TableRow>
            ) : visiblePersonnel.map((entry) => (
              <TableRow key={entry.accountId} className="hover:bg-secondary/50">
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">{entry.fullName}</span>
                    <span className="text-xs text-muted-foreground">{entry.displayEmail}</span>
                    <span className="text-xs text-muted-foreground">{entry.staffCode}</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary">{typeLabel(entry.type)}</Badge></TableCell>
                <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                  {entry.type === "DOCTOR" ? departmentName(entry.departmentId) : "—"}
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">
                  {entry.type === "DOCTOR" ? (
                    <div className="flex flex-col gap-0.5">
                      <span>{entry.doctorProfile?.professionalTitle || "—"}</span>
                      <span className="text-xs text-muted-foreground">{entry.doctorProfile?.licenseNumber || "—"}</span>
                    </div>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={entry.active && entry.accountStatus === "ACTIVE" ? "default" : "outline"}>{statusLabel(entry)}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={saving || !entry.active} onClick={() => void openEdit(entry)}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Chỉnh sửa {entry.fullName}</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={deactivating || !entry.active} onClick={() => void openDeactivate(entry)}>
                      <Ban className="h-4 w-4" />
                      <span className="sr-only">Ngừng tài khoản {entry.fullName}</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && visiblePersonnel.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Không tìm thấy nhân sự phù hợp.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Cập nhật nhân sự" : "Tạo tài khoản nhân sự"}</DialogTitle>
            <DialogDescription>
              {editing ? "Email và mật khẩu không thể thay đổi trong biểu mẫu này." : "Admin đặt mật khẩu. Mật khẩu không được hiển thị lại sau khi tạo."}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-5 py-2" onSubmit={submit}>
            {!editing && (
              <div className="grid gap-2">
                <Label htmlFor="personnel-type">Loại tài khoản</Label>
                <select
                  id="personnel-type"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as PersonnelType }))}
                >
                  <option value="DOCTOR">Bác sĩ</option>
                  <option value="STAFF">Nhân viên</option>
                </select>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Họ và tên" htmlFor="full-name"><Input id="full-name" required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></Field>
              <Field label="Mã nhân sự" htmlFor="staff-code"><Input id="staff-code" required maxLength={64} value={form.staffCode} onChange={(event) => setForm({ ...form, staffCode: event.target.value })} /></Field>
              {!editing && <Field label="Email đăng nhập" htmlFor="personnel-email"><Input id="personnel-email" type="email" required maxLength={320} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>}
              {!editing && <Field label="Mật khẩu ban đầu" htmlFor="initial-password"><Input id="initial-password" type="password" required minLength={6} maxLength={128} autoComplete="new-password" value={form.initialPassword} onChange={(event) => setForm({ ...form, initialPassword: event.target.value })} /></Field>}
            </div>

            {form.type === "DOCTOR" && (
              <div className="grid gap-5 border-t border-border pt-5">
                <div className="flex items-center gap-2 text-sm font-semibold"><UserRoundCog className="h-4 w-4" /> Hồ sơ hành nghề</div>
                <Field label="Khoa/phòng ban" htmlFor="department-id">
                  <select
                    id="department-id"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.departmentId}
                    onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
                  >
                    <option value="">Chưa vào chuyên khoa nào</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name} ({department.code})
                      </option>
                    ))}
                  </select>
                </Field>
                {departments.length === 0 && <p className="text-sm text-destructive">Không có khoa/phòng ban đang hoạt động hoặc tài khoản chưa có quyền đọc danh mục.</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Số điện thoại Việt Nam" htmlFor="phone"><div className="grid gap-1"><Input id="phone" required type="tel" inputMode="numeric" autoComplete="tel" placeholder="0349568452" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /><p className="text-xs text-muted-foreground">Nhập số di động bắt đầu bằng 0. Hệ thống lưu dạng +84.</p></div></Field>
                  <Field label="Ngày sinh" htmlFor="date-of-birth"><Input id="date-of-birth" required type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} /></Field>
                  <Field label="Giới tính" htmlFor="gender"><select id="gender" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as PersonnelForm["gender"] })}><option value="UNSPECIFIED">Chưa xác định</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></Field>
                  <Field label="Số năm kinh nghiệm" htmlFor="years-experience"><Input id="years-experience" required type="number" min={0} max={80} value={form.yearsExperience} onChange={(event) => setForm({ ...form, yearsExperience: event.target.value })} /></Field>
                  <Field label="Chức danh chuyên môn" htmlFor="professional-title"><Input id="professional-title" required maxLength={200} value={form.professionalTitle} onChange={(event) => setForm({ ...form, professionalTitle: event.target.value })} /></Field>
                  <Field label="Học vị" htmlFor="academic-degree"><Input id="academic-degree" required maxLength={200} value={form.academicDegree} onChange={(event) => setForm({ ...form, academicDegree: event.target.value })} /></Field>
                  <Field label="Chuyên ngành" htmlFor="specialty-designation"><Input id="specialty-designation" required maxLength={200} value={form.specialtyDesignation} onChange={(event) => setForm({ ...form, specialtyDesignation: event.target.value })} /></Field>
                  <Field label="Số giấy phép hành nghề" htmlFor="license-number"><Input id="license-number" required maxLength={128} value={form.licenseNumber} onChange={(event) => setForm({ ...form, licenseNumber: event.target.value })} /></Field>
                  <Field label="Cơ quan cấp phép" htmlFor="licensing-authority"><Input id="licensing-authority" required maxLength={200} value={form.licensingAuthority} onChange={(event) => setForm({ ...form, licensingAuthority: event.target.value })} /></Field>
                  <Field label="Ngày cấp giấy phép" htmlFor="license-issued-on"><Input id="license-issued-on" required type="date" value={form.licenseIssuedOn} onChange={(event) => setForm({ ...form, licenseIssuedOn: event.target.value })} /></Field>
                  <Field label="Ngày hết hạn" htmlFor="license-expires-on"><Input id="license-expires-on" type="date" value={form.licenseExpiresOn} onChange={(event) => setForm({ ...form, licenseExpiresOn: event.target.value })} /></Field>
                  <Field label="URL ảnh đại diện" htmlFor="avatar-url"><Input id="avatar-url" type="url" maxLength={2048} value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} /></Field>
                </div>
                <Field label="Địa chỉ" htmlFor="address"><Textarea id="address" required maxLength={1000} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
                <Field label="Giới thiệu" htmlFor="biography"><Textarea id="biography" maxLength={4000} value={form.biography} onChange={(event) => setForm({ ...form, biography: event.target.value })} /></Field>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setDialogOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={saving}>
                {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Lưu thay đổi" : "Tạo tài khoản"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deactivateTarget)} onOpenChange={(open) => !deactivating && !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ngừng tài khoản nhân sự?</AlertDialogTitle>
            <AlertDialogDescription>
              Tài khoản của &quot;{deactivateTarget?.fullName}&quot; sẽ không thể đăng nhập. Phiên, thông tin xác thực và quyền đang hiệu lực sẽ bị vô hiệu hóa; dữ liệu lịch sử được giữ lại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="deactivation-reason">Lý do ngừng tài khoản</Label>
            <Textarea id="deactivation-reason" required maxLength={500} value={deactivationReason} onChange={(event) => setDeactivationReason(event.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deactivating || !deactivationReason.trim()} onClick={(event) => { event.preventDefault(); void confirmDeactivate() }}>
              {deactivating && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Ngừng tài khoản
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div className="grid gap-2"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>
}
