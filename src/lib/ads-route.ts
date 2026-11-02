import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { corsHeaders } from "@/lib/ads";

export function reply(req: NextRequest, body: unknown, status = 200) {
  const headers = corsHeaders(req.headers.get("origin"));
  return body === null ? new NextResponse(null, { status, headers }) : NextResponse.json(body, { status, headers });
}

export function preflight(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;

export async function readJson(req: NextRequest, maxBytes: number): Promise<unknown | undefined> {
  const text = await req.text();
  if (text.length > maxBytes) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
