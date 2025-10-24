const Manager = artifacts.require("Manager");
const { expect } = require("chai");
const { ethers } = require("ethers");

contract("Manager", (accounts) => {
  let instance;
  const [owner, other] = accounts;

  beforeEach(async () => {
    instance = await Manager.new({ from: owner });
  });

  function ethSignedMessageHash(messageBytes) {
    // utility: ethers.utils.hashMessage does the toEthSignedMessageHash transformation
    return ethers.utils.hashMessage(messageBytes);
  }

  it("registers a key with valid signature", async () => {
    const publicKey = ethers.utils.toUtf8Bytes("fake-key-1");
    const alg = "ed25519";
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1h from now

    // create the challenge same as contract: keccak256("RegisterKey:", publicKey, alg, expiresAt, contractAddress)
    const messageHashBytes = ethers.utils.solidityKeccak256(
      ["string", "bytes", "string", "uint256", "address"],
      ["RegisterKey:", publicKey, alg, expiresAt, instance.address]
    );
    const messageHashBytesArray = ethers.utils.arrayify(messageHashBytes);

    // use web3.eth.sign via accounts[0] (Truffle provider) to sign the message
    const signature = await web3.eth.sign(
      ethers.utils.hexlify(messageHashBytesArray),
      owner
    );

    // call registerKey
    await instance.registerKey(publicKey, alg, expiresAt, signature, {
      from: owner,
    });

    const count = await instance.getHistoryCount(owner);
    expect(count.toNumber()).to.equal(1);

    const entry = await instance.getKey(owner, 0);
    expect(entry.alg).to.equal(alg);
  });

  it("rejects registration with bad signature", async () => {
    const publicKey = ethers.utils.toUtf8Bytes("fake-key-2");
    const alg = "ed25519";
    const expiresAt = 0;

    const messageHashBytes = ethers.utils.solidityKeccak256(
      ["string", "bytes", "string", "uint256", "address"],
      ["RegisterKey:", publicKey, alg, expiresAt, instance.address]
    );
    const messageHashBytesArray = ethers.utils.arrayify(messageHashBytes);

    // sign with other account, not owner
    const signature = await web3.eth.sign(
      ethers.utils.hexlify(messageHashBytesArray),
      other
    );

    try {
      await instance.registerKey(publicKey, alg, expiresAt, signature, {
        from: owner,
      });
      throw new Error("should have reverted");
    } catch (err) {
      assert(
        err.message.includes("invalid signature") ||
          err.message.includes("revert"),
        "expected revert for invalid signature"
      );
    }
  });

  it("rotates key and sets history", async () => {
    // register first
    const pk1 = ethers.utils.toUtf8Bytes("k1");
    const alg = "ed25519";
    const t1 = Math.floor(Date.now() / 1000) + 3600;

    const h1 = ethers.utils.solidityKeccak256(
      ["string", "bytes", "string", "uint256", "address"],
      ["RegisterKey:", pk1, alg, t1, instance.address]
    );
    const sig1 = await web3.eth.sign(h1, owner);
    await instance.registerKey(pk1, alg, t1, sig1, { from: owner });

    // rotate to pk2
    const pk2 = ethers.utils.toUtf8Bytes("k2");
    const t2 = Math.floor(Date.now() / 1000) + 7200;
    const h2 = ethers.utils.solidityKeccak256(
      ["string", "bytes", "string", "uint256", "address"],
      ["RotateKey:", pk2, alg, t2, instance.address]
    );
    const sig2 = await web3.eth.sign(h2, owner);
    await instance.rotateKey(pk2, alg, t2, sig2, { from: owner });

    const count = (await instance.getHistoryCount(owner)).toNumber();
    expect(count).to.equal(2);

    const active = await instance.getActiveKeyIndex(owner);
    // active[0] is found boolean in truffle return format; active[1] is index
    // convert appropriately
  });

  it("revokes a key", async () => {
    const pk1 = ethers.utils.toUtf8Bytes("k1rev");
    const alg = "ed25519";
    const t1 = 0;
    const h1 = ethers.utils.solidityKeccak256(
      ["string", "bytes", "string", "uint256", "address"],
      ["RegisterKey:", pk1, alg, t1, instance.address]
    );
    const sig1 = await web3.eth.sign(h1, owner);
    await instance.registerKey(pk1, alg, t1, sig1, { from: owner });

    await instance.revokeKey(0, { from: owner });
    const key = await instance.getKey(owner, 0);
    assert(key.revoked === true || key[4] === true, "key should be revoked");
  });
});
