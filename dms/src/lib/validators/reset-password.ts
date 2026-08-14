import z from "zod";

export const requestOtpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

// export const resetPasswordSchema = z
//   .object({
//     email: z.string().email("Please enter a valid email address"),
//     otp: z.string().length(6, "Enter the 6-digit code"),
//     newPassword: z.string().min(8, "Password must be at least 8 characters"),
//     confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
//   })
//   .refine((data) => data.newPassword === data.confirmPassword, {
//     message: "Passwords do not match",
//     path: ["confirmPassword"],
//   });

  export const resetPasswordSchema = z
  .object({
    resetToken: z.string().min(1, "Missing reset token"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });