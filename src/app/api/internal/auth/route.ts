import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const adminKey = process.env.INTERNAL_ADMIN_KEY;

    if (!adminKey) {
      return NextResponse.json(
        { success: false, error: "Internal admin key is not configured on the server." },
        { status: 500 }
      );
    }

    if (password !== adminKey) {
      return NextResponse.json(
        { success: false, error: "Invalid admin key password." },
        { status: 401 }
      );
    }

    // Set cookie (temporary session cookie - omit maxAge/expires)
    const cookieStore = await cookies();
    cookieStore.set("internal_session", adminKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Internal Admin Auth API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("internal_session");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Internal Admin Logout API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
