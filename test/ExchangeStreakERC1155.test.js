const dotenv = require("dotenv");

const ExchangeStreak = artifacts.require("ExchangeStreak");
const ERC1155Streak = artifacts.require("ERC1155Streak");
const ERC20Streak = artifacts.require("ERC20Streak");

const assert = require("chai").assert;
const truffleAssert = require('truffle-assertions');
const Web3Utils = require('web3-utils');

const utils = require("./utils/utils");
const {stringToBytes32} = require("./utils/utils");

contract("ExchangeStreak", accounts => {
    const contractCreator = accounts[0];
    const { parsed } = dotenv.config();
    
    const nonceStep = 10;
    let signer = parsed.SIGNER_ADDRESS;
    let mnemonic = parsed.SIGNER_MNEMONICS;
    let hdPath = parsed.SIGNER_HD_PATH;
    let nonces;
    
    const getNextNonce = (userAddress) => {
        nonces[userAddress] += nonceStep;
        return nonces[userAddress];
    }
    
    let erc1155Streak;
    let exchangeStreak;
    let erc20Streak;
    
    before(async function() {
        // runs once before the first test in this block
        erc1155Streak = await ERC1155Streak.deployed();
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

    it("multiple artwork listing, success, set/get the price in ETH", async () => {
        const seller = accounts[1];
        const expectedPriceInETH = "0.01";
        const artworkObject = utils.generateArtwork1155();
        
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkObject);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
    
        const putArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkObject.quantity, expectedPriceInETH, seller);
        
        let offerId;
    
        await truffleAssert.eventEmitted(putArtworkToSaleResult, 'Token1155OfferListed', (ev) => {
            const _tokenId = Web3Utils.hexToNumber(ev[0]);
            offerId = ev[1];
            const _owner = ev[2];
            const _quantity = Web3Utils.hexToNumber(ev[3]);
            const _price = Web3Utils.fromWei(ev[4], "ether");
            return _tokenId === artwork.tokenId && _owner === seller && _quantity === artworkObject.quantity && _price === expectedPriceInETH;
        }, 'Token1155OfferListed event should be emitted with correct parameters');
    
        const actualPriceInETH = await utils.contracts.exchangeStreakAPI.getERC1155Price(offerId);
        const sellerBalance = await utils.contracts.erc1155StreakAPI.getBalanceOf(artwork.tokenId, seller);
    
        assert.equal(expectedPriceInETH, actualPriceInETH, `invalid price of the artwork`);
        assert.equal(artworkObject.quantity, sellerBalance, `invalid seller balance`);
    });
    
    it("multiple artwork listing, error, seller places for sale more than they have", async () => {
        const seller = accounts[1];
        const expectedPriceInETH = "0.01";
        const artworkData = utils.generateArtwork1155();
    
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
    
        await truffleAssert.reverts(
          utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkData.quantity + 1, expectedPriceInETH, seller),
          ''
        );
    });
    
    it("multiple artwork listing, error, seller places for sale partially and in the end more than they have", async () => {
        const seller = accounts[1];
        const expectedPriceInETH = "0.01";
        const artworkData = utils.generateArtwork1155();
        const quantityPart = Math.floor(artworkData.quantity / 2);
        
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
        
        await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, quantityPart, expectedPriceInETH, seller);
        await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, quantityPart, expectedPriceInETH, seller);
        
        await truffleAssert.reverts(
          utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, quantityPart, expectedPriceInETH, seller),
          ''
        );
    });

    it("multiple artwork unlist from sale, success", async () => {
        const seller = accounts[1];
        const expectedPriceInETH = "0.01";
        const artworkData = utils.generateArtwork1155();
        const quantityPart = Math.floor(artworkData.quantity / 2);
    
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
    
        const putArtworkToSaleResult1 = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, quantityPart, expectedPriceInETH, seller);
    
        let offerId1;
    
        await truffleAssert.eventEmitted(putArtworkToSaleResult1, 'Token1155OfferListed', (ev) => {
            offerId1 = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');
        
        const tokensListed1 = await utils.contracts.exchangeStreakAPI.getTokensListed(seller, artwork.tokenId);
        assert.equal(tokensListed1, quantityPart)
    
        const putArtworkToSaleResult2 = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, quantityPart, expectedPriceInETH, seller);
    
        let offerId2;
    
        await truffleAssert.eventEmitted(putArtworkToSaleResult2, 'Token1155OfferListed', (ev) => {
            offerId2 = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');
    
        const tokensListed2 = await utils.contracts.exchangeStreakAPI.getTokensListed(seller, artwork.tokenId);
        assert.equal(tokensListed2, 2 * quantityPart)
    
        const deleteArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.removeListToken1155(offerId1, seller);

        await truffleAssert.eventEmitted(deleteArtworkToSaleResult, 'Token1155OfferDeleted', (ev) => {
            const _tokenId = Web3Utils.hexToNumber(ev[0]);
            const _offerId = Web3Utils.hexToNumber(ev[1]);

            return _tokenId === artwork.tokenId && _offerId === offerId1;
        }, 'TokenDeleted event should be emitted with correct parameters');
    
        const tokensListed3 = await utils.contracts.exchangeStreakAPI.getTokensListed(seller, artwork.tokenId);
        assert.equal(tokensListed3, quantityPart)
    });
    
    it("multiple artwork unlist from sale after multiple lists, success", async () => {
        const seller = accounts[1];
        const expectedPriceInETH = "0.01";
        const artworkData = utils.generateArtwork1155();
        
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
        
        const putArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkData.quantity, expectedPriceInETH, seller);
        
        let offerId;
        
        await truffleAssert.eventEmitted(putArtworkToSaleResult, 'Token1155OfferListed', (ev) => {
            offerId = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');
        
        const deleteArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.removeListToken1155(offerId, seller);
        
        await truffleAssert.eventEmitted(deleteArtworkToSaleResult, 'Token1155OfferDeleted', (ev) => {
            const _tokenId = Web3Utils.hexToNumber(ev[0]);
            const _offerId = Web3Utils.hexToNumber(ev[1]);
            
            return _tokenId === artwork.tokenId && _offerId === offerId;
        }, 'TokenDeleted event should be emitted with correct parameters');
    });
    
    it("multiple artwork unlist from sale, error, can't buy not listed token", async () => {
        const seller = accounts[1];
        const buyer = accounts[2];
        const priceInETH = "0.01";
        const artworkData = utils.generateArtwork1155();
        const totalPriceInETH = `${Number(priceInETH) * artworkData.quantity}`;
        
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
        
        const putArtworkToSaleResult1 = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkData.quantity, priceInETH, seller);
        
        let offerId;
        
        await truffleAssert.eventEmitted(putArtworkToSaleResult1, 'Token1155OfferListed', (ev) => {
            offerId = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');
        
        const deleteArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.removeListToken1155(offerId, seller);
        
        await truffleAssert.eventEmitted(deleteArtworkToSaleResult, 'Token1155OfferDeleted', (ev) => {
            return true;
        }, '');
        
        await truffleAssert.reverts(
            utils.contracts.exchangeStreakAPI.buyToken1155ForETH(offerId, artworkData.quantity, totalPriceInETH, buyer)
        )
    });

    it("multiple artwork purchase in ETH, success", async () => {
        const seller = accounts[1];
        const buyer = accounts[2];
        const priceInETH = "0.001";
        const artworkData = utils.generateArtwork1155();
        const totalPriceInETH = `${Number(priceInETH) * artworkData.quantity}`;
    
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
    
        const putArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkData.quantity, priceInETH, seller);
    
        let offerId;
    
        await truffleAssert.eventEmitted(putArtworkToSaleResult, 'Token1155OfferListed', (ev) => {
            offerId = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');

        const sellerBalanceBefore = await web3.eth.getBalance(seller);
        const buyerBalanceBefore = await web3.eth.getBalance(buyer);

        const receipt = await utils.contracts.exchangeStreakAPI.buyToken1155ForETH(offerId, artworkData.quantity, totalPriceInETH, buyer);
        await truffleAssert.eventEmitted(receipt, 'Token1155Sold', (ev) => {
            const _tokenId = Web3Utils.hexToNumber(ev[0]);
            const _offerId = Web3Utils.hexToNumber(ev[1]);
            const _quantity = Web3Utils.hexToNumber(ev[2]);
            const _price = Web3Utils.fromWei(ev[3], "ether");
            const _isERC20 = ev[4];
        
            return _tokenId === artwork.tokenId
              && _offerId === offerId
              && _quantity === artworkData.quantity
              && _price === priceInETH
              && _isERC20 === false;
        }, 'TokenSold event should be emitted with correct parameters');
        await truffleAssert.eventEmitted(receipt, 'Token1155Owned', (ev) => {
            const _tokenId = Web3Utils.hexToNumber(ev[0]);
            const _previousOwner = ev[1]
            const _currentOwner = ev[2]
            const _quantity = Web3Utils.hexToNumber(ev[3]);
        
            return _tokenId === artwork.tokenId
              && _previousOwner === seller
              && _currentOwner === buyer
              && _quantity === artworkData.quantity;
        }, 'TokenOwned event should be emitted with correct parameters');
        await truffleAssert.eventEmitted(receipt, 'Token1155OfferDeleted', (ev) => {
            const _tokenId = Web3Utils.hexToNumber(ev[0]);
            const _offerId = Web3Utils.hexToNumber(ev[1]);
        
            return _tokenId === artwork.tokenId
              && _offerId === offerId;
        }, 'TokenDeleted event should be emitted with correct parameters');
    
        const priceInWei = Web3Utils.toBN(Web3Utils.toWei(totalPriceInETH, "ether"))
        const txCost = await utils.getTxCostInWei(receipt)

        const expectedSellerBalance = Web3Utils.toBN(sellerBalanceBefore).add(priceInWei).toString()
        const expectedBuyerBalance = Web3Utils.toBN(buyerBalanceBefore).sub(priceInWei).sub(txCost).toString()

        const actualSellerBalance = await web3.eth.getBalance(seller)
        const actualBuyerBalance = await web3.eth.getBalance(buyer)

        assert.equal(expectedSellerBalance, actualSellerBalance, "invalid balance of the seller");
        assert.equal(expectedBuyerBalance, actualBuyerBalance, "invalid balance of the buyer");
    
        const actualPriceInETH = await utils.contracts.exchangeStreakAPI.getERC1155Price(offerId);
        assert.equal("0", actualPriceInETH, `invalid art token price after the sale`);

        const actualBuyerTokenBalance = await utils.contracts.erc1155StreakAPI.getBalanceOf(artwork.tokenId, buyer);
        assert.equal(artworkData.quantity, actualBuyerTokenBalance);
    });

    it("multiple artwork purchase in ETH, success, not all from listed was bought", async () => {
        const seller = accounts[1];
        const buyer = accounts[2];
        const priceInETH = "0.001";
        const artworkData = utils.generateArtwork1155();
        const quantity = artworkData.quantity - 1;
        const totalPriceInETH = `${Number(priceInETH) * quantity}`;
    
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
    
        const putArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkData.quantity, priceInETH, seller);
    
        let offerId;
    
        await truffleAssert.eventEmitted(putArtworkToSaleResult, 'Token1155OfferListed', (ev) => {
            offerId = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');
    
        const sellerBalanceBefore = await web3.eth.getBalance(seller);
        const buyerBalanceBefore = await web3.eth.getBalance(buyer);
    
        const receipt = await utils.contracts.exchangeStreakAPI.buyToken1155ForETH(offerId, quantity, totalPriceInETH, buyer);
        await truffleAssert.eventEmitted(receipt, 'Token1155Sold', (ev) => {
            const _tokenId = Web3Utils.hexToNumber(ev[0]);
            const _offerId = Web3Utils.hexToNumber(ev[1]);
            const _quantity = Web3Utils.hexToNumber(ev[2]);
            const _price = Web3Utils.fromWei(ev[3], "ether");
            const _isERC20 = ev[4];
        
            return _tokenId === artwork.tokenId
              && _offerId === offerId
              && _quantity === quantity
              && _price === priceInETH
              && _isERC20 === false;
        }, 'TokenSold event should be emitted with correct parameters');
        await truffleAssert.eventEmitted(receipt, 'Token1155Owned', (ev) => {
            const _tokenId = Web3Utils.hexToNumber(ev[0]);
            const _previousOwner = ev[1]
            const _currentOwner = ev[2]
            const _quantity = Web3Utils.hexToNumber(ev[3]);
        
            return _tokenId === artwork.tokenId
              && _previousOwner === seller
              && _currentOwner === buyer
              && _quantity === quantity;
        }, 'TokenOwned event should be emitted with correct parameters');
    
        const priceInWei = Web3Utils.toBN(Web3Utils.toWei(totalPriceInETH, "ether"))
        const txCost = await utils.getTxCostInWei(receipt)
    
        const expectedSellerBalance = Web3Utils.toBN(sellerBalanceBefore).add(priceInWei).toString()
        const expectedBuyerBalance = Web3Utils.toBN(buyerBalanceBefore).sub(priceInWei).sub(txCost).toString()
    
        const actualSellerBalance = await web3.eth.getBalance(seller)
        const actualBuyerBalance = await web3.eth.getBalance(buyer)
    
        assert.equal(expectedSellerBalance, actualSellerBalance, "invalid balance of the seller");
        assert.equal(expectedBuyerBalance, actualBuyerBalance, "invalid balance of the buyer");
        
        const actualBuyerTokenBalance = await utils.contracts.erc1155StreakAPI.getBalanceOf(artwork.tokenId, buyer);
        assert.equal(quantity, actualBuyerTokenBalance);
    
        const actualSellerTokenBalance = await utils.contracts.erc1155StreakAPI.getBalanceOf(artwork.tokenId, seller);
        assert.equal(1, actualSellerTokenBalance);
        
        const offerQuantity = await utils.contracts.exchangeStreakAPI.getERC1155OfferQuantity(offerId);
        assert.equal(1, offerQuantity);
    
        const buyer2 = accounts[3];
        const receipt2 = await utils.contracts.exchangeStreakAPI.buyToken1155ForETH(offerId, 1, priceInETH, buyer2);
        await truffleAssert.eventEmitted(receipt2, 'Token1155OfferDeleted', (ev) => {
            const _tokenId = Web3Utils.hexToNumber(ev[0]);
            const _offerId = Web3Utils.hexToNumber(ev[1]);
        
            return _tokenId === artwork.tokenId
              && _offerId === offerId;
        }, 'TokenDeleted event should be emitted with correct parameters');
        const actualPriceInETH = await utils.contracts.exchangeStreakAPI.getERC1155Price(offerId);
        assert.equal("0", actualPriceInETH, `invalid art token price after the sale`);
    });

    it("multiple artwork purchase in ETH, error, invalid price", async () => {
        const seller = accounts[1];
        const buyer = accounts[2];
        const priceInETH = "0.001";
        const artworkData = utils.generateArtwork1155();
        const wrongTotalPriceInETH = `${Number(priceInETH) * (artworkData.quantity - 1)}`;
    
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
    
        const putArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkData.quantity, priceInETH, seller);
    
        let offerId;
    
        await truffleAssert.eventEmitted(putArtworkToSaleResult, 'Token1155OfferListed', (ev) => {
            offerId = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');
 
        await truffleAssert.reverts(utils.contracts.exchangeStreakAPI.buyToken1155ForETH(offerId, artworkData.quantity, wrongTotalPriceInETH, buyer), "");
    });

    it("multiple artwork purchase in ETH, error, buyer has not enough funds", async () => {
        const seller = accounts[1];
        const buyer = accounts[2];
        const priceInETH = Web3Utils.fromWei(`${await web3.eth.getBalance(buyer)}`, 'ether');
        const artworkData = utils.generateArtwork1155();
        const totalPriceInETH = `${Number(priceInETH) * artworkData.quantity}`;
    
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
    
        const putArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkData.quantity, priceInETH, seller);
    
        let offerId;
    
        await truffleAssert.eventEmitted(putArtworkToSaleResult, 'Token1155OfferListed', (ev) => {
            offerId = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');
    
        await truffleAssert.fails(utils.contracts.exchangeStreakAPI.buyToken1155ForETH(offerId, artworkData.quantity, totalPriceInETH, buyer));
    });
    
    it("multiple artwork purchase in ETH, error, buyer purchases more tokens than were listed", async () => {
        const seller = accounts[1];
        const buyer = accounts[2];
        const priceInETH = "0.001";
        const artworkData = utils.generateArtwork1155();
        const quantityPart1 = artworkData.quantity - 1;
        const totalPriceInETH1 = `${Number(priceInETH) * quantityPart1}`;
        const quantityPart2 = 2;
        const totalPriceInETH2 = `${Number(priceInETH) * quantityPart2}`;
    
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
        
        const putArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkData.quantity, priceInETH, seller);
        
        let offerId;
        
        await truffleAssert.eventEmitted(putArtworkToSaleResult, 'Token1155OfferListed', (ev) => {
            offerId = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');
        
        const receipt = await utils.contracts.exchangeStreakAPI.buyToken1155ForETH(offerId, quantityPart1, totalPriceInETH1, buyer);
        await truffleAssert.eventEmitted(receipt, 'Token1155Sold', (ev) => {
            return true;
        }, '');
        
        await truffleAssert.reverts(
          utils.contracts.exchangeStreakAPI.buyToken1155ForETH(offerId, quantityPart2, totalPriceInETH2, buyer)
        );
    });
    
    it("multiple artwork purchase in ERC20, success, signing via private key", async () => {
        const seller = accounts[1];
        const buyer = accounts[2];
        
        const priceInETH = "0.001";
        const priceInERC20 = "10";
        const artworkData = utils.generateArtwork1155();
        const totalPriceInERC20 = `${Number(priceInERC20) * artworkData.quantity}`;

        await utils.contracts.erc20StreakAPI.transfer(buyer, totalPriceInERC20, contractCreator);
    
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
        
        const putArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkData.quantity, priceInETH, seller);
    
        let offerId;
    
        await truffleAssert.eventEmitted(putArtworkToSaleResult, 'Token1155OfferListed', (ev) => {
            offerId = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');
    
        const sellerBalanceERC20Before = await utils.contracts.erc20StreakAPI.balanceOf(seller);
        const buyerBalanceERC20Before = await utils.contracts.erc20StreakAPI.balanceOf(buyer);
        
        await utils.contracts.erc20StreakAPI.approve(exchangeStreak.address, totalPriceInERC20, buyer);
        
        const nonce = getNextNonce(buyer);
        const timestamp = Math.round(Date.now() / 1000);
        const { signature } = await utils.signature.createViaMnemonic1155(offerId, artworkData.quantity, priceInERC20, nonce, mnemonic, hdPath, timestamp);
        const receipt = await utils.contracts.exchangeStreakAPI.buyToken1155ForERC20(offerId, artworkData.quantity, priceInERC20, nonce, signature, buyer, timestamp);
    
        truffleAssert.eventEmitted(receipt, 'Token1155Sold', (ev) => {
            const _tokenId = Web3Utils.hexToNumber(ev[0]);
            const _offerId = Web3Utils.hexToNumber(ev[1]);
            const _quantity = Web3Utils.hexToNumber(ev[2]);
            const _price = `${Web3Utils.hexToNumber(ev[3])}`;
            const _isForERC20 = ev[4];
            return _tokenId === artwork.tokenId && _offerId === offerId && _quantity === artworkData.quantity && _price === priceInERC20 && _isForERC20 === true;
        }, 'Token1155Sold event should be emitted with correct parameters');
        truffleAssert.eventEmitted(receipt, 'Token1155Owned', (ev) => {
            const _tokenId = Web3Utils.hexToNumber(ev[0]);
            const _previousOwner = ev[1];
            const _newOwner = ev[2];
            const _quantity = Web3Utils.hexToNumber(ev[3]);
            return _tokenId === artwork.tokenId
              && _previousOwner === seller
              && _newOwner === buyer
              && _quantity === artworkData.quantity;
        }, 'Token1155Owned event should be emitted with correct parameters');
        truffleAssert.eventEmitted(receipt, 'Token1155OfferDeleted', (ev) => {
            const _tokenId = Web3Utils.hexToNumber(ev[0]);
            const _offerId = Web3Utils.hexToNumber(ev[1]);
            return _tokenId === artwork.tokenId && _offerId === offerId;
        }, 'Token1155OfferDeleted event should be emitted with correct parameters');
    
        const sellerBalanceERC20After = await utils.contracts.erc20StreakAPI.balanceOf(seller);
        const buyerBalanceERC20After = await utils.contracts.erc20StreakAPI.balanceOf(buyer);
        
        assert.equal(totalPriceInERC20, Web3Utils.toBN(sellerBalanceERC20After).sub(Web3Utils.toBN(sellerBalanceERC20Before)).toString(), "invalid balance of the seller after the purchase");
        assert.equal(totalPriceInERC20, Web3Utils.toBN(buyerBalanceERC20Before).sub(Web3Utils.toBN(buyerBalanceERC20After)).toString(), "invalid balance of the buyer after the purchase");
        
        const buyerTokenBalance = await utils.contracts.erc1155StreakAPI.getBalanceOf(artwork.tokenId, buyer);
        const actualPriceInETH = await utils.contracts.exchangeStreakAPI.getERC1155Price(offerId);
        const tokensListed = await utils.contracts.exchangeStreakAPI.getTokensListed(seller, artwork.tokenId);
    
        assert.equal(buyerTokenBalance, artworkData.quantity, "invalid buyer token balance");
        assert.equal("0", actualPriceInETH, "invalid art token price after the sale");
        assert.equal("0", tokensListed, "invalid number of listed tokens");
        
        await utils.revertAllERC20(contractCreator, seller);
        await utils.revertAllERC20(contractCreator, buyer);
    });
    
    it("multiple artwork purchase in ERC20, error, invalid nonce error", async () => {
        const seller = accounts[1];
        const buyer = accounts[2];
    
        const priceInETH = "0.001";
        const priceInERC20 = "10";
        const artworkData = utils.generateArtwork1155();
        const totalPriceInERC20 = `${Number(priceInERC20) * artworkData.quantity}`;
    
        await utils.contracts.erc20StreakAPI.transfer(buyer, totalPriceInERC20, contractCreator);
    
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
    
        const putArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkData.quantity, priceInETH, seller);
    
        let offerId;
    
        await truffleAssert.eventEmitted(putArtworkToSaleResult, 'Token1155OfferListed', (ev) => {
            offerId = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');
    
        await utils.contracts.erc20StreakAPI.approve(exchangeStreak.address, totalPriceInERC20, buyer);
    
        const nonce = getNextNonce(buyer);
        const timestamp = Math.round(Date.now() / 1000);
        const { signature } = await utils.signature.createViaMnemonic1155(offerId, artworkData.quantity, priceInERC20, nonce - nonceStep, mnemonic, hdPath, timestamp);
        truffleAssert.fails(
          utils.contracts.exchangeStreakAPI.buyToken1155ForERC20(offerId, artworkData.quantity, priceInERC20, nonce - nonceStep, signature, buyer, timestamp),
          truffleAssert.ErrorType.REVERT,
          "invalid nonce"
        );
        
        await utils.revertAllERC20(contractCreator, seller); // transfer back
        await utils.revertAllERC20(contractCreator, buyer); // transfer back
    });
    
    it("multiple artwork purchase in ERC20, error, invalid signer error", async () => {
        const seller = accounts[1];
        const buyer = accounts[2];
    
        const priceInETH = "0.001";
        const priceInERC20 = "10";
        const artworkData = utils.generateArtwork1155();
        const totalPriceInERC20 = `${Number(priceInERC20) * artworkData.quantity}`;
        
        const wrongHdPath = "m/44'/60'/0'/0/0"
    
        await utils.contracts.erc20StreakAPI.transfer(buyer, totalPriceInERC20, contractCreator);
    
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
    
        const putArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkData.quantity, priceInETH, seller);
    
        let offerId;
    
        await truffleAssert.eventEmitted(putArtworkToSaleResult, 'Token1155OfferListed', (ev) => {
            offerId = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');
    
        await utils.contracts.erc20StreakAPI.approve(exchangeStreak.address, totalPriceInERC20, buyer);
    
        const nonce = getNextNonce(buyer);
        const timestamp = Math.round(Date.now() / 1000);
        const { signature } = await utils.signature.createViaMnemonic1155(offerId, artworkData.quantity, priceInERC20, nonce, mnemonic, wrongHdPath, timestamp);
        truffleAssert.reverts(
          utils.contracts.exchangeStreakAPI.buyToken1155ForERC20(offerId, artworkData.quantity, priceInERC20, nonce, signature, buyer, timestamp)
        );
    
        await utils.revertAllERC20(contractCreator, seller); // transfer back
        await utils.revertAllERC20(contractCreator, buyer); // transfer back
    });
    
    it("multiple artwork purchase in ERC20, error, valid signer, but invalid signed price", async () => {
        const seller = accounts[1];
        const buyer = accounts[2];
    
        const priceInETH = "0.001";
        const priceInERC20 = "10";
        const artworkData = utils.generateArtwork1155();
        const totalPriceInERC20 = `${Number(priceInERC20) * artworkData.quantity}`;
    
        await utils.contracts.erc20StreakAPI.transfer(buyer, totalPriceInERC20, contractCreator);
    
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
    
        const putArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkData.quantity, priceInETH, seller);
    
        let offerId;
    
        await truffleAssert.eventEmitted(putArtworkToSaleResult, 'Token1155OfferListed', (ev) => {
            offerId = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');
    
        await utils.contracts.erc20StreakAPI.approve(exchangeStreak.address, totalPriceInERC20, buyer);
    
        const nonce = getNextNonce(buyer);
        const timestamp = Math.round(Date.now() / 1000);
        const { signature } = await utils.signature.createViaMnemonic1155(offerId, artworkData.quantity, priceInERC20, nonce, mnemonic, hdPath, timestamp);
        truffleAssert.reverts(
          utils.contracts.exchangeStreakAPI.buyToken1155ForERC20(offerId, artworkData.quantity, `${priceInERC20 - 1}`, nonce, signature, buyer, timestamp)
        );
    
        await utils.revertAllERC20(contractCreator, seller); // transfer back
        await utils.revertAllERC20(contractCreator, buyer); // transfer back
    })

    it("multiple artwork purchase in ERC20, error, has not enough funds", async () => {
        const seller = accounts[1];
        const buyer = accounts[2];
    
        const buyerBalanceERC20 = await utils.contracts.erc20StreakAPI.balanceOf(buyer);
    
        const priceInETH = "0.001";
        const priceInERC20 = `${buyerBalanceERC20 + 10}`;
        const artworkData = utils.generateArtwork1155();
        const totalPriceInERC20 = `${Number(priceInERC20) * artworkData.quantity}`;
        
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
    
        const putArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkData.quantity, priceInETH, seller);
    
        let offerId;
    
        await truffleAssert.eventEmitted(putArtworkToSaleResult, 'Token1155OfferListed', (ev) => {
            offerId = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');
    
        await utils.contracts.erc20StreakAPI.approve(exchangeStreak.address, totalPriceInERC20, buyer);
    
        const nonce = getNextNonce(buyer);
        const timestamp = Math.round(Date.now() / 1000);
        const { signature } = await utils.signature.createViaMnemonic1155(offerId, artworkData.quantity, priceInERC20, nonce, mnemonic, hdPath, timestamp);
        truffleAssert.reverts(
          utils.contracts.exchangeStreakAPI.buyToken1155ForERC20(offerId, artworkData.quantity, priceInERC20, nonce, signature, buyer, timestamp)
        );
    });
    
    it("multiple artwork purchase in ERC20, zero timestamp", async () => {
        const seller = accounts[1];
        const buyer = accounts[2];
    
        const priceInETH = "0.001";
        const priceInERC20 = "10";
        const artworkData = utils.generateArtwork1155();
        const totalPriceInERC20 = `${Number(priceInERC20) * artworkData.quantity}`;
    
        await utils.contracts.erc20StreakAPI.transfer(buyer, totalPriceInERC20, contractCreator);
    
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
    
        const putArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkData.quantity, priceInETH, seller);
    
        let offerId;
    
        await truffleAssert.eventEmitted(putArtworkToSaleResult, 'Token1155OfferListed', (ev) => {
            offerId = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');
    
        const sellerBalanceERC20Before = await utils.contracts.erc20StreakAPI.balanceOf(seller);
        const buyerBalanceERC20Before = await utils.contracts.erc20StreakAPI.balanceOf(buyer);
    
        await utils.contracts.erc20StreakAPI.approve(exchangeStreak.address, totalPriceInERC20, buyer);
    
        const previousSafeVolatilityPeriod = await utils.contracts.exchangeStreakAPI.getSafeVolatilityPeriod();
        await utils.contracts.exchangeStreakAPI.setSafeVolatilityPeriod(3600, contractCreator);
        await utils.contracts.exchangeStreakAPI.setSafeVolatilityPeriod(0, contractCreator);
    
        const nonce = getNextNonce(buyer);
        const timestamp = Math.round(Date.now() / 1000);
        const { signature } = await utils.signature.createViaMnemonic1155(offerId, artworkData.quantity, priceInERC20, nonce, mnemonic, hdPath, timestamp);
    
        await new Promise((resolve, reject) => setTimeout(() => resolve(true), 1500));
        await utils.mineOneBlock();
    
        const receipt = await utils.contracts.exchangeStreakAPI.buyToken1155ForERC20(offerId, artworkData.quantity, priceInERC20, nonce, signature, buyer, timestamp);
    
        truffleAssert.eventEmitted(receipt, 'Token1155Sold', (ev) => {
            const _tokenId = Web3Utils.hexToNumber(ev[0]);
            const _offerId = Web3Utils.hexToNumber(ev[1]);
            const _quantity = Web3Utils.hexToNumber(ev[2]);
            const _price = `${Web3Utils.hexToNumber(ev[3])}`;
            const _isForERC20 = ev[4];
            return _tokenId === artwork.tokenId && _offerId === offerId && _quantity === artworkData.quantity && _price === priceInERC20 && _isForERC20 === true;
        }, 'Token1155Sold event should be emitted with correct parameters');
        truffleAssert.eventEmitted(receipt, 'Token1155Owned', (ev) => {
            const _tokenId = Web3Utils.hexToNumber(ev[0]);
            const _previousOwner = ev[1];
            const _newOwner = ev[2];
            const _quantity = Web3Utils.hexToNumber(ev[3]);
            return _tokenId === artwork.tokenId
              && _previousOwner === seller
              && _newOwner === buyer
              && _quantity === artworkData.quantity;
        }, 'Token1155Owned event should be emitted with correct parameters');
        truffleAssert.eventEmitted(receipt, 'Token1155OfferDeleted', (ev) => {
            const _tokenId = Web3Utils.hexToNumber(ev[0]);
            const _offerId = Web3Utils.hexToNumber(ev[1]);
            return _tokenId === artwork.tokenId && _offerId === offerId;
        }, 'Token1155OfferDeleted event should be emitted with correct parameters');
    
        const sellerBalanceERC20After = await utils.contracts.erc20StreakAPI.balanceOf(seller);
        const buyerBalanceERC20After = await utils.contracts.erc20StreakAPI.balanceOf(buyer);
    
        assert.equal(totalPriceInERC20, Web3Utils.toBN(sellerBalanceERC20After).sub(Web3Utils.toBN(sellerBalanceERC20Before)).toString(), "invalid balance of the seller after the purchase");
        assert.equal(totalPriceInERC20, Web3Utils.toBN(buyerBalanceERC20Before).sub(Web3Utils.toBN(buyerBalanceERC20After)).toString(), "invalid balance of the buyer after the purchase");
    
        const buyerTokenBalance = await utils.contracts.erc1155StreakAPI.getBalanceOf(artwork.tokenId, buyer);
    
        assert.equal(buyerTokenBalance, artworkData.quantity, "invalid buyer token balance");
    
        await utils.contracts.exchangeStreakAPI.setSafeVolatilityPeriod(previousSafeVolatilityPeriod, contractCreator);
        await utils.revertAllERC20(contractCreator, seller);
        await utils.revertAllERC20(contractCreator, buyer);
    });

    it("multiple artwork purchase in ERC20, incorrect timestamp", async () => {
        const seller = accounts[1];
        const buyer = accounts[2];
    
        const priceInETH = "0.001";
        const priceInERC20 = "1000";
        const artworkData = utils.generateArtwork1155();
        const totalPriceInERC20 = `${Number(priceInERC20) * artworkData.quantity}`;

        await utils.contracts.erc20StreakAPI.transfer(buyer, totalPriceInERC20, contractCreator); // set the initial amount of ERC20 for buyer
    
        const artwork = await utils.contracts.erc1155StreakAPI.createArtworkAsERC1155Token(seller, artworkData);
        await utils.contracts.erc1155StreakAPI.setApprovalForAll(exchangeStreak.address, seller);
    
        const putArtworkToSaleResult = await utils.contracts.exchangeStreakAPI.listToken1155(artwork.tokenId, artworkData.quantity, priceInETH, seller);
    
        let offerId;
    
        await truffleAssert.eventEmitted(putArtworkToSaleResult, 'Token1155OfferListed', (ev) => {
            offerId = Web3Utils.hexToNumber(ev[1]);
            return true;
        }, '');
    
        await utils.contracts.erc20StreakAPI.approve(exchangeStreak.address, totalPriceInERC20, buyer);
    
        const previousSafeVolatilityPeriod = await utils.contracts.exchangeStreakAPI.getSafeVolatilityPeriod();
        await utils.contracts.exchangeStreakAPI.setSafeVolatilityPeriod(1, contractCreator);
    
        const nonce = getNextNonce(buyer);
        const timestamp = Math.round(Date.now() / 1000);
        const { signature } = await utils.signature.createViaMnemonic1155(offerId, artworkData.quantity, priceInERC20, nonce, mnemonic, hdPath, timestamp);
        
        await new Promise((resolve, reject) => setTimeout(() => resolve(true), 2000));
        await utils.mineOneBlock();
    
        try {
            await utils.contracts.exchangeStreakAPI.buyToken1155ForERC20(offerId, artworkData.quantity, priceInERC20, nonce, signature, buyer, timestamp);
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
