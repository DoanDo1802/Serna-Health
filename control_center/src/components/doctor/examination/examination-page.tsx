"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/base/ui/dialog"
import PatientInfo from "../patient/PatientInfo";
import ExaminationForm from "./ExaminationForm";
import PrescriptionSection from "../prescription/PrescriptionSection";
import {
  ArrowLeft,
  Save,
  Eye,
  Printer,
  AlertCircle,
  History,
  Lightbulb,
  Sparkles,
  User,
  Check,
  Bot,
  Send,
  FileText,
  Activity,
  Pill,
} from "lucide-react";
import ExaminationPrintPreview from "./examination-print-preview"
import { ChatInput, ChatInputTextArea, ChatInputSubmit } from "@/components/base/ui/chat-input"
import { Button } from "@/components/base/ui/button"
import { Input } from "@/components/base/ui/input"
import { Textarea } from "@/components/base/ui/textarea"
import { Checkbox } from "@/components/base/ui/checkbox"
import { Card } from "@/components/base/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/base/ui/select"
import { useData } from "@/components/base/providers/data-provider"
import { useAuth } from "@/components/base/providers/auth-provider"
import type { Appointment, Patient, Specialty, SpecialtyExamTemplateField } from "@/types/medical"
import { useReactToPrint } from "react-to-print"
import { useRef } from "react"
import { receptionApi, clinicalCareApi, aiApi, treatmentTemplatesApi, type ClinicalNote, type ClinicalNoteVersion } from "@/lib/api"
import { ExamTemplateRenderer } from "@/components/shared/exam-template-renderer"

const parseBoldItalicAndArrows = (text: string): React.ReactNode[] => {
  const cleanText = text.replace(/->/g, "→");
  const boldParts = cleanText.split(/\*\*([^*]+)\*\*/g);
  return boldParts.flatMap((boldPart, boldIndex) => {
    const isBold = boldIndex % 2 === 1;
    const italicParts = boldPart.split(/\*([^*]+)\*/g);
    const renderedItalics = italicParts.map((italicPart, italicIndex) => {
      const isItalic = italicIndex % 2 === 1;
      if (isItalic) {
        return (
          <em key={`italic-${italicIndex}`} className="italic not-bold font-normal">
            {italicPart}
          </em>
        );
      }
      return italicPart;
    });
    if (isBold) {
      return (
        <strong key={`bold-${boldIndex}`} className="font-bold text-foreground">
          {renderedItalics}
        </strong>
      );
    }
    return renderedItalics;
  });
};

const renderMessageText = (text: string): React.ReactNode => {
  if (!text) return null;
  const lines = text.split("\n");
  const renderedElements: React.ReactNode[] = [];
  let currentListItems: { type: "ordered" | "unordered"; content: React.ReactNode; key: number }[] = [];
  const flushList = (key: number) => {
    if (currentListItems.length > 0) {
      const listType = currentListItems[0].type;
      if (listType === "unordered") {
        renderedElements.push(
          <ul key={`ul-${key}`} className="list-disc pl-5 my-1 space-y-0.5">
            {currentListItems.map((item) => (
              <li key={item.key} className="text-sm leading-relaxed">
                {item.content}
              </li>
            ))}
          </ul>
        );
      } else {
        renderedElements.push(
          <ol key={`ol-${key}`} className="list-decimal pl-5 my-1 space-y-0.5">
            {currentListItems.map((item) => (
              <li key={item.key} className="text-sm leading-relaxed">
                {item.content}
              </li>
            ))}
          </ol>
        );
      }
      currentListItems = [];
    }
  };
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(index);
      renderedElements.push(<div key={`empty-${index}`} className="h-2" />);
      return;
    }
    const unorderedMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (unorderedMatch) {
      const content = parseBoldItalicAndArrows(unorderedMatch[2]);
      currentListItems.push({ type: "unordered", content, key: index });
      return;
    }
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (orderedMatch) {
      const content = parseBoldItalicAndArrows(orderedMatch[2]);
      currentListItems.push({ type: "ordered", content, key: index });
      return;
    }
    flushList(index);
    const headerMatch = trimmed.match(/^\*\*(.*)\*\*$/);
    if (headerMatch) {
      renderedElements.push(
        <p key={`header-${index}`} className="font-bold text-sm mt-3 mb-1 first:mt-0">
          {parseBoldItalicAndArrows(headerMatch[1])}
        </p>
      );
    } else {
      renderedElements.push(
        <p key={`p-${index}`} className="text-sm leading-relaxed">
          {parseBoldItalicAndArrows(line)}
        </p>
      );
    }
  });
  flushList(lines.length);
  return <div className="space-y-1">{renderedElements}</div>;
};

interface ExaminationPageProps {
  patient: Patient
  appointment?: Appointment | null
  specialty?: Specialty
  encounterId?: string
}

export function ExaminationPage({ patient, appointment, specialty, encounterId }: ExaminationPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const {
    icdCodes,
    medicines,
    addExaminationRecord,
    addPrescription,
    updateAppointment,
    updatePatient,
    examinationRecords,
    prescriptions,
    ensureMedicinesLoaded,
    ensureIcdLoaded
  } = useData()

  useEffect(() => {
    ensureMedicinesLoaded()
    ensureIcdLoaded()
  }, [ensureMedicinesLoaded, ensureIcdLoaded])

  const [resolvedEncounterId, setResolvedEncounterId] = useState<string | undefined>(encounterId)
  const [encounterEtag, setEncounterEtag] = useState<string>("\"0\"")
  const [activeNote, setActiveNote] = useState<ClinicalNote | null>(null)
  const [activeVersion, setActiveVersion] = useState<ClinicalNoteVersion | null>(null)
  const [versionEtag, setVersionEtag] = useState<string>("\"0\"")

  const [icdCode, setIcdCode] = useState("")
  const [mainDiagnosis, setMainDiagnosis] = useState("")
  const [symptoms, setSymptoms] = useState("")
  const [physicalExam, setPhysicalExam] = useState("")
  const [testResults, setTestResults] = useState("")
  const [specialtyExamValues, setSpecialtyExamValues] = useState<Record<string, unknown>>({})

  useEffect(() => {
    setSpecialtyExamValues({})
  }, [specialty?.id])

  useEffect(() => {
    if (encounterId) setResolvedEncounterId(encounterId)
  }, [encounterId])

  // Nạp hoặc khởi tạo Encounter và hồ sơ khám từ backend
  useEffect(() => {
    let active = true
    const initEncounterAndNote = async () => {
      try {
        let currentEncounterId = encounterId || resolvedEncounterId
        let currentEtag = "\"0\""

        if (!currentEncounterId && appointment?.id) {
          try {
            const checkInRes = await receptionApi.checkIn(appointment.id, "Bắt đầu lượt khám")
            if (checkInRes?.encounter) {
              currentEncounterId = checkInRes.encounter.id
              currentEtag = `"${checkInRes.encounter.version}"`
              if (active) {
                setResolvedEncounterId(currentEncounterId)
                setEncounterEtag(currentEtag)
              }
            }
          } catch (e) {
            console.warn("Không thể tự động check-in qua receptionApi:", e)
          }
        } else if (currentEncounterId) {
          try {
            const encRes = await receptionApi.getEncounter(currentEncounterId)
            if (encRes?.data && active) {
              currentEtag = encRes.etag || `"${encRes.data.version}"`
              setEncounterEtag(currentEtag)
            }
          } catch (e) {
            console.warn("Không thể tải thông tin encounter:", e)
          }
        }

        if (currentEncounterId) {
          const notesPage = await clinicalCareApi.listEncounterNotes(currentEncounterId)
          const examNote = notesPage?.items?.find((n) => n.noteType === "EXAMINATION")
          if (examNote && active) {
            setActiveNote(examNote)
            if (examNote.currentVersionId) {
              const vRes = await clinicalCareApi.getNoteVersion(examNote.currentVersionId)
              if (vRes?.data && active) {
                setActiveVersion(vRes.data)
                setVersionEtag(vRes.etag || `"${vRes.data.version}"`)
                const content = vRes.data.content as any
                if (content) {
                  if (content.symptoms) setSymptoms(content.symptoms)
                  if (content.physicalExamination) setPhysicalExam(content.physicalExamination)
                  if (content.testResults) setTestResults(content.testResults)
                  if (content.mainDiagnosis) setMainDiagnosis(content.mainDiagnosis)
                  if (content.icdCode) setIcdCode(content.icdCode)
                  if (content.careAdvice) setTreatment(content.careAdvice)
                  if (content.followUpDate) setFollowUpDate(content.followUpDate)
                  if (content.clinicalNote) setExaminationNotes(content.clinicalNote)
                  if (Array.isArray(content.medicines) && content.medicines.length > 0) {
                    setPrescriptionItems(content.medicines.map((m: any) => ({
                      medicineId: String(m.medicineId),
                      medicineName: m.medicineName,
                      quantity: m.quantity,
                      unit: m.unit || "Viên",
                      dosage: m.dosage || m.dosageInstruction || "",
                      notes: m.notes || "",
                      isFromTemplate: Boolean(m.isFromTemplate),
                    })))
                  }
                  if (content.additionalData?.specialtyExamValues) {
                    setSpecialtyExamValues(content.additionalData.specialtyExamValues)
                  }
                  if (content.additionalData?.prescriptionNotes) {
                    setPrescriptionNotes(content.additionalData.prescriptionNotes)
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("Không thể nạp hồ sơ khám từ backend:", err)
      }
    }

    initEncounterAndNote()
    return () => {
      active = false
    }
  }, [encounterId, appointment?.id])

  const [previewMode, setPreviewMode] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const [treatment, setTreatment] = useState("")
  const [followUpDate, setFollowUpDate] = useState("")
  const [examinationNotes, setExaminationNotes] = useState("")
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: `Xin chào bác sĩ 👋

Tôi hỗ trợ cung cấp thông tin tham khảo nhanh cho bác sĩ:
• Tóm tắt lịch sử khám của bệnh nhân
• Hướng dẫn tra cứu phân loại mã ICD-10
• Cung cấp tài liệu y khoa tham khảo nhanh`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Auto scroll to bottom of chat when new message or chunk arrives (local scroll only)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, isAiLoading]);

  const handleSendMessage = async () => {
    if (!input.trim() || isAiLoading) return;

    const question = input.trim();
    setInput("");

    setMessages((prev) => [
      ...prev,
      {
        sender: "doctor",
        text: question,
      },
    ]);

    setIsAiLoading(true);

    try {
      const historyPayload = messages
        .filter((_, idx) => idx > 0)
        .map((m) => ({
          role: m.sender === "doctor" ? "user" : "assistant",
          content: m.text,
        }))
        .slice(-10);

      const res = await aiApi.doctorChat({
        message: question,
        history: historyPayload,
        appointmentId: appointment?.id ? parseInt(appointment.id, 10) : undefined,
        patientCode: patient?.patientCode,
      });

      const replyText = res.reply || "AI không phản hồi.";
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "",
        },
      ]);

      let currentLength = 0;
      const speed = 10; // ms per tick
      const charsPerTick = 3; // chars printed per tick
      const timer = setInterval(() => {
        currentLength += charsPerTick;
        if (currentLength >= replyText.length) {
          clearInterval(timer);
          setMessages((prev) => {
            const copy = [...prev];
            if (copy.length > 0) {
              copy[copy.length - 1] = {
                ...copy[copy.length - 1],
                text: replyText,
              };
            }
            return copy;
          });
        } else {
          const part = replyText.substring(0, currentLength);
          setMessages((prev) => {
            const copy = [...prev];
            if (copy.length > 0) {
              copy[copy.length - 1] = {
                ...copy[copy.length - 1],
                text: part,
              };
            }
            return copy;
          });
        }
      }, speed);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `❌ Đã xảy ra lỗi: ${err.message || "Không thể kết nối tới dịch vụ AI."}`,
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const sendQuickQuestion = (question: string) => {
    setInput(question);
  };
  const [prescriptionItems, setPrescriptionItems] = useState<
    Array<{ medicineId: string; medicineName: string; quantity: number; unit: string; dosage: string; notes?: string; isFromTemplate?: boolean }>
  >([])
  const [prescriptionNotes, setPrescriptionNotes] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [treatmentTemplates, setTreatmentTemplates] = useState<Array<{ id: string; templateName: string; description?: string; details?: Array<{ medicineId: number; medicineName?: string; quantity: number; unit?: string; dosage: string }> }>>([])
  const [isCompleting, setIsCompleting] = useState(false)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [selectedTemplatePreview, setSelectedTemplatePreview] = useState<null | {
    id: string
    templateName: string
    description?: string
    details: Array<{ medicineId: number; medicineName?: string; quantity: number; unit?: string; dosage: string }>
  }>(null)
  const [selectedMedicineId, setSelectedMedicineId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [dosage, setDosage] = useState("")
  const [medicineNotes, setMedicineNotes] = useState("")

  const selectedIcd = icdCodes.find((c) => c.id === icdCode)

  useEffect(() => {
    const loadTemplates = async () => {
      if (!selectedIcd?.code) {
        setTreatmentTemplates([])
        setSelectedTemplateId("")
        return
      }

      try {
        const templates = await treatmentTemplatesApi.list({ icd10Code: selectedIcd.code })
        setTreatmentTemplates(
          (templates || []).map((template: any) => ({
            id: String(template.id),
            templateName: template.templateName,
            description: template.description,
            details: (template.details || []).map((detail: any) => ({
              medicineId: detail.medicineId,
              medicineName: detail.medicineName,
              quantity: detail.quantity ?? 1,
              unit: detail.unit,
              dosage: detail.dosage ?? "",
            })),
          }))
        )
      } catch (error) {
        console.error("Không thể tải combo thuốc", error)
        setTreatmentTemplates([])
      }
    }

    void loadTemplates()
  }, [selectedIcd?.code])
  const selectedMedicine = medicines.find((m) => m.id === selectedMedicineId)
  const specialtyFields = specialty?.examTemplate?.fields ?? []

  const setSpecialtyExamValue = (fieldId: string, value: unknown) => {
    setSpecialtyExamValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  const isSpecialtyFieldEmpty = (field: SpecialtyExamTemplateField) => {
    const value = specialtyExamValues[field.id]
    if (field.type === "checkbox") return value !== true
    return value === undefined || value === null || String(value).trim() === ""
  }

  const renderSpecialtyField = (field: SpecialtyExamTemplateField) => {
    const value = specialtyExamValues[field.id]
    const label = `${field.label}${field.required ? " *" : ""}`

    if (field.type === "textarea") {
      return (
        <Textarea
          value={String(value ?? "")}
          onChange={(e) => setSpecialtyExamValue(field.id, e.target.value)}
          placeholder={`Nhập ${field.label.toLowerCase()}`}
          rows={3}
          className="w-full bg-card"
        />
      )
    }

    if (field.type === "number") {
      return (
        <Input
          type="number"
          value={String(value ?? "")}
          onChange={(e) => setSpecialtyExamValue(field.id, e.target.value)}
          placeholder={`Nhập ${field.label.toLowerCase()}`}
          className="w-full bg-card"
        />
      )
    }

    if (field.type === "select") {
      return (
        <Select value={String(value ?? "")} onValueChange={(nextValue) => setSpecialtyExamValue(field.id, nextValue)}>
          <SelectTrigger className="w-full bg-card">
            <SelectValue placeholder={`Chọn ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    if (field.type === "checkbox") {
      return (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox
            checked={value === true}
            onCheckedChange={(checked) => setSpecialtyExamValue(field.id, checked === true)}
          />
          {label}
        </label>
      )
    }

    return (
      <Input
        value={String(value ?? "")}
        onChange={(e) => setSpecialtyExamValue(field.id, e.target.value)}
        placeholder={`Nhập ${field.label.toLowerCase()}`}
        className="w-full bg-card"
      />
    )
  }

  const handleAddMedicine = () => {
    if (selectedMedicineId && selectedMedicine && quantity && dosage) {
      setPrescriptionItems((prev) => [
        ...prev,
        {
          medicineId: selectedMedicineId,
          medicineName: selectedMedicine.name,
          quantity: parseInt(quantity),
          unit: selectedMedicine.unit,
          dosage,
          notes: medicineNotes,
          isFromTemplate: false,
        },
      ])
      setSelectedMedicineId("")
      setQuantity("")
      setDosage("")
      setMedicineNotes("")
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    const template = treatmentTemplates.find((item) => item.id === templateId)
    if (!template) return

    setSelectedTemplateId(templateId)
    setSelectedTemplatePreview({
      id: template.id,
      templateName: template.templateName,
      description: template.description,
      details: (template.details || []).map((detail) => ({
        medicineId: detail.medicineId,
        medicineName: detail.medicineName,
        quantity: detail.quantity,
        unit: detail.unit,
        dosage: detail.dosage,
      })),
    })
    setIsTemplateModalOpen(true)
  }

  const applyTemplateToPrescription = () => {
    if (!selectedTemplatePreview) return

    const itemsToAdd = selectedTemplatePreview.details
      .filter((detail) => detail.medicineId && detail.medicineName)
      .map((detail) => ({
        medicineId: String(detail.medicineId),
        medicineName: detail.medicineName || "Thuốc",
        quantity: detail.quantity || 1,
        unit: detail.unit || "viên",
        dosage: detail.dosage || "",
        notes: "",
        isFromTemplate: true,
      }))

    if (itemsToAdd.length > 0) {
      setPrescriptionItems((prev) => [...prev, ...itemsToAdd])
    }

    setSelectedTemplateId("")
    setSelectedTemplatePreview(null)
    setIsTemplateModalOpen(false)
  }

  const removeTemplatePreviewMedicine = (index: number) => {
    setSelectedTemplatePreview((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        details: prev.details.filter((_, detailIndex) => detailIndex !== index),
      }
    })
  }

  const handleRemoveMedicine = (index: number) => {
    setPrescriptionItems((prev) => prev.filter((_, i) => i !== index))
  }
  const handlePrint = () => {
    console.log(printRef.current);

    if (!printRef.current) {
      toast({
        title: "Lỗi in ấn",
        description: "Không thể in phiếu khám do thiếu tham chiếu bản in.",
        variant: "destructive",
      })
      return;
    }

    reactToPrint();
  };
  const reactToPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `PhieuKham_${patient.name}`,
  });
  const handleSaveExamination = async (complete: boolean = false) => {
    if (complete) {
      if (!icdCode || !mainDiagnosis || !symptoms || !physicalExam || !treatment) {
        toast({
          title: "Thiếu thông tin bắt buộc",
          description: "Vui lòng điền đầy đủ các trường: Triệu chứng, Khám lâm sàng, Chẩn đoán, Hướng điều trị",
          variant: "destructive",
        })
        return
      }
      const missingSpecialtyField = specialtyFields.find((field) => field.required && isSpecialtyFieldEmpty(field))
      if (missingSpecialtyField) {
        toast({
          title: "Thiếu thông tin chuyên khoa",
          description: `Vui lòng điền mục chuyên khoa bắt buộc: ${missingSpecialtyField.label}`,
          variant: "destructive",
        })
        return
      }
    } else {
      if (!symptoms && !mainDiagnosis) {
        toast({
          title: "Thiếu thông tin",
          description: "Vui lòng nhập ít nhất triệu chứng hoặc chẩn đoán để lưu nháp",
          variant: "destructive",
        })
        return
      }
    }

    const today = new Date().toISOString().split("T")[0]
    const appointmentRecordId = appointment?.id || "temp-appt"
    const doctorId = user?.doctorId ? String(user.doctorId) : (appointment?.doctorId ?? "dr1")

    try {
      if (complete) setIsCompleting(true)

      // 1. Ensure encounter is checked in & started
      let currentEncounterId = resolvedEncounterId
      let currentEncounterEtag = encounterEtag

      if (!currentEncounterId && appointment?.id) {
        try {
          const checkInRes = await receptionApi.checkIn(appointment.id, "Bắt đầu lượt khám")
          if (checkInRes?.encounter) {
            currentEncounterId = checkInRes.encounter.id
            currentEncounterEtag = `"${checkInRes.encounter.version}"`
            setResolvedEncounterId(currentEncounterId)
            setEncounterEtag(currentEncounterEtag)
            if (checkInRes.encounter.status === "PLANNED") {
              const startRes = await receptionApi.startEncounter(currentEncounterId, currentEncounterEtag)
              currentEncounterEtag = startRes.etag || `"${startRes.data.version}"`
              setEncounterEtag(currentEncounterEtag)
            }
          }
        } catch (e) {
          console.warn("Không thể check-in/start encounter:", e)
        }
      }

      if (!currentEncounterId) {
        toast({
          title: "Lỗi phiên khám",
          description: "Không tìm thấy phiên khám hợp lệ (Encounter). Vui lòng thử lại.",
          variant: "destructive",
        })
        return
      }

      const noteContent = {
        symptoms,
        physicalExamination: physicalExam,
        testResults: testResults || undefined,
        mainDiagnosis: selectedIcd?.name || mainDiagnosis,
        icdCode: selectedIcd?.code ?? icdCode,
        clinicalNote: examinationNotes || undefined,
        historySummary: appointment?.symptomsInitial || undefined,
        careAdvice: treatment,
        followUpDate: followUpDate || undefined,
        diagnoses: (selectedIcd?.code || icdCode)
          ? [{ icd10Code: selectedIcd?.code ?? icdCode, isPrimary: true }]
          : [],
        medicines: prescriptionItems.map((item) => ({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          quantity: item.quantity,
          unit: item.unit,
          dosageInstruction: [item.dosage, item.notes].filter(Boolean).join(" - "),
          dosage: item.dosage,
          notes: item.notes,
          isFromTemplate: Boolean(item.isFromTemplate),
        })),
        additionalData: {
          specialtyExamValues,
          specialtyExamTemplate: specialty?.examTemplate,
          prescriptionNotes,
        },
      }

      let curVersionId = activeVersion?.id
      let curVersionEtag = versionEtag

      // 2. Create or Update draft note
      if (curVersionId && activeVersion?.status === "DRAFT") {
        const updateRes = await clinicalCareApi.updateDraft(curVersionId, curVersionEtag, {
          contentSchemaVersion: "1.0",
          content: noteContent,
        })
        curVersionEtag = updateRes.etag || `"${updateRes.data.version}"`
        setActiveVersion(updateRes.data)
        setVersionEtag(curVersionEtag)
      } else {
        const createRes = await clinicalCareApi.createNote(currentEncounterId, {
          noteType: "EXAMINATION",
          contentSchemaVersion: "1.0",
          content: noteContent,
        })
        setActiveNote(createRes.data)
        if (createRes.data.currentVersion) {
          curVersionId = createRes.data.currentVersion.id
          curVersionEtag = `"${createRes.data.currentVersion.version}"`
          setActiveVersion(createRes.data.currentVersion)
          setVersionEtag(curVersionEtag)
        }
      }

      // Save in local cache for current session
      addExaminationRecord({
        appointmentId: appointmentRecordId,
        patientId: patient.id,
        doctorId,
        examinationDate: today,
        icdCode: selectedIcd?.code ?? icdCode,
        mainDiagnosis: selectedIcd?.name || mainDiagnosis,
        symptoms,
        physicalExamination: physicalExam,
        testResults: testResults || undefined,
        treatment,
        followUpDate: followUpDate || undefined,
        notes: examinationNotes,
        specialtyExamValues,
        specialtyExamTemplate: specialty?.examTemplate,
        createdAt: today,
      })

      if (prescriptionItems.length > 0) {
        addPrescription({
          appointmentId: appointmentRecordId,
          patientId: patient.id,
          doctorId,
          prescriptionDate: today,
          items: prescriptionItems,
          notes: prescriptionNotes,
          status: complete ? "issued" : "draft",
        })
      }

      // 3. If completing, finalize note & complete encounter
      if (complete) {
        if (!curVersionId) {
          throw new Error("Không thể xác định phiên bản hồ sơ để hoàn thành")
        }
        const finRes = await clinicalCareApi.finalizeNote(curVersionId, curVersionEtag)
        setActiveVersion(finRes.data)
        setVersionEtag(finRes.etag || `"${finRes.data.version}"`)

        await receptionApi.completeEncounter(currentEncounterId, currentEncounterEtag)

        if (appointment?.id) {
          await updateAppointment(appointment.id, {
            ...appointment,
            status: "COMPLETED",
          })
        }
        await updatePatient(patient.id, {
          ...patient,
          status: "completed",
        })

        toast({
          title: "Hoàn thành khám bệnh",
          description: "Hồ sơ khám bệnh đã được ký hoàn thành và lưu trữ bền vững.",
        })
        router.push("/doctor/patient-records")
      } else {
        if (appointment?.id) {
          await updateAppointment(appointment.id, {
            ...appointment,
            status: "IN_PROGRESS",
          })
        }
        await updatePatient(patient.id, {
          ...patient,
          status: "in-examination",
        })
        toast({
          title: "Đã lưu nháp",
          description: "Thông tin khám bệnh đã được lưu nháp trên hệ thống.",
        })
      }
    } catch (error: any) {
      console.error("Không thể lưu khám bệnh", error)
      toast({
        title: "Lỗi hệ thống",
        description: error?.message || (complete ? "Không thể hoàn thành khám bệnh. Vui lòng thử lại." : "Không thể lưu khám bệnh. Vui lòng thử lại."),
        variant: "destructive",
      })
    } finally {
      if (complete) setIsCompleting(false)
    }
  }

  const calculateAge = () => {
    const today = new Date()
    const birthDate = new Date(patient.dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  // AI & History contexts helper calculations
  const patientRecords = examinationRecords
    .filter((r) => r.patientId === patient.id)
    .sort((a, b) => new Date(b.examinationDate).getTime() - new Date(a.examinationDate).getTime())

  const getLastExaminationDaysAgo = () => {
    if (patientRecords.length === 0) return null
    const lastRecord = patientRecords[0]
    const lastDate = new Date(lastRecord.examinationDate)
    const today = new Date()
    const daysAgo = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    return daysAgo
  }

  const generateAlerts = () => {
    const alerts: Array<{ type: string; message: string; severity: "warning" | "info" }> = []

    if (patientRecords.length === 0) {
      alerts.push({
        type: "Lần khám đầu tiên",
        message: "Đây là lần khám bệnh đầu tiên của bệnh nhân",
        severity: "info",
      })
    } else {
      const daysAgo = getLastExaminationDaysAgo()
      if (daysAgo && daysAgo > 90) {
        alerts.push({
          type: "Quá hạn tái khám",
          message: `Lần khám cuối cách đây ${daysAgo} ngày`,
          severity: "warning",
        })
      } else if (daysAgo && daysAgo > 30) {
        alerts.push({
          type: "Cần tái khám",
          message: `Lần khám cuối cách đây ${daysAgo} ngày`,
          severity: "info",
        })
      }
    }

    const chronicDiseases = patientRecords
      .filter((r) => r.icdCode && r.icdCode.startsWith("I"))
      .map((r) => r.mainDiagnosis)
    if (chronicDiseases.length > 0) {
      alerts.push({
        type: "Bệnh mãn tính",
        message: `Bệnh nhân có tiền sử: ${[...new Set(chronicDiseases)].join(", ")}`,
        severity: "warning",
      })
    }

    return alerts
  }

  const generateRecommendations = () => {
    const recommendations: string[] = []

    if (calculateAge() > 40) {
      recommendations.push("Kiểm tra huyết áp định kỳ")
      recommendations.push("Xét nghiệm đường huyết")
    }

    if (patientRecords.length > 3) {
      recommendations.push("Xem xét lập hồ sơ bệnh mãn tính")
    }

    if (patientRecords.some((r) => r.icdCode.includes("E"))) {
      recommendations.push("Tư vấn dinh dưỡng và tập luyện")
    }

    if (recommendations.length === 0) {
      recommendations.push("Tiếp tục theo dõi sức khỏe định kỳ")
      recommendations.push("Lựa chọn lối sống lành mạnh")
    }

    return recommendations
  }

  const alerts = generateAlerts()
  const recommendations = generateRecommendations()

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/80">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{patient.name}</h1>
            <p className="text-sm text-muted-foreground">
              {calculateAge()} tuổi • {patient.gender === "M" ? "Nam" : "Nữ"} • {patient.phone}
            </p>
          </div>
        </div>
        <div className="flex justify-end items-center gap-3 mb-6">

          {/* Xem trước */}
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
          >
            <Eye className="w-4 h-4 mr-2" />
            {previewMode ? "Chỉnh sửa" : "Xem trước"}
          </Button>

          {/* In PDF */}
          {previewMode && (
            <Button
              variant="outline"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4 mr-2" />
              In PDF
            </Button>
          )}

          {/* Lưu nháp */}
          <Button
            variant="outline"
            onClick={() => handleSaveExamination(false)}
            disabled={isCompleting}
            className="border-green-700 text-green-700 hover:bg-green-50 hover:text-green-800"
          >
            <Save className="w-4 h-4 mr-2" />
            Lưu khám bệnh
          </Button>

          {/* Hoàn thành */}
          <Button
            onClick={() => handleSaveExamination(true)}
            disabled={isCompleting}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            <Check className="w-4 h-4 mr-2" />
            {isCompleting ? "Đang lưu hồ sơ và tạo PDF..." : "Hoàn thành"}
          </Button>

        </div>
      </div>


      {/* Examination Form Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Phiếu khám */}
        <div className="lg:col-span-8">
          {previewMode ? (

            <div ref={printRef}>

              <ExaminationPrintPreview
                patient={patient}
                symptoms={symptoms}
                physicalExam={physicalExam}
                examinationNotes={examinationNotes}
                diagnosis={mainDiagnosis}
                icdCode={selectedIcd?.code ?? ""}
                treatment={treatment}
                followUpDate={followUpDate}
                prescriptionItems={prescriptionItems.map((item) => ({ ...item, quantity: String(item.quantity) }))}
                prescriptionNotes={prescriptionNotes}
                specialtyFields={specialtyFields}
                specialtyExamValues={specialtyExamValues}
                specialtyName={specialty?.name}
                doctorName={user?.name || undefined}
                onBack={() => setPreviewMode(false)}
                onPrint={handlePrint}
              />

            </div>

          ) : (

            <div>
              <Card
                id="print-area"
                className="
                bg-white
                rounded-lg
                border
                shadow-md
                overflow-hidden

                w-full
                max-w-[210mm]
                mx-auto

                print:w-[210mm]
                print:max-w-none
                print:rounded-none
                print:shadow-none
                print:border-none
                print:bg-white
                "
              >
                {/* Header */}
                {/* ================= HEADER ================= */}

                <div className="border-b bg-white">

                  <div className="px-8 pt-8">

                    <div className="flex justify-between items-start">

                      {/* Logo + phòng khám */}

                      <div>

                        <h2 className="text-xl font-bold text-green-700">
                          NOVAMED CLINIC
                        </h2>

                        <p className="text-sm text-muted-foreground mt-1">
                          Hồ sơ bệnh án điện tử
                        </p>

                      </div>

                      {/* Thông tin phiếu */}

                      <div className="text-right text-sm">

                        <p>
                          <span className="font-semibold">
                            Mã BN:
                          </span>{" "}
                          {patient.patientCode || patient.id}
                        </p>

                        <p className="mt-1">
                          <span className="font-semibold">
                            Ngày khám:
                          </span>{" "}
                          {new Date().toLocaleDateString("vi-VN")}
                        </p>

                      </div>

                    </div>

                    <div className="mt-8 text-center">

                      <h1 className="text-3xl font-bold tracking-wider">

                        PHIẾU KHÁM BỆNH

                      </h1>

                    </div>

                  </div>

                  <div className="mt-8 border-t" />

                </div>
                {/*Thông tin bệnh nhân */}
                {/* Section: Thông tin bệnh nhân */}
                <div className="border-b border-border/70">
                  {/* Header */}
                  <div className="bg-green-50 border-l-4 border-green-600 px-6 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      <h2 className="text-base font-semibold text-foreground">
                        I. THÔNG TIN BỆNH NHÂN
                      </h2>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-8">

                    <div className="grid grid-cols-2 gap-x-10 gap-y-5 text-sm">

                      <div>
                        <span className="font-semibold">
                          Họ và tên:
                        </span>{" "}
                        {patient.name}
                      </div>

                      <div>
                        <span className="font-semibold">
                          Mã bệnh nhân:
                        </span>{" "}
                        {patient.patientCode || patient.id}
                      </div>

                      <div>
                        <span className="font-semibold">
                          Giới tính:
                        </span>{" "}
                        {patient.gender === "M" ? "Nam" : "Nữ"}
                      </div>

                      <div>
                        <span className="font-semibold">
                          Điện thoại:
                        </span>{" "}
                        {patient.phone}
                      </div>

                      <div className="col-span-2">
                        <span className="font-semibold">
                          Địa chỉ:
                        </span>{" "}
                        {patient.address}
                      </div>

                    </div>

                  </div>

                </div>

                {/* Card 1: Triệu chứng & Khám lâm sàng */}
                <div className="border-b border-border/70">
                  {/* Header */}
                  <div className="bg-muted/30 px-6 py-4">
                    <h2 className="text-base font-semibold text-foreground">
                      II. TRIỆU CHỨNG & KHÁM LÂM SÀNG
                    </h2>
                  </div>

                  {/* Content */}
                  <div className="p-8 space-y-6">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-2">
                        Triệu chứng lâm sàng chính *
                      </label>
                      <Textarea
                        value={symptoms}
                        onChange={(e) => setSymptoms(e.target.value)}
                        placeholder="Mô tả cụ thể các triệu chứng bệnh nhân đang gặp phải..."
                        rows={3}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-2">
                        Kết quả khám lâm sàng thể chất *
                      </label>
                      <Textarea
                        value={physicalExam}
                        onChange={(e) => setPhysicalExam(e.target.value)}
                        placeholder="Kết quả đo chỉ số sinh tồn (huyết áp, nhịp tim), khám thực thể..."
                        rows={3}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Card 2: Cận lâm sàng & Ghi chú */}
                <div className="border-b border-border/70">
                  {/* Header */}
                  <div className="bg-muted/30 px-6 py-4">
                    <h2 className="text-base font-semibold text-foreground">
                      III. CHUYÊN KHOA{specialty?.name ? `: ${specialty.name.toUpperCase()}` : ""}
                    </h2>
                  </div>

                  {/* Content */}
                  <div className="p-8 space-y-6">
                    {specialty?.examTemplate ? (
                      <ExamTemplateRenderer
                        template={specialty.examTemplate}
                        value={specialtyExamValues}
                        onChange={setSpecialtyExamValues}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Chuyên khoa này chưa có template khám riêng.
                      </p>
                    )}



                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-2">
                        Ghi chú bổ sung
                      </label>
                      <Textarea
                        value={examinationNotes}
                        onChange={(e) => setExaminationNotes(e.target.value)}
                        placeholder="Các ghi chú hoặc nhắc nhở khác trong quá trình khám..."
                        rows={3}
                        className="w-full bg-card"
                      />
                    </div>
                  </div>
                </div>
                {/* Card 3: Chẩn đoán */}
                <div className="border-b border-border/70">
                  {/* Header */}
                  <div className="bg-muted/30 px-6 py-4">
                    <h2 className="text-base font-semibold text-foreground">
                      IV. CHẨN ĐOÁN
                    </h2>
                  </div>

                  {/* Content */}
                  <div className="p-8 space-y-6">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-2">
                        Mã ICD-10 *
                      </label>

                      <Select value={icdCode} onValueChange={setIcdCode}>
                        <SelectTrigger className="w-full bg-card border-border/80">
                          <SelectValue placeholder="Tìm và chọn mã ICD-10" />
                        </SelectTrigger>

                        <SelectContent>
                          {icdCodes.map((code) => (
                            <SelectItem key={code.id} value={code.id}>
                              {code.code} - {code.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {selectedIcd && (
                        <p className="mt-2 text-xs text-primary font-medium">
                          Tên chẩn đoán ICD: {selectedIcd.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-2">
                        Chẩn đoán chính thức *
                      </label>

                      <Input
                        value={mainDiagnosis}
                        onChange={(e) => setMainDiagnosis(e.target.value)}
                        placeholder="Nhập chẩn đoán lâm sàng chính xác"
                        className="w-full bg-card"
                      />
                    </div>
                  </div>
                </div>
                {/* Card 4: Điều trị */}
                <div className="border-b border-border/70">
                  {/* Header */}
                  <div className="bg-muted/30 px-6 py-4">
                    <h2 className="text-base font-semibold text-foreground">
                      V. ĐIỀU TRỊ & TÁI KHÁM
                    </h2>
                  </div>

                  {/* Content */}
                  <div className="p-8 space-y-6">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-2">
                        Chỉ định điều trị & Lời dặn của bác sĩ *
                      </label>

                      <Textarea
                        value={treatment}
                        onChange={(e) => setTreatment(e.target.value)}
                        placeholder="Nhập phương án điều trị, lời dặn dinh dưỡng, sinh hoạt, tập luyện..."
                        rows={4}
                        className="w-full bg-card"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-2">
                        Ngày hẹn tái khám
                      </label>

                      <Input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="w-full bg-card"
                      />
                    </div>
                  </div>
                </div>
                {/* Card 5: Đơn thuốc */}
                <div>
                  {/* Header */}
                  <div className="bg-primary/5 px-6 py-4">
                    <h2 className="text-base font-semibold text-primary">
                      VI. ĐƠN THUỐC
                    </h2>
                  </div>

                  {/* Content */}
                  <div className="p-8 space-y-6">

                    {/* Add Medicine */}

                    <div className="rounded-lg border bg-slate-50 p-6 space-y-5">
                      {/* Combo thuốc */}
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-2">
                          Combo thuốc
                        </label>

                        <Select
                          value={selectedTemplateId}
                          onValueChange={handleTemplateSelect}
                        >
                          <SelectTrigger className="w-full bg-card">
                            <SelectValue placeholder="Chọn combo thuốc" />
                          </SelectTrigger>

                          <SelectContent>
                            {treatmentTemplates.map((template) => (
                              <SelectItem
                                key={template.id}
                                value={template.id}
                              >
                                {template.templateName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-2">
                            Tên thuốc
                          </label>

                          <Select
                            value={selectedMedicineId}
                            onValueChange={setSelectedMedicineId}
                          >
                            <SelectTrigger className="w-full bg-card">
                              <SelectValue placeholder="Chọn thuốc" />
                            </SelectTrigger>

                            <SelectContent>
                              {medicines.map((med) => (
                                <SelectItem key={med.id} value={med.id}>
                                  {med.name} ({med.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-2">
                            Số lượng
                          </label>

                          <Input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            placeholder="Nhập số lượng"
                          />
                        </div>

                      </div>

                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-2">
                          Liều dùng
                        </label>

                        <Input
                          value={dosage}
                          onChange={(e) => setDosage(e.target.value)}
                          placeholder="Ví dụ: 1 viên x 2 lần/ngày"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-2">
                          Lưu ý
                        </label>

                        <Input
                          value={medicineNotes}
                          onChange={(e) => setMedicineNotes(e.target.value)}
                          placeholder="Lưu ý khi dùng thuốc"
                        />
                      </div>

                      <div className="flex justify-end">

                        <Button
                          onClick={handleAddMedicine}
                        >
                          + Thêm thuốc
                        </Button>

                      </div>

                    </div>

                    {/* Danh sách thuốc */}
                    {prescriptionItems.length > 0 && (

                      <div className="overflow-x-auto">

                        <table className="w-full border border-gray-300 text-sm">

                          <thead className="bg-slate-100">

                            <tr>

                              <th className="border p-2">STT</th>

                              <th className="border p-2">Tên thuốc</th>

                              <th className="border p-2">ĐVT</th>

                              <th className="border p-2">SL</th>

                              <th className="border p-2">Liều dùng</th>

                              <th className="border p-2">Ghi chú</th>

                              <th className="border p-2"></th>

                            </tr>

                          </thead>

                          <tbody>

                            {prescriptionItems.map((item, index) => (

                              <tr key={index}>

                                <td className="border p-2 text-center">
                                  {index + 1}
                                </td>

                                <td className="border p-2">
                                  {item.medicineName}
                                </td>

                                <td className="border p-2 text-center">
                                  {item.unit}
                                </td>

                                <td className="border p-2 text-center">
                                  {item.quantity}
                                </td>

                                <td className="border p-2">
                                  {item.dosage}
                                </td>

                                <td className="border p-2">
                                  {item.notes}
                                </td>

                                <td className="border p-2 text-center">

                                  <Button

                                    variant="ghost"

                                    size="icon"

                                    onClick={() => handleRemoveMedicine(index)}

                                  >

                                    🗑

                                  </Button>

                                </td>

                              </tr>

                            ))}

                          </tbody>

                        </table>

                      </div>

                    )}

                    {/* Ghi chú đơn thuốc */}
                    <div>

                      <label className="block text-xs font-medium text-muted-foreground mb-2">
                        Hướng dẫn chung
                      </label>

                      <Textarea
                        value={prescriptionNotes}
                        onChange={(e) => setPrescriptionNotes(e.target.value)}
                        rows={3}
                        placeholder="Ghi chú cho đơn thuốc..."
                      />

                    </div>

                  </div>
                </div>
              </Card>
            </div>
          )}

        </div>
        <div className="lg:col-span-4">
          <Card className="sticky top-6 h-[calc(100vh-210px)] min-h-[550px] flex flex-col rounded-2xl border border-border/80 shadow-md bg-card overflow-hidden">

            {/* Header */}
            <div className="p-3 border-b border-border bg-muted/10">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                  NOVAMED AI Copilot
                </h3>
              </div>

              {/* Quick Actions Grid */}
              <div className="mt-3 flex flex-wrap gap-1">
                {[
                  { label: "Tóm tắt lịch sử khám của bệnh nhân", text: "Lịch sử khám" },
                  { label: "Giải thích mã ICD-10", text: "Tra ICD-10" },
                  { label: "Tra cứu tương tác thuốc", text: "Tương tác thuốc" },
                ].map((btn, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => sendQuickQuestion(btn.label)}
                    className="px-2 py-1 rounded-md text-[11px] font-medium bg-secondary hover:bg-emerald-600 hover:text-white transition-all border border-border/40 active:scale-95 cursor-pointer"
                  >
                    {btn.text}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
              {messages.map((message, index) => {
                const isDoctor = message.sender === "doctor";
                return (
                  <div
                    key={index}
                    className={`flex ${isDoctor ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm leading-relaxed whitespace-pre-wrap ${isDoctor
                        ? "bg-green-700 text-white rounded-tr-none"
                        : "bg-white border border-border text-foreground rounded-tl-none"
                        }`}
                    >
                      {renderMessageText(message.text)}
                    </div>
                  </div>
                );
              })}
              {isAiLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-border text-foreground max-w-[80%] rounded-2xl rounded-tl-none px-3.5 py-2.5 text-sm shadow-sm flex items-center gap-1.5">
                    <span className="h-2 w-2 bg-emerald-600 rounded-full animate-bounce [animation-duration:1s]"></span>
                    <span className="h-2 w-2 bg-emerald-600 rounded-full animate-bounce [animation-duration:1s] [animation-delay:0.2s]"></span>
                    <span className="h-2 w-2 bg-emerald-600 rounded-full animate-bounce [animation-duration:1s] [animation-delay:0.4s]"></span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input Area */}
            <div className="p-2 border-t border-border bg-muted/10">
              <ChatInput
                value={input ?? ""}
                onChange={(e) => setInput(e.target.value)}
                onSubmit={handleSendMessage}
                variant="unstyled"
                className="bg-card border border-border focus-within:ring-1 focus-within:ring-green-700 focus-within:border-green-700 rounded-xl p-1.5 flex flex-row items-center gap-2 w-full"
              >
                <ChatInputTextArea
                  variant="unstyled"
                  placeholder="Hỏi AI về lịch sử khám, tài liệu tham khảo..."
                  className="min-h-[36px] max-h-[100px] text-xs py-1.5 flex-1"
                  rows={1}
                />
                <ChatInputSubmit className="h-8 w-8 p-0 flex items-center justify-center shrink-0" />
              </ChatInput>
            </div>

          </Card>
        </div>
      </div>

      <Dialog open={isTemplateModalOpen} onOpenChange={(open) => {
        setIsTemplateModalOpen(open)
        if (!open) {
          setSelectedTemplatePreview(null)
          setSelectedTemplateId("")
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview combo thuốc</DialogTitle>
            <DialogDescription>
              {selectedTemplatePreview?.templateName || "Xem trước thuốc trong combo trước khi áp dụng"}
            </DialogDescription>
          </DialogHeader>

          {selectedTemplatePreview && (
            <div className="space-y-4">
              {selectedTemplatePreview.description && (
                <p className="text-sm text-muted-foreground">{selectedTemplatePreview.description}</p>
              )}

              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="mb-2 text-sm font-medium">Danh sách thuốc trong combo</div>
                <div className="space-y-2">
                  {selectedTemplatePreview.details.map((detail, index) => (
                    <div key={`${detail.medicineId}-${index}`} className="flex items-center justify-between rounded-md border bg-white px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">{detail.medicineName || "Thuốc"}</div>
                        <div className="text-xs text-muted-foreground">
                          {detail.quantity || 1} {detail.unit || "viên"} • {detail.dosage || "Chưa có liều dùng"}
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeTemplatePreviewMedicine(index)}>
                        Bỏ
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setIsTemplateModalOpen(false)
              setSelectedTemplatePreview(null)
              setSelectedTemplateId("")
            }}>
              Hủy
            </Button>
            <Button type="button" onClick={applyTemplateToPrescription} disabled={!selectedTemplatePreview?.details?.length}>
              Áp dụng vào đơn thuốc
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
