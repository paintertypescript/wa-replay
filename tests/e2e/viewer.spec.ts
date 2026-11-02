import { test, expect } from "@playwright/test";
import AdmZip from "adm-zip";
import fs from "node:fs/promises";
import path from "node:path";

const archive = "__wa-replay-test__.zip";
const file = path.join(process.cwd(), "data", archive);
// Synthetic messages only. Real exports never become test fixtures.
test.beforeAll(async () => {
  const zip = new AdmZip();
  const lines = ["[01/01/2024, 09:00:00] Messages are end-to-end encrypted"];
  for (let day = 1; day <= 60; day++) {
    const date = new Date(Date.UTC(2024, 0, day));
    for (let message = 0; message < 15; message++) {
      const stamp = `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/2024`;
      lines.push(`[${stamp}, 10:${String(message).padStart(2, "0")}:00] ${message % 2 ? "Ben" : "Ana"}: ${message === 1 ? "<attached: pixel.png>" : `Moment ${day}-${message} 🌻`}`);
    }
  }
  zip.addFile("_chat.txt", Buffer.from(lines.join("\n")));
  zip.addFile("media/pixel.png", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfY4AAAAASUVORK5CYII=", "base64"));
  zip.addFile("notes.txt", Buffer.from("Not a WhatsApp transcript"));
  zip.addFile("unsafe.html", Buffer.from("<script>alert(1)</script>"));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, zip.toBuffer());
});
test.afterAll(async () => { await fs.rm(file, { force: true }); });

test("calendar jumps to the start of a day, images expand, search navigates, and media stays local", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /wa-replay-test.*WhatsApp export/ }).click();
  await expect(page.getByLabel("Chat history")).toBeVisible();
  await expect(page.locator(".message-bubble")).not.toHaveCount(900);
  await page.getByRole("button", { name: "View pixel.png" }).first().click();
  await expect(page.getByRole("dialog", { name: "Image preview" })).toBeVisible();
  await page.getByRole("button", { name: "Close image" }).click();
  await page.getByRole("button", { name: /Jump to date/ }).click();
  await page.getByRole("button", { name: "Next month" }).click();
  await page.getByRole("button", { name: "February 14, 2024, 15 messages", exact: true }).click();
  await expect(page.getByText("Moment 45-0 🌻", { exact: true })).toBeVisible();
  const topDelta = await page.getByText("Moment 45-0 🌻", { exact: true }).evaluate((node) => node.getBoundingClientRect().top - document.querySelector(".message-scroller")!.getBoundingClientRect().top);
  expect(topDelta).toBeGreaterThanOrEqual(0);
  expect(topDelta).toBeLessThan(140);
  await page.screenshot({ path: "test-results/viewer-desktop.png" });
  await page.getByRole("button", { name: /Jump to date/ }).click();
  await expect(page.getByRole("button", { name: "February 14, 2024, 15 messages", exact: true })).toHaveAttribute("aria-current", "date");
  await page.keyboard.press("Escape");
  await page.getByLabel("Search messages").fill("Moment 59-14");
  await page.getByLabel("Search messages").press("Enter");
  await expect(page.getByText("Moment 59-14", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByRole("button", { name: "First message", exact: true }).click();
  await expect(page.getByText("Moment 1-0 🌻", { exact: true })).toBeVisible();
  const media = await request.get(`/api/media?${new URLSearchParams({ archive, path: "media/pixel.png" })}`);
  expect(media.headers()["content-type"]).toBe("image/png");
  expect(media.headers()["cache-control"]).toBe("no-store");
  const range = await request.get(`/api/media?${new URLSearchParams({ archive, path: "media/pixel.png" })}`, { headers: { Range: "bytes=0-9" } });
  expect(range.status()).toBe(206);
  expect((await range.body()).length).toBe(10);
  const unsafe = await request.get(`/api/media?${new URLSearchParams({ archive, path: "unsafe.html" })}`);
  expect(unsafe.headers()["content-type"]).toBe("application/octet-stream");
  expect(unsafe.headers()["content-disposition"]).toContain("attachment");
  const traversal = await request.get("/api/chat?archive=../private.zip");
  expect(traversal.status()).toBe(400);
  expect(errors).toEqual([]);
});

test("mobile library and transcript errors remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open library" }).click();
  await page.getByRole("button", { name: /wa-replay-test.*WhatsApp export/ }).click();
  await expect(page.getByLabel("Chat history")).toBeVisible();
  await expect.poll(() => page.locator(".sidebar").evaluate((node) => node.getBoundingClientRect().right)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/viewer-mobile.png" });
  await page.getByLabel("Transcript", { exact: true }).selectOption("notes.txt");
  await expect(page.getByRole("alert").filter({ hasText: "No WhatsApp messages" })).toBeVisible();
  // The selector must remain available to recover from a bad transcript.
  await page.getByLabel("Transcript", { exact: true }).selectOption("_chat.txt");
  await expect(page.getByLabel("Chat history")).toBeVisible();
});
