"use client";

import { Button } from "@/components/base/ui/button";
import { Input } from "@/components/base/ui/input";
import { Textarea } from "@/components/base/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/base/ui/select";

interface Medicine {
  id: string;
  name: string;
  unit: string;
}

interface TreatmentTemplate {
  id: string;
  name: string;
}

interface PrescriptionItem {
  medicineName: string;
  quantity: string;
  unit: string;
  dosage: string;
  notes?: string;
}

interface Props {
  medicines: Medicine[];
  treatmentTemplates: TreatmentTemplate[];

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

  prescriptionItems: PrescriptionItem[];

  prescriptionNotes: string;
  setPrescriptionNotes: (v: string) => void;

  handleAddMedicine: () => void;
  handleRemoveMedicine: (index: number) => void;
}

export default function PrescriptionSection({
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
}: Props) {
  return (
    <>

      {/* Header */}

      <div className="bg-primary/5 px-6 py-4">

        <h2 className="text-base font-semibold text-primary">

          Đơn thuốc chỉ định

        </h2>

      </div>

      <div className="p-6 space-y-6">

        {/* Combo */}

        <div>

          <label className="block text-xs font-medium mb-2">

            Combo thuốc

          </label>

          <Select
            value={selectedTemplateId}
            onValueChange={setSelectedTemplateId}
          >
            <SelectTrigger>

              <SelectValue placeholder="Chọn combo thuốc" />

            </SelectTrigger>

            <SelectContent>

              {treatmentTemplates.map((item) => (

                <SelectItem
                  key={item.id}
                  value={item.id}
                >
                  {item.name}

                </SelectItem>

              ))}

            </SelectContent>

          </Select>

        </div>

        {/* Thuốc */}

        <div className="grid grid-cols-2 gap-4">

          <div>

            <label className="block text-xs font-medium mb-2">

              Thuốc

            </label>

            <Select
              value={selectedMedicineId}
              onValueChange={setSelectedMedicineId}
            >

              <SelectTrigger>

                <SelectValue placeholder="Chọn thuốc" />

              </SelectTrigger>

              <SelectContent>

                {medicines.map((med) => (

                  <SelectItem
                    key={med.id}
                    value={med.id}
                  >

                    {med.name} ({med.unit})

                  </SelectItem>

                ))}

              </SelectContent>

            </Select>

          </div>

          <div>

            <label className="block text-xs font-medium mb-2">

              Số lượng

            </label>

            <Input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />

          </div>

        </div>

        {/* Liều */}

        <div>

          <label className="block text-xs font-medium mb-2">

            Liều dùng

          </label>

          <Input
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
          />

        </div>

        {/* Ghi chú */}

        <div>

          <label className="block text-xs font-medium mb-2">

            Lưu ý

          </label>

          <Input
            value={medicineNotes}
            onChange={(e) => setMedicineNotes(e.target.value)}
          />

        </div>

        <Button
          className="w-full"
          onClick={handleAddMedicine}
        >

          Thêm vào đơn thuốc

        </Button>

        {/* Danh sách */}

        {prescriptionItems.length > 0 && (

          <div className="space-y-3">

            <h3 className="font-semibold">

              Thuốc đã kê

            </h3>

            {prescriptionItems.map((item, index) => (

              <div
                key={index}
                className="border rounded-lg p-4 flex justify-between"
              >

                <div>

                  <p className="font-medium">

                    {item.medicineName}

                  </p>

                  <p className="text-sm text-muted-foreground">

                    {item.quantity} {item.unit} • {item.dosage}

                  </p>

                  {item.notes && (

                    <p className="text-xs italic">

                      {item.notes}

                    </p>

                  )}

                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveMedicine(index)}
                >

                  Xóa

                </Button>

              </div>

            ))}

          </div>

        )}

        <Textarea
          rows={3}
          value={prescriptionNotes}
          onChange={(e) =>
            setPrescriptionNotes(e.target.value)
          }
          placeholder="Hướng dẫn sử dụng thuốc..."
        />

      </div>

    </>
  );
}