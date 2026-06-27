import { NextResponse } from "next/server";
import { User } from "@/models/User";
import { BriefComposerService } from "@/services/brief-composer.service";
import { EmailService } from "@/services/email.service";
import { dbConnect } from "@/lib/db"; // Use dbConnect from lib/db or lib/mongodb

export async function GET(request: Request) {
  return handleMorningCron(request);
}

export async function POST(request: Request) {
  return handleMorningCron(request);
}

async function handleMorningCron(request: Request) {
  await dbConnect();

  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const authHeader = request.headers.get("authorization");
  const token = secret || authHeader?.replace("Bearer ", "");

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetUid = searchParams.get("uid");
  if (targetUid) {
    try {
      const user = await User.findOne({ firebaseUid: targetUid }).lean();
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      const brief = await BriefComposerService.composeMorningBrief(targetUid);
      await EmailService.sendMorningBrief(
        targetUid,
        brief.email,
        brief.data,
        brief.telemetry,
        brief.skipped
      );
      return NextResponse.json({ success: true, message: `Sent morning brief to ${brief.email}` });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  try {
    const users = await User.find({ "briefSettings.morningBriefEnabled": true }).lean();
    let sentCount = 0;

    for (const user of users) {
      const timezone = user.briefSettings?.timezone || "UTC";
      
      try {
        const userTimeStr = new Date().toLocaleTimeString("en-US", { 
          timeZone: timezone, 
          hour: "numeric", 
          hour12: false 
        });
        const currentHour = parseInt(userTimeStr);
        const preferredHour = parseInt(user.briefSettings?.preferredMorningTime?.split(":")[0] || "8");

        // Send if the hour matches, or if we force send
        if (currentHour === preferredHour || searchParams.get("force") === "true") {
          const brief = await BriefComposerService.composeMorningBrief(user.firebaseUid);
          await EmailService.sendMorningBrief(
            user.firebaseUid,
            brief.email,
            brief.data,
            brief.telemetry,
            brief.skipped
          );
          sentCount++;
        }
      } catch (err) {
        console.error(`Failed to send morning brief to user ${user.firebaseUid}:`, err);
      }
    }

    return NextResponse.json({ success: true, processed: users.length, sent: sentCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
