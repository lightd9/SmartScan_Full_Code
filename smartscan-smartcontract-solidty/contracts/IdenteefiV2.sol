// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract IdenteefiV2 {
    enum Role { None, Admin, Manufacturer, Supplier, Retailer }
    address public owner;
    mapping(address => Role) public roles;

    struct Product { string name; string serialNumber; string description; string brand; string image; mapping(uint256 => ProductHistory) history; uint256 historySize; bool exists; }
    struct ProductHistory { uint256 id; string actor; string location; string timestamp; bool isSold; }
    mapping(string => Product) private products;

    event ProductRegistered(string indexed serialNumber, string name, string brand, address indexed manufacturer);
    event ProductHistoryAdded(string indexed serialNumber, uint256 historyId, string actor, bool isSold, address indexed reporter);
    event RoleGranted(address indexed account, Role role);
    event RoleRevoked(address indexed account, Role role);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() { require(msg.sender == owner, "IdenteefiV2: caller is not the owner"); _; }
    modifier onlyRole(Role role) { require(roles[msg.sender] == role || roles[msg.sender] == Role.Admin, "IdenteefiV2: unauthorized role"); _; }
    modifier onlySupplyChainRole() { Role role = roles[msg.sender]; require(role == Role.Admin || role == Role.Manufacturer || role == Role.Supplier || role == Role.Retailer, "IdenteefiV2: unauthorized role"); _; }

    constructor() { owner = msg.sender; roles[msg.sender] = Role.Admin; emit OwnershipTransferred(address(0), msg.sender); emit RoleGranted(msg.sender, Role.Admin); }

    function transferOwnership(address newOwner) external onlyOwner { require(newOwner != address(0), "IdenteefiV2: new owner is the zero address"); emit OwnershipTransferred(owner, newOwner); owner = newOwner; roles[newOwner] = Role.Admin; emit RoleGranted(newOwner, Role.Admin); }
    function grantRole(address account, Role role) external onlyOwner { require(account != address(0), "IdenteefiV2: zero account"); require(role != Role.None, "IdenteefiV2: invalid role"); roles[account] = role; emit RoleGranted(account, role); }
    function revokeRole(address account) external onlyOwner { Role previous = roles[account]; roles[account] = Role.None; emit RoleRevoked(account, previous); }

    function registerProduct(string memory _name, string memory _brand, string memory _serialNumber, string memory _description, string memory _image, string memory _actor, string memory _location, string memory _timestamp) external onlyRole(Role.Manufacturer) {
        require(bytes(_serialNumber).length > 0, "IdenteefiV2: serial number required"); require(!products[_serialNumber].exists, "IdenteefiV2: product already registered");
        Product storage p = products[_serialNumber]; p.name = _name; p.brand = _brand; p.serialNumber = _serialNumber; p.description = _description; p.image = _image; p.exists = true;
        emit ProductRegistered(_serialNumber, _name, _brand, msg.sender); _addProductHistory(_serialNumber, _actor, _location, _timestamp, false);
    }

    function addProductHistory(string memory _serialNumber, string memory _actor, string memory _location, string memory _timestamp, bool _isSold) external onlySupplyChainRole {
        require(products[_serialNumber].exists, "IdenteefiV2: product does not exist");
        if (_isSold) require(roles[msg.sender] == Role.Retailer || roles[msg.sender] == Role.Admin, "IdenteefiV2: only retailer can mark sold");
        _addProductHistory(_serialNumber, _actor, _location, _timestamp, _isSold);
    }

    function _addProductHistory(string memory _serialNumber, string memory _actor, string memory _location, string memory _timestamp, bool _isSold) private { Product storage p = products[_serialNumber]; p.historySize++; p.history[p.historySize] = ProductHistory(p.historySize, _actor, _location, _timestamp, _isSold); emit ProductHistoryAdded(_serialNumber, p.historySize, _actor, _isSold, msg.sender); }
    function getProduct(string memory _serialNumber) external view returns (string memory, string memory, string memory, string memory, string memory, ProductHistory[] memory) { Product storage p = products[_serialNumber]; ProductHistory[] memory result = new ProductHistory[](p.historySize); for (uint256 i = 0; i < p.historySize; i++) result[i] = p.history[i + 1]; return (p.serialNumber, p.name, p.brand, p.description, p.image, result); }
    function productExists(string memory _serialNumber) external view returns (bool) { return products[_serialNumber].exists; }
}
