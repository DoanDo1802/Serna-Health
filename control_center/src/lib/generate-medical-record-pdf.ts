import { pdf } from "@react-pdf/renderer";
import React from "react";
import MedicalRecordPdfDocument, { MedicalRecordPdfProps } from "@/components/doctor/examination/MedicalRecordPdfDocument";

/**
 * Generates a PDF blob from the MedicalRecordPdfDocument component
 */
export async function generateMedicalRecordPdf(props: MedicalRecordPdfProps): Promise<Blob> {
  const doc = React.createElement(MedicalRecordPdfDocument, props);
  const pdfInstance = pdf(doc as any);
  return await pdfInstance.toBlob();
}
