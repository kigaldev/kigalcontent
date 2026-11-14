import { NextResponse } from "next/server";

const BACKEND_INTERNAL_BASE =
  process.env.BACKEND_URL || "http://localhost:8000";

export async function GET() {
  const targetUrl = new URL(
    "health",
    `${BACKEND_INTERNAL_BASE.replace(/\/$/, "")}/`
  );

  try {
    const res = await fetch(targetUrl.toString(), { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { status: "degraded", backend: "offline" },
        { status: 503 }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { status: "degraded", backend: "unreachable" },
      { status: 503 }
    );
  }
}
