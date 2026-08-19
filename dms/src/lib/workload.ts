export type WorkloadStatus = "healthy" | "busy" | "heavy";
import { Sparkles, AlertTriangle, Flame } from "lucide-react"; 

export const WORKLOAD_ICON: Record<WorkloadStatus, typeof Sparkles> = {
  healthy: Sparkles,
  busy: AlertTriangle,
  heavy: Flame,
};
export type WorkloadThresholds = {
  workloadHealthyMax: number;
  workloadBusyMax: number;
};

export function getWorkloadStatus(count: number, thresholds: WorkloadThresholds): WorkloadStatus {
  if (count <= thresholds.workloadHealthyMax) return "healthy";
  if (count <= thresholds.workloadBusyMax) return "busy";
  return "heavy";
}

export const WORKLOAD_DISPLAY: Record<WorkloadStatus, { label: string; textColor: string; bgColor: string; borderAccent: string }> = {
  healthy: { label: "Healthy pace", textColor: "text-emerald-600", bgColor: "bg-emerald-50", borderAccent: "border-emerald-400" },
  busy: { label: "Busy day", textColor: "text-amber-600", bgColor: "bg-amber-50", borderAccent: "border-amber-400" },
  heavy: { label: "Heavy load", textColor: "text-rose-600", bgColor: "bg-rose-50", borderAccent: "border-rose-400" },
};