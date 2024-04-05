import { NextRequest, NextResponse } from "next/server";
// import { DEFAULT_DEBUGGER_HUB_URL } from "../debug";
import { RandomNumberRequestStateValue } from "./types";
import { kv } from "@vercel/kv";
import { getFrameMessage } from "frames.js";

export const maxDuration = 25; // This function can run for a maximum of 5 seconds
const MAXIMUM_KV_RESULT_LIFETIME_IN_SECONDS = 10 * 60; // 10 minutes

export async function POST(req: NextRequest) {
  const body = await req.json();
  // verify independently
  const frameMessage = await getFrameMessage(body.postBody);

  const uniqueId = `fid:${frameMessage.requesterFid}`;

  try {
    console.log(body.postBody);

    const playbackId = frameMessage.inputText;
    if (!playbackId) {
      return NextResponse.json({ message: "Playback ID is required" }, { status: 400 });
    }

    const response = await fetch(String(process.env.NODE_LIVEPEER_SERVER), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        playbackId: playbackId,
      }),
    });
    const { gifUrl } = await response.json();
    await kv.set<RandomNumberRequestStateValue>(
      uniqueId,
      {
        data: gifUrl,
        status: "success",
        timestamp: new Date().getTime(),
      },
      { ex: MAXIMUM_KV_RESULT_LIFETIME_IN_SECONDS },
    );
    return NextResponse.json(
      {
        data: gifUrl,
        status: "success",
        timestamp: new Date().getTime(),
      },
      { status: 200 },
    );
  } catch (e) {
    console.log(e);
    await kv.set<RandomNumberRequestStateValue>(
      uniqueId,
      {
        error: String(e),
        status: "error",
        timestamp: new Date().getTime(),
      },
      { ex: MAXIMUM_KV_RESULT_LIFETIME_IN_SECONDS },
    );
    // Handle errors
    return NextResponse.json({ message: e }, { status: 500 });
  }
}
