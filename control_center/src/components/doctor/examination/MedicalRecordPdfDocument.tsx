"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

/* ------------------------------------------------------------------ */
/* Vietnamese-capable font (Roboto from Google Fonts CDN)              */
/* ------------------------------------------------------------------ */
Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf",
      fontWeight: 300,
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf",
      fontWeight: 500,
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf",
      fontWeight: 700,
    },
  ],
});

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
const colors = {
  primary: "#15803d",     // Green 700
  text: "#1e293b",        // Slate 800
  lightText: "#64748b",   // Slate 500
  bgLight: "#f8fafc",     // Slate 50
  border: "#f1f5f9",      // Slate 100
  borderMuted: "#e2e8f0", // Slate 200
  white: "#ffffff",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 9.5,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48, // Tăng lề trái phải để tài liệu cân đối, không bị sát lề
    color: colors.text,
    lineHeight: 1.5,
  },

  /* ---- Header ---- */
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
    paddingBottom: 12,
  },
  clinicTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  clinicLogoText: {
    backgroundColor: colors.primary,
    color: colors.white,
    fontWeight: 700,
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 6,
  },
  clinicName: {
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: 0.5,
  },
  clinicSub: { 
    fontSize: 8.5, 
    color: colors.lightText,
    marginTop: 2,
  },
  headerRight: { 
    textAlign: "right", 
    fontSize: 8.5,
    color: "#334155",
  },
  headerRightBold: { 
    fontWeight: 700,
    color: colors.primary,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
    marginTop: 8,
    marginBottom: 16,
  },
  titleContainer: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  mainTitle: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: "#0f172a",
    marginBottom: 2,
  },
  mainSubtitle: {
    textAlign: "center",
    fontSize: 8.5,
    fontWeight: 500,
    color: colors.primary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  /* ---- Section container ---- */
  section: { 
    marginTop: 18,
  },
  sectionHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 4,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionHeaderText: {
    fontWeight: 700,
    fontSize: 9.5,
    textTransform: "uppercase",
    color: "#0f172a",
    letterSpacing: 0.5,
  },
  sectionBody: { 
    paddingLeft: 2,
  },

  /* ---- Info grid (3 cols) ---- */
  infoGrid: { 
    flexDirection: "row", 
    flexWrap: "wrap",
  },
  infoCell: { 
    width: "33.33%", 
    flexDirection: "column", 
    marginBottom: 8,
  },
  infoCellFull: { 
    width: "100%", 
    flexDirection: "column", 
    marginBottom: 8,
  },
  infoLabel: { 
    fontSize: 7.5,
    fontWeight: 500, 
    color: colors.lightText, 
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: { 
    fontSize: 9.5,
    fontWeight: 500,
    color: colors.text,
  },

  /* ---- Text blocks ---- */
  fieldLabel: { 
    fontSize: 7.5,
    fontWeight: 500, 
    color: colors.lightText, 
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  fieldValue: {
    fontSize: 9.5,
    color: colors.text,
    marginBottom: 10,
    lineHeight: 1.4,
  },

  /* ---- Table ---- */
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 4,
  },
  tableRow: { 
    flexDirection: "row", 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border,
    alignItems: "center",
  },
  tableHeader: { 
    backgroundColor: colors.bgLight,
  },
  tableCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 8.5,
  },
  tableCellLast: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 8.5,
  },
  tableCellBold: { 
    fontWeight: 700,
    color: "#334155",
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableCellCenter: { 
    textAlign: "center",
  },

  /* ---- Footer / Signature ---- */
  sigRow: { flexDirection: "row", marginTop: 24 },
  sigCol: { flex: 1, alignItems: "center" },
  sigDate: { fontSize: 8.5, color: colors.lightText, marginBottom: 4 },
  sigTitle: { fontWeight: 700, fontSize: 9, textTransform: "uppercase", color: "#334155", marginBottom: 2 },
  sigNote: { fontSize: 7.5, color: colors.lightText },
  sigSpace: { height: 48 },
  doctorNameText: {
    fontSize: 9,
    fontWeight: 700,
    color: "#1f2937",
    marginTop: 4,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 36,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  qrBox: {
    width: 60,
    height: 60,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgLight,
    borderRadius: 4,
  },
  qrText: {
    fontSize: 8,
    fontWeight: 700,
    color: colors.lightText,
    marginBottom: 2,
  },
  qrLabel: { fontSize: 7, textAlign: "center", marginTop: 4, color: colors.lightText },
  bottomRight: { textAlign: "right", fontSize: 7.5, color: colors.lightText },
  
  /* ---- Misc ---- */
  prescriptionNotesBox: {
    backgroundColor: "#f0fdf4", // Green 50
    borderWidth: 1,
    borderColor: "#dcfce7", // Green 100
    borderRadius: 6,
    padding: 10,
    marginTop: 10,
  },
  prescriptionNotesTitle: {
    fontSize: 7.5,
    fontWeight: 700,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  prescriptionNotesContent: {
    fontSize: 9,
    color: "#166534", // Green 800
    lineHeight: 1.4,
  },
  followUpRow: {
    flexDirection: "row",
    paddingTop: 8,
    marginTop: 8,
    alignItems: "center",
  },
  followUpLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: colors.text,
    marginRight: 4,
  },
  followUpValue: {
    fontSize: 9,
    fontWeight: 700,
    color: colors.primary,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#dcfce7",
  },
  icdCodeBadge: {
    fontWeight: 700,
    color: colors.primary,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#dcfce7",
    fontSize: 8.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

/* ------------------------------------------------------------------ */
/* Props – same shape as examination-print-preview.tsx                 */
/* ------------------------------------------------------------------ */
export interface PrescriptionItem {
  medicineName: string;
  quantity: string;
  unit: string;
  dosage: string;
  notes?: string;
}

export interface SpecialtyField {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
}

export interface MedicalRecordPdfProps {
  patient: {
    name?: string;
    patientCode?: string;
    id?: string;
    gender?: string;
    phone?: string;
    address?: string;
    dateOfBirth?: string;
  };
  symptoms: string;
  physicalExam: string;
  examinationNotes: string;
  diagnosis: string;
  icdCode: string;
  treatment: string;
  followUpDate: string;
  prescriptionItems: PrescriptionItem[];
  prescriptionNotes: string;
  specialtyFields?: SpecialtyField[];
  specialtyExamValues?: Record<string, any>;
  doctorName?: string;
  specialtyName?: string;
  appointmentDate?: string;
  timeSlot?: string;
  emrCode?: string;
}

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */
export default function MedicalRecordPdfDocument(props: MedicalRecordPdfProps) {
  const {
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
    doctorName,
    specialtyName,
    appointmentDate,
    timeSlot,
    emrCode,
  } = props;

  const now = new Date();
  const formattedDate = `Ngày ${pad(now.getDate())} tháng ${pad(now.getMonth() + 1)} năm ${now.getFullYear()}`;
  const examDateDisplay = appointmentDate
    ? new Date(appointmentDate + "T00:00:00").toLocaleDateString("vi-VN")
    : now.toLocaleDateString("vi-VN");

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ==================== Header ==================== */}
        <View style={s.headerRow}>
          <View>
            <View style={s.clinicTitleContainer}>
              <Text style={s.clinicLogoText}>MC</Text>
              <Text style={s.clinicName}>MEDICORE CLINIC</Text>
            </View>
            <Text style={s.clinicSub}>Hệ thống y tế kỹ thuật số hiện đại</Text>
          </View>
          <View style={s.headerRight}>
            <Text>
              Mã BN: <Text style={s.headerRightBold}>{patient.patientCode || patient.id || ""}</Text>
            </Text>
            {emrCode && (
              <Text>
                Mã hồ sơ: <Text style={s.headerRightBold}>{emrCode}</Text>
              </Text>
            )}
            <Text>Ngày khám: {examDateDisplay}</Text>
            {timeSlot && <Text>Giờ khám: {timeSlot}</Text>}
          </View>
        </View>

        <View style={s.titleContainer}>
          <Text style={s.mainTitle}>PHIẾU KHÁM BỆNH</Text>
        </View>

        {/* ==================== I. Thông tin bệnh nhân ==================== */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>I. Thông tin bệnh nhân</Text>
          </View>
          <View style={s.sectionBody}>
            <View style={s.infoGrid}>
              <View style={s.infoCell}>
                <Text style={s.infoLabel}>Họ tên</Text>
                <Text style={s.infoValue}>{patient.name || "—"}</Text>
              </View>
              <View style={s.infoCell}>
                <Text style={s.infoLabel}>Giới tính</Text>
                <Text style={s.infoValue}>{patient.gender === "M" ? "Nam" : (patient.gender === "F" ? "Nữ" : "—")}</Text>
              </View>
              <View style={s.infoCell}>
                <Text style={s.infoLabel}>Điện thoại</Text>
                <Text style={s.infoValue}>{patient.phone || "—"}</Text>
              </View>
              <View style={s.infoCellFull}>
                <Text style={s.infoLabel}>Địa chỉ</Text>
                <Text style={s.infoValue}>{patient.address || "—"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ==================== II. Triệu chứng & Khám lâm sàng ==================== */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>II. Triệu chứng & Khám lâm sàng</Text>
          </View>
          <View style={s.sectionBody}>
            <View style={{ marginBottom: 8 }}>
              <Text style={s.fieldLabel}>Triệu chứng chính</Text>
              <Text style={s.fieldValue}>{symptoms || "Không ghi nhận."}</Text>
            </View>
            <View style={{ marginBottom: 8 }}>
              <Text style={s.fieldLabel}>Kết quả khám lâm sàng thể chất</Text>
              <Text style={s.fieldValue}>{physicalExam || "Bình thường."}</Text>
            </View>
          </View>
        </View>

        {/* ==================== III. Khám chuyên khoa ==================== */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>
              III. Khám chuyên khoa{specialtyName ? `: ${specialtyName}` : ""}
            </Text>
          </View>
          <View style={s.sectionBody}>
            {specialtyFields && specialtyFields.length > 0 ? (
              <View style={s.infoGrid}>
                {specialtyFields.map((field) => {
                  const value = specialtyExamValues?.[field.id];
                  const isEmpty = value === undefined || value === null || String(value).trim() === "";
                  let displayValue = isEmpty ? "—" : (field.type === "checkbox" ? (value === true ? "Có" : "Không") : String(value));

                  if (field.type === "textarea") {
                    return (
                      <View key={field.id} style={{ width: "100%", marginBottom: 8 }}>
                        <Text style={s.fieldLabel}>{field.label}</Text>
                        <Text style={s.fieldValue}>{displayValue}</Text>
                      </View>
                    );
                  }

                  return (
                    <View key={field.id} style={s.infoCell}>
                      <Text style={s.fieldLabel}>{field.label}</Text>
                      <Text style={s.infoValue}>{displayValue}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={{ color: colors.lightText, fontSize: 8.5 }}>
                Không có chỉ định khám chuyên khoa riêng.
              </Text>
            )}
          </View>
        </View>

        {/* ==================== IV. Chẩn đoán ==================== */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>IV. Chẩn đoán</Text>
          </View>
          <View style={s.sectionBody}>
            <View style={s.infoGrid}>
              <View style={[s.infoCell, { width: "30%" }]}>
                <Text style={s.infoLabel}>Mã ICD-10</Text>
                <View style={{ flexDirection: "row" }}>
                  <Text style={s.icdCodeBadge}>{icdCode || "—"}</Text>
                </View>
              </View>
              <View style={[s.infoCell, { width: "70%" }]}>
                <Text style={s.infoLabel}>Chẩn đoán bệnh chính</Text>
                <Text style={s.infoValue}>{diagnosis || "—"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ==================== V. Điều trị & Đơn thuốc ==================== */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>V. Điều trị & Đơn thuốc</Text>
          </View>
          <View style={s.sectionBody}>
            <Text style={s.fieldLabel}>Chỉ định điều trị & Lời dặn</Text>
            <Text style={s.fieldValue}>{treatment || "—"}</Text>

            <Text style={[s.fieldLabel, { marginTop: 6, marginBottom: 4 }]}>Danh sách thuốc kê đơn</Text>

            {/* Prescription Table */}
            <View style={s.table}>
              {/* Header row */}
              <View style={[s.tableRow, s.tableHeader]} fixed>
                <Text style={[s.tableCell, s.tableCellBold, s.tableCellCenter, { width: "7%" }]}>STT</Text>
                <Text style={[s.tableCell, s.tableCellBold, { width: "33%" }]}>Tên thuốc</Text>
                <Text style={[s.tableCell, s.tableCellBold, s.tableCellCenter, { width: "12%" }]}>ĐVT</Text>
                <Text style={[s.tableCell, s.tableCellBold, s.tableCellCenter, { width: "10%" }]}>SL</Text>
                <Text style={[s.tableCell, s.tableCellBold, { width: "23%" }]}>Liều dùng</Text>
                <Text style={[s.tableCellLast, s.tableCellBold, { width: "15%" }]}>Ghi chú</Text>
              </View>
              {/* Data rows */}
              {prescriptionItems.length === 0 ? (
                <View style={s.tableRow}>
                  <Text style={[s.tableCell, { width: "100%", textAlign: "center", color: colors.lightText, paddingVertical: 12 }]}>
                    Chưa kê đơn thuốc.
                  </Text>
                </View>
              ) : (
                prescriptionItems.map((item, index) => (
                  <View key={index} style={s.tableRow}>
                    <Text style={[s.tableCell, s.tableCellCenter, { width: "7%", color: colors.lightText }]}>{index + 1}</Text>
                    <Text style={[s.tableCell, { width: "33%", fontWeight: 700, color: "#1e293b" }]}>{item.medicineName}</Text>
                    <Text style={[s.tableCell, s.tableCellCenter, { width: "12%", color: "#334155" }]}>{item.unit}</Text>
                    <Text style={[s.tableCell, s.tableCellCenter, { width: "10%", fontWeight: 500 }]}>{item.quantity}</Text>
                    <Text style={[s.tableCell, { width: "23%", color: "#334155" }]}>{item.dosage}</Text>
                    <Text style={[s.tableCell, { width: "15%", color: colors.lightText }]}>{item.notes || "—"}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Prescription notes */}
            {prescriptionNotes && (
              <View style={s.prescriptionNotesBox}>
                <Text style={s.prescriptionNotesTitle}>Hướng dẫn sử dụng thuốc</Text>
                <Text style={s.prescriptionNotesContent}>{prescriptionNotes}</Text>
              </View>
            )}

            {/* Follow up */}
            {followUpDate ? (
              <View style={s.followUpRow}>
                <Text style={s.followUpLabel}>Hẹn tái khám vào ngày:</Text>
                <Text style={s.followUpValue}>
                  {new Date(followUpDate + "T00:00:00").toLocaleDateString("vi-VN")}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ==================== VI. Ghi chú của bác sĩ ==================== */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>VI. Ghi chú của bác sĩ</Text>
          </View>
          <View style={s.sectionBody}>
            <Text style={{ fontSize: 9.5, color: colors.text }}>
              {examinationNotes || "Không có ghi chú thêm."}
            </Text>
          </View>
        </View>

        {/* ==================== Signature ==================== */}
        <View style={s.sigRow}>
          <View style={s.sigCol}>
            <Text style={[s.sigDate, { color: colors.white }]}>{formattedDate}</Text>
            <Text style={s.sigTitle}>Bệnh nhân</Text>
            <Text style={s.sigNote}>(Ký và ghi rõ họ tên)</Text>
            <View style={s.sigSpace} />
          </View>
          <View style={s.sigCol}>
            <Text style={s.sigDate}>{formattedDate}</Text>
            <Text style={s.sigTitle}>Bác sĩ điều trị</Text>
            <Text style={s.sigNote}>(Ký và ghi rõ họ tên)</Text>
            <View style={s.sigSpace} />
            {doctorName && <Text style={s.doctorNameText}>{doctorName}</Text>}
          </View>
        </View>

        {/* ==================== Bottom ==================== */}
        <View style={s.bottomRow}>
          <View>
            <View style={s.qrBox}>
              <Text style={s.qrText}>QR CODE</Text>
            </View>
            <Text style={s.qrLabel}>Tra cứu hồ sơ</Text>
          </View>
          <View style={s.bottomRight}>
            <Text>Hệ thống hồ sơ bệnh án điện tử MediCore</Text>
            <Text>Thời gian xuất: {now.toLocaleString("vi-VN")}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

/* ---- helpers ---- */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
