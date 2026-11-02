import { listArchives } from "@/lib/archives";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ archives: await listArchives() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The data folder could not be read. Check its permissions." }, { status: 500 });
  }
}
