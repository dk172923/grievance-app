const hre = require("hardhat");

async function main() {
  const ContractFactory = await hre.ethers.getContractFactory("RecordVerifier"); // Replace 'Lock' with your contract name
  const contract = await ContractFactory.deploy();

  await contract.deploymentTransaction().wait(); // Wait for deployment tx to be mined

  console.log("Contract deployed to:", contract.target); // In ethers v6, use .target not .address
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
