import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";

const dataDirectory = path.join(process.cwd(), "data");
type ArchiveState = {
  cached?: { file: string; version: string; zip: AdmZip };
  pending?: { file: string; version: string; promise: Promise<AdmZip> };
};
// Route handlers and development reloads share the same compressed ZIP. Concurrent
// image requests also share an in-flight read instead of loading it once per image.
const shared = globalThis as typeof globalThis & { waReplayArchiveState?: ArchiveState };
const state = shared.waReplayArchiveState ??= {};

export async function listArchives() {
  await fs.mkdir(dataDirectory, { recursive: true });
  const entries = await fs.readdir(dataDirectory, { withFileTypes: true });
  const archives = await Promise.all(entries.filter((entry) => entry.isFile() && /\.zip$/i.test(entry.name)).map(async (entry) => {
    const stat = await fs.stat(path.join(dataDirectory, entry.name));
    return { name: entry.name, size: stat.size, modified: stat.mtime.toISOString() };
  }));
  return archives.sort((a, b) => a.name.localeCompare(b.name));
}

export async function openArchive(name: string) {
  if (!name || name.includes("/") || name.includes("\\") || !/\.zip$/i.test(name)) throw new Error("Choose a ZIP from the data folder.");
  const file = path.join(dataDirectory, name);
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Only ZIP files directly inside data are supported.");
  const version = `${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
  if (state.cached?.file === file && state.cached.version === version) return state.cached.zip;
  if (state.pending?.file === file && state.pending.version === version) return state.pending.promise;
  state.cached = undefined;
  const promise = (async () => {
    try {
      const zip = new AdmZip(await fs.readFile(file));
      state.cached = { file, version, zip };
      return zip;
    } catch {
      throw new Error("This ZIP could not be opened. Check that it is a complete, unencrypted WhatsApp export.");
    }
  })();
  state.pending = { file, version, promise };
  try {
    return await promise;
  } finally {
    if (state.pending?.promise === promise) state.pending = undefined;
  }
}

export function archiveFiles(zip: AdmZip) {
  return zip.getEntries().filter((entry) => !entry.isDirectory && !entry.entryName.startsWith("__MACOSX/") && !path.posix.basename(entry.entryName).startsWith("."));
}

export function decodeTranscript(buffer: Buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString("utf16le");
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return Buffer.from(buffer.subarray(2)).swap16().toString("utf16le");
  return buffer.toString("utf8");
}
