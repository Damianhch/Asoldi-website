const ORANGE = '#FF5B00';
const ORANGE_WASH = 'rgba(255, 91, 0, 0.14)';
const ORANGE_WASH_SOLID = '#FFE8DA';
const BLACK = '#050505';
const WHITE = '#ffffff';
const TEXT = '#1a1a1a';
const MUTED = '#5b5b5b';
const FONT = 'Arial, Helvetica, sans-serif';

function attr(value = '') {
  return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function fontHead() {
  return `
  <style type="text/css">
    html, body { width: 100% !important; max-width: 100% !important; margin: 0 !important; }
    body, table, td, p, a, li, h1, h2, h3 { font-family:${FONT} !important; }
    img { max-width: 100% !important; }
    ${desktopCopyCss()}
  </style>`;
}

function desktopCopyCss() {
  return `
    .email-title-pad { padding: 56px 24px 0 !important; }
    .email-envelope { margin: 36px auto 28px !important; display: block; }
    .email-copy-pad { padding: 8px 64px 36px !important; }
    .email-copy-col { width: 100% !important; max-width: 560px !important; }
    @media only screen and (max-width: 680px) {
      .email-title-pad { padding: 36px 16px 0 !important; }
      .email-envelope { margin: 24px auto 16px !important; }
      .email-copy-pad { padding: 6px 28px 20px !important; }
      .email-copy-col { max-width: 100% !important; }
    }`;
}

function fontStyle() {
  return `font-family:${FONT};`;
}

function socialIcon(href, src, alt) {
  return `
    <a href="${attr(href)}" target="_blank" style="display:inline-block;margin:0 7px;text-decoration:none;">
      <img src="${attr(src)}" width="32" height="32" alt="${attr(alt)}" style="display:block;border:0;width:32px;height:32px;" />
    </a>`;
}

function logoRow(assets, { color = '#ffffff', markSrc = '', homeUrl = 'https://asoldi.com' } = {}) {
  const src = markSrc || assets.logoMark;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td valign="middle">
          <a href="${attr(homeUrl)}" target="_blank" style="display:inline-block;text-decoration:none;color:${color};">
            <img src="${attr(src)}" width="28" height="28" alt="asoldi.com" style="display:inline-block;border:0;width:28px;height:28px;vertical-align:middle;margin-right:10px;" />
            <span style="${fontStyle()}font-size:22px;line-height:28px;color:${color};text-decoration:underline;vertical-align:middle;">asoldi.com</span>
          </a>
        </td>
      </tr>
    </table>`;
}

function reviewPortrait(assets) {
  const src = assets.reviewAvatar || assets.avatarBlank;
  return `<img src="${attr(src)}" width="40" height="40" alt="Christopher Vrioni" style="display:block;border-radius:20px;border:0;width:40px;height:40px;" />`;
}

function customersBadge(assets, { width = 238 } = {}) {
  const height = Math.round((width * 76) / 453);
  return `
    <img src="${attr(assets.customersBadge)}" width="${width}" height="${height}" alt="100+ fornøyde kunder" style="display:block;border:0;width:${width}px;height:${height}px;max-width:100%;" />`;
}

function reviewQuote(html) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;">
      <tr>
        <td width="100%" style="width:100%;max-width:0;${fontStyle()}font-size:13px;line-height:1.55;color:${TEXT};word-wrap:break-word;word-break:break-word;overflow-wrap:anywhere;white-space:normal;">
          ${html}
        </td>
      </tr>
    </table>`;
}

function whiteCardOpen() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:100%;table-layout:fixed;background:#ffffff;border-collapse:separate;border-radius:18px;overflow:hidden;">`;
}

function testimonialDesktop(assets) {
  return `
    ${whiteCardOpen()}
      <tr>
        <td style="padding:18px 18px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;">
            <tr>
              <td valign="middle" width="54%" style="width:54%;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="padding-right:12px;">
                      ${reviewPortrait(assets)}
                    </td>
                    <td valign="middle" style="${fontStyle()}">
                      <div style="font-size:14px;font-weight:bold;color:${TEXT};">Christopher Vrioni</div>
                      <div style="font-size:12px;color:${MUTED};padding-top:2px;">Superhero Pizza and Burger</div>
                    </td>
                  </tr>
                </table>
              </td>
              <td valign="middle" align="right" width="220" style="width:220px;padding-left:8px;">
                ${customersBadge(assets, { width: 220 })}
              </td>
            </tr>
          </table>
          <div style="color:#F5B400;font-size:14px;letter-spacing:2px;padding:14px 0 6px;">★★★★★</div>
          ${reviewQuote('“Super happy with the website these guys made for us at superhero burger &amp; superhero pizza... They really done a good job... the whole process was smooth from start to finish. The site is clean, easy to use, and does exactly what we need it to. They were quick to respond whenever we had questions and made sure everything worked perfectly.”')}
        </td>
      </tr>
    </table>`;
}

function testimonialMobile(assets) {
  return `
    ${whiteCardOpen()}
      <tr>
        <td style="padding:16px 16px 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="middle" style="padding-right:12px;">
                ${reviewPortrait(assets)}
              </td>
              <td valign="middle" style="${fontStyle()}">
                <div style="font-size:14px;font-weight:bold;color:${TEXT};">Christopher Vrioni</div>
                <div style="font-size:12px;color:${MUTED};padding-top:2px;">Superhero Pizza and Burger</div>
              </td>
            </tr>
          </table>
          <div style="color:#F5B400;font-size:14px;letter-spacing:2px;padding:12px 0 6px;">★★★★★</div>
          <div style="padding:0 0 14px;">
            ${reviewQuote('“Super happy with the website these guys made... The whole process was smooth from start to finish. The site is clean, easy to use, and does exactly what we need it to. They were quick to respond... and made sure everything worked perfectly.”')}
          </div>
          ${customersBadge(assets, { width: 260 })}
        </td>
      </tr>
    </table>`;
}

function blackFooter(view) {
  const footerLinks = view.footerLinks || {};
  const assets = view.assets || {};
  const year = view.year || new Date().getFullYear();
  return `
    <td bgcolor="${BLACK}" align="center" style="padding:26px 20px 18px;background:${BLACK};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            ${socialIcon(footerLinks.facebook, assets.facebook, 'Facebook')}
            ${socialIcon(footerLinks.instagram, assets.instagram, 'Instagram')}
            ${socialIcon(footerLinks.youtube, assets.youtube, 'YouTube')}
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;${fontStyle()}font-size:12px;line-height:1.6;color:#d7d7d7;">
        © ${year} Alle rettigheter reservert<br/>
        Østre berg 10, Trondheim Norge
      </p>
      <p style="margin:12px 0 0;${fontStyle()}font-size:12px;line-height:1.7;color:#d7d7d7;">
        <a href="${attr(footerLinks.mail)}" style="color:#d7d7d7;text-decoration:underline;">Mail</a>
        &nbsp;·&nbsp;
        <a href="${attr(footerLinks.vilkar)}" style="color:#d7d7d7;text-decoration:underline;">Vilkår</a>
        &nbsp;&amp;&nbsp;
        <a href="${attr(footerLinks.personvern)}" style="color:#d7d7d7;text-decoration:underline;">personvern</a>
        &nbsp;·&nbsp;
        <a href="${attr(footerLinks.kontakt)}" style="color:#d7d7d7;text-decoration:underline;">Kontakt oss</a>
      </p>
      ${view.showUnsubscribe
        ? `<p style="margin:10px 0 4px;${fontStyle()}font-size:11px;line-height:1.6;">
        <a href="${attr(footerLinks.unsubscribe)}" style="color:#9a9a9a;text-decoration:underline;">Avmeld e-postmarkedsføring</a>
      </p>`
        : ''}
    </td>`;
}

function bodyBlock(view, { pad = '0 36px 8px', className = '', constrain = false } = {}) {
  const cta = view.ctaUrl && view.ctaLabel
    ? `<p style="margin:16px 0 18px;text-align:center;"><a href="${attr(view.ctaUrl)}" style="display:inline-block;padding:12px 22px;background:${ORANGE};color:#ffffff;text-decoration:none;font-weight:bold;border-radius:8px;${fontStyle()}">${view.ctaLabel}</a></p>`
    : '';
  const inner = `
        ${view.bodyHtml || ''}
        ${cta}
        ${view.agendaHtml || ''}
        ${view.closingHtml || ''}
        <div style="padding-top:8px;">${view.signerHtml || ''}</div>`;
  if (constrain) {
    return `
    <tr>
      <td class="${className}" align="center" style="padding:${pad};">
        <table class="email-copy-col" role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
          <tr>
            <td style="${fontStyle()}font-size:15px;line-height:1.65;color:${TEXT};text-align:left;">
              ${inner}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }
  return `
    <tr>
      <td class="${className}" style="padding:${pad};${fontStyle()}font-size:15px;line-height:1.65;color:${TEXT};text-align:left;">
        ${inner}
      </td>
    </tr>`;
}

function messageCard(view, { title, envelopeWidth = 150, titleSize = 26, bodyPad = '0 36px 8px', desktopCopy = false } = {}) {
  const assets = view.assets || {};
  const titleClass = desktopCopy ? 'email-title-pad' : '';
  const titlePad = desktopCopy ? '56px 24px 0' : '32px 22px 8px';
  const envMargin = desktopCopy ? '36px auto 28px' : '18px auto 10px';
  const envClass = desktopCopy ? 'email-envelope' : '';
  const bottomH = desktopCopy ? 28 : 16;
  return `
    ${whiteCardOpen()}
      <tr>
        <td class="${titleClass}" style="padding:${titlePad};text-align:center;">
          <h1 style="margin:0;${fontStyle()}font-size:${titleSize}px;line-height:1.3;font-weight:normal;color:${TEXT};">${title}</h1>
          <img class="${envClass}" src="${attr(assets.envelope)}" width="${envelopeWidth}" alt="" style="display:block;margin:${envMargin};border:0;width:${envelopeWidth}px;height:auto;" />
        </td>
      </tr>
      ${bodyBlock(view, {
        pad: desktopCopy ? '8px 64px 36px' : bodyPad,
        className: desktopCopy ? 'email-copy-pad' : '',
        constrain: desktopCopy,
      })}
      <tr><td style="height:${bottomH}px;font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>`;
}

function renderDesktop(view) {
  const assets = view.assets || {};
  const title = view.title || 'Møtet bekreftet';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:100%;table-layout:fixed;background:${WHITE};">
      <tr>
        <td bgcolor="${BLACK}" style="padding:0;font-size:0;line-height:0;background:${BLACK};">
          <img src="${attr(assets.heroDesktop)}" alt="Nettside utvikling for alle — Asoldi.com" style="display:block;width:100%;max-width:100%;height:auto;border:0;" />
        </td>
      </tr>
      <tr>
        <td bgcolor="${WHITE}" style="padding:20px 0;background:${WHITE};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;">
            <tr>
              <td width="3%" style="width:3%;font-size:0;line-height:0;">&nbsp;</td>
              <td width="94%" valign="top" style="width:94%;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${ORANGE_WASH_SOLID}" style="width:100%;table-layout:fixed;background:${ORANGE_WASH};background-color:${ORANGE_WASH};border-collapse:separate;border-radius:18px;">
                  <tr>
                    <td style="padding:16px 16px 0;">
                      ${messageCard(view, { title, envelopeWidth: 176, titleSize: 26, desktopCopy: true })}
                    </td>
                  </tr>
                  ${view.showTestimonial === false ? '' : `
                  <tr>
                    <td style="padding:12px 16px 0;">
                      ${testimonialDesktop(assets)}
                    </td>
                  </tr>`}
                  <tr>
                    <td align="center" style="padding:16px 16px 18px;">
                      ${logoRow(assets, { color: ORANGE, markSrc: assets.logoMarkOrange || assets.logoMark })}
                    </td>
                  </tr>
                </table>
              </td>
              <td width="3%" style="width:3%;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        ${blackFooter(view)}
      </tr>
    </table>`;
}

function renderMobile(view) {
  const assets = view.assets || {};
  const title = view.mobileTitle || 'Møtet er bekreftet';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:100%;table-layout:fixed;background:${ORANGE};">
      <tr>
        <td bgcolor="${BLACK}" style="padding:0;font-size:0;line-height:0;background:${BLACK};">
          <img src="${attr(assets.heroMobile)}" alt="Nettside utvikling for alle — Asoldi.com" style="display:block;width:100%;max-width:100%;height:auto;border:0;" />
        </td>
      </tr>
      <tr>
        <td bgcolor="${ORANGE}" style="padding:16px 14px 8px;background:${ORANGE};">
          ${messageCard(view, { title, envelopeWidth: 160, titleSize: 24, bodyPad: '0 22px 8px' })}
        </td>
      </tr>
      ${view.showTestimonial === false ? '' : `
      <tr>
        <td bgcolor="${ORANGE}" style="padding:10px 14px 8px;background:${ORANGE};">
          ${testimonialMobile(assets)}
        </td>
      </tr>`}
      <tr>
        <td bgcolor="${ORANGE}" align="center" style="padding:22px 16px 26px;background:${ORANGE};">
          ${logoRow(assets)}
        </td>
      </tr>
      <tr>
        ${blackFooter(view)}
      </tr>
    </table>`;
}

export function renderBrandedSalesEmailHtml(view = {}) {
  const variant = view.variant === 'mobile' ? 'mobile' : 'desktop';
  const inner = variant === 'mobile' ? renderMobile(view) : renderDesktop(view);
  const preheader = view.preheader || '';
  return `
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
  <style type="text/css">${variant === 'desktop' ? desktopCopyCss() : ''}</style>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:100%;table-layout:fixed;background:${variant === 'mobile' ? ORANGE : WHITE};margin:0;padding:0;${fontStyle()}">
    <tr>
      <td align="center" style="padding:0;">
        ${inner}
      </td>
    </tr>
  </table>`;
}

export function renderResponsiveSalesEmailHtml(view = {}) {
  const desktop = renderBrandedSalesEmailHtml({ ...view, variant: 'desktop' });
  const mobile = renderBrandedSalesEmailHtml({ ...view, variant: 'mobile' });
  return `
  <style type="text/css">
    ${desktopCopyCss()}
    @media only screen and (max-width: 620px) {
      .email-only-desktop { display: none !important; max-height: 0 !important; overflow: hidden !important; }
      .email-only-mobile { display: block !important; max-width: 100% !important; max-height: none !important; overflow: visible !important; }
    }
  </style>
  <div class="email-only-desktop">${desktop}</div>
  <!--[if !mso]><!-->
  <div class="email-only-mobile" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${mobile}</div>
  <!--<![endif]-->`;
}

export function renderSalesEmailDocument({ title = 'Asoldi', html = '', note = '', frame = 'desktop' } = {}) {
  const isMobile = frame === 'mobile';
  const banner = note
    ? `<div style="${isMobile ? 'max-width:390px;margin:0 auto 16px;' : 'margin:0 0 0;'}padding:12px 16px;${fontStyle()}font-size:13px;color:#444;background:#fff3ea;border-bottom:1px solid #ffd7bf;">${note}</div>`
    : '';
  if (isMobile) {
    return `<!doctype html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${attr(title)}</title>
  ${fontHead()}
</head>
<body style="margin:0;padding:24px 0;background:#e9e9e9;${fontStyle()}">
  ${banner}
  <div style="max-width:390px;margin:0 auto;background:${ORANGE};">
    ${html}
  </div>
</body>
</html>`;
  }
  return `<!doctype html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${attr(title)}</title>
  ${fontHead()}
</head>
<body style="margin:0;padding:0;background:${WHITE};${fontStyle()}">
  ${banner}
  ${html}
</body>
</html>`;
}

export function renderSalesEmailPreviewIndex({ pcHref = '', phoneHref = '' } = {}) {
  return `<!doctype html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Asoldi e-postmal — PC og telefon</title>
  ${fontHead()}
</head>
<body style="margin:0;background:#111;color:#fff;${fontStyle()}">
  <div style="width:100%;box-sizing:border-box;margin:0 auto;padding:28px 16px 40px;">
    <p style="color:#FF5B00;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;">Asoldi e-post</p>
    <h1 style="font-weight:normal;margin:0 0 8px;">Velkomstmail — PC og telefon</h1>
    <p style="color:#bbb;max-width:640px;">To ulike maler. Åpne hver for seg, eller se begge under.</p>
    <p style="margin:18px 0 28px;">
      <a href="${attr(pcHref)}" style="display:inline-block;margin-right:10px;padding:12px 18px;background:#FF5B00;color:#fff;text-decoration:none;border-radius:8px;">PC-versjon</a>
      <a href="${attr(phoneHref)}" style="display:inline-block;padding:12px 18px;background:#222;color:#fff;text-decoration:none;border-radius:8px;border:1px solid #444;">Telefon-versjon</a>
    </p>
    <div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;">
      <div style="flex:1 1 720px;min-width:0;">
        <p style="margin:0 0 8px;color:#888;">PC · full bredde</p>
        <iframe src="${attr(pcHref)}" title="PC" style="display:block;width:100%;height:1200px;border:0;background:${WHITE};border-radius:8px;"></iframe>
      </div>
      <div style="flex:0 0 390px;">
        <p style="margin:0 0 8px;color:#888;">Telefon · 390px</p>
        <iframe src="${attr(phoneHref)}" title="Telefon" width="390" height="1100" style="border:0;background:${ORANGE};border-radius:8px;"></iframe>
      </div>
    </div>
  </div>
</body>
</html>`;
}
