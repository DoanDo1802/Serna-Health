"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { X, User, Briefcase, GraduationCap, Phone, Stethoscope, FileText, Trophy, Upload } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/base/ui/avatar"
import { doctorsApi, specialtiesApi } from "@/lib/api"
import { AVATARS_BUCKET, getSupabaseClient } from "@/lib/supabase"
import type { DoctorProfileRequest } from "@/types/medical"

interface DoctorProfileModalProps {
  isOpen: boolean
  onClose: () => void
  currentDoctor: any
  onSave: (updatedData: any) => void
}

const degrees = [
  "Bác sĩ (BS)",
  "Thạc sĩ (ThS)",
  "Tiến sĩ (TS)",
  "Bác sĩ CKI (BS.CKI)",
  "Bác sĩ CKII (BS.CKII)",
  "Phó Giáo sư (PGS.TS)",
  "Giáo sư (GS.TS)",
]

const experienceYears = Array.from({ length: 41 }, (_, i) => i)
const avatarMaxSize = 2 * 1024 * 1024
const allowedAvatarTypes = ["image/jpeg", "image/png", "image/webp"]

const avatarExtension = (type: string) => {
  if (type === "image/png") return "png"
  if (type === "image/webp") return "webp"
  return "jpg"
}

export function DoctorProfileModal({ isOpen, onClose, currentDoctor, onSave }: DoctorProfileModalProps) {
  const [doctorId, setDoctorId] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [degree, setDegree] = useState("")
  const [specialtyId, setSpecialtyId] = useState("")
  const [experience, setExperience] = useState("")
  const [bio, setBio] = useState("")
  const [achievements, setAchievements] = useState("")
  const [specialties, setSpecialties] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const selectedSpecialtyExists = useMemo(
    () => specialties.some((specialty) => String(specialty.id) === specialtyId),
    [specialties, specialtyId],
  )

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    async function loadProfile() {
      setLoading(true)
      setError("")

      try {
        const [doctorProfile, specialtyResponses] = await Promise.all([
          doctorsApi.getProfile(),
          specialtiesApi.list(),
        ])

        if (cancelled) return

        const profileSpecialtyId = doctorProfile.specialtyId ? String(doctorProfile.specialtyId) : ""
        const profileSpecialtyName = doctorProfile.specialtyName ?? currentDoctor?.specialtyName ?? "Chuyên khoa hiện tại"
        const nextSpecialties = specialtyResponses.some((specialty: any) => String(specialty.id) === profileSpecialtyId)
          ? specialtyResponses
          : profileSpecialtyId
            ? [...specialtyResponses, { id: profileSpecialtyId, name: `${profileSpecialtyName} (Tạm ngừng)` }]
            : specialtyResponses

        setSpecialties(nextSpecialties)
        setDoctorId(String(doctorProfile.id ?? currentDoctor?.doctorId ?? currentDoctor?.id ?? ""))
        setAvatarUrl(doctorProfile.avatar ?? doctorProfile.avatarUrl ?? "")
        setName(doctorProfile.name ?? doctorProfile.doctorName ?? currentDoctor?.name ?? "")
        setPhone(doctorProfile.phone ?? "")
        setDegree(doctorProfile.title ?? doctorProfile.degree ?? "")
        setSpecialtyId(profileSpecialtyId)
        setBio(doctorProfile.bio ?? "")
        setAchievements(Array.isArray(doctorProfile.achievements) ? doctorProfile.achievements.join("\n") : "")
        setExperience(
          doctorProfile.experience !== undefined && doctorProfile.experience !== null
            ? String(doctorProfile.experience)
            : doctorProfile.experienceYears !== undefined && doctorProfile.experienceYears !== null
              ? String(doctorProfile.experienceYears)
              : "",
        )
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Không thể tải hồ sơ bác sĩ")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [currentDoctor?.name, isOpen])

  if (!isOpen) return null

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return

    if (!allowedAvatarTypes.includes(file.type)) {
      setError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP")
      return
    }

    if (file.size > avatarMaxSize) {
      setError("Ảnh đại diện không được vượt quá 2MB")
      return
    }

    const extension = avatarExtension(file.type)
    const owner = doctorId || currentDoctor?.doctorId || currentDoctor?.id || "self"
    const filePath = `doctors/${owner}/${Date.now()}-${crypto.randomUUID()}.${extension}`

    setUploadingAvatar(true)
    setError("")

    try {
      const supabase = getSupabaseClient()
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(filePath)
      setAvatarUrl(data.publicUrl)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Không thể tải ảnh đại diện lên")
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Vui lòng nhập họ và tên")
      return
    }

    if (!selectedSpecialtyExists) {
      setError("Vui lòng chọn chuyên khoa có trong danh sách")
      return
    }

    const achievementItems = achievements
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)

    const payload: DoctorProfileRequest = {
      name: name.trim(),
      specialtyId: Number(specialtyId),
      title: degree || undefined,
      bio: bio.trim() || undefined,
      phone: phone.trim() || undefined,
      experience: experience === "" ? undefined : Number(experience),
      avatarUrl: avatarUrl.trim() || undefined,
      achievements: achievementItems,
    }

    setSaving(true)
    setError("")

    try {
      const updatedDoctor = await doctorsApi.updateProfile(payload)
      onSave(updatedDoctor)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu hồ sơ bác sĩ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-2xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Cập nhật Hồ sơ Y khoa
          </h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Đang tải hồ sơ bác sĩ...
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center justify-center gap-3 pb-4 border-b border-border/50">
                <Avatar className="w-24 h-24 border-4 border-background shadow-md">
                  <AvatarImage src={avatarUrl || "/placeholder.svg"} alt="Avatar" className="object-cover" />
                  <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                    {name?.charAt(0) || "BS"}
                  </AvatarFallback>
                </Avatar>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleAvatarFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar || saving || loading}
                  className="flex items-center gap-2 text-xs font-medium bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-3 h-3" />
                  {uploadingAvatar ? "Đang tải ảnh..." : "Tải ảnh lên"}
                </button>
                <p className="text-[11px] text-muted-foreground">Hỗ trợ JPG, PNG, WebP. Tối đa 2MB.</p>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Họ và tên
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="VD: Nguyễn Văn An"
                      className="w-full border rounded-md p-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Số điện thoại
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="VD: 0912 345 678"
                      className="w-full border rounded-md p-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5" /> Học vị
                    </label>
                    <select
                      value={degree}
                      onChange={(e) => setDegree(e.target.value)}
                      className="w-full border rounded-md p-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">-- Chọn học vị --</option>
                      {degrees.map((degreeOption) => (
                        <option key={degreeOption} value={degreeOption}>
                          {degreeOption}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5" /> Chuyên khoa
                    </label>
                    <select
                      value={specialtyId}
                      onChange={(e) => setSpecialtyId(e.target.value)}
                      className="w-full border rounded-md p-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">-- Chọn chuyên khoa --</option>
                      {specialties.map((specialty) => (
                        <option key={specialty.id} value={String(specialty.id)}>
                          {specialty.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" /> Số năm làm việc
                  </label>
                  <select
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full md:w-1/2 border rounded-md p-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">-- Chọn số năm --</option>
                    {experienceYears.map((year) => (
                      <option key={year} value={String(year)}>
                        {year} năm
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Tiểu sử bác sĩ
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Giới thiệu ngắn về kinh nghiệm, chuyên môn, thế mạnh điều trị..."
                    rows={4}
                    maxLength={2000}
                    className="w-full border rounded-md p-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/50"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Tối đa 2000 ký tự.</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5" /> Thành tựu
                  </label>
                  <textarea
                    value={achievements}
                    onChange={(e) => setAchievements(e.target.value)}
                    placeholder="Nhập mỗi thành tựu trên một dòng. Ví dụ:\nBác sĩ xuất sắc năm 2024\nThành viên Hội Tim mạch Việt Nam"
                    rows={4}
                    maxLength={2000}
                    className="w-full border rounded-md p-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/50"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Mỗi dòng là một thành tựu. Tối đa 2000 ký tự.</p>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-border bg-secondary/10">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium bg-background border text-foreground rounded-md hover:bg-secondary transition-colors">
            Hủy bỏ
          </button>
          <button
            onClick={handleSave}
            disabled={loading || saving || uploadingAvatar || !selectedSpecialtyExists || !name.trim()}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Đang lưu..." : "Lưu hồ sơ"}
          </button>
        </div>
      </div>
    </div>
  )
}
