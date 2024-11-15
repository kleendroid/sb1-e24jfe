// Initialize badge text and handle Solana integration
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ summaries: [] });
  chrome.action.setBadgeText({ text: '' });
  chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
});

// Handle badge updates and Solana token creation
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'updateBadge') {
    chrome.action.setBadgeText({ text: message.count.toString() });
  }
  
  if (message.type === 'createSolanaToken') {
    try {
      const { formData, settings, ticker } = message.data;
      const connection = new Connection(settings.rpcEndpoint, 'confirmed');
      const signerKeyPair = Keypair.fromSecretKey(bs58.decode(settings.privateKey));
      const mintKeypair = Keypair.generate();

      // Create IPFS metadata storage
      const metadataResponse = await fetch("https://pump.fun/api/ipfs", {
        method: "POST",
        body: formData
      });
      const metadataResponseJSON = await metadataResponse.json();

      // Get the create transaction
      const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "publicKey": settings.publicKey,
          "action": "create",
          "tokenMetadata": {
            name: metadataResponseJSON.metadata.name,
            symbol: metadataResponseJSON.metadata.symbol,
            uri: metadataResponseJSON.metadataUri
          },
          "mint": mintKeypair.publicKey.toBase58(),
          "denominatedInSol": "true",
          "amount": 1,
          "slippage": 10,
          "priorityFee": 0.0005,
          "pool": "pump"
        })
      });

      if (response.status === 200) {
        const data = await response.arrayBuffer();
        const tx = VersionedTransaction.deserialize(new Uint8Array(data));
        tx.sign([mintKeypair, signerKeyPair]);
        const signature = await connection.sendTransaction(tx);
        console.log("Transaction: https://solscan.io/tx/" + signature);
      }
    } catch (error) {
      console.error('Error creating Solana token:', error);
    }
  }
  
  // Handle form filling message relay
  if (message.type === 'fillPumpForm') {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, message);
      }
    });
  }
});