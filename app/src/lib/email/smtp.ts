import nodemailer, { type Transporter } from "nodemailer";
import type { EmailMessage, EmailProvider } from "./provider";

let cached: Transporter | null = null;

function transport(): Transporter {
  if (cached) return cached;
  const url = process.env.EMAIL_SERVER;
  if (!url) {
    throw new Error("EMAIL_SERVER is not configured");
  }
  cached = nodemailer.createTransport(url);
  return cached;
}

export const SmtpProvider: EmailProvider = {
  name: "smtp",
  async send(message: EmailMessage) {
    const from =
      message.from ??
      process.env.EMAIL_FROM ??
      `Club OS <noreply@${process.env.CLUB_PUBLIC_URL?.replace(/https?:\/\//, "") ?? "localhost"}>`;

    const result = await transport().sendMail({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
    });
    return { id: result.messageId };
  },
};
