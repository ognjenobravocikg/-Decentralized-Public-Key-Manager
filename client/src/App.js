import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import contractArtifact from "./build/contracts/Manager.json";
import "./App.css"; // Dark theme styles

// === HARDCODED SETTINGS ===
const CONTRACT_ADDRESS = "0xbFF4E590c36fAcD34317a14E906a41A647D4fc68";
const NETWORK = "sepolia";
const algorithms = ["ed25519", "secp256k1", "rsa2048", "rsa4096"];

function App() {
  const [status, setStatus] = useState("Not connected");
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [history, setHistory] = useState([]);

  // ================= WALLET CONNECTION =================
  // Detect wallet automatically and connect if possible
  useEffect(() => {
    async function autoConnect() {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          await connectWallet();
        }
      }
    }
    autoConnect();
  }, []);

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        alert("MetaMask not found!");
        return;
      }

      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const _signer = await provider.getSigner();

      const _contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        contractArtifact.abi,
        _signer
      );

      setSigner(_signer);
      setContract(_contract);

      const addr = await _signer.getAddress();
      setStatus(`✅ Connected as ${addr}`);
    } catch (err) {
      console.error("Wallet connection error:", err);
      setStatus("❌ Error connecting wallet");
    }
  }

  // ================= REGISTER KEY =================
  async function registerKey() {
    try {
      const publicKey = document.getElementById("publicKey").value;
      const alg = document.getElementById("alg").value;
      const expiresAt = parseInt(document.getElementById("expiresAt").value);

      const tx = await contract.registerKey(
        ethers.toUtf8Bytes(publicKey),
        alg,
        expiresAt
      );

      setStatus("⏳ Registering key...");
      await tx.wait();
      setStatus("✅ Key registered!");
    } catch (err) {
      console.error(err);
      setStatus("❌ Error registering key");
    }
  }

  // ================= ROTATE KEY =================
  async function rotateKey() {
    try {
      const publicKey = document.getElementById("publicKey").value;
      const alg = document.getElementById("alg").value;
      const expiresAt = parseInt(document.getElementById("expiresAt").value);

      const tx = await contract.rotateKey(
        ethers.toUtf8Bytes(publicKey),
        alg,
        expiresAt
      );

      setStatus("⏳ Rotating key...");
      await tx.wait();
      setStatus("✅ Key rotated!");
    } catch (err) {
      console.error(err);
      setStatus("❌ Error rotating key");
    }
  }

  // ================= REVOKE KEY =================
  async function revokeKey() {
    try {
      const index = parseInt(document.getElementById("revokeIndex").value);
      const tx = await contract.revokeKey(index);

      setStatus("⏳ Revoking key...");
      await tx.wait();
      setStatus("✅ Key revoked!");
    } catch (err) {
      console.error(err);
      setStatus("❌ Error revoking key");
    }
  }

  // ================= LOAD HISTORY =================
  async function getHistory() {
    try {
      const address = await signer.getAddress();
      const count = await contract.getHistoryCount(address);
      const items = [];

      for (let i = 0; i < count; i++) {
        const key = await contract.getKey(address, i);
        items.push({
          index: i,
          publicKey: ethers.toUtf8String(key[0]),
          alg: key[1],
          registeredAt: new Date(Number(key[2]) * 1000).toLocaleString(),
          expiresAt:
            key[3] === 0
              ? "Never"
              : new Date(Number(key[3]) * 1000).toLocaleString(),
          revoked: key[4],
        });
      }

      setHistory(items);
      setStatus("✅ History loaded");
    } catch (err) {
      console.error(err);
      setStatus("❌ Error loading history");
    }
  }

  // ================= UI =================
  return (
    <div className="app">
      <header className="header">
        <h1>🔑 Decentralized Key Manager</h1>
        <button className="btn connect" onClick={connectWallet}>
          Connect Wallet
        </button>
      </header>

      <p className="status">{status}</p>

      <section className="section">
        <h2>Register / Rotate Key</h2>
        <input id="publicKey" placeholder="Public Key" className="input" />
        <select id="alg" className="input">
          {algorithms.map((alg) => (
            <option key={alg} value={alg}>
              {alg}
            </option>
          ))}
        </select>
        <input
          id="expiresAt"
          placeholder="Expires at (unix timestamp, 0 = never)"
          className="input"
        />
        <div className="button-row">
          <button className="btn" onClick={registerKey} disabled={!signer}>
            Register
          </button>
          <button className="btn" onClick={rotateKey} disabled={!signer}>
            Rotate
          </button>
        </div>
      </section>

      <section className="section">
        <h2>Revoke Key</h2>
        <input id="revokeIndex" placeholder="Key Index" className="input" />
        <button className="btn" onClick={revokeKey} disabled={!signer}>
          Revoke
        </button>
      </section>

      <section className="section">
        <h2>View Key History</h2>
        <button className="btn" onClick={getHistory} disabled={!signer}>
          Load History
        </button>
        <div className="history-container">
          {history.length > 0 ? (
            (() => {
              // Find active key (latest valid one)
              const activeIndex = history
                .slice()
                .reverse()
                .find(
                  (k) =>
                    !k.revoked &&
                    (k.expiresAt === "Never" ||
                      new Date(k.expiresAt) > new Date())
                )?.index;

              return history.map((k) => (
                <div
                  key={k.index}
                  className={`history-item ${
                    k.index === activeIndex ? "active" : ""
                  }`}
                >
                  <b>Index:</b> {k.index}{" "}
                  {k.index === activeIndex && (
                    <span className="active-label">✅ Active</span>
                  )}
                  <br />
                  <b>Public Key:</b> {k.publicKey}
                  <br />
                  <b>Alg:</b> {k.alg}
                  <br />
                  <b>Registered:</b> {k.registeredAt}
                  <br />
                  <b>Expires:</b> {k.expiresAt}
                  <br />
                  <b>Revoked:</b> {k.revoked ? "Yes" : "No"}
                </div>
              ));
            })()
          ) : (
            <p>No keys found.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
