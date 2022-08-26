// ATTENTION: to pass tests truffle should process transactions instantaneously (Automine turned ON)

const assert = require("chai").assert;
const truffleAssert = require("truffle-assertions");
const Web3Utils = require("web3-utils");

const ERC721Streak = artifacts.require("ERC721Streak");
const ERC20Streak = artifacts.require("ERC20Streak");
const ERC1155Streak = artifacts.require("ERC1155Streak");
const AuctionFactoryStreak = artifacts.require("AuctionFactoryStreak");

const utils = require("./utils/utils");

contract("AuctionFactoryStreak auctions creation", accounts => {
  const creatorOfContract = accounts[0];
  const originalOwner = accounts.splice(-1)[0];

  let erc721Streak;
  let erc1155Streak;
  let erc20Streak;
  let auctionFactoryStreak;

  before(async () => {
    erc721Streak = await ERC721Streak.deployed();
    erc1155Streak = await ERC1155Streak.deployed();
    erc20Streak = await ERC20Streak.deployed();
    auctionFactoryStreak = await AuctionFactoryStreak.deployed();

    await utils.contracts.erc721StreakAPI.setApprovalForAll(auctionFactoryStreak.address, creatorOfContract);
    await utils.contracts.erc1155StreakAPI.setApprovalForAll(auctionFactoryStreak.address, creatorOfContract);
  })

  it("contract should have the proper name", async () => {
    const expectedName = "AuctionFactoryStreak";
    const actualName = await utils.contracts.auctionFactoryStreakAPI.getContractName();
    assert.equal(actualName, expectedName, "invalid contract name");
  });

  it("createAuction in ETH for ERC-721", async () => {
    const { tokenId } = await utils.contracts.erc721StreakAPI.mintERC721Token(creatorOfContract, utils.generateUrl());
    const currentBlockHeight = await web3.eth.getBlockNumber();
    const currentBlock = await web3.eth.getBlock(currentBlockHeight);
    const auctionDataForERC721 = {
      beneficiary: originalOwner,
      tokenId,
      bidStep: web3.utils.toWei("0.025", "ether"),
      startingBid: web3.utils.toWei("0.1", "ether"),
      startTimestamp: `${currentBlock.timestamp + 20}`,
      endTimestamp: `${currentBlock.timestamp + 50}`,
      acceptERC20: false,
      isErc1155: false,
      quantity: "0"
    }

    const createAuctionReceipt = await utils.contracts.auctionFactoryStreakAPI.createAuction(auctionDataForERC721, creatorOfContract);
    const newOwner = await utils.contracts.erc721StreakAPI.getArtworkOwner(tokenId);

    truffleAssert.eventEmitted(createAuctionReceipt, 'AuctionCreated', (ev) => {
      const auctionAddress = ev[0];
      const _previousOwner = ev[1];
      const _tokenId = Web3Utils.hexToNumber(ev[2]);
      return _tokenId === tokenId && auctionAddress === newOwner && _previousOwner === originalOwner;
    }, 'AuctionCreated event should be emitted with correct parameters');
  });

  it("createAuction in ERC20 for ERC-721", async () => {
    const { tokenId } = await utils.contracts.erc721StreakAPI.mintERC721Token(creatorOfContract, utils.generateUrl());
    const currentBlockHeight = await web3.eth.getBlockNumber();
    const currentBlock = await web3.eth.getBlock(currentBlockHeight);
    const auctionDataForERC721 = {
      beneficiary: originalOwner,
      tokenId,
      bidStep: web3.utils.toWei("0.025", "ether"),
      startingBid: web3.utils.toWei("0.1", "ether"),
      startTimestamp: `${currentBlock.timestamp + 20}`,
      endTimestamp: `${currentBlock.timestamp + 50}`,
      acceptERC20: true,
      isErc1155: false,
      quantity: "0"
    }

    const createAuctionReceipt = await utils.contracts.auctionFactoryStreakAPI.createAuction(auctionDataForERC721, creatorOfContract);
    const newOwner = await utils.contracts.erc721StreakAPI.getArtworkOwner(tokenId);

    truffleAssert.eventEmitted(createAuctionReceipt, 'AuctionCreated', (ev) => {
      const auctionAddress = ev[0];
      const _previousOwner = ev[1];
      const _tokenId = Web3Utils.hexToNumber(ev[2]);
      return _tokenId === tokenId && auctionAddress === newOwner && _previousOwner === originalOwner;
    }, 'AuctionCreated event should be emitted with correct parameters');
  });

  it("createAuction in ETH for ERC-1155", async () => {
    const { tokenId } = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(creatorOfContract, utils.generateArtwork1155());
    const currentBlockHeight = await web3.eth.getBlockNumber();
    const currentBlock = await web3.eth.getBlock(currentBlockHeight);
    const auctionDataForERC1155 = {
      beneficiary: originalOwner,
      tokenId,
      bidStep: web3.utils.toWei("0.025", "ether"),
      startingBid: web3.utils.toWei("0.1", "ether"),
      startTimestamp: `${currentBlock.timestamp + 20}`,
      endTimestamp: `${currentBlock.timestamp + 50}`,
      acceptERC20: false,
      isErc1155: true,
      quantity: "10"
    }

    const createAuctionReceipt = await utils.contracts.auctionFactoryStreakAPI.createAuction(auctionDataForERC1155, creatorOfContract);
    const balanceOfOriginalOwner = await utils.contracts.erc1155StreakAPI.getBalanceOf(tokenId, originalOwner);
    assert.equal(balanceOfOriginalOwner, 0, "Invalid balance of original owner");

    await truffleAssert.eventEmitted(createAuctionReceipt, 'AuctionCreated', async (ev) => {
      const _newOwner = ev[0];
      const _previousOwner = ev[1];
      const _tokenId = Web3Utils.hexToNumber(ev[2]);
      const balanceOfAuctionFactory = await utils.contracts.erc1155StreakAPI.getBalanceOf(tokenId, _newOwner);
      return _tokenId === tokenId && _previousOwner === originalOwner && balanceOfAuctionFactory === auctionDataForERC1155.quantity;
    }, 'AuctionCreated event should be emitted with correct parameters');
  });

  it("createAuction in ERC20 for ERC-1155", async () => {
    const { tokenId } = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(creatorOfContract, utils.generateArtwork1155());
    const currentBlockHeight = await web3.eth.getBlockNumber();
    const currentBlock = await web3.eth.getBlock(currentBlockHeight);
    const auctionDataForERC1155 = {
      beneficiary: originalOwner,
      tokenId,
      bidStep: web3.utils.toWei("0.025", "ether"),
      startingBid: web3.utils.toWei("0.1", "ether"),
      startTimestamp: `${currentBlock.timestamp + 20}`,
      endTimestamp: `${currentBlock.timestamp + 50}`,
      acceptERC20: true,
      isErc1155: true,
      quantity: "10"
    }

    const createAuctionReceipt = await utils.contracts.auctionFactoryStreakAPI.createAuction(auctionDataForERC1155, creatorOfContract);
    const balanceOfOriginalOwner = await utils.contracts.erc1155StreakAPI.getBalanceOf(tokenId, originalOwner);
    assert.equal(balanceOfOriginalOwner, 0, "Invalid balance of original owner");

    await truffleAssert.eventEmitted(createAuctionReceipt, 'AuctionCreated', async (ev) => {
      const _newOwner = ev[0];
      const _previousOwner = ev[1];
      const _tokenId = Web3Utils.hexToNumber(ev[2]);
      const balanceOfAuctionFactory = await utils.contracts.erc1155StreakAPI.getBalanceOf(tokenId, _newOwner);
      return _tokenId === tokenId && _previousOwner === originalOwner && balanceOfAuctionFactory === auctionDataForERC1155.quantity;
    }, 'AuctionCreated event should be emitted with correct parameters');
  });
});

contract("AuctionStreak for ERC-721 accepting ETH", accounts => {
  const creatorOfContract = accounts[0];
  const bidderOne = accounts[1];
  const bidderTwo = accounts[2];
  const bidderThree = accounts[3];
  const originalOwner = accounts.splice(-1)[0];
  const bidStep = web3.utils.toWei("0.025", "ether");
  const startingBid = web3.utils.toWei("0.1", "ether");

  let tokenId;
  let lastBid = 0;
  let feeRate = 0;
  let auctionAddress;

  let erc721Streak;
  let erc1155Streak;
  let erc20Streak;
  let auctionFactoryStreak;

  before(async () => {
    erc721Streak = await ERC721Streak.deployed();
    erc1155Streak = await ERC1155Streak.deployed();
    erc20Streak = await ERC20Streak.deployed();
    auctionFactoryStreak = await AuctionFactoryStreak.deployed();

    await utils.contracts.erc721StreakAPI.setApprovalForAll(auctionFactoryStreak.address, creatorOfContract);
    await utils.contracts.erc1155StreakAPI.setApprovalForAll(auctionFactoryStreak.address, creatorOfContract);

    const tokenData = await utils.contracts.erc721StreakAPI.mintERC721Token(creatorOfContract, utils.generateUrl());
    tokenId = tokenData.tokenId;
    const currentBlockHeight = await web3.eth.getBlockNumber();
    const currentBlock = await web3.eth.getBlock(currentBlockHeight);
    const auctionDataForERC721 = {
      beneficiary: originalOwner,
      tokenId,
      bidStep,
      startingBid,
      startTimestamp: `${currentBlock.timestamp + 2}`,
      endTimestamp: `${currentBlock.timestamp + 15}`,
      overtimeSeconds: 3,
      acceptERC20: false,
      isErc1155: false,
      quantity: "0",
      feeRate,
    }

    const createAuctionReceipt = await utils.contracts.auctionFactoryStreakAPI.createAuction(auctionDataForERC721, creatorOfContract);
    truffleAssert.eventEmitted(createAuctionReceipt, 'AuctionCreated', (ev) => {
      auctionAddress = ev[0];
      return true;
    }, "");
  });

  it("shouldn't be able to place a bid before auction started", async () => {
    const errorObject = {
      isError: false,
      errorMessage: "",
    }
    try {
      const bid = web3.utils.toWei("0.025", "ether");
      await utils.contracts.auctionFactoryStreakAPI.placeBid(auctionAddress, bidderOne, bid);
    } catch (e) {
      errorObject.isError = true;
      errorObject.errorMessage = e.reason;
    }
    assert(errorObject.isError, "Transaction should be reverted.");
  })

  it("shouldn't be able to place a bid if owner", async () => {
    const errorObject = {
      isError: false,
      errorMessage: "",
    }
    try {
      const bid = web3.utils.toWei("0.1", "ether");
      await utils.contracts.auctionFactoryStreakAPI.placeBid(auctionAddress, creatorOfContract, bid);
    } catch (e) {
      errorObject.isError = true;
      errorObject.errorMessage = e.reason;
    }
    assert(errorObject.isError, "Transaction should be reverted.");
    // assert.include(errorObject.errorMessage, "Auction owner can not place a bid.", "Wrong exception reason.");
  })

  it("shouldn't be able to place a bid if beneficiary", async () => {
    const errorObject = {
      isError: false,
      errorMessage: "",
    }
    try {
      const bid = web3.utils.toWei("0.1", "ether");
      await utils.contracts.auctionFactoryStreakAPI.placeBid(auctionAddress, originalOwner, bid);
    } catch (e) {
      errorObject.isError = true;
      errorObject.errorMessage = e.reason;
    }
    assert(errorObject.isError, "Transaction should be reverted.");
    // assert.include(errorObject.errorMessage, "Auction beneficiary can not place a bid.", "Wrong exception reason.");
  })

  it("shouldn't be able to place a zero-bid", async () => {
    const errorObject = {
      isError: false,
      errorMessage: "",
    }
    try {
      const bid = web3.utils.toWei("0", "ether");
      await utils.contracts.auctionFactoryStreakAPI.placeBid(auctionAddress, bidderOne, bid);
    } catch (e) {
      errorObject.isError = true;
      errorObject.errorMessage = e.reason;
    }
    assert(errorObject.isError, "Transaction should be reverted.");
    // assert.include(errorObject.errorMessage, "You should place a non-zero bid.", "Wrong exception reason.");
  })

  it("shouldn't be able to place a bid lower than starting price", async () => {
    const errorObject = {
      isError: false,
      errorMessage: "",
    }
    try {
      const bid = web3.utils.toWei("0.025", "ether");
      await utils.contracts.auctionFactoryStreakAPI.placeBid(auctionAddress, bidderOne, bid);
    } catch (e) {
      errorObject.isError = true;
      errorObject.errorMessage = e.reason;
    }
    assert(errorObject.isError, "Transaction should be reverted.");
    // assert.include(errorObject.errorMessage, "You should place a bid no lower than the starting price.", "Wrong exception reason.");
  })

  it("should be able to place a bid after auction started and send ETH to auction contract", async () => {
    const balanceBefore = await utils.getBalance(auctionAddress)

    const placeBidReceipt = await utils.contracts.auctionFactoryStreakAPI.placeBid(auctionAddress, bidderOne, startingBid);
    lastBid = startingBid;

    truffleAssert.eventEmitted(placeBidReceipt, 'BidPlaced', (ev) => {
      const sender = ev[0];
      const totalBid = web3.utils.BN(ev[1]).toString();
      const auctionContract = ev.auctionContract;
      return totalBid === lastBid && sender === bidderOne && auctionAddress === auctionContract;
    }, 'BidPlaced event should be emitted with correct parameters');

    const balanceAfter = await utils.getBalance(auctionAddress)
    assert.equal(lastBid, balanceAfter - balanceBefore, "")
  })

  it("shouldn't be able to place a bid if does not overbid previous", async () => {
    const errorObject = {
      isError: false,
      errorMessage: "",
    }
    try {
      const bidTwo = web3.utils.toWei("0.1", "ether");
      await utils.contracts.auctionFactoryStreakAPI.placeBid(auctionAddress, bidderTwo, bidTwo);
    } catch (e) {
      errorObject.isError = true;
      errorObject.errorMessage = e.reason;
    }
    assert(errorObject.isError, "Transaction should be reverted.");
  })

  it("should correctly count user's total bid", async () => {
    let totalBid = `${Number(lastBid) + Number(bidStep)}`;
    await utils.contracts.auctionFactoryStreakAPI.placeBid(auctionAddress, bidderThree, totalBid);
    for (let i = 0; i < 3; ++i) {
      await utils.contracts.auctionFactoryStreakAPI.placeBid(auctionAddress, bidderThree, bidStep);
      totalBid = `${Number(totalBid) + Number(bidStep)}`;
    }
    lastBid = totalBid;

    const fundsByBidder = await utils.contracts.auctionStreakAPI.getFundsByBidder(auctionAddress, bidderThree);
    assert.equal(fundsByBidder.toString(), totalBid);
  })

  it("should extend auction time if bid placed within last blocks before end", async () => {
    const overtimeSeconds = await utils.contracts.auctionFactoryStreakAPI.getOvertimeSeconds(auctionAddress);
    const endTimestampBefore = await utils.contracts.auctionFactoryStreakAPI.getEndTimestamp(auctionAddress);
    lastBid = `${Number(lastBid) + Number(bidStep)}`;
    await utils.contracts.auctionFactoryStreakAPI.placeBid(auctionAddress, bidderThree, bidStep);

    const endTimestampAfter = await utils.contracts.auctionFactoryStreakAPI.getEndTimestamp(auctionAddress);
    assert.equal(endTimestampAfter.toString(), endTimestampBefore.iadd(overtimeSeconds).toString());
  })

  it("should be able to claim funds after auction end if not won", async () => {
    await utils.contracts.auctionStreakAPI.simulateAuctionFinishing(auctionAddress);

    const balanceBefore = await utils.getBalance(bidderOne);
    await utils.contracts.auctionFactoryStreakAPI.claimFunds(auctionAddress, bidderOne);
    const balanceAfter = await utils.getBalance(bidderOne);
    assert(balanceAfter > balanceBefore, "ETH should be transferred to user.");
  })

  it("should be able to claim funds after auction end if beneficiary", async () => {
    const endTimestamp = Number(await utils.contracts.auctionFactoryStreakAPI.getEndTimestamp(auctionAddress));
    let currentBlock = await (web3.eth.getBlock(await web3.eth.getBlockNumber()));
    while (Number(currentBlock.timestamp) < endTimestamp) {
      await utils.mineOneBlock();
      currentBlock = await (web3.eth.getBlock(await web3.eth.getBlockNumber()));
    }

    const balanceBefore = await utils.getBalance(originalOwner);
    const receipt = await utils.contracts.auctionFactoryStreakAPI.claimFunds(auctionAddress, originalOwner);
    const balanceAfter = await utils.getBalance(originalOwner);
    const txFee = await utils.getTxCostInWei(receipt);
    const { toBN } = web3.utils;
    assert(toBN(balanceAfter).sub(toBN(balanceBefore)).toString() === toBN(lastBid).mul(toBN(100 - feeRate)).div(toBN(100)).sub(txFee).toString(), "ETH should be transferred to user.");
  })

  it("shouldn't be able to claim funds after auction end if won", async () => {
    const errorObject = {
      isError: false,
      errorMessage: "",
    }

    await utils.contracts.auctionStreakAPI.simulateAuctionFinishing(auctionAddress);

    try {
      await utils.contracts.auctionFactoryStreakAPI.claimFunds(auctionAddress, bidderThree);
    } catch (e) {
      errorObject.isError = true;
      errorObject.errorMessage = e.reason;
    }
    assert(errorObject.isError, "Transaction should be reverted.");
  })

  it("should be able to claim item after auction end if won", async () => {
    await utils.contracts.auctionStreakAPI.simulateAuctionFinishing(auctionAddress);

    await utils.contracts.auctionFactoryStreakAPI.claimItem(auctionAddress, bidderThree);
    const currentOwner = await utils.contracts.erc721StreakAPI.getArtworkOwner(tokenId);
    assert.equal(currentOwner, bidderThree, "Token should be transferred to winner.");
  })

  it("fee rate calculation for claim funds operation should be correct (case of 10% as default value for fee rate)", async () => {
    const beneficiary = originalOwner;
    const auctionController = creatorOfContract;

    await utils.contracts.erc721StreakAPI.setApprovalForAll(auctionFactoryStreak.address, creatorOfContract);

    const tokenData = await utils.contracts.erc721StreakAPI.mintERC721Token(creatorOfContract, utils.generateUrl());
    tokenId = tokenData.tokenId;
    const currentBlockHeight = await web3.eth.getBlockNumber();
    const currentBlock = await web3.eth.getBlock(currentBlockHeight);
    const auctionDataForERC721 = {
      beneficiary: originalOwner,
      tokenId,
      bidStep,
      startingBid,
      startTimestamp: `${currentBlock.timestamp + 2}`,
      endTimestamp: `${currentBlock.timestamp + 800}`,
      acceptERC20: false,
      isErc1155: false,
      quantity: "0",
      feeRate: 10,
    }

    const createAuctionReceipt = await utils.contracts.auctionFactoryStreakAPI.createAuction(auctionDataForERC721, creatorOfContract);
    let newAuctionAddress;
    truffleAssert.eventEmitted(createAuctionReceipt, 'AuctionCreated', (ev) => {
      newAuctionAddress = ev[0];
      return true;
    }, "");

    await utils.contracts.auctionFactoryStreakAPI.placeBid(newAuctionAddress, bidderOne, startingBid);
    await utils.contracts.auctionStreakAPI.simulateAuctionFinishing(newAuctionAddress);

    const balanceOfBeneficiaryBefore = await utils.getBalance(beneficiary);
    const balanceOfAuctionControllerBefore = await utils.getBalance(auctionController);

    const claimFundsReceiptForBenefeciary = await utils.contracts.auctionFactoryStreakAPI.claimFunds(newAuctionAddress, beneficiary);
    const claimFundsReceiptForAuctionController = await utils.contracts.auctionFactoryStreakAPI.claimFunds(newAuctionAddress, auctionController);
    const txCostForBeneficiary = await utils.getTxCostInWei(claimFundsReceiptForBenefeciary);
    const txCostForAuctionController = await utils.getTxCostInWei(claimFundsReceiptForAuctionController);

    const highestBid = await utils.contracts.auctionStreakAPI.getHighestBid(newAuctionAddress);
    const highestBidder = await utils.contracts.auctionStreakAPI.getHighestBidder(newAuctionAddress);

    const expectedFundsForBeneficiary = highestBid * 0.9;
    const expectedFundsForAuctionController = highestBid * 0.1;

    const balanceOfBeneficiaryBeforeBN = Web3Utils.toBN(`${balanceOfBeneficiaryBefore}`);
    const expectedFundsForBeneficiaryBN = Web3Utils.toBN(`${expectedFundsForBeneficiary}`);
    const expectedBalanceForBeneficiary = balanceOfBeneficiaryBeforeBN.add(expectedFundsForBeneficiaryBN).sub(txCostForBeneficiary).toString();

    const balanceOfAuctionControllerBeforeBN = Web3Utils.toBN(`${balanceOfAuctionControllerBefore}`);
    const expectedFundsForAuctionControllerBN = Web3Utils.toBN(`${expectedFundsForAuctionController}`);
    const expectedBalanceForAuctionController = balanceOfAuctionControllerBeforeBN.add(expectedFundsForAuctionControllerBN).sub(txCostForAuctionController).toString();

    const balanceOfBeneficiaryAfter = await utils.getBalance(beneficiary);
    const balanceOfAuctionControllerAfter = await utils.getBalance(auctionController);
    const balanceOfHighestBidderAfter = await utils.contracts.auctionStreakAPI.getFundsByBidder(newAuctionAddress, `${highestBidder}`);

    assert(balanceOfBeneficiaryAfter === expectedBalanceForBeneficiary, "beneficiary balance after claim funds is incorrect");
    assert(balanceOfAuctionControllerAfter === expectedBalanceForAuctionController, "auction controller balance after claim funds is incorrect");
    assert(balanceOfHighestBidderAfter.toString() === "0", "balance of highest bidder should be zero after all claim funds operations");
  })
});

contract("AuctionStreak for ERC-721 accepting ERC20", accounts => {
  const creatorOfContract = accounts[0];
  const bidderOne = accounts[1];
  const bidderTwo = accounts[2];
  const bidderThree = accounts[3];
  const originalOwner = accounts.splice(-1)[0];

  let erc721Streak;
  let erc1155Streak;
  let erc20Streak;
  let auctionFactoryStreak;

  before(async () => {
    erc721Streak = await ERC721Streak.deployed();
    erc1155Streak = await ERC1155Streak.deployed();
    erc20Streak = await ERC20Streak.deployed();
    auctionFactoryStreak = await AuctionFactoryStreak.deployed();


    await utils.contracts.erc721StreakAPI.setApprovalForAll(auctionFactoryStreak.address, creatorOfContract);
    await utils.contracts.erc1155StreakAPI.setApprovalForAll(auctionFactoryStreak.address, creatorOfContract);
  });
});

contract("AuctionStreak for ERC-1155 accepting ETH", accounts => {
  const creatorOfContract = accounts[0];
  const bidderOne = accounts[1];
  const bidderTwo = accounts[2];
  const bidderThree = accounts[3];
  const originalOwner = accounts.splice(-1)[0];

  let erc721Streak;
  let erc1155Streak;
  let erc20Streak;
  let auctionFactoryStreak;

  before(async () => {
    erc721Streak = await ERC721Streak.deployed();
    erc1155Streak = await ERC1155Streak.deployed();
    erc20Streak = await ERC20Streak.deployed();
    auctionFactoryStreak = await AuctionFactoryStreak.deployed();


    await utils.contracts.erc721StreakAPI.setApprovalForAll(auctionFactoryStreak.address, creatorOfContract);
    await utils.contracts.erc1155StreakAPI.setApprovalForAll(auctionFactoryStreak.address, creatorOfContract);
  });
});

contract("AuctionStreak for ERC-1155 accepting ERC20", accounts => {
  const creatorOfContract = accounts[0];
  const bidderOne = accounts[1];
  const bidderTwo = accounts[2];
  const bidderThree = accounts[3];
  const originalOwner = accounts.splice(-1)[0];

  let erc721Streak;
  let erc1155Streak;
  let erc20Streak;
  let auctionFactoryStreak;

  before(async () => {
    erc721Streak = await ERC721Streak.deployed();
    erc1155Streak = await ERC1155Streak.deployed();
    erc20Streak = await ERC20Streak.deployed();
    auctionFactoryStreak = await AuctionFactoryStreak.deployed();

    await utils.contracts.erc721StreakAPI.setApprovalForAll(auctionFactoryStreak.address, creatorOfContract);
    await utils.contracts.erc1155StreakAPI.setApprovalForAll(auctionFactoryStreak.address, creatorOfContract);
  });
});
