"use client";

import {
  Check,
  X,
  Phone,
  Mail,
  User,
  Calendar,
  Stethoscope,
  ClipboardList,
  Inbox,
} from "lucide-react";

interface PendingAppointment {
  id: string;
  patient: string;
  phone: string;
  email: string;
  dentist: string;
  service: string;
  date: string;
  time: string;
  source: string;
  status: "Pending" | "Confirmed" | "Rejected";
  attendance: string;
}

interface PendingReviewTabProps {
  pendingAppointments: PendingAppointment[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}


export default function PendingReviewTab({
  pendingAppointments,
  onAccept,
  onReject,
}: PendingReviewTabProps) {
  return (
    <div className="space-y-4 w-full">
      <div className="rounded-2xl border border-slate-900/5 bg-white/90 p-5 shadow-sm backdrop-blur-sm flex items-start gap-3">
        <ClipboardList className="h-5 w-5 text-[#7da3b3] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Review incoming requests</p>
          <p className="text-xs text-slate-500 mt-0.5">
            New requests land here first. Confirm an appointment to add it to the main list, or reject it to turn the patient away.
          </p>
        </div>
      </div>

      {pendingAppointments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-10 text-center">
          <Inbox className="h-6 w-6 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-500">No pending requests right now</p>
          <p className="text-xs text-slate-400 mt-1">New online or desk requests will show up here for review.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pendingAppointments.map((appt) => (
            <div
              key={appt.id}
              className="relative overflow-hidden rounded-2xl border border-slate-900/5 bg-white/90 p-5 pl-6 shadow-sm backdrop-blur-sm space-y-3"
            >
              <span className="absolute left-0 top-0 h-full w-1.5 bg-[#7da3b3]" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-sky-50 flex items-center justify-center text-sky-700 font-bold shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{appt.patient}</p>
                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${
                      appt.source === "Online" ? "bg-purple-50 text-purple-700 border border-purple-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                    }`}>{appt.source}</span>
                  </div>
                </div>
                <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  Pending
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" /> {appt.phone}</p>
                <p className="flex items-center gap-1.5 truncate"><Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" /> <span className="truncate">{appt.email}</span></p>
                <p className="flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5 text-slate-400" /> {appt.dentist}</p>
                <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" /> {appt.date} · {appt.time}</p>
              </div>

              <div className="text-xs font-medium text-slate-800">
                <span className="inline-block bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
                  {appt.service}
                </span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onAccept(appt.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-[#7da3b3] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#6b92a2] transition-colors"
                >
                  <Check className="h-3.5 w-3.5" /> Confirm
                </button>
                <button
                  onClick={() => onReject(appt.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-500 border border-slate-200 shadow-sm hover:bg-slate-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}