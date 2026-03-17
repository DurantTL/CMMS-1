export type RegistrationConfirmationAttendee = {
  name: string;
  role: string;
};

export type RegistrationConfirmationTemplateProps = {
  eventName: string;
  eventStartsAt: Date;
  eventEndsAt: Date;
  locationName: string | null;
  locationAddress: string | null;
  attendees: RegistrationConfirmationAttendee[];
  totalDue: number;
  paymentStatus: string;
  eventId: string;
  appUrl: string;
  contactEmail: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatPaymentStatus(status: string): string {
  const labels: Record<string, string> = {
    PAID: "Paid",
    PENDING: "Pending",
    PARTIAL: "Partially Paid",
  };
  return labels[status] ?? status;
}

export function buildRegistrationConfirmationHtml(props: RegistrationConfirmationTemplateProps): string {
  const {
    eventName,
    eventStartsAt,
    eventEndsAt,
    locationName,
    locationAddress,
    attendees,
    totalDue,
    paymentStatus,
    eventId,
    appUrl,
    contactEmail,
  } = props;

  const safeEventName = escapeHtml(eventName);
  const safeLocationName = locationName ? escapeHtml(locationName) : null;
  const safeLocationAddress = locationAddress ? escapeHtml(locationAddress) : null;
  const registrationUrl = `${appUrl}/director/events/${eventId}`;
  const safeRegistrationUrl = escapeHtml(registrationUrl);
  const safeContactEmail = contactEmail ? escapeHtml(contactEmail) : null;

  const formattedTotal = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalDue);
  const formattedPaymentStatus = escapeHtml(formatPaymentStatus(paymentStatus));

  const attendeeRows = attendees
    .map(
      (a) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${escapeHtml(a.name)}</td>` +
        `<td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${escapeHtml(a.role)}</td></tr>`,
    )
    .join("");

  const locationSection =
    safeLocationName || safeLocationAddress
      ? `<p style="margin:0 0 4px;"><strong>Location:</strong> ${safeLocationName ?? ""}` +
        (safeLocationAddress ? `<br />${safeLocationAddress}` : "") +
        `</p>`
      : "";

  const contactSection = safeContactEmail
    ? `<p style="margin:24px 0 0;color:#6b7280;font-size:14px;border-top:1px solid #e5e7eb;padding-top:16px;">` +
      `Questions? Contact us at <a href="mailto:${safeContactEmail}" style="color:#0f172a;">${safeContactEmail}</a>.` +
      `</p>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Registration Confirmation</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f7fb;font-family:Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#0f172a;color:#ffffff;padding:20px 24px;font-size:20px;font-weight:700;">
                Registration Confirmation
              </td>
            </tr>
            <tr>
              <td style="padding:24px;line-height:1.6;font-size:16px;">
                <p style="margin:0 0 20px;">Your registration for <strong>${safeEventName}</strong> has been submitted successfully.</p>

                <h2 style="margin:0 0 8px;font-size:16px;color:#0f172a;">Event Details</h2>
                <p style="margin:0 0 4px;"><strong>Dates:</strong> ${formatDate(eventStartsAt)} &ndash; ${formatDate(eventEndsAt)}</p>
                ${locationSection}

                <h2 style="margin:16px 0 8px;font-size:16px;color:#0f172a;">Attendees (${attendees.length})</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      <th style="padding:6px 8px;text-align:left;font-weight:600;font-size:14px;">Name</th>
                      <th style="padding:6px 8px;text-align:left;font-weight:600;font-size:14px;">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${attendeeRows}
                  </tbody>
                </table>

                <h2 style="margin:0 0 8px;font-size:16px;color:#0f172a;">Payment</h2>
                <p style="margin:0 0 4px;"><strong>Estimated Total:</strong> ${formattedTotal}</p>
                <p style="margin:0 0 20px;"><strong>Payment Status:</strong> ${formattedPaymentStatus}</p>

                <p style="margin:0;">
                  <a href="${safeRegistrationUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">View Registration</a>
                </p>

                ${contactSection}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
