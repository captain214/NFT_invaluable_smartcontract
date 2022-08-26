const ExchangeStreak = artifacts.require("ExchangeStreak");
const ERC721Streak = artifacts.require("ERC721Streak");
const ERC1155Streak = artifacts.require("ERC1155Streak");
const ERC20Streak = artifacts.require("ERC20Streak");
const AuctionStreak = artifacts.require("AuctionStreak");
const AuctionFactoryStreak = artifacts.require("AuctionFactoryStreak");
const Web3Utils = require('web3-utils');
const { Wallet } = require("ethers");
const { utils: ethersUtils } = require("ethers/lib/ethers");

let artworkCounter = 0 // just a counter for generating unique artworks
let artwork1155Counter = 0 // counter for generating ERC1155 artworks

const erc721StreakAPI = {}
const erc1155StreakAPI = {}
const erc20StreakAPI = {}
const exchangeStreakAPI = {}

const auctionStreakAPI = {}
const auctionFactoryStreakAPI = {}

const signature = {}

//------------------------ Common  ------------------------ //

const zeroAddress = "0x0000000000000000000000000000000000000000"

const isZeroAddress = (address) => {
	return zeroAddress === address;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const getTxCostInWei = async (txReceipt) => {
	const gasUsed = txReceipt.receipt.gasUsed;
	const buyArtworkTx = await web3.eth.getTransaction(txReceipt.tx);
	const gasPrice = buyArtworkTx.gasPrice;
	
	const gasPriceInWeiBN = Web3Utils.toBN(gasPrice);
	const gasUsedBN = Web3Utils.toBN(gasUsed);
	const txCostInWeiBN = gasPriceInWeiBN.mul(gasUsedBN);
	return txCostInWeiBN;
}

const stringToBytes32 = (str) => {
	return Web3Utils.asciiToHex(str)
};

const createArtwork = (title, description, url) => {
	return { title, description, url };
}

const createArtwork1155 = (title, quantity, url, data) => {
	return { title, quantity, url, data };
}

const generateUrl = () => {
	artworkCounter++
	return `http://artwork${artworkCounter}.myarts.com`;
}

const generateArtwork1155 = () => {
	artwork1155Counter++
	return createArtwork1155(`title${artwork1155Counter}`, 10, `http://artwork${artwork1155Counter}.myarts.com`, `data${artwork1155Counter}`);
}

const toBeautifiedJson = (obj) => JSON.stringify(obj, null, 2)

const toStringJson = (obj) => JSON.stringify(obj)

const mineOneBlock = async () => {
	await web3.currentProvider.send({
		jsonrpc: '2.0',
		method: 'evm_mine',
		id: new Date().getTime()
	}, () => {
	})
}

const getBalance = async (address) => web3.eth.getBalance(address)

//there are two implementations of signature creating which are differs in the last byte of the signature

//this one is older
signature.createViaWeb3Account = async (tokenId, amount, nonce, signer) => {
	let message = Web3Utils.soliditySha3({ type: 'uint', value: tokenId }, {
		type: 'uint256',
		value: amount
	}, { type: 'uint256', value: nonce });
	let signature = await web3.eth.sign(message, signer);
	return { message, signature }
};

signature.createViaWeb3Account1155 = async (offerId, quantity, amount, nonce, signer) => {
	let message = Web3Utils.soliditySha3({ type: 'uint256', value: offerId }, {
		type: 'uint256',
		value: quantity
	}, { type: 'uint256', value: amount }, { type: 'uint256', value: nonce });
	let signature = await web3.eth.sign(message, signer);
	return { message, signature }
};

signature.createViaPrivateKey = async (tokenId, amount, nonce, privateKey) => {
	if (!privateKey.startsWith("0x")) {
		throw new Error("private key should be prefixed with '0x'")
	}
	let message = Web3Utils.soliditySha3({ type: 'uint', value: tokenId }, {
		type: 'uint256',
		value: amount
	}, { type: 'uint256', value: nonce });
	let result = await web3.eth.accounts.sign(message, privateKey);
	return result
};

signature.createViaMnemonic = async (tokenId, amount, nonce, mnemonic, hdPath, timestamp) => {
	const signer = Wallet.fromMnemonic(mnemonic, hdPath);
	
	const types = ["uint256", "uint256", "uint256"];
	const values = [tokenId, amount, nonce];
	types.push(...(timestamp ? ["uint256"] : []));
	values.push(...(timestamp ? [timestamp] : []));
	
	const messageEncoded = ethersUtils.defaultAbiCoder.encode(
		types,
		values
	)
	const messageHash = ethersUtils.keccak256(messageEncoded);
	const messageHashBinary = ethersUtils.arrayify(messageHash);
	const signature = await signer.signMessage(messageHashBinary);
	return { messageHash, signature };
};

signature.createViaMnemonic1155 = async (offerId, quantity, amount, nonce, mnemonic, hdPath, timestamp) => {
	const signer = Wallet.fromMnemonic(mnemonic, hdPath)
	
	const types = ["uint256", "uint256", "uint256", "uint256"];
	const values = [offerId, quantity, amount, nonce];
	types.push(...(timestamp ? ["uint256"] : []));
	values.push(...(timestamp ? [timestamp] : []));
	
	const messageEncoded = ethersUtils.defaultAbiCoder.encode(
		types,
		values
	);
	const messageHash = ethersUtils.keccak256(messageEncoded);
	const messageHashBinary = ethersUtils.arrayify(messageHash);
	const signature = await signer.signMessage(messageHashBinary);
	return { messageHash, signature };
};

//------------------------ ERC721Streak.sol ------------------------ //

erc721StreakAPI.mintItem = async (callerAddress, url) => {
	const erc721Instance = await ERC721Streak.deployed();
	return erc721Instance.mintItem(callerAddress, url, { from: callerAddress, value: Web3Utils.toWei("0", "ether") });
};

erc721StreakAPI.mintItemInNextTransaction = async (callerAddress, url) => {
	const erc721Instance = await ERC721Streak.deployed();
	return erc721Instance.mintItem.call(callerAddress, url, {
		from: callerAddress,
		value: Web3Utils.toWei("0", "ether")
	});
};

erc721StreakAPI.mintERC721Token = async (callerAddress, artworkObject) => {
	const tokenId = await erc721StreakAPI.mintItemInNextTransaction(callerAddress, artworkObject);
	const receipt = await erc721StreakAPI.mintItem(callerAddress, artworkObject);
	return {
		tokenId: Web3Utils.hexToNumber(tokenId),
		receipt
	}
}

erc721StreakAPI.getArtworkOwner = async (artTokenID) => {
	const erc721Instance = await ERC721Streak.deployed();
	return erc721Instance.ownerOf.call(artTokenID);
}

erc721StreakAPI.approve = async (artTokenID, approveAddress, callerAddress) => {
	const erc721Instance = await ERC721Streak.deployed();
	return erc721Instance.approve(approveAddress, artTokenID, {
		from: callerAddress,
		value: Web3Utils.toWei("0", "ether")
	});
}

erc721StreakAPI.setApprovalForAll = async (approveAddress, callerAddress) => {
	const erc721Instance = await ERC721Streak.deployed();
	return erc721Instance.setApprovalForAll(approveAddress, "1", {
		from: callerAddress,
		value: Web3Utils.toWei("0", "ether")
	});
}

erc721StreakAPI.transferFrom = async (from, to, tokenId, callerAddress) => {
	const erc721Instance = await ERC721Streak.deployed();
	return erc721Instance.transferFrom(from, to, tokenId, {
		from: callerAddress,
		value: Web3Utils.toWei("0", "ether")
	});
}

erc721StreakAPI.safeTransferFrom = async (from, to, tokenId, callerAddress) => {
	const erc721Instance = await ERC721Streak.deployed();
	return erc721Instance.safeTransferFrom(from, to, tokenId, {
		from: callerAddress,
		value: Web3Utils.toWei("0", "ether")
	});
}

//------------------------ ArtTokenERC1155.sol ------------------------ //

erc1155StreakAPI.mintItem = async (callerAddress, artwork1155) => {
	const artToken1155Instance = await ERC1155Streak.deployed();
	return artToken1155Instance.mintItem(stringToBytes32(artwork1155.title), artwork1155.quantity, artwork1155.url, stringToBytes32(artwork1155.data), {
		from: callerAddress,
		value: Web3Utils.toWei("0", "ether")
	});
};

erc1155StreakAPI.getTheArtWorkIdInTheNextTransactionToArtTokenSmartContract = async (callerAddress, artwork1155) => {
	const artToken1155Instance = await ERC1155Streak.deployed();
	return artToken1155Instance.mintItem.call(stringToBytes32(artwork1155.title), artwork1155.quantity, artwork1155.url, stringToBytes32(artwork1155.data), {
		from: callerAddress,
		value: Web3Utils.toWei("0", "ether")
	});
};

erc1155StreakAPI.createArtworkAsERC1155Token = async (callerAddress, artwork1155Object) => {
	const tokenId = await erc1155StreakAPI.getTheArtWorkIdInTheNextTransactionToArtTokenSmartContract(callerAddress, artwork1155Object);
	const receipt = await erc1155StreakAPI.mintItem(callerAddress, artwork1155Object);
	return {
		tokenId: Web3Utils.hexToNumber(tokenId),
		receipt: receipt
	}
}

erc1155StreakAPI.getBalanceOf = async (artTokenID, callerAddress) => {
	const artToken1155Instance = await ERC1155Streak.deployed();
	return artToken1155Instance.balanceOf.call(callerAddress, artTokenID, {
		from: callerAddress,
		value: Web3Utils.toWei("0", "ether")
	});
}

erc1155StreakAPI.setApprovalForAll = async (approveAddress, callerAddress) => {
	const artToken1155Instance = await ERC1155Streak.deployed();
	return artToken1155Instance.setApprovalForAll(approveAddress, "1", {
		from: callerAddress,
		value: Web3Utils.toWei("0", "ether")
	});
}

erc1155StreakAPI.transferFrom = async (from, to, tokenId, callerAddress) => {
	const artToken1155Instance = await ERC1155Streak.deployed();
	return artToken1155Instance.transferFrom(from, to, tokenId, {
		from: callerAddress,
		value: Web3Utils.toWei("0", "ether")
	});
}

erc1155StreakAPI.safeTransferFrom = async (from, to, tokenId, callerAddress) => {
	const artToken1155Instance = await ERC1155Streak.deployed();
	return artToken1155Instance.safeTransferFrom(from, to, tokenId, {
		from: callerAddress,
		value: Web3Utils.toWei("0", "ether")
	});
}

//------------------------ ExchangeStreak.sol ------------------------ //

exchangeStreakAPI.getContractName = async () => {
	const instance = await ExchangeStreak.deployed();
	const actualNameHex = await instance.name.call();
	const actualName = web3.utils.hexToString(actualNameHex);
	return actualName;
};

exchangeStreakAPI.getSigner = async () => {
	const instance = await ExchangeStreak.deployed();
	return instance.signerAddress.call();
};

exchangeStreakAPI.setSigner = async (newSigner, callerAddress) => {
	const instance = await ExchangeStreak.deployed();
	return instance.setSigner(newSigner, { from: callerAddress, value: 0 })
};

exchangeStreakAPI.getSafeVolatilityPeriod = async () => {
	const instance = await ExchangeStreak.deployed();
	return instance.safeVolatilityPeriod.call();
};

exchangeStreakAPI.setSafeVolatilityPeriod = async (newSafeVolatilityPeriod, callerAddress) => {
	const instance = await ExchangeStreak.deployed();
	return instance.setSafeVolatilityPeriod(newSafeVolatilityPeriod, { from: callerAddress, value: 0 })
};

exchangeStreakAPI.listToken = async (tokenID, priceInETH, callerAddress) => {
	const instance = await ExchangeStreak.deployed();
	return instance.listToken(tokenID, Web3Utils.toWei(priceInETH, "ether"), { from: callerAddress, value: 0 });
};

exchangeStreakAPI.listToken1155 = async (tokenID, quantity, priceInETH, callerAddress) => {
	const instance = await ExchangeStreak.deployed();
	return instance.listToken1155(tokenID, quantity, Web3Utils.toWei(priceInETH, "ether"), {
		from: callerAddress,
		value: 0
	});
};

exchangeStreakAPI.removeListToken = async (tokenID, callerAddress) => {
	const instance = await ExchangeStreak.deployed();
	return instance.removeListToken(tokenID, { from: callerAddress, value: 0 });
};

exchangeStreakAPI.removeListToken1155 = async (offerID, callerAddress) => {
	const instance = await ExchangeStreak.deployed();
	return instance.removeListToken1155(offerID, { from: callerAddress, value: 0 });
};

exchangeStreakAPI.getERC721Price = async (tokenID) => {
	const instance = await ExchangeStreak.deployed();
	const price = await instance.ERC721Prices.call(tokenID);
	return Web3Utils.fromWei(price, "ether")
};

exchangeStreakAPI.getERC1155OfferQuantity = async (offerID) => {
	const instance = await ExchangeStreak.deployed();
	const { quantity } = await instance.ERC1155Offers.call(offerID);
	return Web3Utils.hexToNumber(quantity)
};

exchangeStreakAPI.getERC1155Price = async (offerID) => {
	const instance = await ExchangeStreak.deployed();
	const { price } = await instance.ERC1155Offers.call(offerID);
	return Web3Utils.fromWei(price, "ether")
};

exchangeStreakAPI.getNonce = async (userAddress) => {
	const instance = await ExchangeStreak.deployed();
	const result = await instance.nonces.call(userAddress);
	return Web3Utils.hexToNumber(result)
};

exchangeStreakAPI.getTokensListed = async (userAddress, artTokenId) => {
	const instance = await ExchangeStreak.deployed();
	const result = await instance.tokensListed.call(userAddress, artTokenId);
	return Web3Utils.hexToNumber(result)
};

exchangeStreakAPI.buyTokenForETH = async (tokenID, priceInETH, callerAddress) => {
	const instance = await ExchangeStreak.deployed();
	return instance.buyToken(tokenID, { from: callerAddress, value: Web3Utils.toWei(priceInETH, "ether") })
};

exchangeStreakAPI.buyTokenForERC20 = async (tokenID, priceInERC20, nonce, signature, callerAddress, timestamp) => {
	const instance = await ExchangeStreak.deployed();
	return instance.buyTokenForERC20(tokenID, priceInERC20, nonce, signature, timestamp, {
		from: callerAddress,
		value: 0
	})
};

exchangeStreakAPI.buyToken1155ForETH = async (offerID, quantity, priceInETH, callerAddress) => {
	const instance = await ExchangeStreak.deployed();
	return instance.buyToken1155(offerID, quantity, {
		from: callerAddress,
		value: Web3Utils.toWei(priceInETH, "ether")
	})
};

exchangeStreakAPI.buyToken1155ForERC20 = async (offerID, quantity, priceInERC20, nonce, signature, callerAddress, timestamp) => {
	const instance = await ExchangeStreak.deployed();
	return instance.buyToken1155ForERC20(offerID, quantity, priceInERC20, nonce, signature, timestamp, {
		from: callerAddress,
		value: 0
	})
};

//------------------------ ERC20Streak.sol ------------------------ //

erc20StreakAPI.balanceOf = async (callerAddress) => {
	const erc20Instance = await ERC20Streak.deployed();
	const result = await erc20Instance.balanceOf.call(callerAddress)
	return Web3Utils.hexToNumber(result) + ""
};

erc20StreakAPI.transfer = async (to, amount, callerAddress) => {
	const erc20Instance = await ERC20Streak.deployed();
	return erc20Instance.transfer(to, amount, { from: callerAddress, value: 0 })
};

erc20StreakAPI.transferFrom = async (from, to, amount, callerAddress) => {
	const erc20Instance = await ERC20Streak.deployed();
	return erc20Instance.transferFrom(from, to, amount, { from: callerAddress, value: 0 })
};

erc20StreakAPI.approve = async (spender, amount, callerAddress) => {
	const erc20Instance = await ERC20Streak.deployed();
	return erc20Instance.approve(spender, amount, { from: callerAddress, value: 0 })
};

const revertAllERC20 = async (creatorOfContractAddress, callerAddress) => {
	const balance = await erc20StreakAPI.balanceOf(callerAddress);
	if (balance !== "0") {
		await erc20StreakAPI.transfer(creatorOfContractAddress, balance, callerAddress)
	}
}

//------------------------ AuctionFactoryStreak.sol ------------------------ //

auctionFactoryStreakAPI.getContractName = async () => {
  const instance = await AuctionFactoryStreak.deployed();
  const actualNameHex = await instance.name.call();
  const actualName = web3.utils.hexToString(actualNameHex);
  return actualName;
};

auctionFactoryStreakAPI.createAuction = async (auctionData, callerAddress) => {
  const instance = await AuctionFactoryStreak.deployed();
  const { beneficiary, tokenId, bidStep, startingBid, startTimestamp, endTimestamp, acceptERC20, isErc1155, quantity, feeRate = 10, overtimeSeconds = 900} = auctionData;
  return instance.createAuction(
    beneficiary,
    tokenId,
    bidStep,
    startingBid,
    startTimestamp,
    endTimestamp,
    acceptERC20,
    isErc1155,
    quantity,
    feeRate,
    overtimeSeconds,
    {
      from: callerAddress,
      value: 0
    })
};

auctionFactoryStreakAPI.placeBid = async (address, bidderAddress, amount) => {
  const instance = await AuctionFactoryStreak.deployed();
  return instance.placeBid(address, { from: bidderAddress, value: amount })
};

auctionFactoryStreakAPI.placeBidERC20 = async (address, bidderAddress, amount) => {
  const instance = await AuctionFactoryStreak.deployed();
  return instance.placeBidERC20(address, amount, { from: bidderAddress, value: 0 })
};

auctionFactoryStreakAPI.claimFunds = async (address, claimerAddress) => {
  const instance = await AuctionFactoryStreak.deployed();
  return instance.claimFunds(address, { from: claimerAddress, value: 0 })
};

auctionFactoryStreakAPI.claimItem = async (address, claimerAddress) => {
  const instance = await AuctionFactoryStreak.deployed();
  return instance.claimItem(address, { from: claimerAddress, value: 0 })
};

auctionFactoryStreakAPI.cancelAuction = async (address, callerAddress) => {
  const instance = await AuctionFactoryStreak.deployed();
  return instance.cancelAuction(address, { from: callerAddress, value: 0 })
};

auctionFactoryStreakAPI.getOvertimeSeconds = async (address) => {
  const instance = await AuctionFactoryStreak.deployed();
  const { overtimeSeconds } = await instance.auctionParameters(address);
  return overtimeSeconds;
};

auctionFactoryStreakAPI.getEndTimestamp = async (address) => {
  const instance = await AuctionFactoryStreak.deployed();
  const { endTimestamp } = await instance.auctionParameters(address);
  return endTimestamp;
};

//------------------------ AuctionStreak.sol ------------------------ //

auctionStreakAPI.getFundsByBidder = async (address, bidder) => {
  const instance = await AuctionStreak.at(address);
  return instance.fundsByBidder(bidder);
};

auctionStreakAPI.getHighestBidder = async (address) => {
  const instance = await AuctionStreak.at(address);
  return instance.highestBidder.call();
};

auctionStreakAPI.getHighestBid = async (address) => {
  const instance = await AuctionStreak.at(address);
  return instance.highestBid.call();
};

auctionStreakAPI.simulateAuctionFinishing = async (auctionAddress) => {
  const endTimestampBN = await auctionFactoryStreakAPI.getEndTimestamp(auctionAddress);
  let currentBlock = await web3.eth.getBlock(await web3.eth.getBlockNumber());
  let currentTimestampBN = Web3Utils.toBN(`${currentBlock.timestamp}`);
  while (currentTimestampBN.lt(endTimestampBN)) {
    await mineOneBlock();
    currentBlock = await web3.eth.getBlock(await web3.eth.getBlockNumber());
    currentTimestampBN = Web3Utils.toBN(`${currentBlock.timestamp}`);
  }
}

module.exports = {
	delay,
	zeroAddress,
	isZeroAddress,
	getTxCostInWei,
	stringToBytes32,
	toBeautifiedJson,
	toStringJson,
	generateUrl,
	generateArtwork1155,
	createArtwork,
	revertAllERC20,
	mineOneBlock,
	getBalance,
	signature,
	contracts: {
		erc721StreakAPI,
		erc1155StreakAPI,
		exchangeStreakAPI,
		erc20StreakAPI,
		auctionStreakAPI,
		auctionFactoryStreakAPI
	}
}
