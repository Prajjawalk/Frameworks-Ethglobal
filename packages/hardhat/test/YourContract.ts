// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { FrameNFT } from "../typechain-types";

// describe("FrameNFT", function () {
//   // We define a fixture to reuse the same setup in every test.

//   let yourContract: FrameNFT;
//   before(async () => {
//     const [owner] = await ethers.getSigners();
//     const yourContractFactory = await ethers.getContractFactory("FrameNFT");
//     yourContract = (await yourContractFactory.deploy(owner.address)) as FrameNFT;
//     await yourContract.waitForDeployment();
//   });

//   describe("Deployment", function () {
//     it("Should have the right message on deploy", async function () {
//       expect(await yourContract.greeting()).to.equal("Building Unstoppable Apps!!!");
//     });

//     it("Should allow setting a new message", async function () {
//       const newGreeting = "Learn Scaffold-ETH 2! :)";

//       await yourContract.setGreeting(newGreeting);
//       expect(await yourContract.greeting()).to.equal(newGreeting);
//     });
//   });
// });
