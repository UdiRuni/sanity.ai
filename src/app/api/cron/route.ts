import { NextResponse, type NextRequest } from "next/server";
import { runForecastRound } from "@/engine/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled entry point: locks due questions and writes any missing forecasts.
 * Call it daily with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends
 * this header automatically when CRON_SECRET is set).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const report = await runForecastRound();
  return NextResponse.json(report);
}
