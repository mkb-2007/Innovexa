import { NextResponse } from "next/server";
import { processUserQuery } from "@/lib/ai/chatEngine";

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Invalid query parameter" }, { status: 400 });
    }

    const responseMsg = processUserQuery(query);

    return NextResponse.json({
      success: true,
      message: responseMsg,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process ocean query", details: String(error) },
      { status: 500 }
    );
  }
}
