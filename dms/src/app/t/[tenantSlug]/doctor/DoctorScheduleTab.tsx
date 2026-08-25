"use client";

import DoctorScheduleEditor from "./DoctorScheduleEditor";

export default function DoctorScheduleTab() {
  return (
    <div className="w-full">
      <DoctorScheduleEditor showDoctorSelector={false} />
    </div>
  );
}