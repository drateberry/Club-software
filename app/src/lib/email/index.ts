import { SmtpProvider } from "./smtp";
import type { EmailProvider } from "./provider";

export function getEmailProvider(): EmailProvider {
  // The single SMTP provider works with any SMTP endpoint, including Amazon
  // SES (smtp+ssl://email-smtp.us-east-1.amazonaws.com), Postmark, Mailgun,
  // or the local Mailpit dev relay. EMAIL_SERVER drives the choice.
  return SmtpProvider;
}

export type { EmailMessage, EmailProvider } from "./provider";
