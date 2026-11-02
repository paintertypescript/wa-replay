import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWhatsApp } from "../src/lib/whatsapp";
import { decodeTranscript } from "../src/lib/archives";

test("iOS: BOM, direction marks, narrow spaces, multiline text, captions, and nested media", () => {
  const chat = parseWhatsApp("\ufeff[31/12/2023, 11:59:01\u202fPM] Ana: Happy new year!\nSecond line\n\u200e[01/01/2024, 12:00:02 AM] Ben: \u200e<attached: photo.jpg>\nA lovely night\n[01/01/2024, 12:01:00 AM] Ana: <attached: note.opus>", ["media/photo.jpg", "media/note.opus"]);
  assert.equal(chat.dateOrder, "dmy");
  assert.deepEqual(chat.participants, ["Ana", "Ben"]);
  assert.equal(chat.messages[0].text, "Happy new year!\nSecond line");
  assert.equal(chat.messages[0].time, "23:59:01");
  assert.equal(chat.messages[1].time, "00:00:02");
  assert.equal(chat.messages[1].text, "A lovely night");
  assert.equal(chat.messages[1].attachments[0].path, "media/photo.jpg");
  assert.equal(chat.messages[2].attachments[0].kind, "audio");
  assert.equal(chat.mediaCount, 2);
  assert.deepEqual(chat.days, [{ date: "2023-12-31", count: 1, index: 0 }, { date: "2024-01-01", count: 2, index: 1 }]);
});

test("Android: US dates, system notices, 24-hour timestamps, attached files", () => {
  const chat = parseWhatsApp("12/31/23, 21:00 - Messages are end-to-end encrypted\n1/1/24, 09:20 - +1 555 123: IMG-20240101-WA0001.jpg (file attached)\nA caption\n1/1/24, 10:20 - Sam: report.pdf (file attached)", ["IMG-20240101-WA0001.jpg", "report.pdf"]);
  assert.equal(chat.dateOrder, "mdy");
  assert.equal(chat.messages[0].sender, null);
  assert.equal(chat.messages[1].sender, "+1 555 123");
  assert.equal(chat.messages[1].text, "A caption");
  assert.equal(chat.messages[2].attachments[0].kind, "file");
});

test("ambiguous dates default to DMY and can be explicitly changed to MDY", () => {
  const text = "[03/04/2024, 9:01 AM] Ana: Hello";
  assert.equal(parseWhatsApp(text).messages[0].date, "2024-04-03");
  assert.equal(parseWhatsApp(text).ambiguousDates, true);
  assert.equal(parseWhatsApp(text, [], "mdy").messages[0].date, "2024-03-04");
});

test("year-first dates, dots, dashes, and leap-day validation", () => {
  assert.equal(parseWhatsApp("2024-02-29, 12:20 - Ana: Leap day").messages[0].date, "2024-02-29");
  assert.equal(parseWhatsApp("29.02.2024, 12:20 - Ana: Leap day").messages[0].date, "2024-02-29");
  assert.throws(() => parseWhatsApp("29/02/2023, 12:20 - Ana: Nope"), /Invalid date/);
  assert.throws(() => parseWhatsApp("29/02/2024, 24:20 - Ana: Nope"), /Invalid date/);
});

test("missing media stays visible and yields a useful warning", () => {
  const chat = parseWhatsApp("[31/12/2023, 12:00] Ana: <attached: missing.jpg>\n[31/12/2023, 12:01] Ben: <Media omitted>");
  assert.equal(chat.messages[0].text, "<attached: missing.jpg>");
  assert.equal(chat.messages[1].text, "<Media omitted>");
  assert.match(chat.warnings[0], /missing from this ZIP/);
});

test("preserves source message order, Unicode, literal HTML, and same-day first indices", () => {
  const chat = parseWhatsApp("intro\n[31/12/2023, 12:00] Ana: <script>alert('hello')</script> 🌻\n[31/12/2023, 11:00] Ben: ¡Hola!");
  assert.equal(chat.messages[0].sender, "Ana");
  assert.match(chat.messages[0].text, /<script>/);
  assert.equal(chat.messages[1].text, "¡Hola!");
  assert.equal(chat.days[0].index, 0);
  assert.equal(chat.days[0].count, 2);
  assert.match(chat.warnings[0], /introductory/);
});

test("rejects non-chat text and decodes UTF-16 exports", () => {
  assert.throws(() => parseWhatsApp("Just some notes"), /No WhatsApp messages/);
  const text = "[31/12/2023, 12:00] Ana: 🌻";
  const bytes = Buffer.from(text, "utf16le");
  assert.equal(decodeTranscript(Buffer.concat([Buffer.from([0xff, 0xfe]), bytes])), text);
  assert.equal(decodeTranscript(Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(bytes).swap16()])), text);
});
