"use client";

import { Button } from "@/components/base/ui/button";
import { ArrowLeft, Printer } from "lucide-react";

interface PrescriptionItem {
    medicineName: string;
    quantity: string;
    unit: string;
    dosage: string;
    notes?: string;
}

interface Props {
    patient: any;
    symptoms: string;
    physicalExam: string;
    examinationNotes: string;
    diagnosis: string;
    icdCode: string;
    treatment: string;
    followUpDate: string;
    prescriptionItems: PrescriptionItem[];
    prescriptionNotes: string;
    specialtyFields?: any[];
    specialtyExamValues?: Record<string, any>;
    specialtyName?: string;
    doctorName?: string;
    onBack: () => void;
    onPrint: () => void;
}

export default function ExaminationPrintPreview({
    patient,
    symptoms,
    physicalExam,
    examinationNotes,
    diagnosis,
    icdCode,
    treatment,
    followUpDate,
    prescriptionItems,
    prescriptionNotes,
    specialtyFields = [],
    specialtyExamValues = {},
    specialtyName = "",
    doctorName,
    onBack,
    onPrint,
}: Props) {
    const now = new Date();
    const formattedDate = `Ngày ${String(now.getDate()).padStart(2, '0')} tháng ${String(now.getMonth() + 1).padStart(2, '0')} năm ${now.getFullYear()}`;

    return (
        <div className="flex flex-col items-center bg-slate-100 min-h-screen py-8 print:bg-white print:py-0">

            {/* Toolbar */}
            <div className="w-[210mm] flex justify-end gap-3 mb-5 print:hidden">
                <Button
                    variant="outline"
                    onClick={onBack}
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Quay lại
                </Button>

                <Button
                    onClick={onPrint}
                    className="bg-green-700 hover:bg-green-800 text-white"
                >
                    <Printer className="w-4 h-4 mr-2" />
                    In PDF
                </Button>
            </div>

            {/* A4 Page Container */}
            <div
                id="print-area"
                className="
                    bg-white
                    w-[210mm]
                    min-h-[297mm]
                    shadow-lg
                    p-12
                    text-[13px]
                    leading-relaxed
                    text-slate-800
                    print:shadow-none
                "
            >
                {/* ================= Header ================= */}
                <div className="flex justify-between items-start border-b pb-6 border-slate-200">
                    <div className="flex gap-3 items-center">
                        <div className="w-10 h-10 rounded-lg bg-green-700 flex items-center justify-center text-white font-black text-xl tracking-tighter">
                            MC
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">
                                MEDICORE CLINIC
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Hệ thống y tế kỹ thuật số hiện đại
                            </p>
                        </div>
                    </div>
                    <div className="text-right text-xs text-slate-600 space-y-1">
                        <p className="font-semibold text-slate-800">
                            MÃ BN: <span className="font-mono text-green-700 font-bold">{patient.patientCode || patient.id}</span>
                        </p>
                        <p>Ngày khám: <span className="font-medium text-slate-800">{new Date().toLocaleDateString("vi-VN")}</span></p>
                    </div>
                </div>

                {/* ================= Title ================= */}
                <div className="my-8 text-center">
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-wider uppercase">
                        PHIẾU KHÁM BỆNH
                    </h1>
                </div>

                {/* ================= I. Thông tin bệnh nhân ================= */}
                <div className="mt-8">
                    <div className="mb-4 border-b pb-1.5 border-slate-100">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                            I. Thông tin bệnh nhân
                        </h2>
                    </div>
                    <div className="pl-1">
                        <div className="grid grid-cols-3 gap-y-4 gap-x-6">
                            <div>
                                <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider mb-0.5">Họ và tên</span>
                                <span className="font-semibold text-slate-800 text-[13px]">{patient.name || "—"}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider mb-0.5">Giới tính</span>
                                <span className="font-semibold text-slate-800 text-[13px]">{patient.gender === "M" ? "Nam" : (patient.gender === "F" ? "Nữ" : "—")}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider mb-0.5">Điện thoại</span>
                                <span className="font-semibold text-slate-800 text-[13px] font-mono">{patient.phone || "—"}</span>
                            </div>
                            <div className="col-span-3">
                                <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider mb-0.5">Địa chỉ</span>
                                <span className="font-medium text-slate-800 text-[13px]">{patient.address || "—"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ================= II. Triệu chứng & Khám lâm sàng ================= */}
                <div className="mt-8">
                    <div className="mb-4 border-b pb-1.5 border-slate-100">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                            II. Triệu chứng & Khám lâm sàng
                        </h2>
                    </div>
                    <div className="pl-1 space-y-4">
                        <div>
                            <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider mb-1">Triệu chứng chính</span>
                            <div className="text-slate-800 text-[13px] whitespace-pre-wrap leading-relaxed">
                                {symptoms || "Không ghi nhận."}
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider mb-1">Kết quả khám lâm sàng thể chất</span>
                            <div className="text-slate-800 text-[13px] whitespace-pre-wrap leading-relaxed">
                                {physicalExam || "Bình thường."}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ================= III. Khám chuyên khoa ================= */}
                <div className="mt-8">
                    <div className="mb-4 border-b pb-1.5 border-slate-100">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                            III. Khám chuyên khoa{specialtyName ? `: ${specialtyName}` : ""}
                        </h2>
                    </div>
                    <div className="pl-1">
                        {specialtyFields && specialtyFields.length > 0 ? (
                            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                {specialtyFields.map((field) => {
                                    const value = specialtyExamValues?.[field.id];
                                    const isEmpty = value === undefined || value === null || String(value).trim() === "";
                                    let displayValue = isEmpty ? "—" : (field.type === "checkbox" ? (value === true ? "Có" : "Không") : String(value));

                                    if (field.type === "textarea") {
                                        return (
                                            <div key={field.id} className="col-span-2">
                                                <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider mb-1">{field.label}</span>
                                                <div className="text-slate-800 text-[13px] whitespace-pre-wrap leading-relaxed">
                                                    {displayValue}
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={field.id}>
                                            <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider mb-0.5">{field.label}</span>
                                            <span className="font-semibold text-slate-800 text-[13px]">{displayValue}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-slate-400 text-sm italic">
                                Không có chỉ định khám chuyên khoa riêng.
                            </div>
                        )}
                    </div>
                </div>

                {/* ================= IV. Chẩn đoán ================= */}
                <div className="mt-8">
                    <div className="mb-4 border-b pb-1.5 border-slate-100">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                            IV. Chẩn đoán
                        </h2>
                    </div>
                    <div className="pl-1">
                        <div className="grid grid-cols-3 gap-y-4 gap-x-6">
                            <div>
                                <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider mb-0.5">Mã ICD-10</span>
                                <span className="font-semibold text-green-700 font-mono bg-green-50 border border-green-100 px-2 py-0.5 rounded text-xs inline-block">{icdCode || "—"}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider mb-0.5">Chẩn đoán chính</span>
                                <span className="font-semibold text-slate-800 text-[13px]">{diagnosis || "—"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ================= V. Điều trị & Đơn thuốc ================= */}
                <div className="mt-8">
                    <div className="mb-4 border-b pb-1.5 border-slate-100">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                            V. Điều trị & Đơn thuốc
                        </h2>
                    </div>
                    <div className="pl-1 space-y-5">
                        <div>
                            <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider mb-1">Chỉ định điều trị & Lời dặn</span>
                            <div className="text-slate-800 text-[13px] whitespace-pre-wrap leading-relaxed">
                                {treatment || "—"}
                            </div>
                        </div>

                        <div className="pt-2">
                            <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider mb-2">Danh sách thuốc kê đơn</span>
                            <div className="overflow-hidden border border-slate-100 rounded-lg">
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-100">
                                            <th className="py-2.5 px-3 w-12 text-center font-semibold uppercase tracking-wider">STT</th>
                                            <th className="py-2.5 px-3 text-left font-semibold uppercase tracking-wider">Tên thuốc</th>
                                            <th className="py-2.5 px-3 w-20 text-center font-semibold uppercase tracking-wider">ĐVT</th>
                                            <th className="py-2.5 px-3 w-20 text-center font-semibold uppercase tracking-wider">SL</th>
                                            <th className="py-2.5 px-3 text-left font-semibold uppercase tracking-wider">Liều dùng</th>
                                            <th className="py-2.5 px-3 text-left font-semibold uppercase tracking-wider">Ghi chú</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {prescriptionItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                                                    Chưa kê đơn thuốc.
                                                </td>
                                            </tr>
                                        ) : (
                                            prescriptionItems.map((item, index) => (
                                                <tr key={index} className="hover:bg-slate-50/50">
                                                    <td className="py-2.5 px-3 text-center text-slate-500">{index + 1}</td>
                                                    <td className="py-2.5 px-3 font-semibold text-slate-800">{item.medicineName}</td>
                                                    <td className="py-2.5 px-3 text-center text-slate-700">{item.unit}</td>
                                                    <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-800">{item.quantity}</td>
                                                    <td className="py-2.5 px-3 text-slate-700 leading-relaxed">{item.dosage}</td>
                                                    <td className="py-2.5 px-3 text-slate-500 italic">{item.notes || "—"}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {prescriptionNotes && (
                                <div className="mt-3 p-3 bg-green-50/30 border border-green-100/50 rounded-lg">
                                    <span className="text-green-800 font-semibold block text-[10px] uppercase tracking-wider mb-1">Hướng dẫn sử dụng thuốc</span>
                                    <div className="text-green-900 text-[13px] whitespace-pre-wrap leading-relaxed">
                                        {prescriptionNotes}
                                    </div>
                                </div>
                            )}
                        </div>

                        {followUpDate && (
                            <div className="pt-3 border-t border-dashed border-slate-100 flex items-center gap-2 text-[13px]">
                                <span className="text-slate-500 font-semibold">Lịch hẹn tái khám:</span>
                                <span className="text-green-700 font-bold bg-green-50 px-2.5 py-0.5 rounded-full font-mono text-xs border border-green-100">
                                    {new Date(followUpDate).toLocaleDateString("vi-VN")}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ================= VI. Ghi chú của bác sĩ ================= */}
                <div className="mt-8">
                    <div className="mb-4 border-b pb-1.5 border-slate-100">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                            VI. Ghi chú của bác sĩ
                        </h2>
                    </div>
                    <div className="pl-1 text-slate-800 text-[13px] whitespace-pre-wrap leading-relaxed">
                        {examinationNotes || "Không có ghi chú thêm."}
                    </div>
                </div>

                {/* ================= Signatures ================= */}
                <div className="mt-12 grid grid-cols-2 gap-10">
                    <div className="text-center">
                        <p className="text-slate-400 text-xs italic invisible">{formattedDate}</p>
                        <p className="font-bold text-slate-700 uppercase tracking-wider mt-2 text-xs">
                            Bệnh nhân
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 italic">
                            (Ký và ghi rõ họ tên)
                        </p>
                        <div className="h-20"></div>
                    </div>
                    <div className="text-center">
                        <p className="text-slate-500 text-xs font-mono">{formattedDate}</p>
                        <p className="font-bold text-slate-700 uppercase tracking-wider mt-2 text-xs">
                            Bác sĩ điều trị
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 italic">
                            (Ký và ghi rõ họ tên)
                        </p>
                        <div className="h-20"></div>
                        {doctorName && (
                            <p className="font-bold text-slate-800 text-sm tracking-wide">{doctorName}</p>
                        )}
                    </div>
                </div>

                {/* ================= Bottom Footer ================= */}
                <div className="mt-16 flex justify-between items-end border-t pt-6 border-slate-200">
                    <div>
                        <div className="w-20 h-20 border border-slate-200 rounded flex flex-col items-center justify-center bg-slate-50 text-[9px] text-slate-400 font-medium">
                            <span className="font-mono text-[10px] font-bold text-slate-600 mb-1">QR CODE</span>
                            <span>Tra cứu hồ sơ</span>
                        </div>
                    </div>
                    <div className="text-right text-[10px] text-slate-400 space-y-0.5 font-medium">
                        <p>Hệ thống hồ sơ bệnh án điện tử MediCore</p>
                        <p>Thời gian xuất: <span className="font-mono">{now.toLocaleString("vi-VN")}</span></p>
                    </div>
                </div>
            </div>
        </div>
    );
}