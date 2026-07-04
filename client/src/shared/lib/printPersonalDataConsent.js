import { getFullName, formatClientDateRuGenitive } from './formatters';
import { escapeHtml, printHtmlDocument } from './printHtmlDocument';

const formatTodayDate = () => {
  const MONTHS_GENITIVE = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  const today = new Date();
  return `«${today.getDate()}» ${MONTHS_GENITIVE[today.getMonth()]} ${today.getFullYear()} г.`;
};

const fieldOrLine = (value, minWidth = '200px') => {
  if (value) {
    return `<span class="filled">${escapeHtml(value)}</span>`;
  }
  return `<span class="blank" style="min-width:${minWidth}"></span>`;
};

const buildContactLine = (client) => {
  const parts = [];
  if (client?.email) parts.push(escapeHtml(client.email));
  if (client?.phone) parts.push(escapeHtml(client.phone));
  if (parts.length === 0) {
    return '<span class="blank" style="min-width:280px"></span>';
  }
  return parts.join(', ');
};

/**
 * Печать согласия на обработку персональных данных (форма по постановлению МЗ № 74).
 * @param {Object} client — данные клиента из карточки
 * @param {Object} options — { staffName, clinicName, clinicAddress }
 */
export const printPersonalDataConsent = (client, options = {}) => {
  if (!client) {
    window.alert('Клиент не найден');
    return;
  }

  const clientName = getFullName(client.lastName, client.firstName, client.middleName);
  const birthDate = formatClientDateRuGenitive(client.date_of_birth);
  const clientIntro = [clientName, birthDate].filter(Boolean).join(', ');
  const clinicName = options.clinicName || process.env.REACT_APP_CLINIC_NAME || '';
  const clinicAddress = options.clinicAddress || process.env.REACT_APP_CLINIC_ADDRESS || '';

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Согласие на обработку персональных данных — ${escapeHtml(clientName)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.45;
      color: #000;
      margin: 0;
      padding: 18mm 15mm;
    }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .form-title {
      text-align: center;
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 16px;
    }
    .appendix-note {
      text-align: center;
      font-size: 10pt;
      margin-bottom: 12px;
      color: #333;
    }
    p { margin: 0 0 10px; text-align: justify; }
    .filled {
      border-bottom: 1px solid #000;
      padding: 0 2px 1px;
      font-weight: normal;
    }
    .blank {
      display: inline-block;
      border-bottom: 1px solid #000;
      min-height: 1.1em;
      vertical-align: bottom;
    }
    .choice { margin: 12px 0; }
    .choice-item { margin: 4px 0; }
    .signatures {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-top: 28px;
    }
    .signature-block { flex: 1; }
    .signature-line {
      border-bottom: 1px solid #000;
      min-height: 24px;
      margin-bottom: 4px;
    }
    .signature-label { font-size: 10pt; text-align: center; }
    .date-line { margin-top: 20px; }
    .rights-title {
      text-align: center;
      font-weight: bold;
      margin: 0 0 12px;
      font-size: 12pt;
    }
    .rights-subtitle { font-weight: bold; margin: 10px 0 6px; }
    .rights-list { margin: 0; padding-left: 18px; }
    .rights-list li { margin-bottom: 6px; text-align: justify; }
    .clinic-info {
      font-size: 10pt;
      margin-bottom: 14px;
      text-align: center;
    }
    @media print {
      body { padding: 12mm 10mm; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="appendix-note">
      Приложение к Инструкции о формах и порядке дачи и отзыва согласия<br />
      (постановление Министерства здравоохранения РБ от 07.06.2021 № 74)
    </div>
    ${clinicName ? `<div class="clinic-info">${escapeHtml(clinicName)}${clinicAddress ? `<br />${escapeHtml(clinicAddress)}` : ''}</div>` : ''}
    <div class="form-title">
      Согласие (отказ), отзыв согласия пациента (лиц, указанных в части второй<br />
      статьи 18 Закона Республики Беларусь «О здравоохранении») на (от) внесение(я)<br />
      и обработку(и) персональных данных пациента и информации, составляющей врачебную тайну
    </div>

    <p>
      Я, ${fieldOrLine(clientIntro, '420px')}
      <span style="font-size:10pt;">(фамилия, собственное имя, отчество (если таковое имеется), дата рождения)</span>,
    </p>

    <p>
      документ, удостоверяющий личность: ${fieldOrLine(client.identity_document_type, '120px')}
      серия ${fieldOrLine(client.passport_series, '50px')} номер ${fieldOrLine(client.passport_number, '80px')}
      кем выдан ${fieldOrLine(client.passport_issued_by, '160px')},
      дата выдачи ${fieldOrLine(formatClientDateRuGenitive(client.passport_issued_date), '90px')},
      идентификационный номер ${fieldOrLine(client.identification_number, '100px')},
      проживающий(ая) по адресу: ${fieldOrLine(client.address, '240px')},
      адрес электронной почты, контактный номер телефона: ${buildContactLine(client)}
    </p>

    <div class="choice">
      <div class="choice-item">☑ <strong>даю согласие на</strong></div>
      <div class="choice-item">☐ отказываюсь от</div>
      <div class="choice-item">☐ отзываю согласие на</div>
      <div style="font-size:10pt; margin-top:4px;">(нужное отметить)</div>
    </div>

    <p>
      внесение(я) и обработку(и) персональных данных и информации, составляющей врачебную тайну,
      при формировании электронной медицинской карты пациента, информационных систем,
      информационных ресурсов, баз (банков) данных, реестров (регистров) в здравоохранении
      в отношении ${fieldOrLine(clientName, '260px')}
      <span style="font-size:10pt;">(фамилия, собственное имя, отчество пациента; заполняется при подписании представителем)</span>.
    </p>

    <div class="signatures">
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">(подпись)<br />(инициалы, фамилия пациента или представителя)</div>
      </div>
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">(подпись)<br />(инициалы, фамилия медицинского работника)</div>
      </div>
    </div>

    <p class="date-line">${fieldOrLine(formatTodayDate(), '120px')}</p>
  </div>

  <div class="page">
    <div class="rights-title">ПРАВА СУБЪЕКТА ПЕРСОНАЛЬНЫХ ДАННЫХ</div>
    <p class="rights-subtitle">Разъяснения субъекту персональных данных простым и ясным языком:</p>
    <ol class="rights-list">
      <li><strong>Последствия дачи согласия:</strong> оператор получает право на обработку персональных данных и может приступить к оказанию медицинской помощи с использованием информационных систем.</li>
      <li><strong>Последствия отказа:</strong> оператор не получает право на обработку персональных данных в информационных системах; оказание медицинской помощи на бумажных носителях не прекращается.</li>
      <li><strong>Права субъекта</strong> определены Законом Республики Беларусь от 07.05.2021 № 99-З «О защите персональных данных», в том числе право на получение информации об обработке, внесение изменений, отзыв согласия.</li>
      <li>Субъект персональных данных вправе в любое время без объяснения причин отозвать согласие посредством подачи оператору заявления либо в форме, посредством которой получено согласие.</li>
      <li>Оператор обязан в пятнадцатидневный срок после получения заявления прекратить обработку персональных данных и уведомить об этом субъекта, если иное не предусмотрено законодательством.</li>
      <li>Отзыв согласия не имеет обратной силы в отношении обработки, осуществлённой до его отзыва.</li>
      <li>Субъект персональных данных вправе обжаловать действия оператора в уполномоченный орган по защите прав субъектов персональных данных (Национальный центр защиты персональных данных).</li>
    </ol>
    <p style="margin-top:16px; font-size:10pt;">
      Полный текст прав субъекта персональных данных — в Законе Республики Беларусь от 07.05.2021 № 99-З «О защите персональных данных» и приложении к постановлению Министерства здравоохранения от 07.06.2021 № 74.
    </p>
  </div>
</body>
</html>`;

  printHtmlDocument(html, `Согласие — ${clientName}`);
};
