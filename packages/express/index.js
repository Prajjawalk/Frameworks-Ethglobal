import express from 'express'
import pinataSDK from "@pinata/sdk";
import axios from "axios";
import { exec } from "child_process";
import fs from "fs";
import { Livepeer } from "livepeer";
import "dotenv/config"

const pinata = new pinataSDK({ pinataJWTKey: process.env.PINATA_JWT });
const app = express()
const port = 4000
app.use(express.json())

const livepeer = new Livepeer({
  apiKey: process.env.LIVEPEER_API_KEY,
});

app.post('/', async (req, res) => {
  console.log(req.body)
  const body = req.body
  const playbackId = body.playbackId;
  const playbackInfo = await livepeer.playback.get(playbackId);
  const videoUrl = playbackInfo.playbackInfo?.meta.source[0]?.url;

  const mp4FilePath = `video-${playbackId}.mp4`;
  const mp4FileStream = fs.createWriteStream(mp4FilePath);
  const response = await axios.get(String(videoUrl), { responseType: "stream" });

  response.data.pipe(mp4FileStream);

  await new Promise((resolve, reject) => {
    mp4FileStream.on("finish", resolve);
    mp4FileStream.on("error", e => {
      console.log(e);
      reject(e);
    });
  });
  console.log("mp4 file downloaded...");

  // Convert MP4 to GIF using FFmpeg
  const gifFilePath = `output-${playbackId}.gif`;
  await new Promise((resolve, reject) => {
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
  console.log("gif generated...");

  const readableStreamForFile = fs.createReadStream(gifFilePath);
  const options = {
    pinataMetadata: {
      name: "gif",
    },
  };
  const result = await pinata.pinFileToIPFS(readableStreamForFile, options);
  console.log(result);
  const { IpfsHash } = result;

  const gifUrl = `https://ipfs.io/ipfs/${IpfsHash}`;
  fs.unlinkSync(gifFilePath);
  fs.unlinkSync(mp4FilePath);

  res.send(JSON.stringify({
    gifUrl: gifUrl
  }))
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})