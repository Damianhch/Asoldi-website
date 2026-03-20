import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

export function canSendEmail() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendEmail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) throw new Error('SMTP not configured');
  const from = process.env.SMTP_FROM || 'Asoldi <kontakt@asoldi.com>';
  await t.sendMail({ from, to, subject, text: text || undefined, html: html || undefined });
}
