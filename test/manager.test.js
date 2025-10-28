const { expect } = require("chai");
const { expectRevert, time } = require("@openzeppelin/test-helpers");

const Manager = artifacts.require("Manager");

contract("Manager", (accounts) => {
  const user = accounts[1];

  let manager;

  beforeEach(async () => {
    manager = await Manager.new();
  });

  it("should register a key", async () => {
    const pubKey = "0x1234567890";
    const expiresAt = 0;

    const tx = await manager.registerKey(pubKey, "ed25519", expiresAt, {
      from: user,
    });

    expect(tx.logs[0].event).to.equal("KeyRegistered");

    const count = await manager.getHistoryCount(user);
    expect(count.toNumber()).to.equal(1);

    const key = await manager.getKey(user, 0);
    expect(key.publicKey).to.equal(pubKey);
    expect(key.revoked).to.equal(false);
  });

  it("should rotate a key and add history", async () => {
    const pubKey1 = "0xaaaa";
    const pubKey2 = "0xbbbb";

    await manager.registerKey(pubKey1, "ed25519", 0, { from: user });

    const tx = await manager.rotateKey(pubKey2, "rsa", 0, { from: user });
    expect(tx.logs[0].event).to.equal("KeyRotated");

    const count = await manager.getHistoryCount(user);
    expect(count.toNumber()).to.equal(2);

    const active = await manager.getActiveKey(user);
    expect(active.publicKey).to.equal(pubKey2);
  });

  it("should revoke a key", async () => {
    const pubKey = "0x1122";
    await manager.registerKey(pubKey, "ed25519", 0, { from: user });

    const tx = await manager.revokeKey(0, { from: user });
    expect(tx.logs[0].event).to.equal("KeyRevoked");

    const key = await manager.getKey(user, 0);
    expect(key.revoked).to.equal(true);

    const active = await manager.getActiveKey(user);
    expect(active.found).to.equal(false);
  });

  it("should return the most recent non-revoked key as active", async () => {
    const k1 = "0xaaaa";
    const k2 = "0xbbbb";

    await manager.registerKey(k1, "ed25519", 0, { from: user });
    await manager.registerKey(k2, "rsa", 0, { from: user });

    await manager.revokeKey(1, { from: user });

    const active = await manager.getActiveKey(user);
    expect(active.publicKey).to.equal(k1);
  });

  it("should ignore expired keys", async () => {
    const now = await time.latest();
    const expiredTime = now.toNumber() - 100;
    const futureTime = now.toNumber() + 3600;

    const k1 = "0x1111";
    const k2 = "0x2222";

    await manager.registerKey(k1, "ed25519", expiredTime, { from: user });
    await manager.registerKey(k2, "ed25519", futureTime, { from: user });

    const active = await manager.getActiveKey(user);
    expect(active.publicKey).to.equal(k2);
  });

  it("should fail revoking non-existing index", async () => {
    await expectRevert(
      manager.revokeKey(5, { from: user }),
      "Index out of range"
    );
  });
});
