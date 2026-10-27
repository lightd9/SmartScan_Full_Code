import { expect } from "chai";
import { validateInitialAssignments } from "../scripts/deployment-validation.js";

const owner = "0x0000000000000000000000000000000000000001";
const participant = "0x0000000000000000000000000000000000000002";

describe("deployment configuration validation", function () {
  it("rejects an initial participant that is already the deployment owner", function () {
    expect(() => validateInitialAssignments([
      { address: owner, name: "Owner", role: 2, roleName: "manufacturer" },
    ], owner)).to.throw("must differ from the deployment owner");
  });

  it("returns normalized, trimmed assignments", function () {
    const result = validateInitialAssignments([
      { address: participant, name: "  Example Manufacturer  ", role: 2, roleName: "manufacturer" },
    ], owner);
    expect(result[0].address).to.equal(participant);
    expect(result[0].name).to.equal("Example Manufacturer");
  });
});
