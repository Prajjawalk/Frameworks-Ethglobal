import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_DEBUGGER_HUB_URL } from "../debug";
import { RandomNumberRequestStateValue } from "./types";
import pinataSDK from "@pinata/sdk";
import { kv } from "@vercel/kv";
import axios from "axios";
import { exec } from "child_process";
import { getFrameMessage } from "frames.js";
import fs from "fs";
import { Livepeer } from "livepeer";

const MAXIMUM_KV_RESULT_LIFETIME_IN_SECONDS = 10 * 60; // 10 minutes
const pinata = new pinataSDK({ pinataJWTKey: process.env.PINATA_JWT });

async function pollUrlUntilResponse(url: string, expectedResponse: string, interval: number, maxAttempts: number) {
  let attempts = 0;
  // const axios = require("axios");
  while (attempts < maxAttempts) {
    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${process.env.LIVEPEER_API_KEY}`,
        },
      });
      if (response.data.status.phase == expectedResponse) {
        console.log("got the download url...");
        return response.data.downloadUrl;
      }
    } catch (error) {
      // Handle errors if necessary
      console.error("Error:", error);
      throw new Error("Error polling url");
    }
    await new Promise(resolve => setTimeout(resolve, interval));
    attempts++;
  }
  throw new Error(`Max attempts (${maxAttempts}) reached without receiving the expected response.`);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log("reached post");
  // verify independently
  const frameMessage = await getFrameMessage(body.postBody, {
    hubHttpUrl: DEFAULT_DEBUGGER_HUB_URL,
  });

  const uniqueId = `fid:${frameMessage.requesterFid}`;

  try {
    const playbackId = frameMessage.inputText;
    if (!playbackId) {
      return NextResponse.json({ message: "Video URL is required" }, { status: 400 });
    }

    const livepeer = new Livepeer({
      apiKey: process.env.LIVEPEER_API_KEY,
    });

    //clipping random livestream
    console.log("creating clip");
    const result = await livepeer.stream.createClip({
      /**
       * Playback ID of the stream or asset to clip
       */
      playbackId: playbackId,
      /**
       * Start time of the clip in milliseconds
       */
      startTime: Date.now() - 7000,
      /**
       * End time of the clip in milliseconds
       */
      endTime: Date.now() - 5000,
    });
    console.log(result.object?.asset);

    const url = `https://livepeer.studio/api/asset/${result.object?.asset.id}`;
    const expectedResponse = "ready";
    const pollingInterval = 5000; // 5 seconds (in milliseconds)
    const maxAttempts = 100;

    const downloadUrl = await pollUrlUntilResponse(url, expectedResponse, pollingInterval, maxAttempts);
    console.log(downloadUrl);
    // // fetch the playback info on the server
    // const playbackInfo = await livepeer.playback.get(playbackId);
    // const videoUrl = playbackInfo.playbackInfo?.meta.source[0]?.url;
    const videoUrl = downloadUrl;

    // console.log("playback info ", playbackInfo.playbackInfo?.meta.source[0]);

    // Download MP4 video file
    const mp4FilePath = "video.mp4";
    const mp4FileStream = fs.createWriteStream(mp4FilePath);
    const response = await axios.get(videoUrl, { responseType: "stream" });

    response.data.pipe(mp4FileStream);

    await new Promise((resolve, reject) => {
      mp4FileStream.on("finish", resolve);
      mp4FileStream.on("error", e => {
        console.log(e);
        reject(e);
      });
    });

    // Convert MP4 to GIF using FFmpeg
    const gifFilePath = "public/output.gif";
    await new Promise<void>((resolve, reject) => {
      exec(
        `ffmpeg -i ${mp4FilePath} -vf "fps=10,scale=320:-1:flags=lanczos" -c:v gif -loop 0 ${gifFilePath}`,
        error => {
          if (error) {
            console.log(error);
            reject(error);
            return;
          }
          resolve();
        },
      );
    });

    const readableStreamForFile = fs.createReadStream(gifFilePath);
    const options = {
      pinataMetadata: {
        name: "gif",
      },
    };
    const res = await pinata.pinFileToIPFS(readableStreamForFile, options);
    const { IpfsHash } = res;

    const gifUrl = `https://ipfs.io/ipfs/${IpfsHash}`;
    fs.unlinkSync(gifFilePath);
    fs.unlinkSync(mp4FilePath);
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