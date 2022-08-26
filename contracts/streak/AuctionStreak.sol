// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "../openzepplin-contracts/token/ERC721/IERC721Receiver.sol";
import "../openzepplin-contracts/token/ERC1155/IERC1155Receiver.sol";
import "../openzepplin-contracts/token/ERC20/IERC20.sol";
import "../openzepplin-contracts/token/ERC721/IERC721.sol";
import "../openzepplin-contracts/token/ERC1155/IERC1155.sol";

contract AuctionStreak is IERC721Receiver, IERC1155Receiver {
  modifier onlyOwner {
    require(msg.sender == owner);
    _;
  }

  address public owner;
  address public controller;
  address public beneficiary;
  address public highestBidder;

  uint public tokenId;
  uint public quantity;
  uint public highestBid;

  bool public cancelled;
  bool public itemClaimed;
  bool public controllerClaimedFunds;
  bool public beneficiaryClaimedFunds;
  bool public acceptERC20;
  bool public isErc1155;

  IERC20 erc20StreakContract;
  IERC721 erc721StreakContract;
  IERC1155 erc1155StreakContract;

  mapping(address => uint256) public fundsByBidder;

  constructor(
    address _controller,
    address _beneficiary,
    bool _acceptERC20,
    bool _isErc1155,
    uint _tokenId,
    uint _quantity,
    address erc20StreakAddress,
    address erc721StreakAddress,
    address erc1155StreakAddress
  ) {
    owner = msg.sender;
    controller = _controller;
    beneficiary = _beneficiary;
    acceptERC20 = _acceptERC20;
    isErc1155 = _isErc1155;
    tokenId = _tokenId;
    quantity = _quantity;

    if (acceptERC20) {
      erc20StreakContract = IERC20(erc20StreakAddress);
    }

    if (isErc1155) {
      erc1155StreakContract = IERC1155(erc1155StreakAddress);
    } else {
      erc721StreakContract = IERC721(erc721StreakAddress);
    }
  }

  function placeBid(address bidder, uint totalAmount)
  onlyOwner
  external
  {
    fundsByBidder[bidder] = totalAmount;

    if (bidder != highestBidder) {
      highestBidder = bidder;
    }

    highestBid = totalAmount;
  }

  function handlePayment()
  payable
  onlyOwner
  external
  {}

  function withdrawFunds(
    address claimer,
    address withdrawalAccount,
    uint withdrawalAmount,
    bool _beneficiaryClaimedFunds,
    bool _controllerClaimedFunds
  )
  onlyOwner
  external
  {
    fundsByBidder[withdrawalAccount] -= withdrawalAmount;
    if (_beneficiaryClaimedFunds) {
      beneficiaryClaimedFunds = true;
    }
    if (_controllerClaimedFunds) {
      controllerClaimedFunds = true;
    }
    // send the funds
    if (acceptERC20) {
      require(erc20StreakContract.transfer(claimer, withdrawalAmount));
    } else {
      (bool sent, ) = claimer.call{value: withdrawalAmount}("");
      require(sent);
    }
  }

  function transferItem(
    address claimer
  )
  onlyOwner
  external
  {
    if (isErc1155) {
      erc1155StreakContract.safeTransferFrom(address(this), claimer, tokenId, quantity, "");
    } else {
      erc721StreakContract.safeTransferFrom(address(this), claimer, tokenId);
    }

    itemClaimed = true;
  }

  function cancelAuction()
  onlyOwner
  external
  {
    cancelled = true;
  }

  function onERC721Received(address _operator, address _from, uint256 _tokenId, bytes calldata data)
  external
  pure
  override
  returns (bytes4)
  {
    return this.onERC721Received.selector;
  }

  function onERC1155Received(address _operator, address _from, uint256 _id, uint256 _amount, bytes calldata _data)
  external
  pure
  override
  returns(bytes4)
  {
    return this.onERC1155Received.selector;
  }

  function onERC1155BatchReceived(address _operator, address _from, uint256[] calldata _ids, uint256[] calldata _values, bytes calldata _data)
  external
  pure
  override
  returns(bytes4)
  {
    return this.onERC1155BatchReceived.selector;
  }

  /**
 * @dev See {IERC165-supportsInterface}.
 */
  function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
    return interfaceId == type(IERC721Receiver).interfaceId
    || interfaceId == type(IERC1155Receiver).interfaceId;
  }
}
