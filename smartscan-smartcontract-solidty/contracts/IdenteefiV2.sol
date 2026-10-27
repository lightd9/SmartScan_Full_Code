// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/// @title SmartScan product identity and custody registry
/// @notice A product's history is append-only and every entry is bound to its writer wallet.
contract IdenteefiV2 {
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

    modifier onlyOwner() { require(msg.sender == owner, "IdenteefiV2: caller is not the owner"); _; }
    modifier onlyRole(Role role) { require(roles[msg.sender] == role, "IdenteefiV2: unauthorized role"); _; }

    constructor() {
        owner = msg.sender;
        roles[msg.sender] = Role.Admin;
        businessNames[msg.sender] = "SmartScan Admin";
        emit OwnershipTransferred(address(0), msg.sender);
        emit RoleGranted(msg.sender, Role.Admin);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0) && newOwner != owner, "IdenteefiV2: invalid owner");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "IdenteefiV2: caller is not pending owner");
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
        require(account != address(0) && role != Role.None, "IdenteefiV2: invalid role grant");
        require(roles[account] == Role.None, "IdenteefiV2: wallet already has a role; use replaceRole");
        require(bytes(businessName).length > 0 && bytes(businessName).length <= 100, "IdenteefiV2: business name must be 1-100 bytes");
        roles[account] = role;
        businessNames[account] = businessName;
        emit BusinessNameSet(account, businessName);
        emit RoleGranted(account, role);
    }

    function revokeRole(address account) external onlyOwner {
        Role previous = roles[account];
        require(account != owner, "IdenteefiV2: cannot revoke owner");
        require(previous != Role.None, "IdenteefiV2: wallet has no role");
        roles[account] = Role.None;
        delete businessNames[account];
        emit RoleRevoked(account, previous);
    }

    /// @notice Atomically revokes an organization's old wallet and transfers its role to a proven replacement.
    /// @dev Existing product custody references resolve through walletSuccessor without rewriting history.
    function replaceRole(address oldWallet, address newWallet, string calldata businessName) external onlyOwner {
        Role previousRole = roles[oldWallet];
        require(oldWallet != address(0) && oldWallet != owner, "IdenteefiV2: invalid old wallet");
        require(newWallet != address(0) && newWallet != oldWallet, "IdenteefiV2: invalid new wallet");
        require(previousRole != Role.None && roles[newWallet] == Role.None, "IdenteefiV2: wallet role conflict");
        require(walletSuccessor[newWallet] == address(0), "IdenteefiV2: replacement wallet already retired");
        require(bytes(businessName).length > 0 && bytes(businessName).length <= 100, "IdenteefiV2: business name must be 1-100 bytes");

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

    /// @dev The final timestamp argument is retained for ABI compatibility; history uses block.timestamp.
    function registerProduct(
        string memory name_, string memory brand_, string memory serialNumber_,
        string memory description_, string memory image_, string memory actor_,
        string memory location_, string memory
    ) external onlyRole(Role.Manufacturer) {
        require(_validIdentifier(serialNumber_), "IdenteefiV2: invalid product identifier");
        require(!products[serialNumber_].exists, "IdenteefiV2: product already registered");
        require(bytes(name_).length > 0 && bytes(name_).length <= 100, "IdenteefiV2: product name must be 1-100 bytes");
        require(bytes(brand_).length > 0 && bytes(brand_).length <= 100, "IdenteefiV2: brand must be 1-100 bytes");
        require(bytes(description_).length <= 1000, "IdenteefiV2: description exceeds 1000 bytes");
        require(bytes(image_).length <= 200, "IdenteefiV2: image reference exceeds 200 bytes");
        require(bytes(location_).length <= 200, "IdenteefiV2: location exceeds 200 bytes");
        Product storage p = products[serialNumber_];
        p.name = name_;
        p.brand = brand_;
        p.serialNumber = serialNumber_;
        p.description = description_;
        p.image = image_;
        p.manufacturer = msg.sender;
        p.currentCustodian = msg.sender;
        p.stage = Stage.Manufactured;
        p.sold = false;
        p.recalled = false;
        p.exists = true;
        _append(p, serialNumber_, actor_, location_, _blockTimestampString(), Action.Manufactured, address(0));
        emit ProductRegistered(serialNumber_, name_, brand_, msg.sender);
    }

    /// @dev The final timestamp argument is retained for ABI compatibility; history uses block.timestamp.
    function dispatchProduct(string memory serialNumber_, address recipient_, string memory actor_, string memory location_, string memory) external {
        require(bytes(location_).length <= 200, "IdenteefiV2: location exceeds 200 bytes");
        Product storage p = products[serialNumber_];
        require(p.exists, "IdenteefiV2: product does not exist");
        require(!p.sold && !p.recalled, "IdenteefiV2: product is closed");
        require(msg.sender == _effectiveWallet(p.currentCustodian), "IdenteefiV2: caller is not current custodian");
        require(recipient_ != address(0) && recipient_ != msg.sender, "IdenteefiV2: invalid recipient");
        Role senderRole = roles[msg.sender];
        Role recipientRole = roles[recipient_];
        require(
            (senderRole == Role.Manufacturer && recipientRole == Role.Supplier) ||
            (senderRole == Role.Supplier && recipientRole == Role.Retailer),
            "IdenteefiV2: invalid custody transition"
        );
        require(p.stage == Stage.Manufactured || p.stage == Stage.Delivered, "IdenteefiV2: dispatch requires delivered custody");
        p.stage = Stage.Dispatched;
        p.pendingRecipient = recipient_;
        p.pendingRecipientRole = recipientRole;
        _append(p, serialNumber_, actor_, location_, _blockTimestampString(), Action.Dispatched, recipient_);
    }

    /// @dev The final timestamp argument is retained for ABI compatibility; history uses block.timestamp.
    function confirmDelivery(string memory serialNumber_, string memory actor_, string memory location_, string memory) external {
        require(bytes(location_).length <= 200, "IdenteefiV2: location exceeds 200 bytes");
        Product storage p = products[serialNumber_];
        require(p.exists, "IdenteefiV2: product does not exist");
        require(p.stage == Stage.Dispatched, "IdenteefiV2: product was not dispatched");
        require(msg.sender == _effectiveWallet(p.pendingRecipient), "IdenteefiV2: caller is not dispatched recipient");
        require(roles[msg.sender] == p.pendingRecipientRole, "IdenteefiV2: recipient role is no longer authorized");
        p.currentCustodian = msg.sender;
        p.pendingRecipient = address(0);
        p.pendingRecipientRole = Role.None;
        p.stage = Stage.Delivered;
        _append(p, serialNumber_, actor_, location_, _blockTimestampString(), Action.Delivered, address(0));
    }

    /// @dev The final timestamp argument is retained for ABI compatibility; history uses block.timestamp.
    function markSold(string memory serialNumber_, string memory actor_, string memory location_, string memory) external onlyRole(Role.Retailer) {
        require(bytes(location_).length <= 200, "IdenteefiV2: location exceeds 200 bytes");
        Product storage p = products[serialNumber_];
        require(p.exists, "IdenteefiV2: product does not exist");
        require(p.stage == Stage.Delivered, "IdenteefiV2: product is not available for sale");
        require(msg.sender == _effectiveWallet(p.currentCustodian), "IdenteefiV2: caller is not current custodian");
        p.stage = Stage.Sold;
        p.sold = true;
        _append(p, serialNumber_, actor_, location_, _blockTimestampString(), Action.Sold, address(0));
    }

    /// @dev The final timestamp argument is retained for ABI compatibility; history uses block.timestamp.
    function recallProduct(string memory serialNumber_, string memory reason_, string memory actor_, string memory location_, string memory) external {
        require(bytes(reason_).length > 0 && bytes(reason_).length <= 500, "IdenteefiV2: recall reason must be 1-500 bytes");
        require(bytes(location_).length <= 200, "IdenteefiV2: location exceeds 200 bytes");
        Product storage p = products[serialNumber_];
        require(p.exists, "IdenteefiV2: product does not exist");
        require(roles[msg.sender] == Role.Admin || msg.sender == _effectiveWallet(p.manufacturer), "IdenteefiV2: recall not authorized");
        require(p.stage != Stage.Recalled, "IdenteefiV2: already recalled");
        p.stage = Stage.Recalled;
        p.recalled = true;
        _append(p, serialNumber_, actor_, location_, _blockTimestampString(), Action.Recalled, address(0));
        emit ProductRecalled(serialNumber_, msg.sender, reason_);
    }

    function _append(Product storage p, string memory serialNumber_, string memory actor_, string memory location_, string memory timestamp_, Action action_, address recipient_) private {
        require(bytes(businessNames[msg.sender]).length > 0, "IdenteefiV2: wallet has no registered business name");
        uint256 id = p.history.length + 1;
        actor_ = businessNames[msg.sender];
        p.history.push(ProductHistory(id, actor_, msg.sender, location_, timestamp_, action_, recipient_, roles[msg.sender]));
        emit CustodyEvent(serialNumber_, id, action_, msg.sender, recipient_);
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
