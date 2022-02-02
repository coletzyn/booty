const sushiMainnet = require('./sushi-mainnet.json');
const uniswapMainnet = require('./uniswap-mainnet.json');
const dydxMainnet = require('./dydx-mainnet.json');
const tokensMainnet = require('./tokens-mainnet.json');

module.exports = {
  kovan: {
    sushi: sushiMainnet,
    uniswap: uniswapMainnet,
    dydx: dydxMainnet,
    tokens: tokensMainnet
  }
};
