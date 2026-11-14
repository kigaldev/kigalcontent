import { NextRequest, NextResponse } from "next/server";

const BACKEND_INTERNAL_BASE =
  process.env.BACKEND_URL || "http://localhost:8000";

async function proxyRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const search = request.nextUrl.search;
  const targetUrl = new URL(
    `api/${pathStr}${search}`,
    `${BACKEND_INTERNAL_BASE.replace(/\/$/, "")}/`
  );

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    // Avoid forwarding hop-by-hop headers
    if (
      !["host", "connection", "transfer-encoding", "content-length"].includes(
        key.toLowerCase()
      )
    ) {
      headers.set(key, value);
    }
  });

  const body =
    ["GET", "HEAD"].includes(request.method) ? undefined : await request.blob();

  try {
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!["content-encoding", "transfer-encoding"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Internal Backend Service Unavailable",
        detail: err instanceof Error ? err.message : "Connection failed",
      },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
export const HEAD = proxyRequest;
