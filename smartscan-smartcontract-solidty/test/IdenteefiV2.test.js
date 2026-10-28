import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.getOrCreate();

describe("IdenteefiV2", function () {
  let contract;
  let owner;
  let manufacturer;
  let supplier;
  let retailer;
  let replacement;

  const serial = "SS-00000000-0000-0000-0000-000000000001";
  const timestamp = "2026-10-20T00:00:00Z";

  beforeEach(async function () {
    [owner, manufacturer, supplier, retailer, replacement] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("IdenteefiV2");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
    await contract.grantRole(manufacturer.address, 2, "Acme Manufacturing");
    await contract.grantRole(supplier.address, 3, "Acme Supply");
    await contract.grantRole(retailer.address, 4, "Acme Retail");
  });

  async function register(id = serial) {
    return contract.connect(manufacturer).registerProduct("Widget", "Acme", id, "Test widget", "widget.png", "untrusted text", "Lagos", timestamp);
  }

  it("assigns the deployer as owner and admin", async function () {
    expect(await contract.owner()).to.equal(owner.address);
    expect(await contract.roles(owner.address)).to.equal(1);
  });

  it("registers a unique product with wallet-bound history and current state", async function () {
    const tx = await register();
    await expect(tx).to.emit(contract, "ProductRegistered").withArgs(serial, "Widget", "Acme", manufacturer.address);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    const product = await contract.getProduct(serial);
    expect(product[5]).to.have.length(1);
    expect(product[5][0].actor).to.equal("Acme Manufacturing");
    expect(product[5][0].actorWallet).to.equal(manufacturer.address);
    expect(product[5][0].actorRole).to.equal(2);
    expect(product[5][0].timestamp).to.equal(String(block.timestamp));
    expect(product[6]).to.equal(1); // Manufactured
    expect(product[7]).to.equal(manufacturer.address);
    expect(product[9]).to.equal(false);
  });

  it("rejects malformed and duplicate identifiers", async function () {
    await expect(register("bad-id")).to.be.revertedWith("IdenteefiV2: invalid product identifier");
    await register();
    await expect(register()).to.be.revertedWith("IdenteefiV2: product already registered");
  });

  it("rejects oversized product metadata before storing it", async function () {
    await expect(contract.connect(manufacturer).registerProduct("x".repeat(101), "Acme", serial, "", "", "", "", timestamp))
      .to.be.revertedWith("IdenteefiV2: product name must be 1-100 bytes");
    await expect(contract.connect(manufacturer).registerProduct("Widget", "Acme", serial, "x".repeat(1001), "", "", "", timestamp))
      .to.be.revertedWith("IdenteefiV2: description exceeds 1000 bytes");
  });

  it("rejects oversized on-chain business identity names", async function () {
    await expect(contract.grantRole(replacement.address, 2, "x".repeat(101)))
      .to.be.revertedWith("IdenteefiV2: business name must be 1-100 bytes");
  });

  it("rejects oversized custody locations and recall reasons", async function () {
    await register();
    await expect(contract.connect(manufacturer).dispatchProduct(serial, supplier.address, "", "x".repeat(201), timestamp))
      .to.be.revertedWith("IdenteefiV2: location exceeds 200 bytes");
    await expect(contract.recallProduct(serial, "x".repeat(501), "", "", timestamp))
      .to.be.revertedWith("IdenteefiV2: recall reason must be 1-500 bytes");
  });

  it("does not authorize a wallet without the manufacturer role", async function () {
    await expect(contract.connect(replacement).registerProduct("Widget", "Acme", serial, "", "", "", "", timestamp))
      .to.be.revertedWith("IdenteefiV2: unauthorized role");
  });

  it("allows open dispatch and lets an eligible registered receiver claim custody", async function () {
    await register();
    await expect(contract.connect(manufacturer).confirmDelivery(serial, "", "", timestamp))
      .to.be.revertedWith("IdenteefiV2: product was not dispatched");
    const dispatch = await contract.connect(manufacturer).dispatchProduct(serial, ethers.ZeroAddress, "", "Lagos", "2099-01-01T00:00:00Z");
    const dispatchReceipt = await dispatch.wait();
    const dispatchBlock = await ethers.provider.getBlock(dispatchReceipt.blockNumber);
    let state = await contract.getProductState(serial);
    expect(state[0]).to.equal(2); // Dispatched
    expect(state[1]).to.equal(manufacturer.address); // Last confirmed custodian until receipt
    expect(state[2]).to.equal(ethers.ZeroAddress); // No specific receiver was known
    await contract.connect(supplier).confirmDelivery(serial, "", "Abuja", timestamp);
    state = await contract.getProductState(serial);
    expect(state[0]).to.equal(3); // Delivered
    expect(state[1]).to.equal(supplier.address);
    expect((await contract.getProduct(serial))[5][1].timestamp).to.equal(String(dispatchBlock.timestamp));
    await contract.grantRole(replacement.address, 3, "Second Supplier");
    await contract.connect(supplier).dispatchProduct(serial, ethers.ZeroAddress, "", "Abuja", timestamp);
    await expect(contract.connect(supplier).confirmDelivery(serial, "", "Abuja", timestamp))
      .to.be.revertedWith("IdenteefiV2: caller is current custodian");
    await contract.connect(replacement).confirmDelivery(serial, "", "Kano", timestamp);
    expect((await contract.getProductState(serial))[1]).to.equal(replacement.address);
    await contract.connect(replacement).dispatchProduct(serial, ethers.ZeroAddress, "", "Kano", timestamp);
    await contract.connect(retailer).confirmDelivery(serial, "", "Lagos", timestamp);
    await contract.connect(retailer).markSold(serial, "", "Kano", timestamp);
    state = await contract.getProductState(serial);
    expect(state[0]).to.equal(4); // Sold
    expect(state[1]).to.equal(retailer.address);
    expect(state[3]).to.equal(true);
    expect((await contract.getProduct(serial))[5]).to.have.length(8);
  });

  it("does not allow an unregistered or ineligible role to claim an open dispatch", async function () {
    await register();
    await contract.connect(manufacturer).dispatchProduct(serial, ethers.ZeroAddress, "", "", timestamp);
    await expect(contract.connect(retailer).confirmDelivery(serial, "", "", timestamp))
      .to.be.revertedWith("IdenteefiV2: recipient role is not authorized");
    await expect(contract.connect(replacement).confirmDelivery(serial, "", "", timestamp))
      .to.be.revertedWith("IdenteefiV2: recipient role is not authorized");
    await contract.connect(supplier).confirmDelivery(serial, "", "", timestamp);
  });

  it("records recalls as a persistent verification warning", async function () {
    await register();
    await contract.recallProduct(serial, "investigation", "", "Lagos", timestamp);
    const state = await contract.getProductState(serial);
    expect(state[0]).to.equal(5);
    expect(state[4]).to.equal(true);
    await expect(contract.connect(manufacturer).dispatchProduct(serial, supplier.address, "", "", timestamp))
      .to.be.revertedWith("IdenteefiV2: product is closed");
  });

  it("replaces wallet roles atomically and resolves historical custody", async function () {
    await register();
    await contract.replaceRole(manufacturer.address, replacement.address, "Acme Manufacturing New Wallet");
    expect(await contract.roles(manufacturer.address)).to.equal(0);
    expect(await contract.roles(replacement.address)).to.equal(2);
    expect(await contract.getProductState(serial).then((s) => s[1])).to.equal(replacement.address);
    await expect(contract.connect(manufacturer).dispatchProduct(serial, supplier.address, "", "", timestamp))
      .to.be.revertedWith("IdenteefiV2: caller is not current custodian");
    await contract.connect(replacement).dispatchProduct(serial, supplier.address, "", "", timestamp);
  });

  it("requires the proposed owner to accept a two-step ownership transfer", async function () {
    await expect(contract.connect(replacement).transferOwnership(replacement.address)).to.be.revertedWith("IdenteefiV2: caller is not the owner");
    await expect(contract.transferOwnership(replacement.address)).to.emit(contract, "OwnershipTransferStarted").withArgs(owner.address, replacement.address);
    expect(await contract.owner()).to.equal(owner.address);
    await expect(contract.connect(owner).acceptOwnership()).to.be.revertedWith("IdenteefiV2: caller is not pending owner");
    await expect(contract.connect(replacement).acceptOwnership()).to.emit(contract, "OwnershipTransferred").withArgs(owner.address, replacement.address);
    expect(await contract.owner()).to.equal(replacement.address);
    expect(await contract.roles(owner.address)).to.equal(0);
    expect(await contract.roles(replacement.address)).to.equal(1);
  });
});
