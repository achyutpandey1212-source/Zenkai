import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { GoogleGenAI } from "@google/genai";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Verify user session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse uploaded file from FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type;

    // 3. Initialize Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }
    const ai = new GoogleGenAI({ apiKey });

    // 4. Run multimodal Gemini model to parse the file
    const prompt = `
Extract any schedule events, academic/career calendar items, syllabus topics, assignment deadlines, exam dates, or recurring commitments from this document.
Classify each item as one of these categories:
- "Goal" (a milestone, exam, project deliverable, or major target)
- "Constraint" (a class, office hours, gym sessions, work, or recurring commitment)
- "Task" (a specific action item or work piece)

Return a JSON array of objects with the following schema:
[
  {
    "title": "Title of the item",
    "description": "Short description of the item",
    "date": "Date of the event (YYYY-MM-DD if specific, or recurrence days like 'Monday-Friday', 'Every Day', 'Weekends' if recurring)",
    "startTime": "Start time in HH:mm format if specified, or empty string",
    "endTime": "End time in HH:mm format if specified, or empty string",
    "category": "Goal" | "Constraint" | "Task"
  }
]

CRITICAL: Return ONLY valid JSON, do not wrap it in markdown code blocks or add explanatory text.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            data: buffer.toString("base64"),
            mimeType: mimeType || "application/octet-stream",
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      return NextResponse.json({ success: false, error: "Empty response from Gemini parser" }, { status: 500 });
    }

    // Try parsing output
    let parsedItems = [];
    try {
      parsedItems = JSON.parse(textOutput.trim());
    } catch (parseError) {
      console.error("Failed to parse Gemini output as JSON:", textOutput);
      return NextResponse.json({ success: false, error: "Failed to parse extracted data" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      items: parsedItems,
    });
  } catch (error: any) {
    console.error("POST /api/onboarding/import error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
