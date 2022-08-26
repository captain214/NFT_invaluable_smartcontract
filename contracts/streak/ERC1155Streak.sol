// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../openzepplin-contracts/utils/Context.sol";
import "../openzepplin-contracts/access/AccessControlEnumerable.sol";
import "../openzepplin-contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "../openzepplin-contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "../openzepplin-contracts/token/ERC1155/presets/ERC1155PresetMinterPauser.sol";

/**
 * https://github.com/maticnetwork/pos-portal/blob/master/contracts/common/ContextMixin.sol
 */
abstract contract ContextMixin {
    function msgSender()
    internal
    view
    returns (address payable sender)
    {
        if (msg.sender == address(this)) {
            bytes memory array = msg.data;
            uint256 index = msg.data.length;
            assembly {
            // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
                sender := and(
                mload(add(array, index)),
                0xffffffffffffffffffffffffffffffffffffffff
                )
            }
        } else {
            sender = payable(msg.sender);
        }
        return sender;
    }
}

/**
 * https://github.com/maticnetwork/pos-portal/blob/master/contracts/common/Initializable.sol
 */
contract Initializable {
    bool inited = false;

    modifier initializer() {
        require(!inited, "already inited");
        _;
        inited = true;
    }
}

/**
 * https://github.com/maticnetwork/pos-portal/blob/master/contracts/common/EIP712Base.sol
 */
contract EIP712Base is Initializable {
    struct EIP712Domain {
        string name;
        string version;
        address verifyingContract;
        bytes32 salt;
    }

    string constant public ERC712_VERSION = "1";

    bytes32 internal constant EIP712_DOMAIN_TYPEHASH = keccak256(
        bytes(
            "EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)"
        )
    );
    bytes32 internal domainSeperator;

    // supposed to be called once while initializing.
    // one of the contractsa that inherits this contract follows proxy pattern
    // so it is not possible to do this in a constructor
    function _initializeEIP712(
        string memory name
    )
    internal
    initializer
    {
        _setDomainSeperator(name);
    }

    function _setDomainSeperator(string memory name) internal {
        domainSeperator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(name)),
                keccak256(bytes(ERC712_VERSION)),
                address(this),
                bytes32(getChainId())
            )
        );
    }

    function getDomainSeperator() public view returns (bytes32) {
        return domainSeperator;
    }

    function getChainId() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    /**
     * Accept message hash and returns hash message in EIP712 compatible form
     * So that it can be used to recover signer from signature signed using EIP712 formatted data
     * https://eips.ethereum.org/EIPS/eip-712
     * "\\x19" makes the encoding deterministic
     * "\\x01" is the version byte to make it compatible to EIP-191
     */
    function toTypedMessageHash(bytes32 messageHash)
    internal
    view
    returns (bytes32)
    {
        return
        keccak256(
            abi.encodePacked("\x19\x01", getDomainSeperator(), messageHash)
        );
    }
}

/**
 * https://github.com/maticnetwork/pos-portal/blob/master/contracts/common/NativeMetaTransaction.sol
 */
contract NativeMetaTransaction is EIP712Base {
    bytes32 private constant META_TRANSACTION_TYPEHASH = keccak256(
        bytes(
            "MetaTransaction(uint256 nonce,address from,bytes functionSignature)"
        )
    );

    event MetaTransactionExecuted(
        address userAddress,
        address payable relayerAddress,
        bytes functionSignature
    );

    mapping(address => uint256) nonces;

    /*
     * Meta transaction structure.
     * No point of including value field here as if user is doing value transfer then he has the funds to pay for gas
     * He should call the desired function directly in that case.
     */
    struct MetaTransaction {
        uint256 nonce;
        address from;
        bytes functionSignature;
    }

    function executeMetaTransaction(
        address userAddress,
        bytes memory functionSignature,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) public payable returns (bytes memory) {
        MetaTransaction memory metaTx = MetaTransaction({
        nonce : nonces[userAddress],
        from : userAddress,
        functionSignature : functionSignature
        });

        require(
            verify(userAddress, metaTx, sigR, sigS, sigV),
            "Signer and signature do not match"
        );

        // increase nonce for user (to avoid re-use)
        nonces[userAddress] = nonces[userAddress] + 1;

        emit MetaTransactionExecuted(
            userAddress,
            payable(msg.sender),
            functionSignature
        );

        // Append userAddress and relayer address at the end to extract it from calling context
        (bool success, bytes memory returnData) = address(this).call(
            abi.encodePacked(functionSignature, userAddress)
        );
        require(success, "Function call not successful");

        return returnData;
    }

    function hashMetaTransaction(MetaTransaction memory metaTx)
    internal
    pure
    returns (bytes32)
    {
        return
        keccak256(
            abi.encode(
                META_TRANSACTION_TYPEHASH,
                metaTx.nonce,
                metaTx.from,
                keccak256(metaTx.functionSignature)
            )
        );
    }

    function getNonce(address user) public view returns (uint256 nonce) {
        nonce = nonces[user];
    }

    function verify(
        address signer,
        MetaTransaction memory metaTx,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) internal view returns (bool) {
        require(signer != address(0), "NativeMetaTransaction: INVALID_SIGNER");
        return
        signer ==
        ecrecover(
            toTypedMessageHash(hashMetaTransaction(metaTx)),
            sigV,
            sigR,
            sigS
        );
    }
}


/**
 * @dev {ERC1155} token, including:
 *
 *  - ability for holders to burn (destroy) their tokens
 *  - a minter role that allows for token minting (creation)
 *  - a pauser role that allows to stop all token transfers
 *
 * This contract uses {AccessControl} to lock permissioned functions using the
 * different roles - head to its documentation for details.
 *
 * The account that deploys the contract will be granted the minter and pauser
 * roles, as well as the default admin role, which will let it grant both minter
 * and pauser roles to other accounts.
 */
contract ERC1155Streak is ERC1155PresetMinterPauser, ContextMixin, NativeMetaTransaction {
    // Contract name
    string public name;

    uint256 private _currentTokenID = 0;
    mapping(uint256 => uint256) public tokenSupply;

    mapping(uint256 => string) internal _tokenURIs;

    mapping(uint256 => address) public creators;

    mapping(bytes32 => bool) private _uniqTitleSet;

    event Create1155Token(address indexed to, uint256 indexed tokenId, uint256 quantity);

    constructor (string memory name_, string memory uri_) ERC1155PresetMinterPauser(uri_) {
        name = name_;
        _initializeEIP712(name);
    }

    /**
    * @dev Creates a new token type and assigns _quantity to an creator (i.e. the message sender)
    * @param _title unique art title
    * @param _quantity art's quantity
    * @param _uri token's type metadata uri
    * @param _data Data to pass if receiver is contract
    * @return The newly created token ID
    */
    function mintItem(
        bytes32 _title,
        uint256 _quantity,
        string calldata _uri,
        bytes calldata _data
    ) external returns (uint) {
        bytes32 hash = keccak256(abi.encodePacked(_title));
        require(!_uniqTitleSet[hash], "StreakERC1155#mintItem: TITLE_NOT_UNIQUE");
        _uniqTitleSet[hash] = true;

        _currentTokenID += 1;
        uint256 _id = _currentTokenID;

        creators[_id] = msg.sender;

        if (bytes(_uri).length > 0) {
            _tokenURIs[_id] = _uri;
            emit URI(_uri, _id);
        }

        _mint(_msgSender(), _id, _quantity, _data);
        tokenSupply[_id] = _quantity;

        emit Create1155Token(_msgSender(), _id, _quantity); 
        return _id;
    }


    /**
      * @dev Returns the total quantity for a token ID
      * @param _id uint256 ID of the token to query
      * @return amount of token in existence
      */
    function totalSupply(
        uint256 _id
    ) public view returns (uint256) {
        return tokenSupply[_id];
    }


    function uri(
        uint256 _id
    ) public override view returns (string memory) {
        require(_exists(_id), "ERC721Tradable#uri: NONEXISTENT_TOKEN");

        string memory _tokenURI = _tokenURIs[_id];

        return _tokenURI;
    }

    /**
      * @dev Returns whether the specified token exists by checking to see if it has a creator
      * @param _id uint256 ID of the token to query the existence of
      * @return bool whether the token exists
      */
    function _exists(
        uint256 _id
    ) internal view returns (bool) {
        return creators[_id] != address(0);
    }


    /**
     * This is used instead of msg.sender as transactions won't be sent by the original token owner, but by OpenSea.
     */
    function _msgSender()
    internal
    override
    view
    returns (address sender)
    {
        return ContextMixin.msgSender();
    }

    /**
    * As another option for supporting trading without requiring meta transactions, override isApprovedForAll to whitelist OpenSea proxy accounts on Matic
    */
    function isApprovedForAll(
        address _owner,
        address _operator
    ) public override view returns (bool isOperator) {
        //        if (_operator == address(0x207Fa8Df3a17D96Ca7EA4f2893fcdCb78a304101)) {
        //            return true;
        //        }
        return ERC1155.isApprovedForAll(_owner, _operator);
    }
}
