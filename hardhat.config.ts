import "@nomiclabs/hardhat-truffle5";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";

const fs = require('fs');
const privatekey = fs.readFileSync(".secret").toString().trim();

const maticConfig = {
  url: "https://rpc-mumbai.maticvigil.com",
  chainId: 80001,
  accounts: [privatekey],
  gasPrice: 8000000000
}

export default {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20
      }
    },
    matic: maticConfig,
    // ropsten: {
    //   url: "https://ropsten.infura.io/v3/0e7205f8a778420898d6351875c2cdd2",
    //   chainId: 3,
    //   accounts: ["c06f772b6cddb18cd259bb7357fb311af6d7e73ef989805bc2f214623d271772"]
    // },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/0e7205f8a778420898d6351875c2cdd2",
      chainId: 4,
      accounts: [privatekey],
    },
  },
  etherscan: {
    apiKey: "NM7FAVEED75RSW5V8M7W8JDYM418ZTSW9F",
  },
  solidity: {
    version: '0.8.0',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 100000
  }
}
