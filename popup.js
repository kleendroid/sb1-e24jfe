document.addEventListener('DOMContentLoaded', async () => {
  const summariesDiv = document.getElementById('summaries');
  const clearButton = document.getElementById('clearButton');
  const settingsButton = document.getElementById('settingsButton');
  const settingsModal = document.getElementById('settingsModal');
  const saveSettingsButton = document.getElementById('saveSettings');
  const closeSettingsButton = document.getElementById('closeSettings');
  let currentCropper = null;
  
  chrome.action.setBadgeText({ text: '' });
  
  // Settings Modal Handlers
  settingsButton.addEventListener('click', () => {
    settingsModal.style.display = 'block';
    // Load saved settings
    chrome.storage.local.get(['solanaSettings'], (result) => {
      if (result.solanaSettings) {
        document.getElementById('privateKey').value = result.solanaSettings.privateKey || '';
        document.getElementById('publicKey').value = result.solanaSettings.publicKey || '';
        document.getElementById('rpcEndpoint').value = result.solanaSettings.rpcEndpoint || '';
      }
    });
  });

  closeSettingsButton.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  saveSettingsButton.addEventListener('click', async () => {
    const settings = {
      privateKey: document.getElementById('privateKey').value,
      publicKey: document.getElementById('publicKey').value,
      rpcEndpoint: document.getElementById('rpcEndpoint').value
    };
    await chrome.storage.local.set({ solanaSettings: settings });
    settingsModal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });
  
  async function loadSummaries() {
    const { summaries = [] } = await chrome.storage.local.get('summaries');
    
    if (summaries.length === 0) {
      summariesDiv.innerHTML = '<p>No summaries yet. Click the red button on tweets to create summaries!</p>';
      return;
    }

    summariesDiv.innerHTML = summaries
      .reverse()
      .slice(0, 10)
      .map(({ TICKER, xUrl, imageUrl, possibleTickers = [], currentTickerIndex = 0 }, index) => `
        <div class="summary-item" data-index="${index}">
          <div class="info-line">
            <span class="label">Ticker:</span>
            <div class="ticker-navigation">
              <button class="icon-button prev-ticker" ${possibleTickers.length <= 1 ? 'disabled' : ''}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
              </button>
              <span class="ticker-value">${TICKER}</span>
              <button class="icon-button next-ticker" ${possibleTickers.length <= 1 ? 'disabled' : ''}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10.59 7.41L9.18 6l6 6-6 6 1.41 1.41L16.83 12z"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="info-line">
            <span class="label">X url:</span>
            <a href="${xUrl}" target="_blank" class="x-url">${xUrl}</a>
          </div>
          <div class="info-line">
            <span class="label">Image:</span>
            <div class="image-container">
              ${imageUrl ? 
                `<img src="${imageUrl}" alt="Tweet image" class="tweet-image">` : 
                `<button class="generate-image-btn">Generate</button>`
              }
            </div>
          </div>
          <div class="button-container">
            <button class="pump-button">Fill pump form</button>
            <button class="solana-button">Launch on Solana</button>
          </div>
        </div>
      `)
      .join('');

    // Initialize image cropping functionality
    document.querySelectorAll('.tweet-image').forEach(img => {
      img.addEventListener('click', function() {
        if (currentCropper) {
          currentCropper.destroy();
          currentCropper = null;
        }

        const container = this.closest('.image-container');
        
        if (!container.querySelector('.crop-controls')) {
          const controls = document.createElement('div');
          controls.className = 'crop-controls';
          controls.innerHTML = `
            <button class="crop-button apply-crop">Apply Crop</button>
            <button class="crop-button cancel-crop">Cancel</button>
          `;
          container.appendChild(controls);
        }

        currentCropper = new Cropper(this, {
          aspectRatio: NaN,
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 1,
          restore: false,
          guides: true,
          center: true,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false,
        });

        container.querySelector('.apply-crop').addEventListener('click', async () => {
          if (currentCropper) {
            const croppedCanvas = currentCropper.getCroppedCanvas();
            const croppedImage = croppedCanvas.toDataURL('image/jpeg');
            
            const { summaries = [] } = await chrome.storage.local.get('summaries');
            const index = parseInt(container.closest('.summary-item').dataset.index);
            summaries[summaries.length - 1 - index].imageUrl = croppedImage;
            await chrome.storage.local.set({ summaries });
            
            currentCropper.destroy();
            currentCropper = null;
            loadSummaries();
          }
        });

        container.querySelector('.cancel-crop').addEventListener('click', () => {
          if (currentCropper) {
            currentCropper.destroy();
            currentCropper = null;
            loadSummaries();
          }
        });
      });
    });

    // Handle Solana button clicks
    document.querySelectorAll('.solana-button').forEach((button, index) => {
      button.addEventListener('click', async () => {
        const { solanaSettings } = await chrome.storage.local.get('solanaSettings');
        if (!solanaSettings?.privateKey || !solanaSettings?.publicKey || !solanaSettings?.rpcEndpoint) {
          alert('Please configure your Solana settings first');
          settingsModal.style.display = 'block';
          return;
        }

        const summaryItem = button.closest('.summary-item');
        const ticker = summaryItem.querySelector('.ticker-value').textContent;
        const xUrl = summaryItem.querySelector('.x-url').getAttribute('href');
        const imageUrl = summaryItem.querySelector('.tweet-image')?.src;

        try {
          button.textContent = 'Launching...';
          button.disabled = true;

          // Create form data for IPFS
          const formData = new FormData();
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          formData.append("file", blob);
          formData.append("name", ticker);
          formData.append("symbol", ticker);
          formData.append("description", `Token created via Instant Launch`);
          formData.append("twitter", xUrl);
          formData.append("telegram", xUrl);
          formData.append("website", "https://pumpportal.fun");
          formData.append("showName", "true");

          // Send to background script for processing
          chrome.runtime.sendMessage({
            type: 'createSolanaToken',
            data: {
              formData,
              settings: solanaSettings,
              ticker
            }
          });

          setTimeout(() => {
            button.textContent = 'Launch on Solana';
            button.disabled = false;
          }, 2000);
        } catch (error) {
          alert('Error launching token: ' + error.message);
          button.textContent = 'Launch on Solana';
          button.disabled = false;
        }
      });
    });
  }

  // Clear button handler
  clearButton.addEventListener('click', async () => {
    await chrome.storage.local.set({ summaries: [] });
    chrome.action.setBadgeText({ text: '' });
    loadSummaries();
  });

  // Handle ticker navigation
  summariesDiv.addEventListener('click', async (e) => {
    if (e.target.closest('.prev-ticker') || e.target.closest('.next-ticker')) {
      const summaryItem = e.target.closest('.summary-item');
      const index = parseInt(summaryItem.dataset.index);
      const { summaries = [] } = await chrome.storage.local.get('summaries');
      const summary = summaries[summaries.length - 1 - index];
      
      if (e.target.closest('.prev-ticker')) {
        summary.currentTickerIndex = (summary.currentTickerIndex - 1 + summary.possibleTickers.length) % summary.possibleTickers.length;
      } else {
        summary.currentTickerIndex = (summary.currentTickerIndex + 1) % summary.possibleTickers.length;
      }
      
      summary.TICKER = summary.possibleTickers[summary.currentTickerIndex];
      await chrome.storage.local.set({ summaries });
      loadSummaries();
    }
  });

  // Save social preferences
  ['telegram', 'x', 'website'].forEach(social => {
    const checkbox = document.getElementById(`${social}-checkbox`);
    checkbox.addEventListener('change', async () => {
      const { socialPreferences = {} } = await chrome.storage.local.get('socialPreferences');
      socialPreferences[social] = checkbox.checked;
      await chrome.storage.local.set({ socialPreferences });
    });
  });

  // Initial load
  loadSummaries();
});