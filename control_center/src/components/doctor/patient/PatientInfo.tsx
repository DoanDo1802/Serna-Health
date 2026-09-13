"use client";

import { User } from "lucide-react";
interface Patient {
  id: string;
  name: string;
  gender: string;
  phone: string;
  address: string;
}

interface PatientInfoProps {
  patient: Patient;
}

export default function PatientInfo({
  patient,
}: PatientInfoProps) {
  return (
    <div className="border-b border-border/70">

      {/* Header */}

      <div className="bg-muted/30 px-6 py-4">

        <h2 className="text-base font-semibold">

          Thông tin khám bệnh

        </h2>

      </div>

      {/* Content */}

      <div className="p-6">

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

            {patient.gender === "M"
              ? "Nam"
              : "Nữ"}

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
  );
}