import { useState, useEffect } from "react";
import axios from "axios";
import type { WorkloadThresholds } from "@/lib/workload";



const DEFAULT_THRESHOLDS: WorkloadThresholds = {
  workloadHealthyMax: 15,
  workloadBusyMax: 20,
};

export function useWorkloadThresholds() {
  const [thresholds, setThresholds] =
    useState<WorkloadThresholds>(DEFAULT_THRESHOLDS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: responseBody } = await axios.get("/api/workload");
        if (!cancelled && responseBody?.success) {
          setThresholds({
            workloadHealthyMax: responseBody.data.workloadHealthyMax,
            workloadBusyMax: responseBody.data.workloadBusyMax,
          });
        }
      } catch (error) {
        console.error("Failed to load workload thresholds:", error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { thresholds, loaded };
}
