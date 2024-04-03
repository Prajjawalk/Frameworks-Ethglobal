import { NextRequest, NextResponse } from "next/server";
import { RandomNumberRequestStateValue } from "../slow-fetch/types";
import { kv } from "@vercel/kv";
import { TransactionTargetResponse, getFrameMessage } from "frames.js";
import { encodeFunctionData } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";

// const MAXIMUM_KV_RESULT_LIFETIME_IN_SECONDS = 10 * 60; // 10 minutes
export async function POST(req: NextRequest): Promise<NextResponse<TransactionTargetResponse>> {
  const json = await req.json();

  const frameMessage = await getFrameMessage(json);
  if (!frameMessage.inputText || !(String(frameMessage.inputText).length == 42)) {
    throw new Error("No receiver address provided");
  }

  const { requesterFid } = frameMessage;
  const uniqueId = `fid:${requesterFid}`;

  const existingRequest = await kv.get<RandomNumberRequestStateValue>(uniqueId);
  console.log(existingRequest);
  const calldata = encodeFunctionData({
    abi: deployedContracts[84532].FrameNFT.abi,
    functionName: "safeMint",
    args: [
      frameMessage.inputText,
      BigInt(Date.now()),
      existingRequest ? (existingRequest.status == "success" ? existingRequest.data : "") : "",
    ],
  });

  // if (existingRequest?.status == "success") {
  //   await kv.set<RandomNumberRequestStateValue>(
  //     uniqueId,
  //     {
  //       status: "completed",
  //       timestamp: new Date().getTime(),
  //     },
  //     { ex: MAXIMUM_KV_RESULT_LIFETIME_IN_SECONDS },
  //   );
  // }

  return NextResponse.json({
    chainId: "eip155:84532",
    method: "eth_sendTransaction",
    params: {
      abi: deployedContracts[84532].FrameNFT.abi, //"function safeMint(address to, uint256 tokenId, string memory uri)",
      to: deployedContracts[84532].FrameNFT.address,
      data: calldata,
      value: "0",
    },
  });
}
