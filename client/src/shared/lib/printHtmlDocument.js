export const escapeHtml = (value) => {
  if (value == null || value === '') return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

/** Печать HTML без popup — popup + немедленный close() ломает фокус в основном окне. */
export const printHtmlDocument = (html, title = 'Печать') => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', title);
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const printWindow = iframe.contentWindow;
  const printDocument = printWindow.document;
  printDocument.open();
  printDocument.write(html);
  printDocument.close();

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
    window.focus();
  };

  const waitForImages = () => {
    const images = Array.from(printDocument.images || []);
    if (images.length === 0) return Promise.resolve();
    return Promise.all(
      images.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.onload = resolve;
            img.onerror = resolve;
          })
      )
    );
  };

  const triggerPrint = () => {
    waitForImages()
      .then(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch (error) {
          console.error('Ошибка печати:', error);
          cleanup();
          return;
        }

        printWindow.onafterprint = cleanup;
        setTimeout(cleanup, 2000);
      })
      .catch(() => cleanup());
  };

  if (printDocument.readyState === 'complete') {
    setTimeout(triggerPrint, 300);
  } else {
    iframe.onload = () => setTimeout(triggerPrint, 300);
  }
};
