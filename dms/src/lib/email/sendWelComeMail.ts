import { transporter } from "@/lib/email/mailer";

export async function sendStaffWelcomeEmail(
  email: string,
  name: string,
  password: string,
  orgName: string,
  role: string,
) {
  await transporter.sendMail({
    from: `"DMS System" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: `Welcome to ${orgName} Dental Clinic`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
        <h2 style="color: #2563eb;">Welcome to ${orgName}!</h2>

        <p>Hi ${name},</p>

        <p>
          Your staff account has been successfully created for the
          <strong>${orgName}</strong> Dental Management System.
        </p>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> ${password}</p>
          <p><strong>Role:</strong> ${role}</p>
          <p>
            <strong>Login URL:</strong>
            <a href="${process.env.APP_URL}/login">
              ${process.env.APP_URL}/login
            </a>
          </p>
        </div>

        <p style="color:#dc2626;">
          <strong>Security Notice:</strong> Please change your password immediately after your first login.
        </p>

        <p>
          If you were not expecting this account, please contact your clinic administrator.
        </p>

        <br />

        <p>Regards,</p>
        <p><strong>${orgName} Dental Management System</strong></p>
      </div>
    `,
  });
}