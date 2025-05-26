import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0xF944F411d65124a40af405B90fC72547a5301c03'; // Ensure this matches Hardhat deployment
const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_GANACHE_URL || 'http://127.0.0.1:7545');

async function getContract() {
  const [signer] = await provider.listAccounts(); // Use first Ganache account
  const contract = new ethers.Contract(CONTRACT_ADDRESS, [
    'function storeHash(bytes32 hash) public',
    'function verifyHash(bytes32 hash) public view returns (bool)',
  ], signer);
  return contract;
}

export { getContract };