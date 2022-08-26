import { assert } from "chai";

const ERC721Streak = artifacts.require("ERC721Streak");


contract("ERC721Streak contract", function (accounts) {
  let erc721: any;

  let minet

  before(async () => {
    erc721 = await ERC721Streak.deployed();
  });

  describe("Deployment", async () => {
    it("ERC721 deployed", async () => {
      assert.equal(await erc721.symbol(), "SNFT");
    });

    // async function mintToken(tokenUri: string) {
    //   const tx = await erc721.mint(erc721.address, tokenUri)
    //   const tokenId = tx.logs[0].args.tokenId;
    //   const actualTokenUri = await erc721.tokenURI(tokenId);
    //   assert.equal(actualTokenUri, tokenUri);
    //   console.log({ tokenId, tokenUri })
    // }
    //
    // it("ERC721 mint", async () => {
    //   await mintToken("ipfs://QmQFJMudQt7CMXgpxkmgPEh5MWDiNHGqHGMcX1MjURpogb")
    //   await mintToken("ipfs://QmXrAErPDRHbRzfb7ZBhhdyMjAXKG3f5W3kk8X4AF3ZRhj")
    //   await mintToken("ipfs://Qma3CBdjKFZYbXZLCgAz1nZFrdwUSy5kxsac7DznFLG1F2")
    // });
    //
    // it("ERC721 mint", async () => {
    //   await mintToken("ipfs://QmQFJMudQt7CMXgpxkmgPEh5MWDiNHGqHGMcX1MjURpogb")
    //   await mintToken("ipfs://QmXrAErPDRHbRzfb7ZBhhdyMjAXKG3f5W3kk8X4AF3ZRhj")
    //   await mintToken("ipfs://Qma3CBdjKFZYbXZLCgAz1nZFrdwUSy5kxsac7DznFLG1F2")
    // });

  });
});

