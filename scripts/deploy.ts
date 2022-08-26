import hre  from "hardhat";

const pause = (time: number) => new Promise(resolve => setTimeout(resolve, time));

const verifiableNetwork = ["mainnet", "rinkeby", "goerli", "kovan", "matic"];

async function main() {
  let streak = "VIRTUAL";
  const initialSupply = ((await hre.ethers.BigNumber.from(10)).pow(27)).mul(200)
  const [owner] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", owner.address);

  // ERC20
  const ERC20Streak = await hre.ethers.getContractFactory("ERC20Streak");
  const erc20Streak = await ERC20Streak.deploy(streak, streak, initialSupply, owner.address);

  // FIXME change to real uri if it needed
  const testContractUri = "ipfs://QmbqkJtqvkustaWQ9uUQbEJQuSRMeRm52QhUHwdQ8wkfyD";

  // ERC721
  const ERC721Streak = await hre.ethers.getContractFactory("ERC721Streak");
  const erc721Streak = await ERC721Streak.deploy("Streak 721 NFT", "SNFT", testContractUri);
  let minterRole = await erc721Streak.MINTER_ROLE();
  await erc721Streak.grantRole(minterRole, owner.address);

  // ERC1155
  const ERC1155Streak = await hre.ethers.getContractFactory("ERC1155Streak");
  const erc1155Streak = await ERC1155Streak.deploy("Streak 1155 NFT", testContractUri);

  // ExchangeStreak
  const ExchangeStreak = await hre.ethers.getContractFactory("ExchangeStreak");
  const exchangeStreak = await ExchangeStreak.deploy(owner.address, erc721Streak.address, erc1155Streak.address, erc20Streak.address);

  // AuctionStreak
  const AuctionFactoryStreak = await hre.ethers.getContractFactory("AuctionFactoryStreak");
  const auctionFactoryStreak = await AuctionFactoryStreak.deploy(erc20Streak.address, erc721Streak.address, erc1155Streak.address);

  // DropMinting
  let wETH;
  switch (await hre.network.config.chainId) {
    case 80001:
      wETH = 0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa; // wETH address in Polygon Testnet Mumbai
      break;
    case 137:
      wETH = 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619; // wETH address in Polygon Mainnet
      break;
    default:
      wETH = erc20Streak.address;
      break;
  }

  // TODO: change start and end dates before deploying
  const DropMintingFactory = await hre.ethers.getContractFactory("DropMinting");
  const dropMinting = await DropMintingFactory.deploy(
    erc721Streak.address,
    erc20Streak.address,
    Math.round(Date.now() / 1000),
    Math.round(Date.now() / 1000 + 24*60*60*1000)
  );
  await erc721Streak.grantRole(minterRole, dropMinting.address);

  console.log("*************************************************************");
  console.log("* ERC20Streak:", erc20Streak.address);
  console.log("* ERC721Streak:", erc721Streak.address);
  console.log("* ERC1155Streak:", erc1155Streak.address);
  console.log("* ExchangeStreak:", exchangeStreak.address);
  console.log("* AuctionFactoryStreak:", auctionFactoryStreak.address);
  console.log("* DropMintingStreak:", dropMinting.address);
  console.log("*************************************************************");

  if ( verifiableNetwork.includes(hre.network.name) ) {
    // two minute timeout to let Etherscan update
    await pause(120000);

    await hre.run("verify:verify", {
      address: erc20Streak.address,
      contract: "contracts/streak/ERC20Streak.sol:ERC20Streak",
      constructorArguments: [streak, streak, initialSupply, owner.address],
    });
    await hre.run("verify:verify", {
      address: erc721Streak.address,
      constructorArguments: ["Streak 721 NFT", "SNFT", testContractUri],
      contract: "contracts/streak/ERC721Streak.sol:ERC721Streak",
    });
    await hre.run("verify:verify", {
      address: erc1155Streak.address,
      constructorArguments: ["Streak 1155 NFT", testContractUri],
      contract: "contracts/streak/ERC1155Streak.sol:ERC1155Streak",
    });
    await hre.run("verify:verify", {
      address: exchangeStreak.address,
      constructorArguments: [owner.address, erc721Streak.address, erc1155Streak.address, erc20Streak.address],
      contract: "contracts/streak/ExchangeStreak.sol:ExchangeStreak",
    });
    await hre.run("verify:verify", {
      address: auctionFactoryStreak.address,
      constructorArguments: [erc20Streak.address, erc721Streak.address, erc1155Streak.address],
      contract: "contracts/streak/AuctionFactoryStreak.sol:AuctionFactoryStreak",
    });

    await hre.run("verify:verify", {
        address: dropMinting.address,
        constructorArguments: [
          erc721Streak.address,
          erc20Streak.address,
          Math.round(Date.now()/ 1000),
          Math.round(Date.now() / 1000 + 24*60*60*1000)
        ],
        contract: "contracts/streak/DropMinting.sol:DropMinting",
      });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
