import { expect } from "chai";
import { validateOwnershipConfig, validateSafeMetadata } from "../scripts/ownership-admin-validation.js";

const contract = "0x0000000000000000000000000000000000000002";
const pendingOwner = "0x0000000000000000000000000000000000000001";
const config = {
  OWNER_ACTION: "propose",
  CONTRACT_ADDRESS: contract,
  OWNER_ADDRESS: pendingOwner,
  OWNER_CONFIRMATION: `propose:${pendingOwner}`,
};

describe("ownership administration validation", function () {
  it("accepts a deliberate proposal on a supported chain", function () {
    expect(validateOwnershipConfig(config, "mainnet")).to.include({
      action: "propose", contractAddress: contract, ownerAddress: pendingOwner, expectedChainId: 1,
    });
  });

  it("accepts the distinct Safe acceptance preparation action", function () {
    expect(validateOwnershipConfig({ ...config, OWNER_ACTION: "prepare-safe-accept", OWNER_CONFIRMATION: `prepare-safe-accept:${pendingOwner}` }, "sepolia").action)
      .to.equal("prepare-safe-accept");
  });

  it("rejects malformed actions, unsupported networks, and unconfirmed changes", function () {
    expect(() => validateOwnershipConfig({ ...config, OWNER_ACTION: "transfer" }, "sepolia")).to.throw("OWNER_ACTION");
    expect(() => validateOwnershipConfig(config, "unknown")).to.throw("Unsupported or missing network");
    expect(() => validateOwnershipConfig({ ...config, OWNER_CONFIRMATION: "" }, "sepolia")).to.throw("OWNER_CONFIRMATION");
  });

  it("rejects zero, malformed, or overlapping addresses", function () {
    expect(() => validateOwnershipConfig({ ...config, OWNER_ADDRESS: "0x0000000000000000000000000000000000000000" }, "sepolia")).to.throw("OWNER_ADDRESS");
    expect(() => validateOwnershipConfig({ ...config, OWNER_ADDRESS: "bad" }, "sepolia")).to.throw("OWNER_ADDRESS");
    expect(() => validateOwnershipConfig({ ...config, OWNER_ADDRESS: contract, OWNER_CONFIRMATION: `propose:${contract}` }, "sepolia")).to.throw("must differ");
    expect(() => validateOwnershipConfig({ ...config, CONTRACT_ADDRESS: "bad" }, "sepolia")).to.throw("CONTRACT_ADDRESS");
  });

  it("validates Safe owner membership and threshold before accepting it as contract owner", function () {
    expect(validateSafeMetadata([pendingOwner, contract], 2)).to.deep.equal({ owners: [pendingOwner, contract], threshold: 2 });
    expect(() => validateSafeMetadata([], 0)).to.throw("non-empty list");
    expect(() => validateSafeMetadata([pendingOwner, pendingOwner], 1)).to.throw("duplicate");
    expect(() => validateSafeMetadata([pendingOwner], 2)).to.throw("threshold");
  });

  it("requires an explicitly configured chain id for the production network", function () {
    const production = { ...config, PRODUCTION_CHAIN_ID: "8453" };
    expect(validateOwnershipConfig(production, "production").expectedChainId).to.equal(8453);
    expect(() => validateOwnershipConfig(config, "production")).to.throw("configure the production network");
  });
});
