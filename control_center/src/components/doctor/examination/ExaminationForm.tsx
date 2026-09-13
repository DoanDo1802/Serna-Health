"use client";

import { Card } from "@/components/base/ui/card";
import { Input } from "@/components/base/ui/input";
import { Textarea } from "@/components/base/ui/textarea";
import { Button } from "@/components/base/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/base/ui/select";

import PatientInfo from "../patient/PatientInfo";
import PrescriptionSection from "../prescription/PrescriptionSection";
import { User } from "lucide-react";

interface ExaminationFormProps {
    patient: any;

    symptoms: string;
    setSymptoms: (v: string) => void;

    physicalExam: string;
    setPhysicalExam: (v: string) => void;

    testResults: string;
    setTestResults: (v: string) => void;

    examinationNotes: string;
    setExaminationNotes: (v: string) => void;

    icdCode: string;
    setIcdCode: (v: string) => void;

    icdCodes: any[];
    selectedIcd: any;

    mainDiagnosis: string;
    setMainDiagnosis: (v: string) => void;

    treatment: string;
    setTreatment: (v: string) => void;

    followUpDate: string;
    setFollowUpDate: (v: string) => void;

    medicines: any[];
    treatmentTemplates: any[];

    selectedTemplateId: string;
    setSelectedTemplateId: (v: string) => void;

    selectedMedicineId: string;
    setSelectedMedicineId: (v: string) => void;

    quantity: string;
    setQuantity: (v: string) => void;

    dosage: string;
    setDosage: (v: string) => void;

    medicineNotes: string;
    setMedicineNotes: (v: string) => void;

    prescriptionItems: any[];

    prescriptionNotes: string;
    setPrescriptionNotes: (v: string) => void;

    handleAddMedicine: () => void;
    handleRemoveMedicine: (index: number) => void;
}

export default function ExaminationForm({
    patient,

    symptoms,
    setSymptoms,

    physicalExam,
    setPhysicalExam,

    testResults,
    setTestResults,

    examinationNotes,
    setExaminationNotes,

    icdCode,
    setIcdCode,

    icdCodes,
    selectedIcd,

    mainDiagnosis,
    setMainDiagnosis,

    treatment,
    setTreatment,

    followUpDate,
    setFollowUpDate,

    medicines,
    treatmentTemplates,

    selectedTemplateId,
    setSelectedTemplateId,

    selectedMedicineId,
    setSelectedMedicineId,

    quantity,
    setQuantity,

    dosage,
    setDosage,

    medicineNotes,
    setMedicineNotes,

    prescriptionItems,

    prescriptionNotes,
    setPrescriptionNotes,

    handleAddMedicine,
    handleRemoveMedicine,
}: ExaminationFormProps) {
    return (
        <Card
            className="
        bg-white
        rounded-lg
        border
        shadow-md
        overflow-hidden
        w-full
        max-w-[210mm]
        mx-auto
      "
        >
            {/* HEADER */}

            <div className="border-b bg-white">

                <div className="px-8 pt-8">

                    <div className="flex justify-between items-start">

                        <div>

                            <h2 className="text-xl font-bold text-green-700">

                                MEDICORE CLINIC

                            </h2>

                            <p className="text-sm text-muted-foreground mt-1">

                                Hồ sơ bệnh án điện tử

                            </p>

                        </div>

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

            {/* Thông tin bệnh nhân */}

            <PatientInfo patient={patient} />
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
                            {patient.id}
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
                        III. CHUYÊN KHOA
                    </h2>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-2">
                            Kết quả xét nghiệm & Chẩn đoán hình ảnh
                        </label>
                        <Textarea
                            value={testResults}
                            onChange={(e) => setTestResults(e.target.value)}
                            placeholder="Điền kết quả xét nghiệm sinh hóa, huyết học, siêu âm, điện tim (nếu có)..."
                            rows={3}
                            className="w-full bg-card"
                        />
                    </div>

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
                                onValueChange={setSelectedTemplateId}
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
                                            {template.name}
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

            {/* ================= TRIỆU CHỨNG ================= */}

            <div className="border-b border-border/70">

                <div className="bg-muted/30 px-6 py-4">

                    <h2 className="text-base font-semibold">

                        II. TRIỆU CHỨNG & KHÁM LÂM SÀNG

                    </h2>

                </div>

                <div className="p-8 space-y-6">

                    <div>

                        <label className="block text-xs font-medium text-muted-foreground mb-2">

                            Triệu chứng lâm sàng chính *

                        </label>

                        <Textarea
                            value={symptoms}
                            onChange={(e) => setSymptoms(e.target.value)}
                            rows={3}
                            placeholder="Mô tả triệu chứng..."
                        />

                    </div>

                    <div>

                        <label className="block text-xs font-medium text-muted-foreground mb-2">

                            Kết quả khám lâm sàng *

                        </label>

                        <Textarea
                            value={physicalExam}
                            onChange={(e) => setPhysicalExam(e.target.value)}
                            rows={3}
                            placeholder="Kết quả khám..."
                        />

                    </div>

                </div>

            </div>
            {/* ================= CHUYÊN KHOA ================= */}

            <div className="border-b border-border/70">

                <div className="bg-muted/30 px-6 py-4">

                    <h2 className="text-base font-semibold">

                        III. CHUYÊN KHOA

                    </h2>

                </div>

                <div className="p-8 space-y-6">

                    <div>

                        <label className="block text-xs font-medium text-muted-foreground mb-2">

                            Kết quả xét nghiệm & Chẩn đoán hình ảnh

                        </label>

                        <Textarea
                            value={testResults}
                            onChange={(e) => setTestResults(e.target.value)}
                            rows={3}
                            placeholder="Nhập kết quả xét nghiệm..."
                        />

                    </div>

                    <div>

                        <label className="block text-xs font-medium text-muted-foreground mb-2">

                            Ghi chú bổ sung

                        </label>

                        <Textarea
                            value={examinationNotes}
                            onChange={(e) => setExaminationNotes(e.target.value)}
                            rows={3}
                            placeholder="Nhập ghi chú..."
                        />

                    </div>

                </div>

            </div>

            {/* ================= CHẨN ĐOÁN ================= */}

            <div className="border-b border-border/70">

                <div className="bg-muted/30 px-6 py-4">

                    <h2 className="text-base font-semibold">

                        IV. CHẨN ĐOÁN

                    </h2>

                </div>

                <div className="p-8 space-y-6">

                    <div>

                        <label className="block text-xs font-medium text-muted-foreground mb-2">

                            Mã ICD-10 *

                        </label>

                        <Select
                            value={icdCode}
                            onValueChange={setIcdCode}
                        >

                            <SelectTrigger>

                                <SelectValue placeholder="Chọn mã ICD-10" />

                            </SelectTrigger>

                            <SelectContent>

                                {icdCodes.map((code) => (

                                    <SelectItem
                                        key={code.id}
                                        value={code.id}
                                    >

                                        {code.code} - {code.name}

                                    </SelectItem>

                                ))}

                            </SelectContent>

                        </Select>

                        {selectedIcd && (

                            <p className="mt-2 text-sm text-green-700">

                                Chẩn đoán ICD:

                                {" "}

                                <b>{selectedIcd.name}</b>

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
                            placeholder="Nhập chẩn đoán..."
                        />

                    </div>

                </div>

            </div>

            {/* ================= ĐIỀU TRỊ ================= */}

            <div className="border-b border-border/70">

                <div className="bg-muted/30 px-6 py-4">

                    <h2 className="text-base font-semibold">

                        V. ĐIỀU TRỊ & TÁI KHÁM

                    </h2>

                </div>

                <div className="p-8 space-y-6">

                    <div>

                        <label className="block text-xs font-medium text-muted-foreground mb-2">

                            Chỉ định điều trị *

                        </label>

                        <Textarea
                            value={treatment}
                            onChange={(e) => setTreatment(e.target.value)}
                            rows={4}
                            placeholder="Nhập phương án điều trị..."
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
                        />

                    </div>

                </div>

            </div>
            {/* ================= ĐƠN THUỐC ================= */}

            <PrescriptionSection
                medicines={medicines}
                treatmentTemplates={treatmentTemplates}
                selectedTemplateId={selectedTemplateId}
                setSelectedTemplateId={setSelectedTemplateId}
                selectedMedicineId={selectedMedicineId}
                setSelectedMedicineId={setSelectedMedicineId}
                quantity={quantity}
                setQuantity={setQuantity}
                dosage={dosage}
                setDosage={setDosage}
                medicineNotes={medicineNotes}
                setMedicineNotes={setMedicineNotes}
                prescriptionItems={prescriptionItems}
                prescriptionNotes={prescriptionNotes}
                setPrescriptionNotes={setPrescriptionNotes}
                handleAddMedicine={handleAddMedicine}
                handleRemoveMedicine={handleRemoveMedicine}
            />

        </Card>
    );
}