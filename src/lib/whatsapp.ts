import path from "node:path";
import type { Attachment, ChatData, ChatMessage, DateOrder } from "./types";

const controls = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
const header = /^\[?(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*([AP]\.?M\.?)?\]?\s*(?:-\s+)?(.*)$/i;

export function mediaKind(name: string): Attachment["kind"] {
  if (/\.(jpe?g|png|gif|webp|avif|bmp)$/i.test(name)) return "image";
  if (/\.(mp4|webm|mov|m4v|3gp)$/i.test(name)) return "video";
  if (/\.(opus|ogg|mp3|m4a|aac|wav|flac)$/i.test(name)) return "audio";
  return "file";
}

export function parseWhatsApp(text: string, files: string[] = [], requested: DateOrder = "auto"): Omit<ChatData, "transcripts" | "transcript"> {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const records: { rawDate: string; rawTime: string; meridiem: string; body: string }[] = [];
  let preamble = 0;
  for (const raw of lines) {
    const line = raw.replace(controls, "").replace(/[\u00a0\u202f]/g, " ");
    const match = line.match(header);
    if (match) {
      records.push({ rawDate: match[1], rawTime: match[2], meridiem: match[3] || "", body: match[4] });
    } else if (records.length) {
      records[records.length - 1].body += `\n${line}`;
    } else if (line.trim()) preamble++;
  }
  if (!records.length) throw new Error("No WhatsApp messages found. Choose a WhatsApp .txt export with dated message lines.");

  const parts = records.map((r) => r.rawDate.split(/[./-]/).map(Number));
  const yearFirst = records[0].rawDate.split(/[./-]/)[0].length === 4;
  const firstOver12 = parts.some(([a]) => a > 12);
  const secondOver12 = parts.some(([, b]) => b > 12);
  const ambiguousDates = !yearFirst && !firstOver12 && !secondOver12;
  const dateOrder = requested !== "auto" ? requested : yearFirst ? "ymd" : firstOver12 ? "dmy" : secondOver12 ? "mdy" : "dmy";
  const fileMap = new Map<string, string>();
  const key = (name: string) => name.normalize("NFC").toLowerCase();
  for (const file of files) {
    fileMap.set(key(file), file);
    const basename = path.posix.basename(file);
    if (!fileMap.has(key(basename))) fileMap.set(key(basename), file);
  }
  const participants: string[] = [];
  let mediaCount = 0;
  let missingMedia = 0;
  const messages: ChatMessage[] = records.map((record, id) => {
    const [a, b, c] = parts[id];
    let [year, month, day] = dateOrder === "ymd" ? [a, b, c] : dateOrder === "mdy" ? [c, a, b] : [c, b, a];
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const date = new Date(Date.UTC(year, month - 1, day));
    let [hour, minute, second = 0] = record.rawTime.split(":").map(Number);
    if (record.meridiem) {
      if (hour < 1 || hour > 12) throw new Error(`Invalid time on message ${id + 1}.`);
      hour = hour % 12 + (/p/i.test(record.meridiem) ? 12 : 0);
    }
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) {
      throw new Error(`Invalid date or time on message ${id + 1}. Try changing the export date format.`);
    }
    const split = record.body.indexOf(": ");
    const sender = split > 0 ? record.body.slice(0, split) : null;
    if (sender && !participants.includes(sender)) participants.push(sender);
    let body = split > 0 ? record.body.slice(split + 2) : record.body;
    const attachments: Attachment[] = [];
    const attach = (name: string) => {
      const file = fileMap.get(key(name.trim()));
      if (!file) { missingMedia++; return false; }
      if (!attachments.some((item) => item.path === file)) attachments.push({ path: file, name: path.posix.basename(file), kind: mediaKind(file) });
      return true;
    };
    body = body.replace(/<attached:\s*([^>]+)>/gi, (token, name: string) => attach(name) ? "" : token);
    body = body.replace(/^(.+?)\s*\((?:file attached|attached file)\)/gim, (token, name: string) => attach(name) ? "" : token);
    if (body.trim() && fileMap.has(key(body.trim()))) { attach(body.trim()); body = ""; }
    mediaCount += attachments.length;
    return {
      id, date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`,
      sender, text: body.trim(), attachments,
    };
  });
  const dayMap = new Map<string, { date: string; count: number; index: number }>();
  for (const [index, message] of messages.entries()) {
    const existing = dayMap.get(message.date);
    if (existing) existing.count++;
    else dayMap.set(message.date, { date: message.date, count: 1, index });
  }
  const warnings: string[] = [];
  if (preamble) warnings.push(`${preamble} introductory line(s) before the first message were skipped.`);
  if (missingMedia) warnings.push(`${missingMedia} attachment reference(s) are missing from this ZIP. Export the chat with media to include them.`);
  return { messages, participants, days: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)), dateOrder, ambiguousDates, warnings, mediaCount };
}
