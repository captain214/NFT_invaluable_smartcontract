// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "../openzepplin-contracts/utils/math/SafeMath.sol";
import "../openzepplin-contracts/token/ERC20/IERC20.sol";
import "../openzepplin-contracts/token/ERC1155/IERC1155.sol";
import "../openzepplin-contracts/token/ERC721/IERC721.sol";
import "./AuctionStreak.sol";


contract AuctionFactoryStreak {
  using SafeMath for uint;

  struct AuctionParameters {
    uint startingBid;
    uint bidStep;
    uint startTimestamp;
    uint endTimestamp;
    uint overtimeSeconds;
    uint feeRate;
  }

  modifier onlyOwner {
    require(msg.sender == owner);
    _;
  }

  bytes32 public name = "AuctionFactoryStreak";
  address owner;
  IERC20 public erc20StreakContract;
  IERC721 public erc721StreakContract;
  IERC1155 public erc1155StreakContract;
  mapping(address => AuctionParameters) public auctionParameters;

  event AuctionCreated(address indexed auctionContract, address indexed beneficiary, uint indexed tokenId);
  event BidPlaced (address indexed bidder, uint bid, address indexed auctionContract);
  event FundsClaimed (address indexed claimer, address withdrawalAccount, uint withdrawalAmount, address indexed auctionContract);
  event ItemClaimed (address indexed claimer, address indexed auctionContract);
  event AuctionCancelled (address indexed auctionContract);

  constructor(address _erc20StreakAddress, address _erc721StreakContract, address _erc1155StreakContract) {
    owner = msg.sender;
    erc20StreakContract = IERC20(_erc20StreakAddress);
    erc721StreakContract = IERC721(_erc721StreakContract);
    erc1155StreakContract = IERC1155(_erc1155StreakContract);
  }

  function createAuction(
    address beneficiary,
    uint tokenId,
    uint bidStep,
    uint startingBid,
    uint startTimestamp,
    uint endTimestamp,
    bool acceptERC20,
    bool isErc1155,
    uint quantity,
    uint feeRate,
    uint overtimeSeconds
  )
  onlyOwner
  external
  {
    require(beneficiary != address(0));
    require(bidStep > 0);
    require(startingBid >= 0);
    require(startTimestamp < endTimestamp);
    require(startTimestamp >= block.timestamp);
    require(feeRate <= 100);
    if (isErc1155) {
      require(quantity > 0);
    }

    AuctionStreak newAuction = new AuctionStreak(
      msg.sender,
      beneficiary,
      acceptERC20,
      isErc1155,
      tokenId,
      quantity,
      address(erc20StreakContract),
      address(erc721StreakContract),
      address(erc1155StreakContract)
    );

    auctionParameters[address(newAuction)] = AuctionParameters(
      startingBid,
      bidStep,
      startTimestamp,
      endTimestamp,
      overtimeSeconds,
      feeRate
    );

    if (isErc1155) {
      erc1155StreakContract.safeTransferFrom(msg.sender, address(newAuction), tokenId, quantity, "");
    } else {
      erc721StreakContract.safeTransferFrom(msg.sender, address(newAuction), tokenId);
    }

    emit AuctionCreated(address(newAuction), beneficiary, tokenId);
  }

  function placeBid(
    address auctionAddress
  )
  payable
  external
  {
    AuctionStreak auction = AuctionStreak(auctionAddress);
    AuctionParameters memory parameters = auctionParameters[auctionAddress];

    require(block.timestamp >= parameters.startTimestamp);
    require(block.timestamp < parameters.endTimestamp);
    require(!auction.cancelled());
    require(!auction.acceptERC20());
    require(msg.sender != auction.controller());
    require(msg.sender != auction.beneficiary());
    require(msg.value > 0);

    // calculate the user's total bid
    uint totalBid = auction.fundsByBidder(msg.sender) + msg.value;

    if (auction.highestBid() == 0) {
      // reject if user did not overbid
      require(totalBid >= parameters.startingBid);
    } else {
      // reject if user did not overbid
      require(totalBid >= auction.highestBid() + parameters.bidStep);
    }

    auction.handlePayment{value:msg.value}();
    auction.placeBid(msg.sender, totalBid);

    // if bid was placed within specified number of blocks before the auction's end
    // extend auction time
    if (parameters.overtimeSeconds > parameters.endTimestamp - block.timestamp) {
      auctionParameters[auctionAddress].endTimestamp += parameters.overtimeSeconds;
    }

    emit BidPlaced(msg.sender, totalBid, auctionAddress);
  }

  function placeBidERC20(address auctionAddress, uint amount)
  external
  {
    AuctionStreak auction = AuctionStreak(auctionAddress);
    AuctionParameters memory parameters = auctionParameters[auctionAddress];

    require(block.timestamp >= parameters.startTimestamp);
    require(block.timestamp < parameters.endTimestamp);
    require(!auction.cancelled());
    require(auction.acceptERC20());
    require(msg.sender != auction.controller());
    require(msg.sender != auction.beneficiary());
    require(amount > 0);

    // calculate the user's total bid
    uint totalBid = auction.fundsByBidder(msg.sender) + amount;

    if (auction.highestBid() == 0) {
      // reject if user did not overbid
      require(totalBid >= parameters.startingBid);
    } else {
      // reject if user did not overbid
      require(totalBid >= auction.highestBid() + parameters.bidStep);
    }

    require(erc20StreakContract.transferFrom(msg.sender, auctionAddress, amount));
    auction.placeBid(msg.sender, totalBid);

    // if bid was placed within specified number of blocks before the auction's end
    // extend auction time
    if (parameters.overtimeSeconds > parameters.endTimestamp - block.timestamp) {
      auctionParameters[auctionAddress].endTimestamp += parameters.overtimeSeconds;
    }

    emit BidPlaced(msg.sender, totalBid, auctionAddress);
  }

  function claimFunds(address auctionAddress)
  external
  {
    AuctionStreak auction = AuctionStreak(auctionAddress);
    AuctionParameters memory parameters = auctionParameters[auctionAddress];

    require(auction.cancelled() || block.timestamp >= parameters.endTimestamp);

    address withdrawalAccount;
    uint withdrawalAmount;
    bool beneficiaryClaimedFunds;
    bool controllerClaimedFunds;

    if (auction.cancelled()) {
      // if the auction was cancelled, everyone should be allowed to withdraw their funds
      withdrawalAccount = msg.sender;
      withdrawalAmount = auction.fundsByBidder(withdrawalAccount);
    } else {
      // the auction finished without being cancelled

      // reject when auction winner claims funds
      require(msg.sender != auction.highestBidder());

      // everyone except auction winner should be allowed to withdraw their funds
      if (msg.sender == auction.beneficiary()) {
        require(parameters.feeRate < 100 && !auction.beneficiaryClaimedFunds());
        withdrawalAccount = auction.highestBidder();
        withdrawalAmount = auction.highestBid().mul(100 - parameters.feeRate).div(100);
        beneficiaryClaimedFunds = true;
      } else if (msg.sender == auction.controller()) {
        require(parameters.feeRate > 0 && !auction.controllerClaimedFunds());
        withdrawalAccount = auction.highestBidder();
        withdrawalAmount = auction.highestBid().mul(parameters.feeRate).div(100);
        controllerClaimedFunds = true;
      } else {
        withdrawalAccount = msg.sender;
        withdrawalAmount = auction.fundsByBidder(withdrawalAccount);
      }
    }

    // reject when there are no funds to claim
    require(withdrawalAmount != 0);

    auction.withdrawFunds(msg.sender, withdrawalAccount, withdrawalAmount, beneficiaryClaimedFunds, controllerClaimedFunds);

    emit FundsClaimed(msg.sender, withdrawalAccount, withdrawalAmount, auctionAddress);
  }

  function claimItem(address auctionAddress)
  external
  {
    AuctionStreak auction = AuctionStreak(auctionAddress);
    AuctionParameters memory parameters = auctionParameters[auctionAddress];

    require(!auction.itemClaimed());
    require(auction.cancelled() || block.timestamp >= parameters.endTimestamp);

    if (auction.cancelled()
      || (auction.highestBidder() == address(0) && block.timestamp >= parameters.endTimestamp)) {
      require(msg.sender == auction.beneficiary());
    } else {
      require(msg.sender == auction.highestBidder());
    }

    auction.transferItem(msg.sender);

    emit ItemClaimed(msg.sender, auctionAddress);
  }

  function cancelAuction(address auctionAddress)
  onlyOwner
  external
  {
    AuctionStreak auction = AuctionStreak(auctionAddress);
    AuctionParameters memory parameters = auctionParameters[auctionAddress];

    require(!auction.cancelled());
    require(block.timestamp < parameters.endTimestamp);

    auction.cancelAuction();
    emit AuctionCancelled(auctionAddress);
  }
}
