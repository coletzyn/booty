
  require("dotenv").config()
  const Web3 = require('web3');
  
  const abis = require('./abis');
  const { kovan: addresses } = require('./addresses');
  const Flashloan = require('./build/contracts/Flashloan.json');


   const web3 = new Web3(
    new Web3.providers.WebsocketProvider(process.env.INFURA_URL_KOVAN)
   );
  const { address: admin } = web3.eth.accounts.wallet.add(process.env.PRIVATE_KEY);

  const uniswap = new web3.eth.Contract(
    abis.uniswap.uniswap,
    addresses.uniswap.router
  )

  const sushi = new web3.eth.Contract(
    abis.sushi.sushi,
    addresses.sushi.router
  )

  const ONE_WEI = web3.utils.toBN(web3.utils.toWei('1'));
  const AMOUNT_ETH_WEI = web3.utils.toBN(web3.utils.toWei('20'));
  const DIRECTION = {
    SUSHI_TO_UNISWAP: 0,
    UNISWAP_TO_SUSHI: 1
  };
  
  const init = async () => {
    const networkId = await web3.eth.net.getId();  
    const flashloan = new web3.eth.Contract(       
      Flashloan.abi,
      Flashloan.networks[networkId].address
    );

    //DO I GET ETH PRICE OR AAVE PRICE?
    let ethPrice;
    const updateEthPrice = async () => { 
      const results = await uniswap.methods.getAmountsOut(web3.utils.toWei('1'), [addresses.tokens.weth, addresses.tokens.aave]).call();   
      ethPrice = web3.utils.toBN('1').mul(web3.utils.toBN(results[1])).div(ONE_WEI);
      console.log(ethPrice);
    }
    await updateEthPrice();
    setInterval(updateEthPrice, 15000);
    //

    

    web3.eth.subscribe('newBlockHeaders')
      .on('data', async block => {
        console.log(`New block received. Block # ${block.number}`);

        
        const amountsOut1 = await sushi.methods.getAmountsOut(AMOUNT_ETH_WEI, [addresses.tokens.weth, addresses.tokens.aave]).call();   
        const amountsOut2 = await uniswap.methods.getAmountsOut(amountsOut1[1], [addresses.tokens.aave, addresses.tokens.weth]).call();    
        const amountsOut3 = await uniswap.methods.getAmountsOut(AMOUNT_AAVE_WEI, [addresses.tokens.weth, addresses.tokens.aave]).call();    
        const amountsOut4 = await sushi.methods.getAmountsOut(amountsOut3[1], [addresses.tokens.aave, addresses.tokens.weth]).call();   

        
        
        console.log(`Sushi -> Uniswap. AAVE input / output: ${web3.utils.fromWei(AMOUNT_ETH_WEI.toString())} / ${web3.utils.fromWei(amountsOut2[1].toString())}`);
        console.log(`Uniswap -> Sushi. AAVE input / output: ${web3.utils.fromWei(AMOUNT_ETH_WEI.toString())} / ${web3.utils.fromWei(amountsOut4[1].toString())}`);

        const ethFromUniswap = web3.utils.toBN(amountsOut2[1])
        const ethFromSushi = web3.utils.toBN(amountsOut2[1])


        if(ethFromUniswap.gt(AMOUNT_ETH_WEI)) {
          const tx = flashloan.methods.initiateFlashloan(
            addresses.dydx.solo, 
            addresses.tokens.weth, 
            AMOUNT_ETH_WEI,
            DIRECTION.SUSHI_TO_UNISWAP
          );
          const [gasPrice, gasCost] = await Promise.all([
            web3.eth.getGasPrice(),
            tx.estimateGas({from: admin}),
          ]);

          

          const txCost = web3.utils.toBN(gasCost).mul(web3.utils.toBN(gasPrice)).mul(ethPrice);
          const profit = ethFromUniswap.sub(AMOUNT_ETH_WEI).sub(txCost);

          if(profit > 0) {
            console.log('Arb opportunity found Sushi -> Uniswap!');
            console.log(`Expected profit: ${web3.utils.fromWei(profit)} ETH`);
            const data = tx.encodeABI();
            const txData = {
              from: admin,
              to: flashloan.options.address,
              data,
              gas: gasCost,
              gasPrice
            };
            const receipt = await web3.eth.sendTransaction(txData);
            console.log(`Transaction hash: ${receipt.transactionHash}`);
          }
        }

        if(ethFromSushi.gt(AMOUNT_ETH_WEI)) {
          const tx = flashloan.methods.initiateFlashloan(
            addresses.dydx.solo, 
            addresses.tokens.weth, 
            AMOUNT_ETH_WEI,
            DIRECTION.UNISWAP_TO_SUSHI
          );
          const [gasPrice, gasCost] = await Promise.all([
            web3.eth.getGasPrice(),
            tx.estimateGas({from: admin}),
          ]);
          const txCost = web3.utils.toBN(gasCost).mul(web3.utils.toBN(gasPrice)).mul(ethPrice);
          const profit = ethFromSushi.sub(AMOUNT_ETH_WEI).sub(txCost);

          if(profit > 0) {
            console.log('Arb opportunity found Uniswap -> Sushi!');
            console.log(`Expected profit: ${web3.utils.fromWei(profit)} ETH`);
            const data = tx.encodeABI();
            const txData = {
              from: admin,
              to: flashloan.options.address,
              data,
              gas: gasCost,
              gasPrice
            };
            const receipt = await web3.eth.sendTransaction(txData);
            console.log(`Transaction hash: ${receipt.transactionHash}`);
          }
        }
      })
      .on('error', error => {
        console.log(error);
      });
  }
  init();
  
