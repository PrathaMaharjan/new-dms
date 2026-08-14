import { transporter } from "@/lib/email/mailer";

export async function sendAppointmentConfirmedEmail(
  email: string,
  patientName: string,
  treatmentName: string,
  startTime: Date
) {
  const formatted = startTime.toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });
    await transporter.sendMail({
    from: `<${process.env.EMAIL_FROM}>`,
    to: email,
    subject: "Your Appointment is Confirmed",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
        <h2 style="color: #059669;">Appointment Confirmed</h2>
        <p>Hi ${patientName},</p>
        <p>Your appointment has been confirmed.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
          <p><strong>Treatment:</strong> ${treatmentName}</p>
          <p><strong>Date & Time:</strong> ${formatted}</p>
        </div>
        <p>We look forward to seeing you.</p>
        <br />
        <p>Regards,</p>
        <p><strong>Dental Management System</strong></p>
      </div>
    `,
  });
}
export async function sendAppointmentCancelledEmail(
  email: string,
  patientName: string,
  treatmentName: string,
  startTime: Date
) {
  const formatted = startTime.toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });
   await transporter.sendMail({
    from: `<${process.env.EMAIL_FROM}>`,
    to: email,
    subject: "Your Appointment has been Cancelled",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
        <h2 style="color: #dc2626;">Appointment Cancelled</h2>
        <p>Hi ${patientName},</p>
        <p>Your appointment below has been cancelled.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
          <p><strong>Treatment:</strong> ${treatmentName}</p>
          <p><strong>Date & Time:</strong> ${formatted}</p>
        </div>
        <p>If you'd like to reschedule, please contact us or book a new appointment.</p>
        <br />
        <p>Regards,</p>
        <p><strong>Dental Management System</strong></p>
      </div>
    `,
  });
}