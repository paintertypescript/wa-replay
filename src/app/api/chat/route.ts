import { archiveFiles, decodeTranscript, openArchive } from "@/lib/archives";
import { parseWhatsApp } from "@/lib/whatsapp";
import type { DateOrder } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let transcripts: string[] = [];
  let transcript: string | undefined;
  try {
    const params = new URL(request.url).searchParams;
    const dateOrder = params.get("dateOrder") || "auto";
    if (!["auto", "dmy", "mdy", "ymd"].includes(dateOrder)) throw new Error("Invalid date format.");
    const zip = await openArchive(params.get("archive") || "");
    const files = archiveFiles(zip);
    transcripts = files.filter((entry) => /\.txt$/i.test(entry.entryName)).map((entry) => entry.entryName);
    transcript = params.get("transcript") || transcripts.find((name) => /(?:^|\/)_chat\.txt$/i.test(name)) || transcripts.find((name) => /whatsapp/i.test(name)) || transcripts[0];
    if (!transcript) throw new Error("No .txt export found inside this ZIP. Export the WhatsApp chat as a ZIP with its text file.");
    const entry = files.find((file) => file.entryName === transcript);
    if (!entry || !transcripts.includes(transcript)) throw new Error("The selected transcript was not found.");
    if (entry.header.size > 64 * 1024 * 1024) throw new Error("This transcript exceeds the 64 MB text limit. Please split the export.");
    const chat = parseWhatsApp(decodeTranscript(entry.getData()), files.map((entry) => entry.entryName), dateOrder as DateOrder);
    return Response.json({ ...chat, transcript, transcripts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error && !/ENOENT|EACCES|EPERM/.test(error.message) ? error.message : "The ZIP could not be read. Refresh the library and check the data folder.";
    return Response.json({ error: message, transcripts, transcript }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
