// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Manager - Decentralized public key manager
/// @notice Users can register, rotate, revoke, and query their public keys
contract Manager {

    struct KeyEntry {
        bytes publicKey;       // raw public key bytes
        string alg;            // algorithm identifier (e.g., "ed25519")
        uint256 registeredAt;  // timestamp
        uint256 expiresAt;     // timestamp (0 = never expires)
        bool revoked;
    }

    // Address => array of keys (history)
    mapping(address => KeyEntry[]) private histories;

    // Events
    event KeyRegistered(address indexed owner, uint256 indexed index, bytes publicKey, string alg, uint256 expiresAt);
    event KeyRotated(address indexed owner, uint256 indexed oldIndex, uint256 indexed newIndex, bytes newPublicKey, string alg, uint256 expiresAt);
    event KeyRevoked(address indexed owner, uint256 indexed index);

    // ================== KEY MANAGEMENT FUNCTIONS ==================

    /// @notice Register a new key
    function registerKey(bytes calldata publicKey, string calldata alg, uint256 expiresAt) external {
        KeyEntry memory entry = KeyEntry({
            publicKey: publicKey,
            alg: alg,
            registeredAt: block.timestamp,
            expiresAt: expiresAt,
            revoked: false
        });

        histories[msg.sender].push(entry);
        uint256 idx = histories[msg.sender].length - 1;

        emit KeyRegistered(msg.sender, idx, publicKey, alg, expiresAt);
    }

    /// @notice Rotate (add) a new key
    function rotateKey(bytes calldata publicKey, string calldata alg, uint256 expiresAt) external {
        uint256 oldIndex = histories[msg.sender].length == 0 ? type(uint256).max : histories[msg.sender].length - 1;

        KeyEntry memory entry = KeyEntry({
            publicKey: publicKey,
            alg: alg,
            registeredAt: block.timestamp,
            expiresAt: expiresAt,
            revoked: false
        });

        histories[msg.sender].push(entry);
        uint256 newIndex = histories[msg.sender].length - 1;

        emit KeyRotated(msg.sender, oldIndex, newIndex, publicKey, alg, expiresAt);
    }

    /// @notice Revoke a key by its index
    function revokeKey(uint256 index) external {
        require(index < histories[msg.sender].length, "Index out of range");
        KeyEntry storage entry = histories[msg.sender][index];
        require(!entry.revoked, "Already revoked");

        entry.revoked = true;
        emit KeyRevoked(msg.sender, index);
    }

    // ================== VIEW FUNCTIONS ==================

    /// @notice Get number of keys in history
    function getHistoryCount(address owner) external view returns (uint256) {
        return histories[owner].length;
    }

    /// @notice Get a key by index
    function getKey(address owner, uint256 index) external view returns (
        bytes memory publicKey,
        string memory alg,
        uint256 registeredAt,
        uint256 expiresAt,
        bool revoked
    ) {
        require(index < histories[owner].length, "Index out of range");
        KeyEntry storage e = histories[owner][index];
        return (e.publicKey, e.alg, e.registeredAt, e.expiresAt, e.revoked);
    }

    /// @notice Get the last active key (non-revoked, not expired)
    function getActiveKey(address owner) external view returns (
        bytes memory publicKey,
        string memory alg,
        uint256 registeredAt,
        uint256 expiresAt,
        bool revoked,
        bool found
    ) {
        uint256 n = histories[owner].length;
        if (n == 0) return ("", "", 0, 0, false, false);

        for (uint256 i = n; i > 0; i--) {
            KeyEntry storage e = histories[owner][i - 1];
            if (!e.revoked && (e.expiresAt == 0 || e.expiresAt > block.timestamp)) {
                return (e.publicKey, e.alg, e.registeredAt, e.expiresAt, e.revoked, true);
            }
        }

        return ("", "", 0, 0, false, false);
    }
}
