// src/lib/email/sendPasswordResetOtpEmail.ts
import { transporter } from "@/lib/email/mailer";

export async function sendPasswordResetOtpEmail(email: string, name: string, otp: string) {
  await transporter.sendMail({
    from: `"DMS System" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: "Your Password Reset Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>

        <p>Hi ${name},</p>

        <p>
          We received a request to reset your password. Use the code below to
          continue - it expires in <strong>10 minutes</strong>.
        </p>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:24px;margin:20px 0;text-align:center;">
          <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#2563eb;">
            ${otp}
          </span>
        </div>

        <p style="color:#dc2626;">
          <strong>Security Notice:</strong> If you didn't request this, you can safely
          ignore this email - your password will not be changed. Never share this code
          with anyone, including someone claiming to be from support.
        </p>

        <br />

        <p>Regards,</p>
        <p><strong>Dental Management System</strong></p>
      </div>
    `,
  });
}