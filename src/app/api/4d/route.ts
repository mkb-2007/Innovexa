import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.ARGO_BACKEND_URL || "http://127.0.0.1:8000";

// In-memory cache for trajectory to make 4D explorer super fast
let cachedTrajectory: unknown = null;
const profileCache = new Map<number, unknown>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "trajectory";

  try {
    if (type === "trajectory") {
      if (cachedTrajectory) {
        return NextResponse.json(cachedTrajectory);
      }
      try {
        const res = await fetch(`${BACKEND_URL}/api/profile/trajectory/4d`, {
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const data = await res.json();
          cachedTrajectory = data;
          return NextResponse.json(data);
        }
      } catch (e) {
        console.warn("[/api/4d] Backend trajectory unavailable, using fallback:", e);
      }

      // Graceful fallback trajectory for Float 5904300 if backend is temporarily offline
      const fallbackPoints = [
        {
          profile_index: 100,
          latitude: 8.24,
          longitude: 142.25,
          time: "2014-07-16T12:00:00Z",
          max_depth: 2000,
          point_count: 50,
        },
      ];
      const fallbackTrajectory = {
        status: "success",
        profile_count: 1,
        points: fallbackPoints,
        trajectory: {
          profile_count: 1,
          points: fallbackPoints,
        },
      };
      return NextResponse.json(fallbackTrajectory);
    }

    if (type === "profile") {
      const index = parseInt(searchParams.get("index") || "0", 10);
      if (profileCache.has(index)) {
        return NextResponse.json(profileCache.get(index));
      }
      try {
        const res = await fetch(`${BACKEND_URL}/api/profile/${index}/4d`, {
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const data = await res.json();
          profileCache.set(index, data);
          return NextResponse.json(data);
        }
      } catch (e) {
        console.warn("[/api/4d] Backend profile unavailable, using fallback:", e);
      }

      // Fallback CTD profile
      const fallbackProfile = {
        status: "success",
        data: [
          { depth: 0, temperature: 29.8, salinity: 34.2, pressure: 0 },
          { depth: 100, temperature: 27.5, salinity: 34.9, pressure: 101 },
          { depth: 200, temperature: 18.2, salinity: 34.8, pressure: 202 },
          { depth: 500, temperature: 7.5, salinity: 34.5, pressure: 505 },
          { depth: 1000, temperature: 4.5, salinity: 34.5, pressure: 1010 },
          { depth: 2000, temperature: 2.2, salinity: 34.6, pressure: 2020 },
        ],
      };
      return NextResponse.json(fallbackProfile);
    }

    if (type === "visualization") {
      const start = searchParams.get("start") || "0";
      const end = searchParams.get("end") || "20";
      const minDepth = searchParams.get("min_depth");
      const maxDepth = searchParams.get("max_depth");

      let url = `${BACKEND_URL}/api/visualization/4d?start_profile=${start}&end_profile=${end}`;
      if (minDepth) url += `&min_depth=${minDepth}`;
      if (maxDepth) url += `&max_depth=${maxDepth}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        return NextResponse.json(
          { status: "error", message: `Backend error: ${res.statusText}` },
          { status: res.status }
        );
      }
      const data = await res.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ status: "error", message: "Unknown query type" }, { status: 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[/api/4d] Failed to connect to FastAPI backend:", errorMsg);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to connect to FastAPI ocean backend at " + BACKEND_URL,
      },
      { status: 502 }
    );
  }
}
