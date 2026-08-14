import { transporter } from "@/lib/email/mailer";

export async function sendPatientReportEmail(
  email: string,
  patientName: string,
  reportTitle: string,
  pdfBuffer: Buffer,
  filename: string
) {
  await transporter.sendMail({
    from: `"DMS System" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: `Your Dental Report: ${reportTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            
            <!-- Header Banner -->
            <tr>
              <td style="background-color: #0284c7; padding: 32px 24px; text-align: center;">
                <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0; letter-spacing: -0.5px;">
                  Dental Management System
                </h1>
              </td>
            </tr>

            <!-- Body Content -->
            <tr>
              <td style="padding: 32px 32px 24px 32px;">
                <h2 style="color: #1f2937; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 16px;">
                  Hello ${patientName},
                </h2>
                <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">
                  Your medical report is ready. We have attached the document directly to this email for your convenience.
                </p>

                <!-- Report Info Box -->
                <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                  <p style="margin: 0; color: #0369a1; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Attached Document
                  </p>
                  <p style="margin: 4px 0 0 0; color: #0c4a6e; font-size: 16px; font-weight: 700;">
                    ${reportTitle}
                  </p>
                </div>

                <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
                  If you have any questions or need to reschedule an appointment, please feel free to contact our clinic.
                </p>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding: 0 32px;">
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 24px 32px; text-align: center; background-color: #fafafa;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.4;">
                  This is an automated email from <strong>Dental Management System</strong>.<br />
                  Please do not reply directly to this email.
                </p>
              </td>
            </tr>

          </table>
        </body>
      </html>
    `,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}