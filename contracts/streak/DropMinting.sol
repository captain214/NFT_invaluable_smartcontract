// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../openzepplin-contracts/security/ReentrancyGuard.sol";
import "../openzepplin-contracts/access/Ownable.sol";
import "../openzepplin-contracts/token/ERC20/IERC20.sol";

import "./IERC721Streak.sol";
// import "../openzepplin-contracts/token/ERC721/IERC721.sol";

/**
 * @notice DropMinting contract for Streak NFT Marketplace
 */
contract DropMinting is ReentrancyGuard, Ownable {

    /// @notice ERC721 NFT
    IERC721Streak public token;
    address public wETH;

    event DropMintingContractDeployed(
        uint _dropStart,
        uint _dropEnd
    );
    event DropMintingFinished(
        address _to,
        uint _tokenId,
        uint _amount,
        string[]  _tokenUri
    );
    event StopDropMinting(
        uint _dropEnd
    );

    /// @notice Each wallet can mint up to 100 max
    uint16 public mintLimitAccount = 100;

    /// @notice Limitation of NFT can be minted while dropping
    uint16 public mintLimitTotal = 6000;

    /// @notice NFT price ETH
    uint256 public price = 100000000000000000;

    /// @notice Timestamp of opening drop
    uint256 public dropStart;

    /// @notice Timestamp of ending drop
    uint256 public dropEnd;

    /// @notice Count of NFT minted until now while dropping
    uint256 public count;

    /// @notice token IDs per owner
    mapping (address => uint[]) public tokenIDs;

    /**
     * @dev Constructor Function
    */
    constructor(
        address _erc721Address,
        address _wETH,
        uint256 _dropStart,
        uint256 _dropEnd
    ) {
        require (_erc721Address != address(0), "Invalid erc721Address");
        require(address(_wETH) != address(0), "Invalid wETH address");

        token = IERC721Streak(_erc721Address);
        wETH = _wETH;
        dropStart = _dropStart;
        dropEnd = _dropEnd;

        emit DropMintingContractDeployed(dropStart, dropEnd);
    }

    /**
     * @dev Owner of token can airdrop tokens to recipients
     * @param _tokenUri URIs of tokens
     * @return tokenId Token ID minted
     */
    function dropMint(string[] memory _tokenUri) external nonReentrant returns(uint256[] _tokenIds) {
        require(count < mintLimitTotal, "DropMinting: Drop minting has already ended");
        require(block.timestamp >= dropStart && block.timestamp <= dropEnd,"DropMinting: Drop minting is not started");
        require(count + _tokenUri.length <= mintLimitTotal, "DropMinting: All NFTs are minted");
        require(tokenIDs[msg.sender].length + _tokenUri.length <= mintLimitAccount, "DropMinting: Exceeds account minting limitation");

        for (uint256 i = 0; i < _tokenUri.length; i++) {
            tokenId = token.mintItem(msg.sender, _tokenUri[i]);
            tokenIDs[msg.sender].push(tokenId);
            _tokenIds.push(tokenId);
            count++;
            if ( count == mintLimitTotal) {
                dropEnd = block.timestamp;

                emit StopDropMinting(dropEnd);
            }

            require(IERC20(wETH).transferFrom(msg.sender, address(this), price),
              "DropMinting: Can't transfer tokens from recipient");
            emit DropMintingFinished(msg.sender, tokenId, price, _tokenUri);
        }
      return _tokenIds;
    }

    /**
     * @dev Owner end DropMinting
     */
    function endDrop() external onlyOwner {
        require(block.timestamp >= dropStart,"DropMinting: Drop minting is not started");
        dropEnd = block.timestamp;
        emit StopDropMinting(dropEnd);
    }

    /**
     * @dev Owner update account minting limit
     * @param _limit limit of account minting count
     */
    function updateMintLimitAccount(uint16 _limit) external onlyOwner {
        mintLimitAccount = _limit;
    }

    /**
     * @dev Owner update total minting limit
     * @param _limit limit of total minting count
     */
    function updateMintLimitTotal(uint16 _limit) external onlyOwner {
        mintLimitTotal = _limit;
    }

    /**
     * @dev Owner update drop opening time
     * @param _time timestamp of drop opening time
     */
    function updateDropStart(uint256 _time) external onlyOwner {
        dropStart = _time;
    }

    /**
     * @dev Owner update drop ending time
     * @param _time timestamp of drop ending time
     */
    function updateDropEnd(uint256 _time) external onlyOwner {
        dropEnd = _time;
    }

    /**
     * @dev Owner update NFT price
     * @param _price NFT price
     */
    function updatePrice(uint256 _price) external onlyOwner {
        price = _price;
    }

    function getBalance() public view returns(uint) {
        return address(this).balance;
    }

    /**
     * @dev Owner withdraw all money
     */
    function withdrawMoney() external onlyOwner {
        address payable to = payable(msg.sender);
        to.transfer(getBalance());
    }

    function getAvailableMintCnt() external view returns(uint){
        return mintLimitAccount - tokenIDs[msg.sender].length;
    }
}
