import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendPasswordResetEmail = async (toEmail, resetUrl) => {
  await transporter.sendMail({
    from:    `"Hotel HMS" <${process.env.SMTP_USER}>`,
    to:      toEmail,
    subject: "Password Reset Request",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:8px;">
        <h2 style="color:#1a1a1a;margin-bottom:8px;">Reset your password</h2>
        <p style="color:#555;line-height:1.6;">
          We received a request to reset the password for your Hotel HMS account.
          Click the button below to choose a new password.
          This link expires in <strong>15 minutes</strong>.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${resetUrl}"
             style="background:#2563eb;color:#fff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color:#888;font-size:13px;line-height:1.5;">
          If you didn't request this, you can safely ignore this email — your password will remain unchanged.<br><br>
          Or copy this link into your browser:<br>
          <a href="${resetUrl}" style="color:#2563eb;word-break:break-all;">${resetUrl}</a>
        </p>
      </div>
    `,
  });
};
