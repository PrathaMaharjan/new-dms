import axios from "axios";

const POS_URL = process.env.NEXT_PUBLIC_POS_API_URL || "http://localhost:3000";

export const posApi = axios.create({
    baseURL: POS_URL.trim() ? POS_URL : "http://localhost:3000",
});

// Helper functions for Public Booking
export const getPublicDoctors = (locationId?: string) =>
    posApi.get("/api/public/doctors", { params: { locationId } });

export const getPublicServices = (locationId?: string) =>
    posApi.get("/api/public/treatments", { params: { locationId } });

export const submitAppointmentBooking = (bookingPayload: any) =>
    posApi.post("/api/public/booking", bookingPayload);
