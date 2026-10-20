const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IdenteefiV2", function () {
  let contract;
  let owner;
  let other;

  const sample = {
    name: "Widget",
    brand: "Acme",
    serialNumber: "SN-001",
    description: "A test widget",
    image: "widget.png",
    actor: "Acme Manufacturing",
    location: "Kuala Lumpur",
    timestamp: "1700000000",
  };

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("IdenteefiV2");
    contract = await Factory.deploy();
    await contract.deployed();
  });

  async function register(serialNumber = sample.serialNumber) {
    return contract.registerProduct(
      sample.name,
      sample.brand,
      serialNumber,
      sample.description,
      sample.image,
      sample.actor,
      sample.location,
      sample.timestamp
    );
  }

  it("sets the deployer as owner", async function () {
    expect(await contract.owner()).to.equal(owner.address);
  });

  it("registers a product and exposes it via getProduct", async function () {
    await expect(register())
      .to.emit(contract, "ProductRegistered")
      .withArgs(sample.serialNumber, sample.name, sample.brand, owner.address);

    const product = await contract.getProduct(sample.serialNumber);
    expect(product[0]).to.equal(sample.serialNumber);
    expect(product[1]).to.equal(sample.name);
    expect(product[2]).to.equal(sample.brand);
    expect(product[3]).to.equal(sample.description);
    expect(product[4]).to.equal(sample.image);
    expect(product[5].length).to.equal(1);
    expect(product[5][0].actor).to.equal(sample.actor);
  });

  it("reports productExists accurately", async function () {
    expect(await contract.productExists(sample.serialNumber)).to.equal(false);
    await register();
    expect(await contract.productExists(sample.serialNumber)).to.equal(true);
  });

  it("reverts when registering a duplicate serial number", async function () {
    await register();
    await expect(register()).to.be.revertedWith("IdenteefiV2: product already registered");
  });

  it("reverts when registering with an empty serial number", async function () {
    await expect(register("")).to.be.revertedWith("IdenteefiV2: serial number required");
  });

  it("blocks non-owners from registering products", async function () {
    await expect(
      contract.connect(other).registerProduct(
        sample.name,
        sample.brand,
        "SN-OWNER",
        sample.description,
        sample.image,
        sample.actor,
        sample.location,
        sample.timestamp
      )
    ).to.be.revertedWith("IdenteefiV2: unauthorized role");
  });

  it("appends history to an existing product", async function () {
    await register();
    await expect(
      contract.addProductHistory("SN-001", "Retailer", "Penang", "1700000100", true)
    )
      .to.emit(contract, "ProductHistoryAdded")
      .withArgs("SN-001", 2, "Retailer", true, owner.address);

    const product = await contract.getProduct("SN-001");
    expect(product[5].length).to.equal(2);
    expect(product[5][1].actor).to.equal("Retailer");
    expect(product[5][1].isSold).to.equal(true);
  });

  it("reverts when adding history to an unknown product", async function () {
    await expect(
      contract.addProductHistory("UNKNOWN", "Retailer", "Penang", "1700000100", false)
    ).to.be.revertedWith("IdenteefiV2: product does not exist");
  });

  it("blocks non-owners from adding history", async function () {
    await register();
    await expect(
      contract.connect(other).addProductHistory("SN-001", "Retailer", "Penang", "1700000100", false)
    ).to.be.revertedWith("IdenteefiV2: unauthorized role");
  });

  it("transfers ownership only from the current owner", async function () {
    await expect(contract.connect(other).transferOwnership(other.address)).to.be.revertedWith(
      "IdenteefiV2: caller is not the owner"
    );

    await expect(contract.transferOwnership(other.address))
      .to.emit(contract, "OwnershipTransferred")
      .withArgs(owner.address, other.address);

    expect(await contract.owner()).to.equal(other.address);
  });

  it("allows only assigned supply-chain roles to write", async function () {
    await contract.grantRole(other.address, 2); // Manufacturer
    await expect(contract.connect(other).registerProduct(
      sample.name, sample.brand, "SN-ROLE", sample.description, sample.image,
      sample.actor, sample.location, sample.timestamp
    )).to.emit(contract, "ProductRegistered");

    await contract.grantRole(other.address, 3); // Supplier
    await expect(contract.connect(other).addProductHistory(
      "SN-ROLE", "Supplier", "Penang", "1700000100", false
    )).to.emit(contract, "ProductHistoryAdded");

    await expect(contract.connect(other).addProductHistory(
      "SN-ROLE", "Supplier", "Penang", "1700000101", true
    )).to.be.revertedWith("IdenteefiV2: only retailer can mark sold");
  });

  it("allows only retailers to mark products sold", async function () {
    await register();
    await contract.grantRole(other.address, 4); // Retailer
    await expect(contract.connect(other).addProductHistory(
      sample.serialNumber, "Retailer", "Penang", "1700000100", true
    )).to.emit(contract, "ProductHistoryAdded");
  });
});
