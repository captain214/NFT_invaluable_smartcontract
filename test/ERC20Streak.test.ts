import { assert } from "chai";

const ERC20Streak = artifacts.require("ERC20Streak");


contract("ERC20Streak contract", function (accounts) {
  let erc20Streak: any;

  let streak = "VIRTUAL";

  before(async () => {
    erc20Streak = await ERC20Streak.deployed();
  });

  describe("Deployment", async () => {
    it("ERC20 deployed", async () => {
      assert.equal(await erc20Streak.symbol(), streak);
    });
  });
});

