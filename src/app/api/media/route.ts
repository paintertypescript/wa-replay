import path from "node:path";
import { archiveFiles, openArchive } from "@/lib/archives";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mimeTypes: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif", ".bmp": "image/bmp",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".m4v": "video/mp4", ".3gp": "video/3gpp",
  ".opus": "audio/ogg", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".flac": "audio/flac",
};

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const zip = await openArchive(params.get("archive") || "");
    const entry = archiveFiles(zip).find((file) => file.entryName === params.get("path"));
    if (!entry) return new Response("Attachment not found", { status: 404 });
    if (entry.header.size > 512 * 1024 * 1024) return new Response("Attachment exceeds the 512 MB limit", { status: 413 });
    const data = entry.getData();
    const mime = mimeTypes[path.extname(entry.entryName).toLowerCase()] || "application/octet-stream";
    const headers = new Headers({
      "Content-Type": mime, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes",
      "Content-Disposition": `${mime === "application/octet-stream" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(path.posix.basename(entry.entryName)).replace(/'/g, "%27")}`,
    });
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const start = match?.[1] ? Number(match[1]) : match?.[2] ? Math.max(0, data.length - Number(match[2])) : NaN;
      const end = match?.[1] && match?.[2] ? Math.min(Number(match[2]), data.length - 1) : data.length - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= data.length) {
        headers.set("Content-Range", `bytes */${data.length}`);
        return new Response(null, { status: 416, headers });
      }
      headers.set("Content-Range", `bytes ${start}-${end}/${data.length}`);
      headers.set("Content-Length", String(end - start + 1));
      return new Response(new Uint8Array(data.subarray(start, end + 1)), { status: 206, headers });
    }
    headers.set("Content-Length", String(data.length));
    return new Response(new Uint8Array(data), { headers });
  } catch {
    return new Response("Attachment could not be read", { status: 404 });
  }
}
