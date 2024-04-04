// import { DEFAULT_DEBUGGER_HUB_URL } from "./debug";
import { RandomNumberRequestStateValue } from "./slow-fetch/types";
// import { currentURL } from "./utils";
import { kv } from "@vercel/kv";
import {
  FrameButton,
  FrameContainer,
  FrameImage,
  FrameInput,
  NextServerPageProps,
  getFrameMessage,
  getPreviousFrame,
} from "frames.js/next/server";

// import { currentURL } from "./utils";

// eslint-disable-next-line @typescript-eslint/ban-types
type State = {};

const initialState: State = {} as const;

// This is a react server component only
export default async function Home({ searchParams }: NextServerPageProps) {
  // const url = currentURL("/");
  const previousFrame = getPreviousFrame<State>(searchParams);

  const frameMessage = await getFrameMessage(previousFrame.postBody);

  if (frameMessage && !frameMessage?.isValid) {
    throw new Error("Invalid frame payload");
  }

  let frame: React.ReactElement;

  const intialFrame = (
    <FrameContainer
      postUrl={new URL("/frames", process.env.NEXT_PUBLIC_HOST).toString()}
      pathname="/"
      state={initialState}
      previousFrame={previousFrame}
    >
      <FrameImage>
        <div tw="w-full bg-slate-700 text-white justify-center items-center">
          NFTfy your favourite livepeer video with
        </div>
        <div tw="w-full h-full bg-slate-700 text-white justify-center items-center">LiveStreamNFT</div>
        <div tw="w-full bg-slate-700 text-white justify-center items-center">
          Enter playback ID and click `Generate` to generate gif.
        </div>
        <div tw="w-full bg-slate-700 text-white justify-center items-center">
          You can try out with `0b79ukgd9vf7t0ae`
        </div>
      </FrameImage>
      <FrameButton>Generate</FrameButton>
      <FrameInput text="Enter playback ID" />
    </FrameContainer>
  );

  const checkStatusFrame = (
    <FrameContainer
      postUrl={new URL("/frames", process.env.NEXT_PUBLIC_HOST).toString()}
      pathname="/"
      state={initialState}
      previousFrame={previousFrame}
    >
      <FrameImage>
        <div tw="w-full h-full bg-slate-700 text-white justify-center items-center">Loading...</div>
      </FrameImage>
      <FrameButton>Check status</FrameButton>
    </FrameContainer>
  );

  const errorFrame = (error: string) => (
    <FrameContainer
      postUrl={new URL("/frames", process.env.NEXT_PUBLIC_HOST).toString()}
      pathname="/"
      state={initialState}
      previousFrame={previousFrame}
    >
      <FrameImage>{error}</FrameImage>
      <FrameButton target={"/frames?retry=true"}>Retry</FrameButton>
    </FrameContainer>
  );

  if (frameMessage) {
    const { requesterFid } = frameMessage;

    const uniqueId = `fid:${requesterFid}`;

    const existingRequest = await kv.get<RandomNumberRequestStateValue>(uniqueId);

    if (existingRequest) {
      switch (existingRequest.status) {
        case "pending":
          frame = checkStatusFrame;
          break;
        case "success":
          // if retry is true, then try to generate again and show checkStatusFrame
          if (searchParams?.reset === "true") {
            // reset to initial state
            await kv.del(uniqueId);

            frame = intialFrame;
          } else {
            frame = (
              <FrameContainer
                postUrl={new URL("/frames", process.env.NEXT_PUBLIC_HOST).toString()}
                pathname="/"
                state={initialState}
                previousFrame={previousFrame}
              >
                <FrameImage src={existingRequest.data}>
                  {/* <div tw="w-full h-full bg-slate-700 text-white justify-center items-center flex">
                    The number is {existingRequest.data}
                  </div> */}
                </FrameImage>
                <FrameInput text="Enter NFT receiver's address" />
                <FrameButton target={"/frames?reset=true"}>Reset</FrameButton>
                <FrameButton target={"/txdata"} action="tx">
                  Mint NFT
                </FrameButton>
                {frameMessage.transactionId ? (
                  <FrameButton action="link" target={`${process.env.BLOCKEXPLORER_URL}/${frameMessage.transactionId}`}>
                    Transaction
                  </FrameButton>
                ) : null}
                <FrameButton action="link" target={existingRequest.data}>
                  Download
                </FrameButton>
              </FrameContainer>
            );
          }
          break;
        case "error":
          // if retry is true, then try to generate again and show checkStatusFrame
          if (searchParams?.retry === "true") {
            // reset to initial state
            await kv.del(uniqueId);

            frame = intialFrame;
          } else {
            frame = errorFrame(existingRequest.error);
          }
          break;
      }
    } else {
      await kv.set<RandomNumberRequestStateValue>(
        uniqueId,
        {
          status: "pending",
          timestamp: new Date().getTime(),
        },
        // set as pending for one minute
        { ex: 60 },
      );

      // start request, don't await it! Return a loading page, let this run in the background
      fetch(new URL("/slow-fetch", process.env.NEXT_PUBLIC_HOST).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postBody: JSON.parse(searchParams?.postBody as string),
        }),
      });

      frame = checkStatusFrame;
    }
  } else {
    frame = intialFrame;
  }

  // then, when done, return next frame
  return (
    <div className="p-4">
      Livepeer video to NFT frame.
      {frame}
    </div>
  );
}
