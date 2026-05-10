export type InstallmentReminderInput = {
  memberName: string;
  invoiceNumber: string;
  installmentSequence: number;
  installmentTotal: number;
  amountFormatted: string;
  dueDate: string;
  paymentUrl: string;
  clubName: string;
};

export function installmentReminderEmail(input: InstallmentReminderInput) {
  const subject = `Reminder: ${input.clubName} installment ${input.installmentSequence}/${input.installmentTotal} due ${input.dueDate}`;
  const text = `Hi ${input.memberName},

Your next installment for invoice ${input.invoiceNumber} is due on ${input.dueDate}.
Amount: ${input.amountFormatted}

Pay online: ${input.paymentUrl}

— ${input.clubName}`;
  const html = `<p>Hi ${escapeHtml(input.memberName)},</p>
<p>Your next installment for invoice <strong>${escapeHtml(input.invoiceNumber)}</strong> is due on <strong>${escapeHtml(input.dueDate)}</strong>.<br>
Amount: <strong>${escapeHtml(input.amountFormatted)}</strong></p>
<p><a href="${escapeAttr(input.paymentUrl)}">Pay online</a></p>
<p>— ${escapeHtml(input.clubName)}</p>`;
  return { subject, text, html };
}

export type ComplianceReminderInput = {
  memberName: string;
  certType: string;
  expiresOn: string;
  clubName: string;
};

export function complianceReminderEmail(input: ComplianceReminderInput) {
  const subject = `${input.clubName}: ${input.certType} expires ${input.expiresOn}`;
  const text = `Hi ${input.memberName},

Your ${input.certType} expires on ${input.expiresOn}. Please renew to remain in good standing.

— ${input.clubName}`;
  const html = `<p>Hi ${escapeHtml(input.memberName)},</p>
<p>Your <strong>${escapeHtml(input.certType)}</strong> expires on <strong>${escapeHtml(input.expiresOn)}</strong>. Please renew to remain in good standing.</p>
<p>— ${escapeHtml(input.clubName)}</p>`;
  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
