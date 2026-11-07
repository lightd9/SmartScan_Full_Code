// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/// @title SmartScan product identity and custody registry
/// @notice A product's history is append-only and every entry is bound to its writer wallet.
contract IdenteefiV3 {
    enum Role { None, Admin, Manufacturer, Supplier, Retailer }
    enum Stage { None, Manufactured, Dispatched, Delivered, Sold, Recalled }
    enum Action { Manufactured, Dispatched, Delivered, Sold, Recalled }

    address public owner;
    address public pendingOwner;
    mapping(address => Role) public roles;
    mapping(address => string) public businessNames;
    mapping(address => address) public walletSuccessor;

    struct Product {
        string name;
        string serialNumber;
        string description;
        string brand;
        string image;
        address manufacturer;
        address currentCustodian;
        address pendingRecipient;
        Role pendingRecipientRole;
        Role pendingSenderRole;
        Stage stage;
        bool sold;
        bool recalled;
        bool exists;
        ProductHistory[] history;
    }

    struct ProductHistory {
        uint256 id;
        string actor;
        address actorWallet;
        string location;
        string timestamp;
        Action action;
        address recipientWallet;
        Role actorRole;
    }

    mapping(string => Product) private products;

    event ProductRegistered(string indexed serialNumber, string name, string brand, address indexed manufacturer);
    event CustodyEvent(string indexed serialNumber, uint256 indexed historyId, Action action, address indexed actor, address recipient);
    event ProductRecalled(string indexed serialNumber, address indexed caller, string reason);
    event RoleGranted(address indexed account, Role role);
    event RoleRevoked(address indexed account, Role role);
    event BusinessNameSet(address indexed account, string businessName);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event RoleReplaced(address indexed previousWallet, address indexed newWallet, Role role);

    modifier onlyOwner() { require(msg.sender == owner, "IdenteefiV3: caller is not the owner"); _; }
    modifier onlyRole(Role role) { require(roles[_callerWallet()] == role, "IdenteefiV3: unauthorized role"); _; }

    constructor() {
        owner = msg.sender;
        roles[msg.sender] = Role.Admin;
        businessNames[msg.sender] = "SmartScan Admin";
        emit OwnershipTransferred(address(0), msg.sender);
        emit RoleGranted(msg.sender, Role.Admin);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0) && newOwner != owner, "IdenteefiV3: invalid owner");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "IdenteefiV3: caller is not pending owner");
        address previousOwner = owner;
        Role previousRole = roles[previousOwner];
        owner = msg.sender;
        pendingOwner = address(0);
        roles[previousOwner] = Role.None;
        delete businessNames[previousOwner];
        emit RoleRevoked(previousOwner, previousRole);
        roles[msg.sender] = Role.Admin;
        businessNames[msg.sender] = "SmartScan Admin";
        emit RoleGranted(msg.sender, Role.Admin);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    function grantRole(address account, Role role, string calldata businessName) external onlyOwner {
        require(walletSuccessor[account] == address(0), "IdenteefiV3: retired wallet");
        require(account != address(0) && role != Role.None, "IdenteefiV3: invalid role grant");
        require(roles[account] == Role.None, "IdenteefiV3: wallet already has a role; use replaceRole");
        require(bytes(businessName).length > 0 && bytes(businessName).length <= 100, "IdenteefiV3: business name must be 1-100 bytes");
        roles[account] = role;
        businessNames[account] = businessName;
        emit BusinessNameSet(account, businessName);
        emit RoleGranted(account, role);
    }

    function revokeRole(address account) external onlyOwner {
        Role previous = roles[account];
        require(account != owner, "IdenteefiV3: cannot revoke owner");
        require(previous != Role.None, "IdenteefiV3: wallet has no role");
        credentialEpoch[account]++;
        roles[account] = Role.None;
        delete businessNames[account];
        emit RoleRevoked(account, previous);
    }

    /// @notice Atomically revokes an organization's old wallet and transfers its role to a proven replacement.
    /// @dev Existing product custody references resolve through walletSuccessor without rewriting history.
    function replaceRole(address oldWallet, address newWallet, string calldata businessName) external onlyOwner {
        Role previousRole = roles[oldWallet];
        require(oldWallet != address(0) && oldWallet != owner, "IdenteefiV3: invalid old wallet");
        require(newWallet != address(0) && newWallet != oldWallet, "IdenteefiV3: invalid new wallet");
        require(previousRole != Role.None && roles[newWallet] == Role.None, "IdenteefiV3: wallet role conflict");
        require(walletSuccessor[newWallet] == address(0), "IdenteefiV3: replacement wallet already retired");
        require(bytes(businessName).length > 0 && bytes(businessName).length <= 100, "IdenteefiV3: business name must be 1-100 bytes");

        credentialEpoch[oldWallet]++;
        roles[oldWallet] = Role.None;
        delete businessNames[oldWallet];
        roles[newWallet] = previousRole;
        businessNames[newWallet] = businessName;
        walletSuccessor[oldWallet] = newWallet;
        emit RoleRevoked(oldWallet, previousRole);
        emit BusinessNameSet(newWallet, businessName);
        emit RoleGranted(newWallet, previousRole);
        emit RoleReplaced(oldWallet, newWallet, previousRole);
    }

    function _callerWallet() internal view returns (address) {
        // Authorization must use the immediate caller. tx.origin would let an
        // intermediary contract inherit the role of the wallet that called it.
        return msg.sender;
    }

    /// @dev The final timestamp argument is retained for ABI compatibility; history uses block.timestamp.
    function registerProduct(
        string memory name_, string memory brand_, string memory serialNumber_,
        string memory description_, string memory image_, string memory actor_,
        string memory location_, string memory
    ) external onlyRole(Role.Manufacturer) {
        require(_validIdentifier(serialNumber_), "IdenteefiV3: invalid product identifier");
        require(!products[serialNumber_].exists, "IdenteefiV3: product already registered");
        require(bytes(name_).length > 0 && bytes(name_).length <= 100, "IdenteefiV3: product name must be 1-100 bytes");
        require(bytes(brand_).length > 0 && bytes(brand_).length <= 100, "IdenteefiV3: brand must be 1-100 bytes");
        require(bytes(description_).length <= 1000, "IdenteefiV3: description exceeds 1000 bytes");
        require(bytes(image_).length <= 200, "IdenteefiV3: image reference exceeds 200 bytes");
        require(bytes(location_).length <= 200, "IdenteefiV3: location exceeds 200 bytes");
        address caller = _callerWallet();
        Product storage p = products[serialNumber_];
        p.name = name_;
        p.brand = brand_;
        p.serialNumber = serialNumber_;
        p.description = description_;
        p.image = image_;
        p.manufacturer = caller;
        p.currentCustodian = caller;
        p.stage = Stage.Manufactured;
        p.sold = false;
        p.recalled = false;
        p.exists = true;
        _append(p, serialNumber_, actor_, location_, _blockTimestampString(), Action.Manufactured, address(0));
        emit ProductRegistered(serialNumber_, name_, brand_, caller);
    }

    uint256 public constant PROTOCOL_VERSION = 3;
    mapping(address => uint256) public credentialEpoch;
    mapping(string => uint256) public authorizationEpoch;
    mapping(bytes32 => bool) public consumed;
    struct Transfer {
        bytes32 serialHash;
        address sender;
        address receiver;
        uint256 version;
        bytes32 nonce;
        uint256 deadline;
        uint256 senderEpoch;
        uint256 receiverEpoch;
        uint256 authorizationEpoch;
    }
    bytes32 private constant TRANSFER_TYPEHASH = keccak256("Transfer(bytes32 serialHash,address sender,address receiver,uint256 version,bytes32 nonce,uint256 deadline,uint256 senderEpoch,uint256 receiverEpoch,uint256 authorizationEpoch)");
    event AuthorizationInvalidated(string indexed serialNumber, uint256 epoch);
    event ReceiptAuthorized(bytes32 indexed nonce, address indexed sender, address indexed receiver, uint256 version);

    function domainSeparator() public view returns(bytes32) {
        return keccak256(abi.encode(keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"), keccak256("SmartScanReceipt"), keccak256("3"), block.chainid, address(this)));
    }
    function transferDigest(Transfer calldata permit) public view returns(bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), keccak256(abi.encode(TRANSFER_TYPEHASH, permit))));
    }
    /// @notice Exceptional on-chain cancellation. A database cancellation alone cannot revoke a signature.
    function invalidateAuthorizations(string calldata serialNumber) external {
        Product storage p = products[serialNumber];
        require(p.exists && msg.sender == _effectiveWallet(p.currentCustodian), "IdenteefiV3: not custodian");
        authorizationEpoch[serialNumber]++;
        emit AuthorizationInvalidated(serialNumber, authorizationEpoch[serialNumber]);
    }
    /// @notice Sender signs off-chain; only the bound receiver submits this one handover transaction.
    function confirmReceipt(string calldata serialNumber, Transfer calldata permit, bytes calldata signature, string calldata location) external {
        Product storage p = products[serialNumber];
        require(p.exists && !p.sold && !p.recalled, "IdenteefiV3: product closed or missing");
        require(p.stage == Stage.Manufactured || p.stage == Stage.Delivered, "IdenteefiV3: invalid stage");
        require(permit.serialHash == keccak256(bytes(serialNumber)) && permit.version == p.history.length, "IdenteefiV3: subject or version mismatch");
        require(permit.sender == _effectiveWallet(p.currentCustodian) && permit.receiver == msg.sender && permit.sender != msg.sender, "IdenteefiV3: sender or receiver mismatch");
        Role senderRole = roles[permit.sender];
        Role receiverRole = roles[msg.sender];
        require((senderRole == Role.Manufacturer && receiverRole == Role.Supplier) || (senderRole == Role.Supplier && (receiverRole == Role.Supplier || receiverRole == Role.Retailer)), "IdenteefiV3: invalid custody transition");
        require(permit.senderEpoch == credentialEpoch[permit.sender] && permit.receiverEpoch == credentialEpoch[msg.sender] && permit.authorizationEpoch == authorizationEpoch[serialNumber], "IdenteefiV3: authorization revoked");
        require(block.timestamp <= permit.deadline && permit.deadline <= block.timestamp + 15 minutes, "IdenteefiV3: authorization expired or too long");
        require(!consumed[permit.nonce] && permit.nonce != bytes32(0), "IdenteefiV3: authorization used");
        require(signature.length == 65, "IdenteefiV3: invalid signature");
        bytes32 r; bytes32 s; uint8 v;
        assembly { r := calldataload(signature.offset) s := calldataload(add(signature.offset,32)) v := byte(0,calldataload(add(signature.offset,64))) }
        require(uint256(s) <= 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0 && (v == 27 || v == 28), "IdenteefiV3: invalid signature");
        require(ecrecover(transferDigest(permit),v,r,s) == permit.sender, "IdenteefiV3: invalid signature");
        require(bytes(location).length <= 200, "IdenteefiV3: location exceeds 200 bytes");
        consumed[permit.nonce] = true;
        p.currentCustodian = msg.sender;
        p.stage = Stage.Delivered;
        _append(p,serialNumber,"",location,_blockTimestampString(),Action.Delivered,address(0));
        emit ReceiptAuthorized(permit.nonce,permit.sender,msg.sender,permit.version);
    }

    /// @dev The final timestamp argument is retained for ABI compatibility; history uses block.timestamp.
    function markSold(string memory serialNumber_, string memory actor_, string memory location_, string memory) external onlyRole(Role.Retailer) {
        require(bytes(location_).length <= 200, "IdenteefiV3: location exceeds 200 bytes");
        Product storage p = products[serialNumber_];
        require(p.exists, "IdenteefiV3: product does not exist");
        require(p.stage == Stage.Delivered, "IdenteefiV3: product is not available for sale");
        address caller = _callerWallet();
        require(caller == _effectiveWallet(p.currentCustodian), "IdenteefiV3: caller is not current custodian");
        p.stage = Stage.Sold;
        p.sold = true;
        _append(p, serialNumber_, actor_, location_, _blockTimestampString(), Action.Sold, address(0));
    }

    /// @dev The final timestamp argument is retained for ABI compatibility; history uses block.timestamp.
    function recallProduct(string memory serialNumber_, string memory reason_, string memory actor_, string memory location_, string memory) external {
        require(bytes(reason_).length > 0 && bytes(reason_).length <= 500, "IdenteefiV3: recall reason must be 1-500 bytes");
        require(bytes(location_).length <= 200, "IdenteefiV3: location exceeds 200 bytes");
        Product storage p = products[serialNumber_];
        require(p.exists, "IdenteefiV3: product does not exist");
        address caller = _callerWallet();
        require(roles[caller] == Role.Admin || (roles[caller] == Role.Manufacturer && caller == _effectiveWallet(p.manufacturer)), "IdenteefiV3: recall not authorized");
        require(p.stage != Stage.Recalled, "IdenteefiV3: already recalled");
        p.stage = Stage.Recalled;
        p.recalled = true;
        _append(p, serialNumber_, actor_, location_, _blockTimestampString(), Action.Recalled, address(0));
        emit ProductRecalled(serialNumber_, caller, reason_);
    }

    function _append(Product storage p, string memory serialNumber_, string memory actor_, string memory location_, string memory timestamp_, Action action_, address recipient_) private {
        address caller = _callerWallet();
        require(bytes(businessNames[caller]).length > 0, "IdenteefiV3: wallet has no registered business name");
        uint256 id = p.history.length + 1;
        actor_ = businessNames[caller];
        p.history.push(ProductHistory(id, actor_, caller, location_, timestamp_, action_, recipient_, roles[caller]));
        emit CustodyEvent(serialNumber_, id, action_, caller, recipient_);
    }

    function _validIdentifier(string memory identifier) private pure returns (bool) {
        bytes memory value = bytes(identifier);
        if (value.length != 39 || value[0] != "S" || value[1] != "S" || value[2] != "-") return false;
        for (uint256 i = 3; i < value.length; i++) {
            if (i == 11 || i == 16 || i == 21 || i == 26) {
                if (value[i] != "-") return false;
            } else {
                bytes1 c = value[i];
                bool hexChar = (c >= "0" && c <= "9") || (c >= "a" && c <= "f") || (c >= "A" && c <= "F");
                if (!hexChar) return false;
            }
        }
        return true;
    }

    function _blockTimestampString() private view returns (string memory) {
        uint256 value = block.timestamp;
        uint256 digits = 1;
        uint256 remaining = value;
        while (remaining >= 10) {
            remaining /= 10;
            digits++;
        }
        bytes memory buffer = new bytes(digits);
        while (digits > 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function getProduct(string memory serialNumber_) external view returns (
        string memory, string memory, string memory, string memory, string memory,
        ProductHistory[] memory, Stage, address, address, bool, bool
    ) {
        Product storage p = products[serialNumber_];
        return (
            p.serialNumber, p.name, p.brand, p.description, p.image, p.history,
            p.stage, _effectiveWallet(p.currentCustodian), _effectiveWallet(p.pendingRecipient), p.sold, p.recalled
        );
    }

    function getProductState(string memory serialNumber_) external view returns (Stage, address, address, bool, bool) {
        Product storage p = products[serialNumber_];
        return (p.stage, _effectiveWallet(p.currentCustodian), _effectiveWallet(p.pendingRecipient), p.sold, p.recalled);
    }

    function productExists(string memory serialNumber_) external view returns (bool) { return products[serialNumber_].exists; }

    function _effectiveWallet(address wallet) private view returns (address) {
        address successor = walletSuccessor[wallet];
        while (successor != address(0)) {
            wallet = successor;
            successor = walletSuccessor[wallet];
        }
        return wallet;
    }
}
