// Predesigned email-safe templates for Flames Gourmet — Canadian holidays,
// Christian festivals, and Poila Baisakh (Bengali New Year).
// Table-based markup + inline styles for cross-client rendering.

export type SeedTemplate = { name: string; subject: string; html: string };

const BRAND = "Flames Gourmet";

function logoBlock(logoUrl: string, siteUrl: string) {
  const link = siteUrl || "#";
  const img = logoUrl && /^https?:\/\//i.test(logoUrl)
    ? `<img src="${logoUrl}" width="200" alt="${BRAND}" style="display:block;margin:0 auto 8px;border:0;outline:none;text-decoration:none;max-width:200px;height:auto;" />`
    : "";
  return `
    <tr>
      <td align="center" style="padding:28px 24px 16px;background:#ffffff;border-bottom:1px solid #f0e6dc;">
        <a href="${link}" style="text-decoration:none;color:#7a1f1f;">
          ${img}
          <div style="font-family:Georgia,serif;font-size:24px;letter-spacing:4px;font-weight:600;color:#7a1f1f;">${BRAND.toUpperCase()}</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:3px;color:#999;margin-top:4px;">AUTHENTIC INDIAN CUISINE</div>
        </a>
      </td>
    </tr>`;
}

function shell(inner: string, bg: string, logoUrl: string, siteUrl: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${BRAND}</title>
<style>@media only screen and (max-width:620px){.fg-wrap{width:100%!important;max-width:100%!important;border-radius:0!important}.fg-pad{padding:22px!important}}</style>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:Georgia,serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 0;background:${bg};">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="fg-wrap" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
${logoBlock(logoUrl, siteUrl)}
${inner}
<tr><td align="center" class="fg-pad" style="padding:20px;background:#faf3ec;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#888;border-top:1px solid #f0e6dc;">
You're receiving this because you joined the ${BRAND} mailing list.<br/>
<a href="${siteUrl || "#"}" style="color:#888;text-decoration:underline;">${siteUrl || BRAND}</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

export function buildSeedTemplates({ logoUrl = "", siteUrl = "" }: { logoUrl?: string; siteUrl?: string }): SeedTemplate[] {
  const cta = (label: string, color = "#7a1f1f") =>
    `<p style="text-align:center;margin:28px 0 8px;"><a href="${siteUrl || "#"}" style="background:${color};color:#ffffff;padding:14px 32px;text-decoration:none;letter-spacing:3px;font-size:12px;font-family:Arial,Helvetica,sans-serif;display:inline-block;border-radius:4px;">${label}</a></p>`;

  const canadaDay = shell(`
    <tr><td style="padding:0;"><div style="background:linear-gradient(135deg,#d80027,#a30019);padding:36px 24px;text-align:center;color:#fff;">
      <div style="font-family:Georgia,serif;font-size:14px;letter-spacing:6px;">HAPPY CANADA DAY</div>
      <div style="font-family:Georgia,serif;font-size:36px;letter-spacing:1px;margin-top:8px;">Maple &amp; Masala</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;margin-top:12px;color:#ffd9d9;">15% off your entire order this July 1</div>
    </div></td></tr>
    <tr><td style="padding:32px;">
      <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;color:#a30019;text-align:center;">Celebrate true north flavours</h2>
      <p style="margin:0 0 16px;line-height:1.7;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#444;text-align:center;">
        Bring home our chef-curated Canada Day platters — biryani, tandoori favourites and our maple-glazed signature curry, made for sharing.
      </p>
      ${cta("ORDER THE CANADA DAY MENU", "#a30019")}
      <p style="text-align:center;margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999;">Use code: CANADA15 · Valid June 28 – July 2</p>
    </td></tr>`, "#fff5f5", logoUrl, siteUrl);

  const thanksgiving = shell(`
    <tr><td style="padding:0;"><div style="background:linear-gradient(135deg,#b9651c,#7a3e0f);padding:36px 24px;text-align:center;color:#fff5e1;">
      <div style="font-family:Georgia,serif;font-size:14px;letter-spacing:6px;">CANADIAN THANKSGIVING</div>
      <div style="font-family:Georgia,serif;font-size:34px;letter-spacing:1px;margin-top:8px;">A Feast of Thanks</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;margin-top:12px;color:#ffd9a8;">Family platters · Free dessert with orders over $75</div>
    </div></td></tr>
    <tr><td style="padding:32px;">
      <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;color:#7a3e0f;text-align:center;">Gather around the table</h2>
      <p style="margin:0 0 16px;line-height:1.7;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#444;text-align:center;">
        This Thanksgiving, skip the kitchen and savour our slow-cooked curries, fresh-baked naan and a complimentary tray of gulab jamun with every family-size order.
      </p>
      ${cta("RESERVE YOUR FEAST", "#7a3e0f")}
      <p style="text-align:center;margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999;">Pickup &amp; delivery available · Order by Oct 12</p>
    </td></tr>`, "#fdf6ec", logoUrl, siteUrl);

  const christmas = shell(`
    <tr><td style="padding:0;"><div style="background:linear-gradient(135deg,#0b6b3a,#8b0000);padding:36px 24px;text-align:center;color:#fff;">
      <div style="font-family:Georgia,serif;font-size:14px;letter-spacing:6px;">MERRY CHRISTMAS</div>
      <div style="font-family:Georgia,serif;font-style:italic;font-size:36px;margin-top:8px;">Joy &amp; Spice</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;margin-top:12px;color:#fff0c2;">20% off catering · Free dessert tray</div>
    </div></td></tr>
    <tr><td style="padding:32px;">
      <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;color:#8b0000;text-align:center;">A warm Christmas spread</h2>
      <p style="margin:0 0 16px;line-height:1.7;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#444;text-align:center;">
        Make this Christmas unforgettable with our festive catering menu. Aromatic biryanis, tender kebabs and indulgent kheer — crafted to bring the family together.
      </p>
      ${cta("BOOK CHRISTMAS CATERING", "#8b0000")}
      <p style="text-align:center;margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999;">Use code: NOEL20 · Order by Dec 22</p>
    </td></tr>`, "#f1f8f1", logoUrl, siteUrl);

  const easter = shell(`
    <tr><td style="padding:0;"><div style="background:linear-gradient(135deg,#f5d5e8,#cfe9c3);padding:36px 24px;text-align:center;color:#3a5c2e;">
      <div style="font-family:Georgia,serif;font-size:14px;letter-spacing:6px;">HAPPY EASTER</div>
      <div style="font-family:Georgia,serif;font-size:36px;letter-spacing:1px;margin-top:8px;">A Season of Renewal</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;margin-top:12px;color:#4f7b3f;">Brunch specials &amp; family combos</div>
    </div></td></tr>
    <tr><td style="padding:32px;">
      <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;color:#3a5c2e;text-align:center;">Easter Sunday, served warm</h2>
      <p style="margin:0 0 16px;line-height:1.7;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#444;text-align:center;">
        Celebrate Easter with our chef's brunch platters — lamb roganjosh, fluffy puris, mango lassi and a sweet finish of saffron rasmalai.
      </p>
      ${cta("VIEW EASTER MENU", "#3a5c2e")}
      <p style="text-align:center;margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999;">Limited slots · Reserve by Saturday</p>
    </td></tr>`, "#f5faf2", logoUrl, siteUrl);

  const poilaBaisakh = shell(`
    <tr><td style="padding:0;"><div style="background:linear-gradient(135deg,#c1272d,#f1a208);padding:36px 24px;text-align:center;color:#fff8e1;">
      <div style="font-family:Georgia,serif;font-size:14px;letter-spacing:6px;">SHUBHO NOBOBORSHO</div>
      <div style="font-family:Georgia,serif;font-size:36px;letter-spacing:1px;margin-top:8px;">Poila Baisakh</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;margin-top:12px;color:#fff0c2;">A Bengali New Year feast — 15% off our Bengali thali</div>
    </div></td></tr>
    <tr><td style="padding:32px;">
      <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;color:#c1272d;text-align:center;">A new year, a new beginning</h2>
      <p style="margin:0 0 16px;line-height:1.7;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#444;text-align:center;">
        Mark Poila Baisakh with our special Bengali thali — shorshe ilish, kosha mangsho, luchi-aloor dum, and mishti doi to round it off. Naboborsher shubhechha!
      </p>
      ${cta("ORDER THE BENGALI THALI", "#c1272d")}
      <p style="text-align:center;margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999;">Use code: NOBOBORSHO15 · Available April 13 – 16</p>
    </td></tr>`, "#fff8ec", logoUrl, siteUrl);

  return [
    { name: "Canada Day", subject: "Happy Canada Day — 15% off the maple & masala menu", html: canadaDay },
    { name: "Canadian Thanksgiving", subject: "A feast of thanks — family platters at Flames Gourmet", html: thanksgiving },
    { name: "Christmas", subject: "Merry Christmas — 20% off festive catering", html: christmas },
    { name: "Easter", subject: "Happy Easter — brunch specials & family combos", html: easter },
    { name: "Poila Baisakh (Bengali New Year)", subject: "Shubho Noboborsho — celebrate Poila Baisakh with us", html: poilaBaisakh },
  ];
}
