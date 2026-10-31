import nodemailer from "nodemailer";
import { getSettings } from "./queries/settings";
import { BUSINESS } from "@contracts/rates";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export async function loadSmtpConfig(): Promise<SmtpConfig | null> {
  const s = await getSettings([
    "smtp_host",
    "smtp_port",
    "smtp_user",
    "smtp_pass",
    "smtp_from",
  ]);
  if (!s.smtp_host || !s.smtp_user || !s.smtp_pass) return null;
  return {
    host: s.smtp_host,
    port: Number(s.smtp_port ?? "587"),
    user: s.smtp_user,
    pass: s.smtp_pass,
    from:
      s.smtp_from || `${BUSINESS.name} <${s.smtp_user}>`,
  };
}

export function isSmtpConfigured(config: SmtpConfig | null): config is SmtpConfig {
  return config !== null;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
  /** Set for inline images referenced by <img src="cid:..."> in the HTML body. */
  cid?: string;
}

function makeTransport(config: SmtpConfig, port: number) {
  return nodemailer.createTransport({
    host: config.host,
    port,
    secure: port === 465,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export async function sendMail(
  config: SmtpConfig,
  to: string,
  subject: string,
  text: string,
  attachments?: MailAttachment[],
  html?: string,
): Promise<void> {
  const message = { from: config.from, to, subject, text, attachments, html };
  try {
    await makeTransport(config, config.port).sendMail(message);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code ?? "";
    const connectionish = ["ETIMEDOUT", "ESOCKET", "ECONNECTION", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH"].includes(code)
      || /timeout|timed out/i.test((err as Error)?.message ?? "");
    // Some networks block 465 — fall back to STARTTLS on 587.
    if (config.port !== 587 && connectionish) {
      await makeTransport(config, 587).sendMail(message);
      return;
    }
    throw err;
  }
}

export function campaignBodyWithFooter(body: string, _email: string): string {
  return `${body}

—
${BUSINESS.name} · ${BUSINESS.area}
${BUSINESS.phone} · ${BUSINESS.email}

You're receiving this because you subscribed on our website.
To unsubscribe: visit the website and enter your email on the unsubscribe page, or reply "unsubscribe".`;
}
