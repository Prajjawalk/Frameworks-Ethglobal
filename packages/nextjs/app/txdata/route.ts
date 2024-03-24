import { NextRequest, NextResponse } from "next/server";
import { RandomNumberRequestStateValue } from "../slow-fetch/types";
import { kv } from "@vercel/kv";
import { TransactionTargetResponse, getFrameMessage } from "frames.js";
import { encodeFunctionData } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";

const MAXIMUM_KV_RESULT_LIFETIME_IN_SECONDS = 10 * 60; // 10 minutes
export async function POST(req: NextRequest): Promise<NextResponse<TransactionTargetResponse>> {
  console.log(req);

  const json = await req.json();

  const frameMessage = await getFrameMessage(json);
  console.log(frameMessage);
  if (!frameMessage.inputText || !(String(frameMessage.inputText).length == 42)) {
    throw new Error("No receiver address provided");
  }

  console.log(frameMessage.inputText);
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
      existingRequest
        ? existingRequest.status == "success"
          ? existingRequest.data
          : "https://ipfs.io/ipfs/QmbHsse37p6S8p5UWWrqm58L4C5LZZmeaTGeL3KFYEhuR5"
        : "https://ipfs.io/ipfs/QmbHsse37p6S8p5UWWrqm58L4C5LZZmeaTGeL3KFYEhuR5",
    ],
  });

  await kv.set<RandomNumberRequestStateValue>(
    uniqueId,
    {
      error: "",
      status: "analytics",
      timestamp: new Date().getTime(),
    },
    { ex: MAXIMUM_KV_RESULT_LIFETIME_IN_SECONDS },
  );

  return NextResponse.json({
    chainId: "eip155:84532",
    method: "eth_sendTransaction",
    params: {
      abi: deployedContracts[84532].FrameNFT.abi, //"function safeMint(address to, uint256 tokenId, string memory uri)",
      to: deployedContracts[84532].FrameNFT.address,
      // data: "0xbbc44b13000000000000000000000000264f9ef85c21de49451c3636116668889ca41aab00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000004368747470733a2f2f697066732e696f2f697066732f516d6248737365333770365338703555575772716d35384c3443354c5a5a6d65615447654c334b465945687552350000000000000000000000000000000000000000000000000000000000", //"0x783a112b0000000000000000000000000000000000000000000000000000000000000e250000000000000000000000000000000000000000000000000000000000000001",
      data: calldata,
      value: "0",
    },
  });
}
