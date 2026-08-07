import net from "node:net";
import tls from "node:tls";

/**
 * Tiny email shim. If SMTP env vars are unset, just log the message.
 * Uses Node's built-in net/tls modules so cPanel does not need any extra mail
 * package installed for contact/order notifications to work.
 * Returns { ok, skipped?, error? } so callers know whether the message
 * actually left the server.
 */
function encodeHeader(value = "") {
  return /[^\x20-\x7e]/.test(value) ? `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=` : value;
}

function extractEmail(value = "") {
  const match = String(value).match(/<([^>]+)>/);
  return (match ? match[1] : value).trim();
}

function normalizeRecipients(to) {
  return String(to || "").split(/[,;]/).map((v) => extractEmail(v)).filter(Boolean);
}

function dotStuff(value = "") {
  return String(value).replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function buildMessage({ from, to, subject, text, html }) {
  const boundary = `fg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    html ? `Content-Type: multipart/alternative; boundary="${boundary}"` : 'Content-Type: text/plain; charset="UTF-8"',
  ];
  if (!html) return `${headers.join("\r\n")}\r\n\r\n${dotStuff(text || "")}`;
  return `${headers.join("\r\n")}\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${dotStuff(text || "")}\r\n--${boundary}\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${dotStuff(html)}\r\n--${boundary}--`;
}

async function sendViaSmtp({ to, subject, text, html }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const strict = String(process.env.SMTP_TLS_STRICT || "").trim() === "1";
  const recipients = normalizeRecipients(to);
  if (!host || !user || !pass || !from || recipients.length === 0) throw new Error("SMTP configuration is incomplete");

  let socket;
  let buffer = "";
  const connectOptions = { host, port, servername: host, rejectUnauthorized: strict };

  const readResponse = () => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("SMTP timeout waiting for server response")), 30000);
    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/);
      const lastComplete = buffer.endsWith("\n") ? lines.length - 1 : lines.length - 2;
      for (let i = 0; i <= lastComplete; i++) {
        if (/^\d{3} /.test(lines[i])) {
          const response = lines.slice(0, i + 1).join("\n");
          buffer = lines.slice(i + 1).join("\n");
          cleanup();
          resolve(response);
          return;
        }
      }
    };
    const onError = (err) => { cleanup(); reject(err); };
    const cleanup = () => { clearTimeout(timeout); socket.off("data", onData); socket.off("error", onError); };
    socket.on("data", onData);
    socket.on("error", onError);
    onData("");
  });

  const expect = async (command, okCodes = [250]) => {
    if (command) socket.write(`${command}\r\n`);
    const response = await readResponse();
    const code = Number(response.slice(0, 3));
    if (!okCodes.includes(code)) throw new Error(`SMTP ${command || "connect"} failed: ${response}`);
    return response;
  };

  try {
    socket = port === 465 ? tls.connect(connectOptions) : net.connect({ host, port });
    socket.setTimeout(30000, () => socket.destroy(new Error("SMTP connection timed out")));
    await new Promise((resolve, reject) => socket.once("connect", resolve).once("error", reject));
    await expect(null, [220]);
    await expect(`EHLO ${host}`, [250]);
    if (port !== 465) {
      await expect("STARTTLS", [220]);
      socket = tls.connect({ socket, servername: host, rejectUnauthorized: strict });
      buffer = "";
      await expect(`EHLO ${host}`, [250]);
    }
    await expect("AUTH LOGIN", [334]);
    await expect(Buffer.from(user).toString("base64"), [334]);
    await expect(Buffer.from(pass).toString("base64"), [235]);
    await expect(`MAIL FROM:<${extractEmail(from)}>`, [250]);
    for (const recipient of recipients) await expect(`RCPT TO:<${recipient}>`, [250, 251]);
    await expect("DATA", [354]);
    socket.write(`${buildMessage({ from, to, subject, text, html })}\r\n.\r\n`);
    const accepted = await readResponse();
    if (Number(accepted.slice(0, 3)) !== 250) throw new Error(`SMTP DATA failed: ${accepted}`);
    socket.write("QUIT\r\n");
    return { messageId: accepted.match(/queued as\s+(\S+)/i)?.[1] || undefined, accepted: recipients, rejected: [] };
  } finally {
    if (socket && !socket.destroyed) socket.end();
  }
}

export async function sendEmail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) {
    console.log(`[email:DEV] to=${to} subject=${subject}\n${text || ""}`);
    return { ok: false, skipped: true, error: "SMTP_HOST not configured" };
  }
  try {
    const info = await sendViaSmtp({ to, subject, text, html });
    console.log(`[email] sent to=${to} subject=${subject} id=${info.messageId} accepted=${(info.accepted||[]).length} rejected=${(info.rejected||[]).length}`);
    return { ok: true, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
  } catch (e) {
    console.error(`[email] failed to=${to} subject=${subject}:`, e && (e.stack || e.message || e));
    return { ok: false, error: e?.message || String(e) };
  }
}
