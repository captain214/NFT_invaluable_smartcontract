// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.0;

import "../openzepplin-contracts/token/ERC20/IERC20.sol";
import "../openzepplin-contracts/token/ERC721/IERC721.sol";
import "../openzepplin-contracts/token/ERC1155/IERC1155.sol";


contract ExchangeStreak {
	struct ERC1155Offer {
		uint tokenId;
		uint quantity;
		uint price;
		address seller;
	}

	event TokenPriceListed (uint indexed _tokenId, address indexed _owner, uint _price);
	event TokenPriceDeleted (uint indexed _tokenId);
	event TokenPriceUnlisted (uint indexed _tokenId);
	event TokenSold (uint indexed _tokenId, uint _price, bool _soldForERC20);
	event TokenOwned (uint indexed _tokenId, address indexed _previousOwner, address indexed _newOwner);
	event TokenBought (uint indexed _tokenId, uint _price, address indexed _previousOwner, address indexed _newOwner, bool _soldForERC20);
	event Token1155OfferListed (uint indexed _tokenId, uint indexed _offerId, address indexed _owner, uint _quantity, uint _price);
	event Token1155OfferDeleted (uint indexed _tokenId, uint indexed _offerId);
	event Token1155PriceUnlisted (uint indexed _tokenId, uint indexed _offerId);
	event Token1155Sold(uint indexed _tokenId, uint indexed _offerId, uint _quantity, uint _price, bool _soldForERC20);
	event Token1155Owned (uint indexed _tokenId, address indexed _previousOwner, address indexed _newOwner, uint _quantity);
	event Token1155Bought (uint _tokenId, uint indexed _offerId, uint _quantity, uint _price, address indexed _previousOwner, address indexed _newOwner, bool _soldForERC20);

	address public signerAddress;
	address owner;

	bytes32 public name = "ExchangeStreak";

	uint public offerIdCounter;
	uint public safeVolatilityPeriod;

	IERC20 public erc20Contract;
	IERC721 public erc721Contract;
	IERC1155 public erc1155Contract;

	mapping(address => uint) public nonces;
	mapping(uint => uint) public ERC721Prices;
	mapping(uint => ERC1155Offer) public ERC1155Offers;
	mapping(address => mapping(uint => uint)) public tokensListed;

	constructor (
		address _signerAddress,
		address _erc721Address,
		address _erc1155Address,
		address _erc20Address
	)
	{
		require (_signerAddress != address(0));
		require (_erc721Address != address(0));
		require (_erc1155Address != address(0));
		require (_erc20Address != address(0));

		owner = msg.sender;
		signerAddress = _signerAddress;
		erc721Contract = IERC721(_erc721Address);
		erc1155Contract = IERC1155(_erc1155Address);
		erc20Contract = IERC20(_erc20Address);

		safeVolatilityPeriod = 4 hours;
	}

	function listToken(
		uint _tokenId,
		uint _price
	)
	external
	{
		require(_price > 0);
		require(erc721Contract.ownerOf(_tokenId) == msg.sender);
		require(ERC721Prices[_tokenId] == 0);
		ERC721Prices[_tokenId] = _price;
		emit TokenPriceListed(_tokenId, msg.sender, _price);
	}

	function listToken1155(
		uint _tokenId,
		uint _quantity,
		uint _price
	)
	external
	{
		require(_price > 0);
		require(erc1155Contract.balanceOf(msg.sender, _tokenId) >= tokensListed[msg.sender][_tokenId] + _quantity);

		uint offerId = offerIdCounter++;
		ERC1155Offers[offerId] = ERC1155Offer({
			tokenId: _tokenId,
			quantity: _quantity,
			price: _price,
			seller: msg.sender
		});

		tokensListed[msg.sender][_tokenId] += _quantity;
		emit Token1155OfferListed(_tokenId, offerId, msg.sender, _quantity, _price);
	}

	function removeListToken(
		uint _tokenId
	)
	external
	{
		require(erc721Contract.ownerOf(_tokenId) == msg.sender);
		deleteTokenPrice(_tokenId);

		emit TokenPriceUnlisted(_tokenId);
	}

	function removeListToken1155(
		uint _offerId
	)
	external
	{
		require(ERC1155Offers[_offerId].seller == msg.sender);
		ERC1155Offer memory offer = ERC1155Offers[_offerId];
		deleteToken1155Offer(_offerId);

		emit Token1155PriceUnlisted(offer.tokenId, _offerId);
	}

	function deleteTokenPrice(
		uint _tokenId
	)
	internal
	{
		delete ERC721Prices[_tokenId];
		emit TokenPriceDeleted(_tokenId);
	}

	function deleteToken1155Offer(
		uint _offerId
	)
	internal
	{
		ERC1155Offer memory offer = ERC1155Offers[_offerId];
		tokensListed[offer.seller][offer.tokenId] -= offer.quantity;

		delete ERC1155Offers[_offerId];
		emit Token1155OfferDeleted(offer.tokenId, _offerId);
	}

	function buyToken(
		uint _tokenId
	)
	external
	payable
	{
		require(ERC721Prices[_tokenId] > 0, "token is not for sale");
		require(ERC721Prices[_tokenId] <= msg.value);

		address tokenOwner = erc721Contract.ownerOf(_tokenId);

		address payable payableTokenOwner = payable(tokenOwner);
		(bool sent, ) = payableTokenOwner.call{value: msg.value}("");
		require(sent);

		erc721Contract.safeTransferFrom(tokenOwner, msg.sender, _tokenId);

		emit TokenSold(_tokenId, msg.value, false);
		emit TokenOwned(_tokenId, tokenOwner, msg.sender);

		emit TokenBought(_tokenId, msg.value, tokenOwner, msg.sender, false);

		deleteTokenPrice(_tokenId);
	}

	function buyToken1155(
		uint _offerId,
		uint _quantity
	)
	external
	payable
	{
		ERC1155Offer memory offer = ERC1155Offers[_offerId];

		require(offer.price > 0, "offer does not exist");
		require(offer.quantity >= _quantity);
		require(offer.price * _quantity <= msg.value);

		address payable payableSeller = payable(offer.seller);
		(bool sent, ) = payableSeller.call{value: msg.value}("");
		require(sent);

		erc1155Contract.safeTransferFrom(offer.seller, msg.sender, offer.tokenId, _quantity, "");

		emit Token1155Sold(offer.tokenId, _offerId, _quantity, offer.price, false);
		emit Token1155Owned(offer.tokenId, offer.seller, msg.sender, _quantity);

		emit Token1155Bought(offer.tokenId, _offerId, _quantity, offer.price, offer.seller, msg.sender, false);

		if (offer.quantity == _quantity) {
			deleteToken1155Offer(_offerId);
		} else {
			ERC1155Offers[_offerId].quantity -= _quantity;
		}
	}

	function buyTokenForERC20(
		uint _tokenId,
		uint _priceInERC20,
		uint _nonce,
		bytes calldata _signature,
		uint _timestamp
	)
	external
	{
		bytes32 hash = keccak256(abi.encodePacked(_tokenId, _priceInERC20, _nonce, _timestamp));
		bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
		require(recoverSignerAddress(ethSignedMessageHash, _signature) == signerAddress, "invalid secret signer");

		require(nonces[msg.sender] < _nonce, "invalid nonce");
		if (safeVolatilityPeriod > 0) {
			require(_timestamp + safeVolatilityPeriod >= block.timestamp, "safe volatility period exceeded");
		}
		require(ERC721Prices[_tokenId] > 0, "token is not for sale");

		nonces[msg.sender] = _nonce;

		address tokenOwner = erc721Contract.ownerOf(_tokenId);

		bool sent = erc20Contract.transferFrom(msg.sender, tokenOwner, _priceInERC20);
		require(sent);

		erc721Contract.safeTransferFrom(tokenOwner, msg.sender, _tokenId);

		emit TokenSold(_tokenId, _priceInERC20, true);
		emit TokenOwned(_tokenId, tokenOwner, msg.sender);

		deleteTokenPrice(_tokenId);
	}

	function buyToken1155ForERC20(
		uint _offerId,
		uint _quantity,
		uint _priceInERC20,
		uint _nonce,
		bytes calldata _signature,
		uint _timestamp
	)
	external
	{
		bytes32 hash = keccak256(abi.encodePacked(_offerId, _quantity, _priceInERC20, _nonce, _timestamp));
		bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
		require(recoverSignerAddress(ethSignedMessageHash, _signature) == signerAddress, "invalid secret signer");

		ERC1155Offer memory offer = ERC1155Offers[_offerId];

		require(nonces[msg.sender] < _nonce, "invalid nonce");
		if (safeVolatilityPeriod > 0) {
			require(_timestamp + safeVolatilityPeriod >= block.timestamp, "safe volatility period exceeded");
		}
		require(offer.price > 0, "offer does not exist");
		require(offer.quantity >= _quantity);

		nonces[msg.sender] = _nonce;

		erc20Contract.transferFrom(msg.sender, offer.seller, _priceInERC20 * _quantity);
		erc1155Contract.safeTransferFrom(offer.seller, msg.sender, offer.tokenId, _quantity, "");

		emit Token1155Sold(offer.tokenId, _offerId, _quantity, _priceInERC20, true);
		emit Token1155Owned(offer.tokenId, offer.seller, msg.sender, _quantity);

		if (offer.quantity == _quantity) {
			deleteToken1155Offer(_offerId);
		} else {
			ERC1155Offers[_offerId].quantity -= _quantity;
		}
	}

	function setSigner(
		address _newSignerAddress
	)
	external
	{
		require(msg.sender == owner);
		signerAddress = _newSignerAddress;
	}

	function setSafeVolatilityPeriod(
		uint _newSafeVolatilityPeriod
	)
	external
	{
		require(msg.sender == owner);
		safeVolatilityPeriod = _newSafeVolatilityPeriod;
	}

	function recoverSignerAddress(
		bytes32 _hash,
		bytes memory _signature
	)
	internal
	pure
	returns (address)
	{
		require(_signature.length == 65, "invalid signature length");

		bytes32 r;
		bytes32 s;
		uint8 v;

		assembly {
			r := mload(add(_signature, 32))
			s := mload(add(_signature, 64))
			v := and(mload(add(_signature, 65)), 255)
		}

		if (v < 27) {
			v += 27;
		}

		if (v != 27 && v != 28) {
			return address(0);
		}

		return ecrecover(_hash, v, r, s);
	}
}
