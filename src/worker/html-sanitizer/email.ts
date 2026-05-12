export function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function decodeQuotedAttribute(rawValue: string): string {
  const value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function readTagAttribute(rawAttributes: string, attributeName: string): string | null {
  const pattern = new RegExp(
    `${attributeName}\\s*=\\s*("([^"]*)"|'([^']*)'|[^\\s"'=<>` + "`" + `]+)`,
    "i"
  );
  const match = rawAttributes.match(pattern);
  if (!match) {
    return null;
  }

  return decodeQuotedAttribute(match[1]);
}

function sanitizeHref(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/[\u0000-\u001F\u007F\s]+/g, "");
  if (/^https?:/i.test(normalized) || /^mailto:/i.test(normalized)) {
    return normalized;
  }

  return null;
}

interface HtmlEmailSanitizeOptions {
  allowRemoteImages?: boolean;
}

function sanitizeImageSrc(
  value: string | null,
  cidMap: Map<string, string>,
  options: HtmlEmailSanitizeOptions = {}
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (/^\/api\/mailboxes\/[^/]+\/emails\/[^/]+\/attachments\/[^/]+\/preview\b/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.toLowerCase().startsWith("cid:")) {
    const cidKey = trimmed.slice(4).replace(/^<|>$/g, "").toLowerCase();
    return cidMap.get(cidKey) ?? null;
  }

  if (options.allowRemoteImages) {
    const normalized = trimmed.replace(/[\u0000-\u001F\u007F\s]+/g, "");
    if (/^https?:\/\//i.test(normalized)) {
      return normalized;
    }
  }

  return null;
}

function sanitizeTableSpan(rawAttributes: string, attributeName: "colspan" | "rowspan"): string | null {
  const value = readTagAttribute(rawAttributes, attributeName);
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) {
    return null;
  }

  return String(parsed);
}

export function htmlToReadableText(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function htmlHasRemoteImages(value: string): boolean {
  return /<img\b[^>]*\bsrc\s*=\s*("https?:\/\/[^"]*"|'https?:\/\/[^']*'|https?:\/\/[^\s"'=<>`]+)/i.test(value);
}

const HTML_EMAIL_ALLOWED_TAGS = new Set([
  "a",
  "article",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "section",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul"
]);

export function sanitizeHtmlEmail(
  value: string,
  cidMap: Map<string, string>,
  options: HtmlEmailSanitizeOptions = {}
): string {
  const withoutBlockedSections = value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|select|textarea|video|audio|canvas|svg|math|meta|base|link|head|title|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|select|textarea|video|audio|canvas|svg|math|meta|base|link|head|title|noscript)\b[^>]*\/?>/gi, "");

  const withBlockedImages = withoutBlockedSections.replace(/<img\b([^>]*)\/?>/gi, (_match, rawAttributes) => {
    const src = sanitizeImageSrc(readTagAttribute(rawAttributes, "src"), cidMap, options);
    const altText = readTagAttribute(rawAttributes, "alt");
    if (src) {
      const altPart = altText ? ` alt="${escapeHtmlText(altText)}"` : "";
      return `<img src="${escapeHtmlText(src)}"${altPart} class="email-inline-image" />`;
    }

    const label = altText ? `[Image blocked: ${escapeHtmlText(altText)}]` : "[Image blocked]";
    return `<span class="email-image-blocked">${label}</span>`;
  });

  return withBlockedImages.replace(/<\/?([a-z0-9:-]+)([^>]*)>/gi, (fullMatch, rawTagName, rawAttributes) => {
    const isClosingTag = fullMatch.startsWith("</");
    const tagName = rawTagName.toLowerCase();
    if (!HTML_EMAIL_ALLOWED_TAGS.has(tagName)) {
      return "";
    }

    if (isClosingTag) {
      return `</${tagName}>`;
    }

    let sanitizedAttributes = "";

    if (tagName === "a") {
      const href = sanitizeHref(readTagAttribute(rawAttributes, "href"));
      if (href) {
        sanitizedAttributes = ` href="${escapeHtmlText(href)}" target="_blank" rel="nofollow noopener noreferrer"`;
      }
    }

    if (tagName === "span") {
      const className = readTagAttribute(rawAttributes, "class");
      if (className === "email-image-blocked") {
        sanitizedAttributes += ` class="email-image-blocked"`;
      }
    }

    if (tagName === "img") {
      const src = sanitizeImageSrc(readTagAttribute(rawAttributes, "src"), cidMap, options);
      if (!src) {
        return "";
      }
      const altText = readTagAttribute(rawAttributes, "alt");
      sanitizedAttributes += ` src="${escapeHtmlText(src)}" class="email-inline-image"`;
      if (altText) {
        sanitizedAttributes += ` alt="${escapeHtmlText(altText)}"`;
      }
    }

    if (tagName === "td" || tagName === "th") {
      const colspan = sanitizeTableSpan(rawAttributes, "colspan");
      const rowspan = sanitizeTableSpan(rawAttributes, "rowspan");
      if (colspan) {
        sanitizedAttributes += ` colspan="${colspan}"`;
      }
      if (rowspan) {
        sanitizedAttributes += ` rowspan="${rowspan}"`;
      }
    }

    return `<${tagName}${sanitizedAttributes}>`;
  });
}

export function wrapSanitizedHtmlDocument(value: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: http: https:; style-src 'unsafe-inline';" />
    <style>
      body {
        margin: 0;
        padding: 18px;
        color: #1c1b19;
        background: #ffffff;
        font: 14px/1.6 "Segoe UI", "Noto Sans", sans-serif;
        overflow-wrap: anywhere;
      }
      a {
        color: #0f5848;
      }
      p, div, blockquote, pre, ul, ol, table {
        margin: 0 0 12px;
      }
      pre {
        white-space: pre-wrap;
        background: #f6f4ee;
        border: 1px solid #ddd6c6;
        border-radius: 8px;
        padding: 12px;
      }
      blockquote {
        border-left: 3px solid #ddd6c6;
        padding-left: 12px;
        color: #67635b;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid #ddd6c6;
        padding: 8px 10px;
        text-align: left;
        vertical-align: top;
      }
      .email-image-blocked {
        display: inline-block;
        padding: 6px 8px;
        border: 1px dashed #ddd6c6;
        border-radius: 6px;
        background: #f8f5ee;
        color: #67635b;
        font-size: 13px;
      }
      .email-inline-image {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 0 0 12px;
        border: 1px solid #ddd6c6;
        border-radius: 8px;
        background: #f8f5ee;
      }
    </style>
  </head>
  <body>${value}</body>
</html>`;
}
