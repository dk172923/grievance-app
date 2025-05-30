// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract RecordVerifier {
    mapping(bytes32 => bool) private hashes;

    function storeHash(bytes32 hash) public {
        hashes[hash] = true;
    }

    function verifyHash(bytes32 hash) public view returns (bool) {
        return hashes[hash];
    }
}