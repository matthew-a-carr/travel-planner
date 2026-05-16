export type BaseEmailTemplateInput = {
  readonly previewText: string;
  readonly greeting: string;
  readonly paragraphs: readonly string[];
  readonly action?: {
    readonly label: string;
    readonly url: string;
  };
  readonly closingLines: readonly string[];
};

export type RenderedEmailBody = {
  readonly text: string;
  readonly html: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderParagraphText(paragraphs: readonly string[]): string {
  return paragraphs.join('\n\n');
}

function renderParagraphHtml(paragraphs: readonly string[]): string {
  return paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#18181b;">${escapeHtml(paragraph)}</p>`,
    )
    .join('');
}

export function renderBaseEmailTemplate(input: BaseEmailTemplateInput): RenderedEmailBody {
  const textSections = [
    input.greeting,
    '',
    renderParagraphText(input.paragraphs),
    input.action ? `${input.action.label}: ${input.action.url}` : null,
    '',
    input.closingLines.join('\n'),
  ].filter((value): value is string => value !== null);

  const text = textSections.join('\n');

  const actionHtml = input.action
    ? `<p style="margin:12px 0 20px;">
        <a href="${escapeHtml(input.action.url)}" style="display:inline-block;padding:10px 16px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">
          ${escapeHtml(input.action.label)}
        </a>
      </p>`
    : '';

  const html = `
    <div style="margin:0;background:#f5f5f4;padding:24px 12px;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
        <div style="padding:16px 20px;background:#18181b;color:#ffffff;font-size:16px;font-weight:700;">
          Travel Planner
        </div>
        <div style="padding:20px;">
          <p style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
            ${escapeHtml(input.previewText)}
          </p>
          <p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#18181b;">${escapeHtml(input.greeting)}</p>
          ${renderParagraphHtml(input.paragraphs)}
          ${actionHtml}
          <p style="margin:0;font-size:14px;line-height:1.5;color:#52525b;">${input.closingLines
            .map(escapeHtml)
            .join('<br/>')}</p>
        </div>
      </div>
    </div>
  `.trim();

  return {
    text,
    html,
  };
}
