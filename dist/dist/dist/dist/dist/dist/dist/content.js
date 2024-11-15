// Listen for clicks on Twitter/X
document.addEventListener('click', async (e) => {
  if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) {
    if (e.target.closest('[data-testid="tweet"]')) {
      const tweetElement = e.target.closest('[data-testid="tweet"]');
      const tweetText = tweetElement.querySelector('[data-testid="tweetText"]')?.textContent || '';
      const tweetUrl = tweetElement.querySelector('a[href*="/status/"]')?.href || '';
      const imageUrl = tweetElement.querySelector('img[src*="media"]')?.src || '';
      
      // Extract possible tickers (words starting with $)
      const possibleTickers = tweetText.match(/\$[A-Za-z]+/g) || [];
      
      if (possibleTickers.length > 0) {
        const { summaries = [] } = await chrome.storage.local.get('summaries');
        summaries.push({
          TICKER: possibleTickers[0].substring(1),
          xUrl: tweetUrl,
          imageUrl,
          possibleTickers: possibleTickers.map(t => t.substring(1)),
          currentTickerIndex: 0
        });
        await chrome.storage.local.set({ summaries });
        
        // Update badge
        chrome.runtime.sendMessage({
          type: 'updateBadge',
          count: summaries.length.toString()
        });
      }
    }
  }
});

// Handle form filling on pump.fun
if (window.location.hostname === 'pump.fun') {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'fillPumpForm') {
      const { TICKER, xUrl, imageUrl, socialPreferences } = message;
      
      // Fill the form fields
      document.querySelector('input[name="ticker"]').value = TICKER;
      document.querySelector('input[name="twitter_url"]').value = xUrl;
      
      // Handle social checkboxes
      if (socialPreferences.telegram) {
        document.querySelector('input[name="telegram"]').checked = true;
      }
      if (socialPreferences.x) {
        document.querySelector('input[name="twitter"]').checked = true;
      }
      if (socialPreferences.website) {
        document.querySelector('input[name="website"]').checked = true;
      }
      
      // Trigger input events for React state updates
      ['ticker', 'twitter_url'].forEach(field => {
        document.querySelector(`input[name="${field}"]`).dispatchEvent(
          new Event('input', { bubbles: true })
        );
      });
    }
  });
}