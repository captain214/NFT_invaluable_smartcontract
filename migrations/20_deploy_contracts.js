const { BN } = require('@openzeppelin/test-helpers');
const { ethers } = require("hardhat");

const
	ERC20Streak = artifacts.require("ERC20Streak"),
	ERC721Streak = artifacts.require("ERC721Streak"),
	ERC1155Streak = artifacts.require("ERC1155Streak"),
	ExchangeStreak = artifacts.require("ExchangeStreak"),
	AuctionFactoryStreak = artifacts.require("AuctionFactoryStreak");

module.exports = async () => {
	
	// ERC20
	let streak = "VIRTUAL";
	const initialSupply = new BN(200).mul(new BN(10).pow(new BN(27)));
	const [owner, minter, buyer] = await ethers.getSigners();
	const erc20Streak = await ERC20Streak.new(streak, streak, initialSupply, owner.address);
	
	// FIXME change to real uri if it needed
	const testContractUri = "ipfs://QmbqkJtqvkustaWQ9uUQbEJQuSRMeRm52QhUHwdQ8wkfyD";
	
	// ERC721
	const erc721Streak = await ERC721Streak.new("Streak 721 NFT", "SNFT", testContractUri);
	let minterRole = await erc721Streak.MINTER_ROLE();
	await erc721Streak.grantRole(minterRole, minter.address);
	
	// ERC1155
	const erc1155Streak = await ERC1155Streak.new("Streak 1155 NFT", testContractUri);
	
	const exchangeStreak = await ExchangeStreak.new(buyer.address, erc721Streak.address, erc1155Streak.address, erc20Streak.address);
	
	// AuctionStreak
	
	const auctionFactoryStreak = await AuctionFactoryStreak.new(erc20Streak.address, erc721Streak.address, erc1155Streak.address);
	
	ERC20Streak.setAsDeployed(erc20Streak);
	ERC721Streak.setAsDeployed(erc721Streak);
	ERC1155Streak.setAsDeployed(erc1155Streak);
	ExchangeStreak.setAsDeployed(exchangeStreak);
	AuctionFactoryStreak.setAsDeployed(auctionFactoryStreak);
	
	console.log("*************************************************************");
	console.log("* ERC20Streak:", erc20Streak.address);
	console.log("* ERC721Streak:", erc721Streak.address);
	console.log("* ERC1155Streak:", erc1155Streak.address);
	console.log("* ExchangeStreak:", exchangeStreak.address);
	console.log("* AuctionFactoryStreak:", auctionFactoryStreak.address);
	console.log("*************************************************************");
	
};
