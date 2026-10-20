const main = async () => {
  const [deployer] = await hre.ethers.getSigners();
  const accountBalance = await deployer.getBalance();

  console.log("Deploying IdenteefiV2 with account: ", deployer.address);
  console.log("Account balance: ", accountBalance.toString());

  const productContractFactory = await hre.ethers.getContractFactory("IdenteefiV2");
  const productContract = await productContractFactory.deploy();
  await productContract.deployed();

  console.log("IdenteefiV2 address: ", productContract.address);
  console.log("Owner: ", await productContract.owner());

  const roleAddresses = [
    [process.env.MANUFACTURER_ADDRESS, 2, "manufacturer"],
    [process.env.SUPPLIER_ADDRESS, 3, "supplier"],
    [process.env.RETAILER_ADDRESS, 4, "retailer"],
  ];
  for (const [address, role, name] of roleAddresses) {
    if (!address) continue;
    const tx = await productContract.grantRole(address, role);
    await tx.wait();
    console.log(`Granted ${name} role to ${address}`);
  }
};

const runMain = async () => {
  try {
    await main();
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

runMain();
