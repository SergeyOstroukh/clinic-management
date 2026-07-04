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

const contractTextToHtml = (text) => {
  return text
    .split(/\n\n+/)
    .map((paragraph) => {
      const content = escapeHtml(paragraph)
        .replace(/\n/g, '<br/>')
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
      if (!content.trim()) return '';
      return `<p>${content}</p>`;
    })
    .filter(Boolean)
    .join('\n');
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
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.35;
      color: #000;
      margin: 0;
      padding: 15mm 12mm;
    }
    p { margin: 0 0 8px; text-align: justify; }
    .filled {
      border-bottom: 1px solid #000;
      padding: 0 2px 1px;
      font-weight: normal;
    }
    .requisites-section { margin-top: 12px; }
    .requisites-title {
      text-align: center;
      font-weight: bold;
      margin: 0 0 8px;
    }
    .requisites-table {
      width: 100%;
      border: 1px solid #000;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .requisites-col {
      width: 50%;
      vertical-align: top;
      padding: 10px 12px;
      border: 1px solid #000;
      overflow: hidden;
      word-wrap: break-word;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    .requisites-header {
      font-weight: bold;
      margin-bottom: 8px;
    }
    .requisites-body div {
      margin-bottom: 2px;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    .requisites-signature {
      margin-top: 48px;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 4px;
      max-width: 100%;
      line-height: 1.2;
    }
    .requisites-signature .sig-line {
      flex: 1 1 72px;
      min-width: 48px;
      max-width: 100%;
      border-bottom: 1px solid #000;
      height: 1.05em;
      margin-bottom: 2px;
    }
    @media print {
      body { padding: 12mm 10mm; }
      @page { margin: 10mm; }
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
