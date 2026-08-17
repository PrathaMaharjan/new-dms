// import { transporter } from "@/lib/email/mailer";

// export async function sendBookingRequestReceived(
//   email: string,
//   patientName: string,
//   treatmentName: string,
//   preferredDate: string,
//   preferredTime: string,
//   clinicName: string
// ) {

//   await transporter.sendMail({
//     from: `"${clinicName}" <${process.env.EMAIL_FROM}>`,
//     to: email,
//     subject: "We've received your appointment request",
//     html: `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
//         <h2 style="color: #059669;">Request Received</h2>
//         <p>Hi ${patientName},</p>
//         <p>Thanks for requesting an appointment. Our team will review it and confirm shortly.</p>
//         <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
//           <p><strong>Treatment:</strong> ${treatmentName}</p>
//           <p><strong>Requested:</strong> ${preferredDate} at ${preferredTime}</p>
//         </div>
//         <p>We'll be in touch soon to confirm.</p>
//         <br />
//         <p>Regards,</p>
//         <p><strong>${clinicName}</strong></p>
//       </div>
//     `,
//   });
// }


import { transporter } from "@/lib/email/mailer";

export async function sendBookingRequestReceived(
  email: string,
  patientName: string,
  treatmentName: string,
  preferredDate: string,
  preferredTime: string,
  clinicName: string
) {
  await transporter.sendMail({
    from: `"${clinicName}" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: "We've received your appointment request",
    html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Request</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; line-height: 1.6;">
      
      <!-- Outer wrapper for background color -->
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 40px 20px;">
        <tr>
          <td align="center">
            
            <!-- Main Content Container -->
            <table border="0" cellspacing="0" cellpadding="0" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
              
              <!-- Header -->
              <tr>
                <td style="background-color: #059669; padding: 32px 24px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">Appointment Request</h1>
                </td>
              </tr>

              <!-- Body Content -->
              <tr>
                <td style="padding: 40px 32px;">
                  <p style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">Hello ${patientName},</p>
                  
                  <p style="margin: 0 0 32px 0; color: #4b5563; font-size: 16px;">
                    Thank you for reaching out. We have successfully received your appointment request. Our team is currently reviewing it and will get back to you shortly with a final confirmation.
                  </p>
                  
                  <!-- Details Card -->
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 32px;">
                    <tr>
                      <td style="padding: 24px;">
                        <h3 style="margin: 0 0 20px 0; color: #0f172a; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Request Details</h3>
                        
                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="padding-bottom: 16px;">
                              <span style="color: #64748b; font-size: 14px; display: block; margin-bottom: 4px;">Treatment</span>
                              <span style="color: #1e293b; font-size: 16px; font-weight: 600;">${treatmentName}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding-bottom: 16px;">
                              <span style="color: #64748b; font-size: 14px; display: block; margin-bottom: 4px;">Preferred Date</span>
                              <span style="color: #1e293b; font-size: 16px; font-weight: 600;">${preferredDate}</span>
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <span style="color: #64748b; font-size: 14px; display: block; margin-bottom: 4px;">Preferred Time</span>
                              <span style="color: #1e293b; font-size: 16px; font-weight: 600;">${preferredTime}</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Sign Off -->
                  <p style="margin: 0 0 8px 0; color: #4b5563; font-size: 16px;">If you have any immediate questions, please don't hesitate to call us.</p>
                  <p style="margin: 0; color: #4b5563; font-size: 16px;">Warm regards,</p>
                  <p style="margin: 12px 0 0 0; color: #1f2937; font-size: 18px; font-weight: 600;">${clinicName}</p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 13px;">This is an automated message. Please do not reply directly to this email.</p>
                  <p style="margin: 0; color: #9ca3af; font-size: 13px;">&copy; ${new Date().getFullYear()} ${clinicName}. All rights reserved.</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `,
  });
}