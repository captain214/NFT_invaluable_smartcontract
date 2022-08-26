const dotenv = require("dotenv");

const ExchangeStreak = artifacts.require("ExchangeStreak");
const ERC721Streak = artifacts.require("ERC721Streak");
const ERC20Streak = artifacts.require("ERC20Streak");

const assert = require("chai").assert;
const truffleAssert = require('truffle-assertions');
const Web3Utils = require('web3-utils');

const utils = require("./utils/utils");

contract("ExchangeStreak", accounts => {
	const contractCreator = accounts[0];
	console.log({accounts})
	const { parsed } = dotenv.config();
	const nonceStep = 10;
	let signer = parsed.SIGNER_ADDRESS;
	let mnemonic = parsed.SIGNER_MNEMONICS;
	let hdPath = parsed.SIGNER_HD_PATH;
	let nonces;
	
	let erc721Streak;
	let exchangeStreak;
	let erc20Streak;
	
	console.log({ signer, mnemonic, hdPath })
	
	const getNextNonce = (userAddress) => {
		nonces[userAddress] += nonceStep;
		return nonces[userAddress];
	}
	
	before(async function () {
		// runs once before the first test in this block
		erc721Streak = await ERC721Streak.deployed();
		exchangeStreak = await ExchangeStreak.deployed();
		erc20Streak = await ERC20Streak.deployed();
		
		nonces = await accounts.reduce(async (_agg, address) => {
			const agg = await _agg;
			const nonce = await exchangeStreak.nonces(address);
			return {
				...agg,
				[`${address}`]: Web3Utils.hexToNumber(nonce),
			}
		}, {});
	});
	
	after(function () {
		// runs once after the last test in this block
	});
	
	beforeEach(function () {
		// runs before each test in this block
	});
	
	afterEach(async () => {
		// runs after each test in this block
		// TODO: find a pretty way to clean state in blockchain (amount of ERC20 token, ETH balance etc)
	});
	
	it("contract should have name", async () => {
		const expectedName = "ExchangeStreak";
		const actualName = await utils.contracts.exchangeStreakAPI.getContractName();
		assert.equal(actualName, expectedName, "invalid contract name");
	});
	
	it("contract should have signer", async () => {
		const expectedSigner = signer;
		const actualSigner = await utils.contracts.exchangeStreakAPI.getSigner();
		assert.equal(actualSigner, expectedSigner, "invalid signer address");
	});
	
	it("update signer, main scenario", async () => {
		const newSigner = accounts.splice(-1)[0];
		await utils.contracts.exchangeStreakAPI.setSigner(newSigner, contractCreator);
		const actualSigner = await utils.contracts.exchangeStreakAPI.getSigner();
		assert.equal(actualSigner, newSigner, "invalid signer address");
		
		// revert signer
		await utils.contracts.exchangeStreakAPI.setSigner(signer, contractCreator);
	});
	
	it("update signer, not enough permissions to change the signer", async () => {
		const villain = accounts[1];
		await truffleAssert.fails(
			utils.contracts.exchangeStreakAPI.setSigner(villain, villain),
			truffleAssert.ErrorType.REVERT,
			""
		);
		const actualSigner = await utils.contracts.exchangeStreakAPI.getSigner();
		assert.equal(actualSigner, signer, "invalid signer address");
	});
	
	it("update volatility period, main scenario", async () => {
		const newSafeVolatilityPeriod = 3600;
		await utils.contracts.exchangeStreakAPI.setSafeVolatilityPeriod(newSafeVolatilityPeriod, contractCreator);
		const actualSafeVolatilityPeriod = await utils.contracts.exchangeStreakAPI.getSafeVolatilityPeriod();
		assert.equal(actualSafeVolatilityPeriod, newSafeVolatilityPeriod, "invalid safe volatility period");
	});
	
	it("update timestamp, not enough permissions to change the signer", async () => {
		const previousSafeVolatilityPeriod = await utils.contracts.exchangeStreakAPI.getSafeVolatilityPeriod();
		const newSafeVolatilityPeriod = 1800;
		const villain = accounts[1];
		await truffleAssert.fails(
			utils.contracts.exchangeStreakAPI.setSafeVolatilityPeriod(newSafeVolatilityPeriod, villain),
			truffleAssert.ErrorType.REVERT,
			""
		);
		const actualSafeVolatilityPeriod = await utils.contracts.exchangeStreakAPI.getSafeVolatilityPeriod();
		assert.equal(Number(actualSafeVolatilityPeriod), Number(previousSafeVolatilityPeriod), "invalid safe volatility period");
	});
	
	it("put the artwork for sale, main scenario: setting and getting the price in ETH", async () => {
		const seller = accounts[1];
		const expectedPriceInETH = "0.01";
		
		const item = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		await utils.contracts.erc721StreakAPI.approve(item.tokenId, exchangeStreak.address, seller);
		
		const putArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.listToken(item.tokenId, expectedPriceInETH, seller);
		
		const actualPriceInETH = await utils.contracts.exchangeStreakAPI.getERC721Price(item.tokenId);
		const ownerOfArtwork = await utils.contracts.erc721StreakAPI.getArtworkOwner(item.tokenId, seller);
		
		assert.equal(expectedPriceInETH, actualPriceInETH, `invalid price of the artwork`);
		assert.equal(seller, ownerOfArtwork, `invalid owner`);
		
		truffleAssert.eventEmitted(putArtworkToSaleResult, 'TokenPriceListed', (ev) => {
			const _tokenId = Web3Utils.hexToNumber(ev[0]);
			const _owner = ev[1]
			const _price = Web3Utils.fromWei(ev[2], "ether")
			return _tokenId === item.tokenId && _owner === seller && _price === expectedPriceInETH;
		}, 'TokenListed event should be emitted with correct parameters');
	});
	
	it("put the artwork for sale, resetting the price in ETH", async () => {
		const seller = accounts[1];
		const oldPriceInETH = "0.01";
		const newPriceInETH = "0.02";
		
		const artwork = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		await utils.contracts.erc721StreakAPI.approve(artwork.tokenId, exchangeStreak.address, seller);
		
		await utils.contracts.exchangeStreakAPI.listToken(artwork.tokenId, oldPriceInETH, seller);
		
		await truffleAssert.fails(
			utils.contracts.exchangeStreakAPI.listToken(artwork.tokenId, newPriceInETH, seller),
			truffleAssert.ErrorType.REVERT,
			""
		);
		
		const actualPriceInETH = await utils.contracts.exchangeStreakAPI.getERC721Price(artwork.tokenId);
		
		assert.equal(oldPriceInETH, actualPriceInETH, `invalid price of the artwork`);
	});
	
	it("put the artwork for sale, villain tries to change the price in ETH", async () => {
		const seller = accounts[1];
		const villain = accounts[2];
		
		const oldPriceInETH = "0.01";
		const newPriceInETH = "0.02";
		
		const artwork = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		await utils.contracts.erc721StreakAPI.approve(artwork.tokenId, exchangeStreak.address, seller);
		
		await utils.contracts.exchangeStreakAPI.listToken(artwork.tokenId, oldPriceInETH, seller);
		
		await truffleAssert.fails(
			utils.contracts.exchangeStreakAPI.listToken(artwork.tokenId, newPriceInETH, villain),
			truffleAssert.ErrorType.REVERT,
			""
		);
		
		const actualPriceInETH = await utils.contracts.exchangeStreakAPI.getERC721Price(artwork.tokenId);
		const ownerOfArtwork = await utils.contracts.erc721StreakAPI.getArtworkOwner(artwork.tokenId, seller);
		
		assert.equal(oldPriceInETH, actualPriceInETH, `invalid price`);
		assert.equal(seller, ownerOfArtwork, `invalid owner`);
	});
	
	it("remove the artwork from sale", async () => {
		const seller = accounts[1];
		const priceInETH = "0.01"
		
		const artwork = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		await utils.contracts.erc721StreakAPI.approve(artwork.tokenId, exchangeStreak.address, seller);
		
		await utils.contracts.exchangeStreakAPI.listToken(artwork.tokenId, priceInETH, seller);
		
		const receipt = await utils.contracts.exchangeStreakAPI.removeListToken(artwork.tokenId, seller);
		
		const actualPriceInETH = await utils.contracts.exchangeStreakAPI.getERC721Price(artwork.tokenId);
		const ownerOfArtwork = await utils.contracts.erc721StreakAPI.getArtworkOwner(artwork.tokenId, seller);
		
		assert.equal("0", actualPriceInETH, `invalid price of the artwork`);
		assert.equal(seller, ownerOfArtwork, `invalid owner`);
		
		truffleAssert.eventEmitted(receipt, 'TokenPriceDeleted', (ev) => {
			const _tokenId = Web3Utils.hexToNumber(ev[0]);
			return _tokenId === artwork.tokenId;
		}, 'TokenDeleted event should be emitted with correct parameters');
	});
	
	it("artwork purchase in ETH, success transaction", async () => {
		const seller = accounts[1];
		const buyer = accounts[2];
		const priceInETH = "0.001";
		
		const artwork = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		await utils.contracts.erc721StreakAPI.approve(artwork.tokenId, exchangeStreak.address, seller);
		await utils.contracts.exchangeStreakAPI.listToken(artwork.tokenId, priceInETH, seller);
		
		const priceInWei = Web3Utils.toBN(Web3Utils.toWei(priceInETH, "ether"));
		const sellerBalanceBeforeTx = Web3Utils.toBN((await web3.eth.getBalance(seller)));
		const buyerBalanceBeforeTx = Web3Utils.toBN((await web3.eth.getBalance(buyer)));
		
		const receipt = await utils.contracts.exchangeStreakAPI.buyTokenForETH(artwork.tokenId, priceInETH, buyer);
		const txCost = await utils.getTxCostInWei(receipt)
		
		const expectedSellerBalance = sellerBalanceBeforeTx.add(priceInWei).toString()
		const expectedBuyerBalance = buyerBalanceBeforeTx.sub(priceInWei).sub(txCost).toString()
		
		const actualSellerBalance = await web3.eth.getBalance(seller)
		const actualBuyerBalance = await web3.eth.getBalance(buyer)
		
		assert.equal(expectedSellerBalance, actualSellerBalance, "invalid balance of the seller");
		assert.equal(expectedBuyerBalance, actualBuyerBalance, "invalid balance of the buyer");
		
		const ownerOfArtwork = await utils.contracts.erc721StreakAPI.getArtworkOwner(artwork.tokenId, buyer);
		const actualPriceInETH = await utils.contracts.exchangeStreakAPI.getERC721Price(artwork.tokenId);
		
		assert.equal(ownerOfArtwork, buyer, "invalid art token owner");
		assert.equal("0", actualPriceInETH, "invalid art token price after the sale");
		
		truffleAssert.eventEmitted(receipt, 'TokenSold', (ev) => {
			const _tokenId = Web3Utils.hexToNumber(ev[0]);
			const _price = Web3Utils.fromWei(ev[1], "ether")
			const _soldForERC20 = ev[2];
			return _tokenId === artwork.tokenId && _price === priceInETH && !_soldForERC20;
		}, 'TokenSold event should be emitted with correct parameters');
		
		truffleAssert.eventEmitted(receipt, 'TokenOwned', (ev) => {
			const _tokenId = Web3Utils.hexToNumber(ev[0]);
			const _previousOwner = ev[1];
			const _newOwner = ev[2];
			return _tokenId === artwork.tokenId && _previousOwner === seller && _newOwner === buyer;
		}, 'TokenOwned event should be emitted with correct parameters');
		
		truffleAssert.eventEmitted(receipt, 'TokenPriceDeleted', (ev) => {
			const _tokenId = Web3Utils.hexToNumber(ev[0]);
			return _tokenId === artwork.tokenId;
		}, 'TokenDeleted event should be emitted with correct parameters');
	});
	
	it("artwork purchase in ETH, invalid price", async () => {
		const seller = accounts[1];
		const buyer = accounts[2];
		const correctPriceInETH = "0.001";
		const wrongPriceInETH = "0.000001";
		
		const artwork = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		await utils.contracts.erc721StreakAPI.approve(artwork.tokenId, exchangeStreak.address, seller);
		await utils.contracts.exchangeStreakAPI.listToken(artwork.tokenId, correctPriceInETH, seller);
		
		await truffleAssert.fails(
			utils.contracts.exchangeStreakAPI.buyTokenForETH(artwork.tokenId, wrongPriceInETH, buyer),
			truffleAssert.ErrorType.REVERT,
			""
		);
	});
	
	it("artwork purchase in ETH, token is not for sale", async () => {
		const seller = accounts[1];
		const buyer = accounts[2];
		const priceInETH = "0.001";
		
		const artwork = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		await utils.contracts.erc721StreakAPI.approve(artwork.tokenId, exchangeStreak.address, seller);
		
		await truffleAssert.fails(utils.contracts.exchangeStreakAPI.buyTokenForETH(
			artwork.tokenId, priceInETH, buyer),
			truffleAssert.ErrorType.REVERT,
			"token is not for sale"
		);
	});
	
	it("artwork purchase in ETH, has not enough funds", async () => {
		const seller = accounts[1];
		const buyer = accounts[2];
		const buyerBalance = await web3.eth.getBalance(buyer);
		const tooHighPriceInETH = "1" + Web3Utils.fromWei(buyerBalance, "ether");
		
		const artwork = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		await utils.contracts.erc721StreakAPI.approve(artwork.tokenId, exchangeStreak.address, seller);
		await utils.contracts.exchangeStreakAPI.listToken(artwork.tokenId, tooHighPriceInETH, seller);
		
		try {
			await utils.contracts.exchangeStreakAPI.buyTokenForETH(artwork.tokenId, tooHighPriceInETH, buyer);
			assert.isTrue(false, "should throw 'not enough funds' error");
		} catch (e) {
			const notEnoughFunds = e.message.indexOf("Returned error: sender doesn't have enough funds to send tx") !== -1
			assert.isTrue(notEnoughFunds, "should throw 'not enough funds' error");
		}
	});
	
	it("artwork purchase in ERC20, success transaction, signing via private key", async () => {
		const seller = accounts[1];
		const buyer = accounts[2];
		
		const priceInETH = "0.001";
		const priceInERC20 = "10";
		await utils.contracts.erc20StreakAPI.transfer(buyer, priceInERC20, contractCreator);
		
		const artwork = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		await utils.contracts.erc721StreakAPI.approve(artwork.tokenId, exchangeStreak.address, seller);
		await utils.contracts.exchangeStreakAPI.listToken(artwork.tokenId, priceInETH, seller);
		
		await utils.contracts.erc20StreakAPI.approve(exchangeStreak.address, priceInERC20, buyer);
		
		const nonce = getNextNonce(buyer);
		const timestamp = Math.round(Date.now() / 1000);
		const { signature } = await utils.signature.createViaMnemonic(artwork.tokenId, priceInERC20, nonce, mnemonic, hdPath, timestamp)
		const receipt = await utils.contracts.exchangeStreakAPI.buyTokenForERC20(artwork.tokenId, priceInERC20, nonce, signature, buyer, timestamp);
		
		const sellerBalanceERC20After = await utils.contracts.erc20StreakAPI.balanceOf(seller);
		const buyerBalanceERC20After = await utils.contracts.erc20StreakAPI.balanceOf(buyer);
		
		assert.equal(priceInERC20, sellerBalanceERC20After, "invalid balance of the seller after the purchase");
		assert.equal("0", buyerBalanceERC20After, "invalid balance of the buyer after the purchase");
		
		const ownerOfArtwork = await utils.contracts.erc721StreakAPI.getArtworkOwner(artwork.tokenId, buyer);
		const actualPriceInETH = await utils.contracts.exchangeStreakAPI.getERC721Price(artwork.tokenId);
		
		assert.equal(ownerOfArtwork, buyer, "invalid art token owner");
		assert.equal("0", actualPriceInETH, "invalid art token price after the sale");
		
		truffleAssert.eventEmitted(receipt, 'TokenSold', (ev) => {
			const _tokenId = Web3Utils.hexToNumber(ev[0]);
			const _price = `${Web3Utils.hexToNumber(ev[1])}`;
			const _isSoldForERC20 = ev[2];
			return _tokenId === artwork.tokenId && _price === priceInERC20 && _isSoldForERC20;
		}, 'TokenSold event should be emitted with correct parameters');
		
		truffleAssert.eventEmitted(receipt, 'TokenOwned', (ev) => {
			const _tokenId = Web3Utils.hexToNumber(ev[0]);
			const _previousOwner = ev[1];
			const _newOwner = ev[2];
			return _tokenId === artwork.tokenId && _previousOwner === seller && _newOwner === buyer;
		}, 'TokenOwned event should be emitted with correct parameters');
		
		truffleAssert.eventEmitted(receipt, 'TokenPriceDeleted', (ev) => {
			const _tokenId = Web3Utils.hexToNumber(ev[0]);
			return _tokenId === artwork.tokenId;
		}, 'TokenDeleted event should be emitted with correct parameters');
		
		await utils.revertAllERC20(contractCreator, seller); // transfer back
		await utils.revertAllERC20(contractCreator, buyer); // transfer back
	})
	
	it("artwork purchase in ERC20, invalid nonce error", async () => {
		const seller = accounts[1];
		const buyer = accounts[2];
		
		const priceInETH = "0.001";
		const priceInERC20 = "10";
		await utils.contracts.erc20StreakAPI.transfer(buyer, priceInERC20, contractCreator); // set the initial amount of ERC20 for buyer
		
		const artwork = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		await utils.contracts.erc721StreakAPI.approve(artwork.tokenId, exchangeStreak.address, seller);
		await utils.contracts.exchangeStreakAPI.listToken(artwork.tokenId, priceInETH, seller);
		
		const nonce = getNextNonce(buyer);
		const timestamp = Math.round(Date.now() / 1000);
		const { signature } = await utils.signature.createViaMnemonic(artwork.tokenId, priceInERC20, nonce - nonceStep, mnemonic, hdPath, timestamp)
		await truffleAssert.fails(
			utils.contracts.exchangeStreakAPI.buyTokenForERC20(artwork.tokenId, priceInERC20, nonce - nonceStep, signature, buyer, timestamp),
			truffleAssert.ErrorType.REVERT,
			"invalid nonce"
		);
		
		await utils.revertAllERC20(contractCreator, seller); // transfer back
		await utils.revertAllERC20(contractCreator, buyer); // transfer back
	});
	
	it("artwork purchase in ERC20, valid signer, but invalid signed price", async () => {
		const seller = accounts[1];
		const buyer = accounts[2];
		
		const priceInETH = "0.001";
		const validSignedPriceInERC20 = "10";
		const invalidSignedPriceinERC20 = "5";
		
		await utils.contracts.erc20StreakAPI.transfer(buyer, validSignedPriceInERC20, contractCreator); // set the initial amount of ERC20 for buyer
		
		const artwork = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		await utils.contracts.erc721StreakAPI.approve(artwork.tokenId, exchangeStreak.address, seller);
		await utils.contracts.exchangeStreakAPI.listToken(artwork.tokenId, priceInETH, seller);
		
		const sellerBalanceERC20Before = await utils.contracts.erc20StreakAPI.balanceOf(seller);
		const buyerBalanceERC20Before = await utils.contracts.erc20StreakAPI.balanceOf(buyer);
		
		assert.equal("0", sellerBalanceERC20Before, "invalid balance of the seller after the purchase");
		assert.equal(validSignedPriceInERC20, buyerBalanceERC20Before, "invalid balance of the buyer after the purchase");
		
		await utils.contracts.erc20StreakAPI.approve(exchangeStreak.address, validSignedPriceInERC20, buyer);
		
		const nonce = getNextNonce(buyer);
		const timestamp = Math.round(Date.now() / 1000);
		const { signature } = await utils.signature.createViaMnemonic(artwork.tokenId, validSignedPriceInERC20, nonce, mnemonic, hdPath, timestamp)
		await truffleAssert.fails(
			utils.contracts.exchangeStreakAPI.buyTokenForERC20(artwork.tokenId, invalidSignedPriceinERC20, nonce, signature, buyer, timestamp),
			truffleAssert.ErrorType.REVERT, "invalid secret signer");
		
		await utils.revertAllERC20(contractCreator, seller); // transfer back
		await utils.revertAllERC20(contractCreator, buyer); // transfer back
	})
	
	it("artwork purchase in ERC20, invalid signer error (that actually is the same as invalid price)", async () => {
		const seller = accounts[1];
		const villain = accounts[2];
		const priceInETH = "0.001";
		const priceInERC20 = "10";
		await utils.contracts.erc20StreakAPI.transfer(villain, priceInERC20, contractCreator); // set the initial amount of ERC20 for villain
		
		const artwork = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		await utils.contracts.erc721StreakAPI.approve(artwork.tokenId, exchangeStreak.address, seller);
		await utils.contracts.exchangeStreakAPI.listToken(artwork.tokenId, priceInETH, seller);
		
		await utils.contracts.erc20StreakAPI.approve(exchangeStreak.address, priceInERC20, villain);
		
		const nonce = getNextNonce(villain);
		const timestamp = Math.round(Date.now() / 1000);
		const { signature } = await utils.signature.createViaWeb3Account(artwork.tokenId, priceInERC20, nonce, villain, timestamp);
		await truffleAssert.fails(
			utils.contracts.exchangeStreakAPI.buyTokenForERC20(artwork.tokenId, priceInERC20, nonce, signature, villain, timestamp),
			truffleAssert.ErrorType.REVERT,
			"invalid secret signer"
		);
		
		await utils.revertAllERC20(contractCreator, seller); // transfer back
		await utils.revertAllERC20(contractCreator, villain); // transfer back
	});
	
	it("artwork purchase in ERC20, token is not for sale", async () => {
		const seller = accounts[1];
		const buyer = accounts[2];
		const priceInERC20 = "10";
		await utils.contracts.erc20StreakAPI.transfer(buyer, priceInERC20, contractCreator); // set the initial amount of ERC20 for buyer
		
		const artwork = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		
		const nonce = getNextNonce(buyer);
		const timestamp = Math.round(Date.now() / 1000);
		const { signature } = await utils.signature.createViaMnemonic(artwork.tokenId, priceInERC20, nonce, mnemonic, hdPath, timestamp)
		await truffleAssert.fails(
			utils.contracts.exchangeStreakAPI.buyTokenForERC20(artwork.tokenId, priceInERC20, nonce, signature, buyer, timestamp),
			truffleAssert.ErrorType.REVERT,
			"token is not for sale"
		);
		
		await utils.revertAllERC20(contractCreator, seller); // transfer back
		await utils.revertAllERC20(contractCreator, buyer); // transfer back
	});
	
	it("artwork purchase in ERC20, has not enough funds", async () => {
		const seller = accounts[1];
		const buyer = accounts[2];
		const priceInETH = "0.001";
		const priceInERC20 = "1000";
		const balanceOfBuyer = "1";
		await utils.contracts.erc20StreakAPI.transfer(buyer, balanceOfBuyer, contractCreator); // set the initial amount of ERC20 for buyer
		
		const artwork = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		await utils.contracts.erc721StreakAPI.approve(artwork.tokenId, exchangeStreak.address, seller);
		await utils.contracts.exchangeStreakAPI.listToken(artwork.tokenId, priceInETH, seller);
		
		await utils.contracts.erc20StreakAPI.approve(exchangeStreak.address, priceInERC20, buyer);
		
		const nonce = getNextNonce(buyer);
		const timestamp = Math.round(Date.now() / 1000);
		const { signature } = await utils.signature.createViaMnemonic(artwork.tokenId, priceInERC20, nonce, mnemonic, hdPath, timestamp)
		try {
			await utils.contracts.exchangeStreakAPI.buyTokenForERC20(artwork.tokenId, priceInERC20, nonce, signature, buyer, timestamp);
			assert.isTrue(false, "should throw the error");
		} catch (e) {
			const notEnoughFunds = e.message.indexOf("transfer amount exceeds balance") !== -1
			
			await utils.revertAllERC20(contractCreator, seller); // transfer back
			await utils.revertAllERC20(contractCreator, buyer); // transfer back
			
			assert.isTrue(notEnoughFunds, "wrong error message");
		}
	});
	
	it("artwork purchase in ERC20, zero timestamp", async () => {
		const seller = accounts[1];
		const buyer = accounts[2];
		
		const priceInETH = "0.001";
		const priceInERC20 = "10";
		await utils.contracts.erc20StreakAPI.transfer(buyer, priceInERC20, contractCreator);
		
		const artwork = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		await utils.contracts.erc721StreakAPI.approve(artwork.tokenId, exchangeStreak.address, seller);
		await utils.contracts.exchangeStreakAPI.listToken(artwork.tokenId, priceInETH, seller);
		
		await utils.contracts.erc20StreakAPI.approve(exchangeStreak.address, priceInERC20, buyer);
		
		const previousSafeVolatilityPeriod = await utils.contracts.exchangeStreakAPI.getSafeVolatilityPeriod();
		await utils.contracts.exchangeStreakAPI.setSafeVolatilityPeriod(3600, contractCreator);
		await utils.contracts.exchangeStreakAPI.setSafeVolatilityPeriod(0, contractCreator);
		
		const nonce = getNextNonce(buyer);
		const timestamp = Math.round(Date.now() / 1000);
		const { signature } = await utils.signature.createViaMnemonic(artwork.tokenId, priceInERC20, nonce, mnemonic, hdPath, timestamp);
		
		await new Promise((resolve, reject) => setTimeout(() => resolve(true), 1500));
		await utils.mineOneBlock();
		
		const receipt = await utils.contracts.exchangeStreakAPI.buyTokenForERC20(artwork.tokenId, priceInERC20, nonce, signature, buyer, timestamp);
		
		const sellerBalanceERC20After = await utils.contracts.erc20StreakAPI.balanceOf(seller);
		const buyerBalanceERC20After = await utils.contracts.erc20StreakAPI.balanceOf(buyer);
		
		assert.equal(priceInERC20, sellerBalanceERC20After, "invalid balance of the seller after the purchase");
		assert.equal("0", buyerBalanceERC20After, "invalid balance of the buyer after the purchase");
		
		const ownerOfArtwork = await utils.contracts.erc721StreakAPI.getArtworkOwner(artwork.tokenId, buyer);
		const actualPriceInETH = await utils.contracts.exchangeStreakAPI.getERC721Price(artwork.tokenId);
		
		assert.equal(ownerOfArtwork, buyer, "invalid art token owner");
		assert.equal("0", actualPriceInETH, "invalid art token price after the sale");
		
		truffleAssert.eventEmitted(receipt, 'TokenSold', (ev) => {
			const _tokenId = Web3Utils.hexToNumber(ev[0]);
			const _price = `${Web3Utils.hexToNumber(ev[1])}`;
			const _isSoldForERC20 = ev[2];
			return _tokenId === artwork.tokenId && _price === priceInERC20 && _isSoldForERC20;
		}, 'TokenSold event should be emitted with correct parameters');
		
		truffleAssert.eventEmitted(receipt, 'TokenOwned', (ev) => {
			const _tokenId = Web3Utils.hexToNumber(ev[0]);
			const _previousOwner = ev[1];
			const _newOwner = ev[2];
			return _tokenId === artwork.tokenId && _previousOwner === seller && _newOwner === buyer;
		}, 'TokenOwned event should be emitted with correct parameters');
		
		truffleAssert.eventEmitted(receipt, 'TokenPriceDeleted', (ev) => {
			const _tokenId = Web3Utils.hexToNumber(ev[0]);
			return _tokenId === artwork.tokenId;
		}, 'TokenDeleted event should be emitted with correct parameters');
		
		await utils.contracts.exchangeStreakAPI.setSafeVolatilityPeriod(previousSafeVolatilityPeriod, contractCreator);
		await utils.revertAllERC20(contractCreator, seller); // transfer back
		await utils.revertAllERC20(contractCreator, buyer); // transfer back
	});
	
	it("artwork purchase in ERC20, incorrect timestamp", async () => {
		const seller = accounts[1];
		const buyer = accounts[2];
		
		const priceInETH = "0.001";
		const priceInERC20 = "10";
		await utils.contracts.erc20StreakAPI.transfer(buyer, priceInERC20, contractCreator);
		
		const artwork = await utils.contracts.erc721StreakAPI.mintERC721Token(seller, utils.generateUrl());
		await utils.contracts.erc721StreakAPI.approve(artwork.tokenId, exchangeStreak.address, seller);
		await utils.contracts.exchangeStreakAPI.listToken(artwork.tokenId, priceInETH, seller);
		
		await utils.contracts.erc20StreakAPI.approve(exchangeStreak.address, priceInERC20, buyer);
		
		const previousSafeVolatilityPeriod = await utils.contracts.exchangeStreakAPI.getSafeVolatilityPeriod();
		await utils.contracts.exchangeStreakAPI.setSafeVolatilityPeriod(1, contractCreator);
		
		const nonce = getNextNonce(buyer);
		const timestamp = Math.round(Date.now() / 1000);
		const { signature } = await utils.signature.createViaMnemonic(artwork.tokenId, priceInERC20, nonce, mnemonic, hdPath, timestamp);
		
		await new Promise((resolve, reject) => setTimeout(() => resolve(true), 2000))
		await utils.mineOneBlock();
		
		try {
			await utils.contracts.exchangeStreakAPI.buyTokenForERC20(artwork.tokenId, priceInERC20, nonce, signature, buyer, timestamp);
			assert.isTrue(false, "should throw the error");
		} catch (e) {
			const reverted = e.message.indexOf("safe volatility period exceeded") !== -1
			
			await utils.revertAllERC20(contractCreator, seller); // transfer back
			await utils.revertAllERC20(contractCreator, buyer); // transfer back
			
			assert.isTrue(reverted, "wrong error message");
		}
		
		await utils.contracts.exchangeStreakAPI.setSafeVolatilityPeriod(previousSafeVolatilityPeriod, contractCreator);
		await utils.revertAllERC20(contractCreator, seller); // transfer back
		await utils.revertAllERC20(contractCreator, buyer); // transfer back
	});
});
