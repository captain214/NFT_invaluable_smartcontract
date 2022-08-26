// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../openzepplin-contracts/token/ERC721/IERC721.sol";

interface IERC721Streak is IERC721 {
    function mintItem(address to, string memory _tokenUri) external returns(uint256 tokenId);
}