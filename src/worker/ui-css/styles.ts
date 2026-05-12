export const APP_STYLES = String.raw`
      :root {
        color-scheme: light;
        --bg: #f3f1ea;
        --bg-soft: #f8f6f0;
        --panel: #fffdfa;
        --panel-soft: rgba(255, 255, 255, 0.78);
        --text: #1f1b16;
        --muted: #666055;
        --line: #d9d2c4;
        --line-strong: #c8bead;
        --accent: #156f5b;
        --accent-strong: #0f5848;
        --accent-soft: rgba(21, 111, 91, 0.08);
        --danger: #9b2c2c;
      }
      * { box-sizing: border-box; }
      [hidden] {
        display: none !important;
      }
      html {
        font-size: 16px;
      }
      body {
        margin: 0;
        font-family: "Segoe UI", "Noto Sans", sans-serif;
        color: var(--text);
        line-height: 1.5;
        background:
          radial-gradient(circle at top right, rgba(209, 230, 223, 0.45) 0%, rgba(209, 230, 223, 0) 28%),
          radial-gradient(circle at top left, rgba(241, 227, 197, 0.45) 0%, rgba(241, 227, 197, 0) 24%),
          linear-gradient(180deg, #f8f6f0 0%, #efebe2 100%);
      }
      a {
        color: var(--accent-strong);
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
        text-decoration-color: rgba(15, 88, 72, 0.3);
      }
      .shell {
        min-height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 32px 20px 48px;
      }
      .shell--centered {
        align-items: center;
      }
      .panel {
        width: min(1180px, 100%);
        background: rgba(255, 253, 248, 0.95);
        border: 1px solid rgba(201, 193, 177, 0.75);
        border-radius: 12px;
        box-shadow:
          0 24px 70px rgba(32, 25, 16, 0.08),
          0 2px 12px rgba(32, 25, 16, 0.04);
        overflow: hidden;
        backdrop-filter: blur(10px);
      }
      .panel--narrow {
        width: min(480px, 100%);
      }
      .header {
        padding: 28px 32px 24px;
        border-bottom: 1px solid var(--line);
        background:
          linear-gradient(135deg, rgba(21, 111, 91, 0.1), rgba(255, 255, 255, 0) 44%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0.28));
      }
      .header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .content {
        padding: 28px 32px 32px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: clamp(28px, 3vw, 36px);
        line-height: 1.06;
        font-weight: 700;
      }
      h2 {
        margin: 0;
        font-size: 18px;
        line-height: 1.25;
        font-weight: 700;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }
      form {
        display: grid;
        gap: 18px;
      }
      label {
        display: grid;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: var(--muted);
      }
      input, select, textarea {
        appearance: none;
        width: 100%;
        padding: 12px 14px;
        border-radius: 10px;
        border: 1px solid var(--line);
        background: #fff;
        font: inherit;
        color: var(--text);
        transition: border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
      }
      input:focus,
      select:focus,
      textarea:focus {
        outline: none;
        border-color: rgba(21, 111, 91, 0.65);
        box-shadow: 0 0 0 4px rgba(21, 111, 91, 0.12);
      }
      input:disabled,
      select:disabled,
      textarea:disabled {
        background: #f6f3ec;
        color: #8c8578;
      }
      input[type="checkbox"] {
        appearance: auto;
        width: 18px;
        height: 18px;
        padding: 0;
        margin: 0;
        border-radius: 6px;
        border: 1px solid var(--line-strong);
        background: white;
        accent-color: var(--accent);
        cursor: pointer;
        box-shadow: none;
      }
      input[type="checkbox"]:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(21, 111, 91, 0.14);
      }
      textarea {
        min-height: 96px;
        resize: vertical;
      }
      button {
        appearance: none;
        border: 0;
        border-radius: 10px;
        padding: 12px 16px;
        background: linear-gradient(180deg, #1a7e67 0%, #156f5b 100%);
        color: white;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 10px 24px rgba(21, 111, 91, 0.18);
        transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
      }
      button:not(:disabled):hover {
        transform: translateY(-1px);
        box-shadow: 0 14px 28px rgba(21, 111, 91, 0.2);
      }
      button:not(:disabled):active {
        transform: translateY(0);
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 1;
        color: #8c8578;
        background: linear-gradient(180deg, #efe9dc 0%, #e8e1d2 100%);
        border: 1px solid #ddd4c4;
        box-shadow: none;
      }
      button.secondary {
        background: rgba(255, 255, 255, 0.76);
        color: var(--accent-strong);
        border: 1px solid var(--line);
        box-shadow: none;
      }
      button.secondary:hover {
        background: rgba(255, 255, 255, 0.96);
        border-color: var(--line-strong);
      }
      button.secondary:disabled {
        background: rgba(243, 239, 231, 0.92);
        border-color: #ddd4c4;
        color: #9a9285;
      }
      .lang-switch {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.88);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
      }
      .lang-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 68px;
        padding: 8px 12px;
        border-radius: 999px;
        color: var(--muted);
        font-size: 14px;
      }
      .lang-link:hover {
        text-decoration: none;
      }
      .lang-link.is-active {
        background: var(--accent);
        color: white;
      }
      .nav-pills {
        display: inline-flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .nav-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 40px;
        padding: 9px 14px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.72);
        color: var(--muted);
        font-size: 14px;
        transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
      }
      .nav-pill:hover {
        text-decoration: none;
        border-color: var(--line-strong);
        color: var(--text);
      }
      .nav-pill.is-active {
        border-color: var(--accent);
        color: var(--accent-strong);
        background: var(--accent-soft);
      }
      .stack {
        display: grid;
        gap: 20px;
      }
      .title-block {
        display: grid;
        gap: 6px;
      }
      .row {
        display: flex;
        gap: 16px;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
      }
      .row--start {
        align-items: flex-start;
      }
      .metrics {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }
      .metrics--compact .metric {
        min-height: 92px;
        padding: 16px;
      }
      .metrics--compact .metric strong {
        font-size: 28px;
      }
      .metric {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 18px;
        background: linear-gradient(180deg, #ffffff 0%, #fbf8f1 100%);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
        min-height: 106px;
        display: grid;
        align-content: start;
        gap: 8px;
      }
      .metric strong {
        display: block;
        font-size: 32px;
        line-height: 1;
        margin: 0;
      }
      .metric span {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }
      .notice {
        display: grid;
        gap: 8px;
        padding: 14px 16px;
        border-radius: 10px;
        border: 1px solid rgba(155, 44, 44, 0.18);
        background: rgba(155, 44, 44, 0.06);
        color: var(--danger);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
      }
      .notice__eyebrow {
        margin: 0;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.2;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .notice__title {
        margin: 0;
        color: var(--text);
        font-size: 15px;
        font-weight: 700;
        line-height: 1.4;
      }
      .notice__body {
        margin: 0;
        color: inherit;
        font-size: 14px;
        line-height: 1.6;
      }
      .notice--success {
        border-color: rgba(21, 111, 91, 0.18);
        background: rgba(21, 111, 91, 0.08);
        color: var(--accent-strong);
      }
      .notice--success .notice__eyebrow {
        color: var(--accent-strong);
      }
      .notice--error .notice__eyebrow {
        color: var(--danger);
      }
      .notice--reminder {
        border-color: rgba(154, 111, 26, 0.2);
        background: rgba(154, 111, 26, 0.07);
        color: #7a5a1f;
      }
      .notice--reminder .notice__eyebrow {
        color: #8a661f;
      }
      .muted {
        color: var(--muted);
        font-size: 14px;
      }
      .list {
        display: grid;
        gap: 12px;
      }
      .list-item, .card {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 18px;
        background: rgba(255, 255, 255, 0.92);
      }
      .list-item--interactive {
        cursor: pointer;
        transition: border-color 140ms ease, background 140ms ease, box-shadow 140ms ease;
      }
      .list-item--interactive:hover {
        border-color: var(--line-strong);
        background: rgba(255, 255, 255, 0.98);
      }
      .list-item--interactive.is-active {
        border-color: rgba(21, 111, 91, 0.5);
        background: rgba(21, 111, 91, 0.08);
        box-shadow: inset 3px 0 0 var(--accent);
      }
      .card {
        display: grid;
        gap: 16px;
        align-content: start;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
      }
      .card-grid {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }
      .summary-grid {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .section-grid {
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.95fr);
      }
      .section-grid--workspace {
        grid-template-columns: minmax(280px, 0.92fr) minmax(0, 1.45fr);
        align-items: stretch;
      }
      .sidebar-stack {
        display: grid;
        gap: 18px;
        align-content: start;
      }
      .inline-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .toolbar {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
      }
      .toolbar-start {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .toolbar-end {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .toolbar-panel {
        display: flex;
        gap: 14px;
        align-items: flex-start;
        justify-content: space-between;
        flex-wrap: wrap;
        padding: 16px 18px;
        border: 1px solid rgba(21, 111, 91, 0.14);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.84);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
      }
      .selection-actions {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }
      .control-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: minmax(220px, 1.7fr) repeat(2, minmax(160px, 0.75fr));
      }
      .control-grid label {
        gap: 6px;
      }
      .result-meta {
        color: var(--muted);
        font-size: 13px;
        font-weight: 600;
      }
      .filter-meta {
        color: var(--muted);
        font-size: 13px;
        font-weight: 600;
      }
      .selection-meta {
        color: var(--muted);
        font-size: 13px;
        font-weight: 600;
      }
      .pagination {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        padding-top: 4px;
      }
      .pagination[hidden] {
        display: none;
      }
      .pagination-buttons {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }
      .table-shell {
        display: grid;
        gap: 16px;
      }
      .checkbox-cell {
        width: 42px;
      }
      .checkbox-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .table th,
      .table td {
        text-align: left;
        padding: 14px 10px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }
      .table th {
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .table tbody tr {
        transition: background 140ms ease, box-shadow 140ms ease;
      }
      .table tbody tr:hover {
        background: rgba(21, 111, 91, 0.04);
      }
      .table tbody tr.is-selected {
        background: rgba(21, 111, 91, 0.1);
        box-shadow: inset 3px 0 0 var(--accent);
      }
      .table tbody tr.is-selected:hover {
        background: rgba(21, 111, 91, 0.14);
      }
      .table tbody tr.is-unread {
        background: rgba(21, 111, 91, 0.035);
      }
      .table tbody tr.is-unread:hover {
        background: rgba(21, 111, 91, 0.08);
      }
      .table tbody tr.is-selected {
        background: rgba(21, 111, 91, 0.12);
        box-shadow: inset 3px 0 0 var(--accent);
      }
      .table tbody tr.is-selected:hover {
        background: rgba(21, 111, 91, 0.16);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        padding: 5px 9px;
        border-radius: 999px;
        border: 1px solid rgba(21, 111, 91, 0.14);
        background: rgba(21, 111, 91, 0.08);
        color: var(--accent-strong);
        font-size: 12px;
        line-height: 1.2;
      }
      .badge-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .detail-grid {
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
      }
      .detail-grid--mailbox {
        grid-template-columns: minmax(280px, 330px) minmax(0, 1fr);
      }
      .detail-list {
        display: grid;
        gap: 12px;
      }
      .health-detail-list {
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 10px;
      }
      .state-panel {
        display: grid;
        gap: 10px;
        padding: 16px 18px;
        border: 1px dashed rgba(201, 193, 177, 0.92);
        border-radius: 10px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(249, 245, 237, 0.92) 100%);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
      }
      .state-panel--compact {
        padding: 14px 16px;
        gap: 8px;
      }
      .state-panel--danger {
        border-style: solid;
        border-color: rgba(155, 44, 44, 0.18);
        background: rgba(155, 44, 44, 0.04);
      }
      .state-panel__title {
        margin: 0;
        color: var(--text);
        font-size: 15px;
        font-weight: 700;
        line-height: 1.4;
      }
      .state-panel__eyebrow {
        margin: 0;
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.3;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .state-panel__body {
        margin: 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.65;
      }
      .detail-item {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 14px 16px;
        background: linear-gradient(180deg, #ffffff 0%, #fbf8f1 100%);
        display: grid;
        gap: 6px;
      }
      .detail-item strong,
      .detail-item code,
      .detail-item .detail-value {
        display: block;
        color: var(--text);
        overflow-wrap: anywhere;
      }
      .detail-label {
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .detail-value {
        font-weight: 600;
        line-height: 1.55;
      }
      .detail-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 4px;
      }
      .attachment-list {
        display: grid;
        gap: 12px;
      }
      .attachment-link {
        display: inline-flex;
        align-items: flex-start;
        gap: 10px;
        flex-wrap: wrap;
      }
      .attachment-link:hover {
        text-decoration: none;
      }
      .attachment-name {
        display: block;
        color: var(--text);
        font-weight: 700;
      }
      .attachment-meta {
        color: var(--muted);
        font-size: 13px;
      }
      .attachment-preview {
        display: block;
        max-width: 100%;
        max-height: 220px;
        margin-top: 12px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #f8f5ee;
      }
      .mode-switch .secondary.is-active {
        background: rgba(21, 111, 91, 0.08);
        border-color: var(--accent);
        color: var(--accent-strong);
      }
      .subject-link {
        display: inline-flex;
        align-items: flex-start;
        margin: 0;
      }
      .subject-link:hover {
        text-decoration: none;
      }
      .table-primary {
        display: grid;
        gap: 6px;
      }
      .address-chip {
        display: inline-flex;
        align-items: center;
        max-width: 100%;
        padding: 5px 10px;
        border-radius: 999px;
        border: 1px solid rgba(21, 111, 91, 0.12);
        background: #f2f8f6;
        color: var(--accent-strong);
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .subject-title,
      .table-title {
        color: var(--text);
        font-size: 15px;
        line-height: 1.45;
      }
      .subject-title.is-unread {
        font-weight: 800;
      }
      .table-preview {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.55;
      }
      .sender-cell {
        display: grid;
        gap: 4px;
      }
      .sender-name {
        color: var(--text);
        font-weight: 600;
      }
      .sender-address {
        color: var(--muted);
        font-size: 13px;
        overflow-wrap: anywhere;
      }
      .subdomain-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .workspace-card {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        gap: 10px;
        min-height: 100%;
      }
      .workspace-card__header {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        justify-content: space-between;
        flex-wrap: wrap;
        min-height: 68px;
      }
      .workspace-card__header .title-block {
        min-height: 68px;
        align-content: start;
      }
      .workspace-card__body {
        min-height: 0;
        display: grid;
        align-content: start;
        gap: 12px;
      }
      .workspace-card__footer {
        min-height: 32px;
        display: flex;
        align-items: flex-end;
      }
      .workspace-list {
        align-content: start;
        gap: 10px;
      }
      .workspace-list .list-item {
        padding: 14px 16px;
      }
      .workspace-table-wrap {
        min-height: 0;
      }
      .workspace-table-wrap .table {
        margin: 0;
      }
      .workspace-header-meta {
        display: grid;
        gap: 8px;
        justify-items: end;
      }
      .workspace-header-meta .pagination {
        padding-top: 0;
      }
      .confirm-backdrop {
        position: fixed;
        inset: 0;
        z-index: 70;
        display: grid;
        place-items: center;
        padding: 24px;
        background: rgba(25, 28, 32, 0.32);
        backdrop-filter: blur(6px);
      }
      .confirm-backdrop[hidden] {
        display: none;
      }
      .confirm-dialog {
        width: min(500px, 100%);
        display: grid;
        gap: 18px;
        padding: 24px;
        border: 1px solid rgba(155, 44, 44, 0.14);
        border-radius: 10px;
        background: rgba(255, 253, 250, 0.99);
        box-shadow: 0 24px 60px rgba(27, 33, 35, 0.18);
      }
      .confirm-dialog__header {
        display: grid;
        gap: 6px;
      }
      .confirm-dialog__eyebrow {
        color: var(--accent-strong);
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .confirm-dialog__body {
        display: grid;
        gap: 12px;
      }
      .confirm-dialog__message {
        color: var(--text);
        font-size: 15px;
        line-height: 1.65;
      }
      .confirm-dialog__detail {
        padding: 13px 14px;
        border: 1px solid rgba(155, 44, 44, 0.16);
        border-radius: 10px;
        background: rgba(155, 44, 44, 0.05);
        color: #7b4338;
        font-size: 13px;
        line-height: 1.6;
        white-space: pre-line;
        overflow-wrap: anywhere;
      }
      .confirm-dialog__actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
        padding-top: 6px;
        border-top: 1px solid rgba(217, 210, 196, 0.8);
      }
      .email-body {
        min-height: 420px;
        padding: 20px 22px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: white;
        white-space: pre-wrap;
        overflow: auto;
        overflow-wrap: anywhere;
        word-break: break-word;
        line-height: 1.72;
        font-size: 14px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
      }
      .email-body.is-empty-state {
        min-height: 260px;
        white-space: normal;
        color: var(--muted);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 244, 236, 0.96) 100%);
      }
      .email-html-frame {
        width: 100%;
        min-height: 520px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: white;
      }
      .body-source {
        margin-bottom: 10px;
        font-size: 13px;
      }
      .empty {
        padding: 22px 16px;
        border: 1px dashed var(--line);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.55);
        color: var(--muted);
        line-height: 1.6;
      }
      .empty--center {
        text-align: center;
      }
      code {
        font-family: Consolas, "SFMono-Regular", monospace;
        font-size: 12px;
        overflow-wrap: anywhere;
      }
      .mono {
        font-family: Consolas, "SFMono-Regular", monospace;
        font-size: 12px;
        overflow-wrap: anywhere;
      }
      @media (max-width: 860px) {
        .shell {
          padding: 20px 14px 32px;
        }
        .header,
        .content {
          padding-left: 18px;
          padding-right: 18px;
        }
        .summary-grid,
        .section-grid {
          grid-template-columns: 1fr;
        }
        .detail-grid,
        .detail-grid--mailbox {
          grid-template-columns: 1fr;
        }
        .control-grid {
          grid-template-columns: 1fr;
        }
        .workspace-card__header,
        .workspace-card__header .title-block,
        .workspace-header-meta {
          min-height: 0;
        }
        .workspace-header-meta {
          justify-items: start;
        }
        .confirm-backdrop {
          padding: 14px;
        }
        .table {
          table-layout: auto;
        }
      }
      @media (max-width: 640px) {
        .metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .card-grid {
          grid-template-columns: 1fr;
        }
        .table th,
        .table td {
          padding-left: 6px;
          padding-right: 6px;
        }
      }
`;
