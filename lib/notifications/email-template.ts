export interface StaffEmailContent {
  subject: string
  preview: string
  lines: string[]
  actionUrl: string
  actionLabel?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderStaffEmail(content: StaffEmailContent): { html: string; text: string } {
  const actionLabel = content.actionLabel ?? 'Open in dashboard'
  const bodyLines = content.lines.map((line) => `<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.5;">${escapeHtml(line)}</p>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:24px;background:#f6f5fa;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e9ecef;">
    <div style="background:#3C216C;padding:20px 24px;">
      <p style="margin:0;font-size:18px;font-weight:600;color:#D4A62E;">MOJO Apartments</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">${escapeHtml(content.preview)}</p>
    </div>
    <div style="padding:24px;">
      ${bodyLines}
      <a href="${escapeHtml(content.actionUrl)}" style="display:inline-block;margin-top:8px;background:#3C216C;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px;">${escapeHtml(actionLabel)}</a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #e9ecef;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">Property management alert · you can turn these off in Settings</p>
    </div>
  </div>
</body>
</html>`

  const text = [
    content.subject,
    '',
    ...content.lines,
    '',
    `${actionLabel}: ${content.actionUrl}`,
  ].join('\n')

  return { html, text }
}
