const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const loginBtn = document.getElementById('loginBtn');
const usernameInput = document.getElementById('usernameInput');
const scanBtn = document.getElementById('scanBtn');
const messageSelect = document.getElementById('messageSelect');
const customMessageInput = document.getElementById('customMessage');
const statusDiv = document.getElementById('status');
const hiveClient = new window.dhive.Client(['https://api.hive.blog', 'https://api.deathwing.me']);
const keychain = new window.hiveKeychain.HiveKeychainSdk();

// Default config (overridden by config.json)
let config = {
  community: 'hive-124838',
  targetAccount: 'peak.snaps',
  beneficiaries: [{ account: 'snapnpay', percentage: 10 }],
  messages: [
    'I just quickly snaped and paid {amount} at {account} today.',
    'I just paid {amount} at {account}.',
    'I just bought from {account} using Pay Snaps with {amount}.'
  ],
  defaultMessageIndex: 0
};

// Load config and settings
async function loadConfig() {
  try {
    const response = await fetch('config.json');
    config = { ...config, ...(await response.json()) };
    // Load saved settings from localStorage
    const savedSettings = JSON.parse(localStorage.getItem('paynsnap') || '{}');
    if (savedSettings.defaultMessageIndex !== undefined) {
      messageSelect.value = savedSettings.defaultMessageIndex;
      if (savedSettings.defaultMessageIndex === '3') {
        customMessageInput.value = savedSettings.customMessage || '';
        customMessageInput.disabled = false;
      }
    }
  } catch (err) {
    statusDiv.textContent = 'Error loading config: Using defaults.';
  }
}

// Persistent login check
let username = localStorage.getItem('hiveUsername');
if (username) {
  loginBtn.textContent = `Logged in as @${username}`;
  loginBtn.disabled = true;
  scanBtn.disabled = false;
  if (usernameInput) {
    usernameInput.value = username;
    usernameInput.disabled = true;
  }
}

// Login with Hive Keychain (with username input)
loginBtn.addEventListener('click', async () => {
  const inputUsername = usernameInput.value.trim();
  if (!inputUsername) {
    statusDiv.textContent = 'Please enter your Hive username.';
    return;
  }
  keychain.requestHandshake(() => {
    keychain.requestSignBuffer(
      inputUsername,
      'paynsnap_login',
      'Posting',
      response => {
        if (response.success) {
          username = inputUsername;
          localStorage.setItem('hiveUsername', username);
          loginBtn.textContent = `Logged in as @${username}`;
          loginBtn.disabled = true;
          scanBtn.disabled = false;
          statusDiv.textContent = 'Login successful! Ready to scan QR code.';
          usernameInput.disabled = true;
        } else {
          statusDiv.textContent = 'Login failed. Please try again.';
        }
      },
      null,
      'Pay n Snap Login'
    );
  });
});

// Handle message selection
messageSelect.addEventListener('change', () => {
  customMessageInput.disabled = messageSelect.value !== '3';
  if (messageSelect.value === '3') {
    customMessageInput.focus();
  }
  localStorage.setItem('paynsnap', JSON.stringify({
    defaultMessageIndex: messageSelect.value,
    customMessage: customMessageInput.value
  }));
});

customMessageInput.addEventListener('input', () => {
  localStorage.setItem('paynsnap', JSON.stringify({
    defaultMessageIndex: messageSelect.value,
    customMessage: customMessageInput.value
  }));
});

// QR code scanning
let stream;
scanBtn.addEventListener('click', async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    video.hidden = false;
    canvas.hidden = false;
    video.play();
    scanBtn.disabled = true;
    statusDiv.textContent = 'Scanning QR code...';
    scanQRCode();
  } catch (err) {
    statusDiv.textContent = 'Error accessing camera: ' + err.message;
    scanBtn.disabled = false;
  }
});

function scanQRCode() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  if (code) {
    stopCamera();
    processQRCode(code.data);
  } else {
    requestAnimationFrame(scanQRCode);
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    video.hidden = true;
    canvas.hidden = true;
    scanBtn.disabled = false;
  }
}

async function processQRCode(data) {
  try {
    const { to, amount, memo } = JSON.parse(data);
    if (!to || !amount || !memo) {
      statusDiv.textContent = 'Invalid QR code data.';
      return;
    }
    statusDiv.textContent = `Initiating transfer of ${amount} to @${to}...`;

    // Send HBD transfer
    keychain.requestTransfer(
      username,
      to,
      amount,
      memo,
      'HBD',
      response => {
        if (response.success) {
          statusDiv.textContent = 'Transfer initiated. Waiting for confirmation...';
          waitForConfirmation(to, amount, memo);
        } else {
          statusDiv.textContent = 'Transfer failed: ' + response.message;
          scanBtn.disabled = false;
        }
      },
      false
    );
  } catch (err) {
    statusDiv.textContent = 'Error processing QR code: ' + err.message;
    scanBtn.disabled = false;
  }
}

async function waitForConfirmation(to, amount, memo) {
  const startTime = Date.now();
  const timeout = 10000; // 10 seconds
  while (Date.now() - startTime < timeout) {
    try {
      const history = await hiveClient.database.getAccountHistory(username, -1, 10);
      const transfer = history.find(op => {
        const [type, data] = op[1].op;
        return type === 'transfer' && data.to === to && data.amount === amount && data.memo === memo;
      });
      if (transfer) {
        statusDiv.textContent = 'Transfer confirmed! Posting snap...';
        await postSnap(to, amount);
        return;
      }
    } catch (err) {
      console.error('Error checking history:', err);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  statusDiv.textContent = 'Confirmation timed out after 10 seconds.';
  scanBtn.disabled = false;
}

async function postSnap(to, amount) {
  try {
    // Get latest post by target account in community
    const query = {
      tag: config.community,
      limit: 1,
      observer: username,
      account: config.targetAccount
    };
    const posts = await hiveClient.database.getDiscussions('blog', query);
    if (!posts || posts.length === 0) {
      statusDiv.textContent = 'Payment has been confirmed but the snap didn’t happen.';
      scanBtn.disabled = false;
      return;
    }

    const { author, permlink } = posts[0];
    const parentPermlink = permlink;
    const commentPermlink = `re-${permlink}-${Date.now()}`;
    let message = config.messages[parseInt(messageSelect.value)] || config.messages[config.defaultMessageIndex];
    if (messageSelect.value === '3' && customMessageInput.value) {
      message = customMessageInput.value;
    }
    message = message.replace('{amount}', amount).replace('{account}', to);

    const beneficiaries = config.beneficiaries.map(b => ({
      account: b.account,
      weight: b.percentage * 100 // Convert percentage to basis points
    }));

    const commentOp = {
      parent_author: author,
      parent_permlink: parentPermlink,
      author: username,
      permlink: commentPermlink,
      title: '',
      body: message,
      json_metadata: JSON.stringify({
        app: 'paynsnap/1.0',
        beneficiaries
      })
    };

    keychain.requestPost(
      username,
      '',
      message,
      parentPermlink,
      commentPermlink,
      author,
      JSON.stringify({ app: 'paynsnap/1.0', beneficiaries }),
      null,
      response => {
        if (response.success) {
          statusDiv.textContent = 'Snap posted successfully!';
        } else {
          statusDiv.textContent = 'Payment has been confirmed but the snap didn’t happen.';
        }
        scanBtn.disabled = false;
      },
      false
    );
  } catch (err) {
    statusDiv.textContent = 'Payment has been confirmed but the snap didn’t happen: ' + err.message;
    scanBtn.disabled = false;
  }
}

// Initialize
loadConfig();