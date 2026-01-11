// ===============================
// NOTIFICATIONS (EMAIL)
// ===============================
const nodemailer = require("nodemailer");
const { defineString } = require("firebase-functions/params");

// 🔐 Environment parameters (Firebase Functions v7+)
const EMAIL_USER = defineString("EMAIL_USER");
const EMAIL_PASS = defineString("EMAIL_PASS");

// ---------------- TRANSPORTER (LAZY INIT) ----------------
function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER.value(),
      pass: EMAIL_PASS.value(),
    },
  });
}

// ---------------- BASE HTML TEMPLATE ----------------
function baseTemplate({ title, body }) {
  return `
  <div style="font-family: Roboto, Arial, sans-serif; background:#f6f8fc; padding:30px;">
    <div style="max-width:600px; margin:auto; background:#ffffff;
                border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1);
                overflow:hidden;">

      <div style="padding:20px 24px; border-bottom:1px solid #e0e0e0;">
        <h2 style="margin:0; font-size:20px; color:#202124;">
          ${title}
        </h2>
      </div>

      <div style="padding:24px; font-size:15px; color:#202124; line-height:1.6;">
        ${body}
      </div>

      <div style="padding:16px 24px; background:#f6f8fc;
                  font-size:12px; color:#5f6368; text-align:center;">
        This is an automated message from <b>Samagra</b>.<br/>
        Please do not reply to this email.
      </div>

    </div>
  </div>
  `;
}

// =======================================================
// SEND APPOINTMENT EMAIL
// =======================================================
exports.sendAppointmentEmail = async ({
  to,
  subject,
  title,
  message,
  details = {},
}) => {
  const {
    doctorName,
    patientName,
    appointmentDate,
    startTime,
    endTime,
    status,
  } = details;

  // ✅ Emulator safety
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.log("📧 EMAIL (EMULATOR MODE)");
    console.log({ to, subject, title, message, details });
    return;
  }

  const transporter = getTransporter();

  const body = `
    <p>${message}</p>

    <div style="margin-top:16px; padding:16px;
                background:#f1f3f4; border-radius:6px;">
      ${doctorName ? `<p><b>Doctor:</b> ${doctorName}</p>` : ""}
      ${patientName ? `<p><b>Patient:</b> ${patientName}</p>` : ""}
      ${appointmentDate ? `<p><b>Date:</b> ${appointmentDate}</p>` : ""}
      ${startTime ? `<p><b>Time:</b> ${startTime} – ${endTime}</p>` : ""}
      ${status ? `<p><b>Status:</b> ${status}</p>` : ""}
    </div>

    <p style="margin-top:20px;">
      You can view more details by logging into your dashboard.
    </p>
  `;

  const html = baseTemplate({ title, body });

  await transporter.sendMail({
    from: `"Samagra" <${EMAIL_USER.value()}>`,
    to,
    subject,
    html,
  });
};
