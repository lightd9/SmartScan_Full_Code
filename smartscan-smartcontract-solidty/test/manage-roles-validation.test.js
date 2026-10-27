import { expect } from "chai";
import { chainIdForNetwork, validateRoleConfig } from "../scripts/role-admin-validation.js";

const wallet = "0x0000000000000000000000000000000000000001";
const contract = "0x0000000000000000000000000000000000000002";
const valid = {
  ROLE_ACTION: "grant",
  ROLE_NAME: "manufacturer",
  ROLE_ADDRESS: wallet,
  CONTRACT_ADDRESS: contract,
  ROLE_BUSINESS_NAME: "Acme Manufacturing",
  ROLE_CONFIRMATION: `grant:manufacturer:${wallet}`,
};

describe("role-management configuration validation", function () {
  it("accepts a fully confirmed grant on a supported network", function () {
    expect(validateRoleConfig(valid, "sepolia")).to.include({ action: "grant", roleName: "manufacturer", roleId: 2, expectedChainId: 11155111 });
  });

  it("rejects any action other than the exact grant/revoke values", function () {
    expect(() => validateRoleConfig({ ...valid, ROLE_ACTION: "anything" }, "sepolia")).to.throw("ROLE_ACTION must be exactly grant or revoke");
    expect(() => validateRoleConfig({ ...valid, ROLE_ACTION: "Revoke" }, "sepolia")).to.throw("ROLE_ACTION must be exactly grant or revoke");
  });

  it("requires a known role for both grants and revocations", function () {
    expect(() => validateRoleConfig({ ...valid, ROLE_NAME: "" }, "sepolia")).to.throw("ROLE_NAME");
    expect(() => validateRoleConfig({ ...valid, ROLE_ACTION: "revoke", ROLE_NAME: "owner" }, "sepolia")).to.throw("ROLE_NAME");
  });

  it("rejects malformed, zero, or overlapping wallet/contract addresses", function () {
    expect(() => validateRoleConfig({ ...valid, ROLE_ADDRESS: "not-an-address" }, "sepolia")).to.throw("ROLE_ADDRESS");
    expect(() => validateRoleConfig({ ...valid, CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000" }, "sepolia")).to.throw("CONTRACT_ADDRESS");
    expect(() => validateRoleConfig({ ...valid, ROLE_ADDRESS: contract, ROLE_CONFIRMATION: `grant:manufacturer:${contract}` }, "sepolia")).to.throw("must be different");
  });

  it("rejects unsupported networks and missing deliberate confirmation", function () {
    expect(() => validateRoleConfig(valid, "unknown")).to.throw("Unsupported or missing network");
    expect(() => validateRoleConfig({ ...valid, ROLE_CONFIRMATION: "" }, "sepolia")).to.throw("ROLE_CONFIRMATION");
  });

  it("requires the business display name for grants", function () {
    expect(() => validateRoleConfig({ ...valid, ROLE_BUSINESS_NAME: " " }, "sepolia")).to.throw("ROLE_BUSINESS_NAME");
    expect(() => validateRoleConfig({ ...valid, ROLE_BUSINESS_NAME: "é".repeat(51) }, "sepolia")).to.throw("100 UTF-8 bytes");
  });

  it("requires an explicit safe integer chain ID for the configurable production network", function () {
    expect(chainIdForNetwork("production", { PRODUCTION_CHAIN_ID: "8453" })).to.equal(8453);
    expect(chainIdForNetwork("production", { PRODUCTION_CHAIN_ID: "0" })).to.equal(undefined);
    expect(chainIdForNetwork("production", { PRODUCTION_CHAIN_ID: "1.5" })).to.equal(undefined);
    expect(validateRoleConfig({ ...valid, PRODUCTION_CHAIN_ID: "8453" }, "production").expectedChainId).to.equal(8453);
  });
});
