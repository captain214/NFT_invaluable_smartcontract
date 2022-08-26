import { assert } from "chai";

const ERC1155Streak = artifacts.require("ERC1155Streak");


contract("ERC1155Streak contract", function (accounts) {
  let erc1555: any;
  const contractUri = "ipfs://QmbqkJtqvkustaWQ9uUQbEJQuSRMeRm52QhUHwdQ8wkfyD";

  before(async () => {
    erc1555 = await ERC1155Streak.deployed();

  });

  describe("Deployment", async () => {
    it("ERC1155", async () => {
      assert.equal(await erc1555.name(), "Streak 1155 NFT");
    });

    // async function mintToken(tokenUri: string) {
    //   const tx = await erc1555.mint(erc1555.address, tokenUri)
    //   const actualContractUri = await erc1555.contractURI();
    //   const tokenId = tx.logs[0].args.tokenId;
    //   const actualTokenUri = await erc1555.tokenURI(tokenId);
    //   assert.equal(actualContractUri, contractUri);
    //   assert.equal(actualTokenUri, tokenUri);
    //   console.log({ tokenId, tokenUri })
    // }
    //
    // it("ERC1155 mint", async () => {
    //   await mintToken("ipfs://QmQFJMudQt7CMXgpxkmgPEh5MWDiNHGqHGMcX1MjURpogb")
    //   await mintToken("ipfs://QmXrAErPDRHbRzfb7ZBhhdyMjAXKG3f5W3kk8X4AF3ZRhj")
    //   await mintToken("ipfs://Qma3CBdjKFZYbXZLCgAz1nZFrdwUSy5kxsac7DznFLG1F2")
    // });

  });
});

