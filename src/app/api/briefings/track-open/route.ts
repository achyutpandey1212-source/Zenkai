import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { BriefingLog } from "@/models/BriefingLog";
import { BehaviorEngine } from "@/services/behavior-engine.service";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF
const pixel = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const logId = searchParams.get("id");

    if (logId && Types.ObjectId.isValid(logId)) {
      await dbConnect();
      const log = await BriefingLog.findById(logId);
      
      if (log && !log.opened) {
        log.opened = true;
        log.openedAt = new Date();
        await log.save();

        // Notify BehaviorEngine
        await BehaviorEngine.updateFromBriefing(log.uid, log.type, "opened");
      }
    }
  } catch (err) {
    console.error("[TrackOpenRoute] Error recording briefing open:", err);
  }

  // Always return the transparent tracking pixel
  return new NextResponse(pixel, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
