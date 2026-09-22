import axios from "axios";

const rawUrl = process.env.NEXT_PUBLIC_POS_API_URL?.trim();
const POS_URL = (rawUrl && rawUrl.length > 0 ? rawUrl : "http://localhost:3000").replace(/\/$/, "");

export const posApi = axios.create({
    baseURL: POS_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Helper functions for Public Booking
export const getPublicLocations = (tenantSlug?: string) =>
    posApi.get("/api/public/locations", { params: tenantSlug ? { tenantSlug } : undefined });

export const getPublicDoctors = (params?: { locationId?: string; tenantSlug?: string }) =>
    posApi.get("/api/public/doctors", { params });

export const getPublicServices = (params?: { locationId?: string; tenantSlug?: string }) =>
    posApi.get("/api/public/treatments", { params });

export const submitAppointmentBooking = (bookingPayload: any) =>
    posApi.post("/api/public/booking", bookingPayload);

export const getOrganizationBySlug = (slug: string) =>
    posApi.get(`/api/public/organizations/${slug}`);
