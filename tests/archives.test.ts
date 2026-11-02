import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import AdmZip from "adm-zip";
import { openArchive } from "../src/lib/archives";

test("concurrent requests share one ZIP read; replacing the ZIP invalidates the cache", async () => {
  const name = `__wa-replay-cache-test-${randomUUID()}.zip`;
  const file = path.join(process.cwd(), "data", name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    const zip = new AdmZip();
    zip.addFile("_chat.txt", Buffer.from("Synthetic export"));
    await fs.writeFile(file, zip.toBuffer());
    const archives = await Promise.all(Array.from({ length: 12 }, () => openArchive(name)));
    for (const archive of archives) assert.equal(archive, archives[0]);
    assert.equal(await openArchive(name), archives[0]);
    zip.addFile("extra.txt", Buffer.from("Another synthetic file"));
    await fs.writeFile(file, zip.toBuffer());
    const replaced = await openArchive(name);
    assert.notEqual(replaced, archives[0]);
    assert.ok(replaced.getEntry("extra.txt"));
  } finally {
    await fs.rm(file, { force: true });
  }
});

test("archive access rejects traversal, nested paths, and non-ZIP files", async () => {
  for (const name of ["../private.zip", "..\\private.zip", "/private.zip", "nested/private.zip", "notes.txt", ""]) {
    await assert.rejects(openArchive(name), /Choose a ZIP/);
  }
});
