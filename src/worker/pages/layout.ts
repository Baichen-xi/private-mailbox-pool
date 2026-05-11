import { APP_STYLES } from "../ui-css/styles";

export type PageLocale = "en" | "zh";

export function renderLayout(title: string, body: string, locale: PageLocale): string {
  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>${APP_STYLES}</style>
  </head>
  <body>${body}</body>
</html>`;
}
