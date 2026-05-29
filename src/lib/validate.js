const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

function isValidWallet(wallet) {
  return WALLET_RE.test(wallet || "");
}

module.exports = { isValidWallet, WALLET_RE };
