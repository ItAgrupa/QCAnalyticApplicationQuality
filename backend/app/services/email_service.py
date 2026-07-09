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


def smtp_configured() -> bool:
    return bool(_HOST and _USER and _PASSWORD)


def send_email(to: list[str], subject: str, html: str) -> bool:
    """Send an HTML email. Returns True on success, False on failure (never raises)."""
    if not smtp_configured():
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


# ── Shared header/footer ──────────────────────────────────────────────────────

def _email_header(title: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#792482;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:11px;letter-spacing:2px;text-transform:uppercase;">
              Magopco · Quality Intelligence Platform
            </p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">{title}</h1>
          </td>
        </tr>"""


def _email_footer() -> str:
    return """
        <tr>
          <td style="background:#f9f4fc;padding:16px 32px;border-top:1px solid #ede7f6;">
            <p style="margin:0;font-size:11px;color:#999;text-align:center;">
              Magopco Quality Intelligence Platform<br>
              To manage your notification preferences, go to Settings &rarr; Notifications in the platform.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _load_detail_block(
    load_ref: str, container: str | None, inspection_date: str, client_name: str
) -> str:
    return f"""
<table width="100%" cellpadding="0" cellspacing="0"
       style="background:#f9f4fc;border-radius:6px;padding:16px;margin-bottom:24px;">
  <tr>
    <td style="padding:6px 16px;">
      <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Load Reference</p>
      <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#333;">{load_ref}</p>
    </td>
    <td style="padding:6px 16px;">
      <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Container</p>
      <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#333;">{container or '&mdash;'}</p>
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
</table>"""


def _pallet_summary_block(passed: int, failed: int, held: int, total: int) -> str:
    return f"""
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
        <p style="margin:0;font-size:28px;font-weight:900;color:#333;">{total}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#555;text-transform:uppercase;">Total</p>
      </div>
    </td>
  </tr>
</table>"""


def _cta_button(label: str, url: str) -> str:
    return f"""
<div style="text-align:center;margin:24px 0;">
  <a href="{url}" style="background:#792482;color:#ffffff;text-decoration:none;padding:14px 32px;
             border-radius:6px;font-size:14px;font-weight:700;display:inline-block;">{label}</a>
</div>"""


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

    issues_block = (
        f'<div style="background:#fff8e1;border-left:4px solid #f57f17;padding:12px 16px;'
        f'border-radius:4px;margin-bottom:24px;">'
        f'<p style="margin:0;font-size:13px;color:#555;"><strong>Main issue:</strong> {issues}</p></div>'
        if issues else ''
    )

    html = (
        _email_header("Quality Alert")
        + f"""
        <tr>
          <td style="background:{status_color};padding:12px 32px;">
            <p style="margin:0;color:#ffffff;font-size:14px;font-weight:700;">
              &#9888; Load {load_ref} has pallets with status: {status_label}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            {_load_detail_block(load_ref, container, inspection_date, client_name)}
            {_pallet_summary_block(passed, failed, held, total_pallets)}
            {issues_block}
            {_cta_button("View Full Report &rarr;", f"{app_url}/reports/{load_id}")}
          </td>
        </tr>"""
        + _email_footer()
    )
    return send_email(recipients, subject, html)


def send_all_passed_alert(
    recipients: list[str],
    load_ref: str,
    container: str | None,
    inspection_date: str,
    client_name: str,
    total_pallets: int,
    pass_rate: float,
    app_url: str,
    load_id: int,
) -> bool:
    subject = f"[Quality] Load {load_ref} — All {total_pallets} pallet(s) PASSED"

    html = (
        _email_header("Load Passed")
        + f"""
        <tr>
          <td style="background:#2e7d32;padding:12px 32px;">
            <p style="margin:0;color:#ffffff;font-size:14px;font-weight:700;">
              &#10003; Load {load_ref} achieved a {pass_rate:.0f}% pass rate
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            {_load_detail_block(load_ref, container, inspection_date, client_name)}
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td align="center" style="padding:8px;">
                  <div style="background:#e8f5e9;border-radius:8px;padding:24px 32px;">
                    <p style="margin:0;font-size:40px;font-weight:900;color:#2e7d32;">{total_pallets}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#555;text-transform:uppercase;">Pallets Passed</p>
                  </div>
                </td>
                <td align="center" style="padding:8px;">
                  <div style="background:#e8f5e9;border-radius:8px;padding:24px 32px;">
                    <p style="margin:0;font-size:40px;font-weight:900;color:#2e7d32;">{pass_rate:.0f}%</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#555;text-transform:uppercase;">Pass Rate</p>
                  </div>
                </td>
              </tr>
            </table>
            {_cta_button("View Full Report &rarr;", f"{app_url}/reports/{load_id}")}
          </td>
        </tr>"""
        + _email_footer()
    )
    return send_email(recipients, subject, html)


def send_analysis_done_alert(
    recipients: list[str],
    load_ref: str,
    container: str | None,
    inspection_date: str,
    client_name: str,
    total_pallets: int,
    passed: int,
    failed: int,
    held: int,
    final_status: str,
    pass_rate: float,
    app_url: str,
    load_id: int,
) -> bool:
    subject = f"[Analysis Complete] Load {load_ref} — {final_status} ({pass_rate:.0f}% pass rate)"
    status_colors = {"PASS": "#2e7d32", "HOLD": "#e65100", "REJECT": "#c62828"}
    banner_color = status_colors.get(final_status, "#555555")

    html = (
        _email_header("Analysis Complete")
        + f"""
        <tr>
          <td style="background:{banner_color};padding:12px 32px;">
            <p style="margin:0;color:#ffffff;font-size:14px;font-weight:700;">
              Load {load_ref} analysis complete &mdash; Final status: {final_status}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            {_load_detail_block(load_ref, container, inspection_date, client_name)}
            {_pallet_summary_block(passed, failed, held, total_pallets)}
            <div style="background:#f9f4fc;border-radius:6px;padding:16px;margin-bottom:24px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Pass Rate</p>
              <p style="margin:4px 0 0;font-size:32px;font-weight:900;color:{banner_color};">{pass_rate:.0f}%</p>
            </div>
            {_cta_button("View Full Report &rarr;", f"{app_url}/reports/{load_id}")}
          </td>
        </tr>"""
        + _email_footer()
    )
    return send_email(recipients, subject, html)


def send_import_ready_alert(
    recipients: list[str],
    file_name: str,
    client_name: str,
    confidence: float,
    pallet_count: int,
    import_id: int,
    app_url: str,
) -> bool:
    subject = f"[Import Ready] {file_name} is ready for validation"
    confidence_color = "#2e7d32" if confidence >= 85 else ("#e65100" if confidence >= 65 else "#c62828")
    confidence_label = "High" if confidence >= 85 else ("Medium" if confidence >= 65 else "Low")

    html = (
        _email_header("Import Ready for Validation")
        + f"""
        <tr>
          <td style="background:#1565c0;padding:12px 32px;">
            <p style="margin:0;color:#ffffff;font-size:14px;font-weight:700;">
              A new PDF report has been extracted and is awaiting your review
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f9f4fc;border-radius:6px;padding:16px;margin-bottom:24px;">
              <tr>
                <td style="padding:6px 16px;">
                  <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">File</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#333;">{file_name}</p>
                </td>
                <td style="padding:6px 16px;">
                  <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Client</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#333;">{client_name}</p>
                </td>
                <td style="padding:6px 16px;">
                  <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Pallets Found</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#333;">{pallet_count}</p>
                </td>
                <td style="padding:6px 16px;">
                  <p style="margin:0;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Confidence</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:{confidence_color};">
                    {confidence:.0f}% &mdash; {confidence_label}
                  </p>
                </td>
              </tr>
            </table>
            <p style="font-size:13px;color:#555;margin-bottom:24px;">
              Please review the extracted data and validate or correct any fields before the quality
              analysis can be run.
            </p>
            {_cta_button("Review &amp; Validate &rarr;", f"{app_url}/imports")}
          </td>
        </tr>"""
        + _email_footer()
    )
    return send_email(recipients, subject, html)
