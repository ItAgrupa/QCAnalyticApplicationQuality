"""Email notification service — uses Python built-in smtplib (no extra dependency).

Configure via environment variables:
    SMTP_HOST      e.g. smtp.gmail.com
    SMTP_PORT      587 (TLS) or 465 (SSL)
    SMTP_USER      your-email@gmail.com
    SMTP_PASSWORD  Gmail App Password (not your regular password)
    FROM_EMAIL     sender address (defaults to SMTP_USER)
"""
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

log = logging.getLogger(__name__)

_HOST     = os.getenv("SMTP_HOST", "")
_PORT     = int(os.getenv("SMTP_PORT", "587"))
_USER     = os.getenv("SMTP_USER", "")
_PASSWORD = os.getenv("SMTP_PASSWORD", "")
_FROM     = os.getenv("FROM_EMAIL", _USER)


def _smtp_configured() -> bool:
    return bool(_HOST and _USER and _PASSWORD)


def send_email(to: list[str], subject: str, html: str) -> bool:
    """Send an HTML email. Returns True on success, False on failure (never raises)."""
    if not _smtp_configured():
        log.warning("Email not sent — SMTP not configured (set SMTP_HOST/SMTP_USER/SMTP_PASSWORD)")
        return False
    if not to:
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = _FROM
    msg["To"]      = ", ".join(to)
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        if _PORT == 465:
            with smtplib.SMTP_SSL(_HOST, _PORT, timeout=10) as server:
                server.login(_USER, _PASSWORD)
                server.sendmail(_FROM, to, msg.as_string())
        else:
            with smtplib.SMTP(_HOST, _PORT, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.login(_USER, _PASSWORD)
                server.sendmail(_FROM, to, msg.as_string())
        log.info("Email sent to %s — %s", to, subject)
        return True
    except Exception as exc:
        log.error("Email send failed: %s", exc)
        return False


# ── Alert templates ───────────────────────────────────────────────────────────

def send_load_alert(
    recipients: list[str],
    load_ref: str,
    container: str | None,
    inspection_date: str,
    client_name: str,
    total_pallets: int,
    passed: int,
    failed: int,
    held: int,
    issues: str | None,
    app_url: str,
    load_id: int,
) -> bool:
    not_passed = failed + held
    subject = f"[Quality Alert] Load {load_ref} — {not_passed} pallet(s) not passed"

    status_color = "#c62828" if failed > 0 else "#e65100"
    status_label = "REJECTED" if failed > 0 else "ON HOLD"

    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#792482;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:11px;letter-spacing:2px;text-transform:uppercase;">
              Magopco · Quality Intelligence Platform
            </p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">
              Quality Alert
            </h1>
          </td>
        </tr>

        <!-- Status banner -->
        <tr>
          <td style="background:{status_color};padding:12px 32px;">
            <p style="margin:0;color:#ffffff;font-size:14px;font-weight:700;">
              ⚠ Load {load_ref} has pallets with status: {status_label}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">

            <!-- Load details -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f9f4fc;border-radius:6px;padding:16px;margin-bottom:24px;">
              <tr>
                <td style="padding:6px 16px;">
                  <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Load Reference</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#333;">{load_ref}</p>
                </td>
                <td style="padding:6px 16px;">
                  <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Container</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#333;">{container or '—'}</p>
                </td>
                <td style="padding:6px 16px;">
                  <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Inspection Date</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#333;">{inspection_date}</p>
                </td>
                <td style="padding:6px 16px;">
                  <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Client</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#333;">{client_name}</p>
                </td>
              </tr>
            </table>

            <!-- Pallet summary -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td align="center" style="padding:8px;">
                  <div style="background:#e8f5e9;border-radius:8px;padding:16px 24px;">
                    <p style="margin:0;font-size:28px;font-weight:900;color:#2e7d32;">{passed}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#555;text-transform:uppercase;">Passed</p>
                  </div>
                </td>
                <td align="center" style="padding:8px;">
                  <div style="background:#ffebee;border-radius:8px;padding:16px 24px;">
                    <p style="margin:0;font-size:28px;font-weight:900;color:#c62828;">{failed}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#555;text-transform:uppercase;">Rejected</p>
                  </div>
                </td>
                <td align="center" style="padding:8px;">
                  <div style="background:#fff3e0;border-radius:8px;padding:16px 24px;">
                    <p style="margin:0;font-size:28px;font-weight:900;color:#e65100;">{held}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#555;text-transform:uppercase;">On Hold</p>
                  </div>
                </td>
                <td align="center" style="padding:8px;">
                  <div style="background:#f5f5f5;border-radius:8px;padding:16px 24px;">
                    <p style="margin:0;font-size:28px;font-weight:900;color:#333;">{total_pallets}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#555;text-transform:uppercase;">Total</p>
                  </div>
                </td>
              </tr>
            </table>

            {f'<div style="background:#fff8e1;border-left:4px solid #f57f17;padding:12px 16px;border-radius:4px;margin-bottom:24px;"><p style="margin:0;font-size:13px;color:#555;"><strong>Main issue:</strong> {issues}</p></div>' if issues else ''}

            <!-- CTA -->
            <div style="text-align:center;margin:24px 0;">
              <a href="{app_url}/reports/{load_id}"
                 style="background:#792482;color:#ffffff;text-decoration:none;padding:14px 32px;
                        border-radius:6px;font-size:14px;font-weight:700;display:inline-block;">
                View Full Report →
              </a>
            </div>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f4fc;padding:16px 32px;border-top:1px solid #ede7f6;">
            <p style="margin:0;font-size:11px;color:#999;text-align:center;">
              Magopco Quality Intelligence Platform · You are receiving this because you enabled email alerts.<br>
              To unsubscribe, go to Settings → Email Alerts in the platform.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    return send_email(recipients, subject, html)
