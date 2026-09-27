import { demoFriendTable } from "@/lib/demo-table";
import { GameError } from "@/lib/game";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const table = await demoFriendTable(request);
    return Response.json(table, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const message = error instanceof GameError ? error.message : "示例桌暂时打不开。";
    const status = error instanceof GameError ? error.status : 503;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
