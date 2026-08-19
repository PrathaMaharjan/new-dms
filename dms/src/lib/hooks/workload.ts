import { useState, useEffect } from "react";
import axios from "axios";
import type { WorkloadThresholds } from "@/lib/workload";

const DEFAULT_THRESHOLDS: WorkloadThresholds = {
  workloadHealthyMax: 15,
  workloadBusyMax: 20,
};

export function useWorkloadThresholds(locationId?: string | null) {
  const [thresholds, setThresholds] =
    useState<WorkloadThresholds>(DEFAULT_THRESHOLDS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let locId = locationId;
        if (!locId) {
          try {
            locId =
              localStorage.getItem("dms_location_id") ||
              localStorage.getItem("current_location_id") ||
              localStorage.getItem("locationId");
          } catch (e) {}
        }

        if (locId) {
          try {
            const savedLoc = localStorage.getItem(`workload_thresholds_${locId}`);
            if (savedLoc) {
              const parsed = JSON.parse(savedLoc);
              if (parsed?.workloadHealthyMax && parsed?.workloadBusyMax) {
                if (!cancelled) {
                  setThresholds({
                    workloadHealthyMax: Number(parsed.workloadHealthyMax),
                    workloadBusyMax: Number(parsed.workloadBusyMax),
                  });
                  setLoaded(true);
                  return;
                }
              }
            }
          } catch (e) {}
        }

        const { data: responseBody } = await axios.get("/api/workload");
        if (!cancelled && responseBody?.success) {
          setThresholds({
            workloadHealthyMax: responseBody.data.workloadHealthyMax ?? 15,
            workloadBusyMax: responseBody.data.workloadBusyMax ?? 20,
          });
        }
      } catch (error) {
        console.error("Failed to load workload thresholds:", error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    load();

    const handleUpdate = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (!locationId || customEvt.detail?.locationId === locationId) {
        load();
      }
    };

    window.addEventListener("workload_updated", handleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("workload_updated", handleUpdate);
    };
  }, [locationId]);

  return { thresholds, loaded };
}
