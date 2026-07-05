import {
  getFullName,
  formatContractHeaderDate,
  formatClientInitialsSignature,
  formatDateRu,
} from './formatters';
import { escapeHtml, printHtmlDocument } from './printHtmlDocument';
import { THERAPY_CONTRACT_BODY } from './therapyContractBody';

const REQUISITES_SECTION_MARKER = '7. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН';

const EXECUTOR_REQUISITES = `ООО «Дантист Клиник»
Юридический адрес: Республика Беларусь, г. Минск, ул. Нововиленская, 45-84. 220053
Почтовый адрес: Республика Беларусь, г. Минск, ул. Нововиленская, 45-84. 220053
УНП 193806619
р/с BY70 ALFA 3012 2F87 1600 1027 0000 в BYN в ЗАО «Альфа-Банк» г. Минск, ул. Сурганова 43-47.
СВИФТ- ALFABY2X   УНП 101541947  ОКПО 37526626`;

const normalizeContractText = (text) =>
  text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const buildClientIdLine = (client) => {
  if (client.identification_number) {
    return `МР ${client.identification_number}`;
  }
  if (client.passport_number) {
    const series = client.passport_series ? `${client.passport_series} ` : '';
    return `${series}${client.passport_number}`.trim();
  }
  return '';
};

const buildCustomerRequisitesLines = (client) => {
  const lines = [
    getFullName(client.lastName, client.firstName, client.middleName),
    formatDateRu(client.date_of_birth),
    client.phone || '',
    client.address || '',
    buildClientIdLine(client),
  ].filter((line) => line && String(line).trim());

  return lines;
};

const highlightFilled = (html, value) => {
  if (!value) return html;
  const escaped = escapeHtml(value);
  return html.split(escaped).join(`<span class="filled">${escaped}</span>`);
};

/** Подпункт: 1.1, 3.1.2, 4.1.2.1 и т.д. */
const isSubPointStart = (trimmed) => /^\d+(?:\.\d+)+\.?\s/.test(trimmed);

const isMainSectionTitle = (trimmed) =>
  /^\d+\.\s+[А-ЯЁ]/.test(trimmed) && !/^\d+\.\d+/.test(trimmed);

const isClauseHeader = (trimmed) => {
  const match = trimmed.match(/^(\d+(?:\.\d+)+)\.\s+(.+)$/);
  if (!match) return false;
  const title = match[2].replace(/:$/, '').trim();
  return title.length >= 8 && title === title.toUpperCase();
};

const isNewClauseStart = (trimmed, prevTrimmed) =>
  isSubPointStart(trimmed) ||
  trimmed.startsWith('-') ||
  trimmed.startsWith('•') ||
  /^\d+\)\s?/.test(trimmed) ||
  trimmed.startsWith('(') ||
  trimmed.startsWith('сообщать') ||
  (trimmed.startsWith('гражданин') && prevTrimmed?.startsWith('Общество'));

/** Мягкие переносы Word → отдельные логические пункты */
const mergeLinesToClauses = (lines) => {
  const clauses = [];
  let current = [];

  const flush = () => {
    if (current.length === 0) return;
    const text = current
      .map((line) => line.trim().replace(/\s+/g, ' '))
      .join(' ')
      .trim();
    if (text) clauses.push(text);
    current = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      return;
    }

    if (current.length > 0 && isNewClauseStart(trimmed, current[0].trim())) {
      flush();
    }
    current.push(line);
  });

  flush();
  return clauses;
};

const renderClause = (text) => {
  const trimmed = text.trim();

  if (trimmed.startsWith('Общество') || trimmed.startsWith('гражданин')) {
    return `<p class="doc-preamble">${escapeHtml(trimmed)}</p>`;
  }

  if (trimmed.startsWith('(')) {
    return `<p class="doc-line-center">${escapeHtml(trimmed)}</p>`;
  }

  const classes = ['doc-line'];
  if (isClauseHeader(trimmed)) classes.push('clause-header');
  return `<p class="${classes.join(' ')}">${escapeHtml(trimmed)}</p>`;
};

const renderClauses = (lines) => {
  const clauses = mergeLinesToClauses(lines);
  return clauses.map((clause) => renderClause(clause)).join('\n');
};

/** Рендер тела договора с сохранением структуры Word/PDF */
const contractTextToHtml = (text) => {
  const lines = text.split('\n');
  if (lines.length < 4) return '';

  let index = 0;
  const title = lines[index++];
  const subtitle = lines[index++];
  while (index < lines.length && lines[index].trim() === '') index += 1;

  const dateLine = lines[index++] || '';
  const datePart = dateLine.replace(/^г\.\s*Минск[\t\s]+/i, '').trim();

  const parts = [
    `<div class="doc-title">${escapeHtml(title)}</div>`,
    `<div class="doc-subtitle">${escapeHtml(subtitle)}</div>`,
    `<div class="doc-date-row"><span>г. Минск</span><span class="doc-date">${escapeHtml(datePart)}</span></div>`,
  ];

  let sectionBuffer = [];

  const flushSection = () => {
    if (sectionBuffer.length === 0) return;
    parts.push(renderClauses(sectionBuffer));
    sectionBuffer = [];
  };

  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;

    const trimmed = line.trim();
    if (isMainSectionTitle(trimmed)) {
      flushSection();
      parts.push(`<p class="doc-section-title">${escapeHtml(trimmed)}</p>`);
      continue;
    }

    sectionBuffer.push(line);
  }

  flushSection();
  return parts.join('\n');
};

const buildRequisitesSectionHtml = (client) => {
  const customerLines = buildCustomerRequisitesLines(client);
  const signatureInitials = formatClientInitialsSignature(
    client.lastName,
    client.firstName,
    client.middleName
  );

  const executorHtml = EXECUTOR_REQUISITES.split('\n')
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join('');

  const customerHtml = customerLines
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join('');

  return `
    <div class="requisites-section">
      <p class="requisites-title">${escapeHtml(REQUISITES_SECTION_MARKER)}</p>
      <table class="requisites-table" cellspacing="0" cellpadding="0">
        <tr>
          <td class="requisites-col">
            <div class="requisites-header">ИСПОЛНИТЕЛЬ:</div>
            <div class="requisites-body">${executorHtml}</div>
            <div class="requisites-signature">
              <span>Директор</span><span class="sig-line"></span><span>С.В. Остроух</span>
            </div>
          </td>
          <td class="requisites-col">
            <div class="requisites-header">ЗАКАЗЧИК:</div>
            <div class="requisites-body">${customerHtml}</div>
            <div class="requisites-signature">
              <span>Пациент</span><span class="sig-line"></span><span>${escapeHtml(signatureInitials)}</span>
            </div>
          </td>
        </tr>
      </table>
    </div>`;
};

const applyClientSubstitutions = (text, client) => {
  const clientName = getFullName(client.lastName, client.firstName, client.middleName);
  const contractDate = formatContractHeaderDate();

  let result = text;

  result = result.replace('"__"________ 2026', contractDate);
  result = result.replace(
    /представитель несовершеннолетнего пациента\)\s+_{10,}\s+_{10,},/,
    `представитель несовершеннолетнего пациента) ${clientName},`
  );
  result = result.replace(
    'Я, __________________________________________________________',
    `Я, ${clientName}`
  );

  const markerIndex = result.indexOf(REQUISITES_SECTION_MARKER);
  if (markerIndex !== -1) {
    result = result.slice(0, markerIndex).trimEnd();
  }

  return { result, clientName, contractDate };
};

const buildTherapyContractHtml = (client) => {
  const clientName = getFullName(client.lastName, client.firstName, client.middleName);
  const normalizedBody = normalizeContractText(THERAPY_CONTRACT_BODY);
  const { result: bodyText, clientName: substitutedName, contractDate } =
    applyClientSubstitutions(normalizedBody, client);

  let bodyHtml = contractTextToHtml(bodyText);
  bodyHtml = highlightFilled(bodyHtml, contractDate);
  bodyHtml = highlightFilled(bodyHtml, substitutedName);
  bodyHtml += buildRequisitesSectionHtml(client);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Договор на терапевтические услуги — ${escapeHtml(clientName)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.05;
      color: #000;
      margin: 0;
      padding: 0;
    }
    body { padding: 0; }
    .doc-title {
      text-align: center;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 12pt;
      margin: 0 0 2px;
    }
    .doc-subtitle {
      text-align: center;
      font-size: 11pt;
      margin: 0 0 8px;
    }
    .doc-date-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin: 0 0 6px;
    }
    .doc-date { white-space: nowrap; }
    .doc-preamble {
      text-align: justify;
      margin: 0;
      /* PDF: первая строка 79pt, переносы 43.7pt → ~1.25cm */
      text-indent: 1.25cm;
    }
    /* PDF: все пункты (1.1, 3.1.1, -, 1), •) начинаются с 57.8pt */
    .doc-line {
      margin: 0;
      text-align: justify;
      text-indent: 0.5cm;
    }
    .doc-line.clause-header {
      font-weight: bold;
    }
    .doc-line-center {
      margin: 0;
      text-align: center;
    }
    .doc-section-title {
      font-weight: bold;
      text-align: center;
      margin: 3px 0 1px;
    }
    p { margin: 0; }
    .filled {
      border-bottom: 1px solid #000;
      padding: 0 1px;
      font-weight: normal;
    }
    .requisites-section { margin-top: 6px; }
    .requisites-title {
      text-align: center;
      font-weight: bold;
      margin: 0 0 4px;
    }
    .requisites-table {
      width: 100%;
      border: 1px solid #000;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 10pt;
      line-height: 1.12;
    }
    .requisites-col {
      width: 50%;
      vertical-align: top;
      padding: 6px 8px;
      border: 1px solid #000;
      overflow: hidden;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .requisites-header {
      font-weight: bold;
      margin-bottom: 4px;
    }
    .requisites-body div {
      margin-bottom: 1px;
      line-height: 1.12;
      overflow-wrap: anywhere;
    }
    .requisites-signature {
      margin-top: 28px;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 3px;
      max-width: 100%;
      line-height: 1.1;
    }
    .requisites-signature .sig-line {
      flex: 1 1 60px;
      min-width: 40px;
      max-width: 100%;
      border-bottom: 1px solid #000;
      height: 1em;
      margin-bottom: 1px;
    }
    @media print {
      html, body {
        font-size: 11pt;
        line-height: 1.05;
      }
      @page {
        size: A4;
        margin: 15mm 15mm 15mm 15mm;
      }
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
};

/**
 * Печать договора на оказание терапевтических стоматологических услуг.
 * @param {Object} client — данные клиента из карточки
 */
export const printTherapyContract = (client) => {
  if (!client) {
    window.alert('Клиент не найден');
    return;
  }

  const clientName = getFullName(client.lastName, client.firstName, client.middleName);
  printHtmlDocument(buildTherapyContractHtml(client), `Договор — ${clientName}`);
};
