// App configuration and state
let config = {};
let currentUser = null;
let currentStream = null;
let scanningInterval = null;
let paymentData = null;
let isProcessing = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    await loadConfig();
    initializeUI();
    checkExistingSession();
    populateMessageOptions();
});

// Load configuration from config.json
async function loadConfig() {
    try {
        const response = await fetch('./config.json');
        if (!response.ok) {
            throw new Error('Failed to load configuration');
        }
        config = await response.json();
        console.log('Configuration loaded:', config);
    } catch (error) {
        console.error('Error loading config:', error);
        showStatus('Error loading configuration. Please refresh the page.', 'error');
    }
}

// Initialize UI event listeners
function initializeUI() {
    // Login functionality
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // QR Code scanning
    document.getElementById('scanQRBtn').addEventListener('click', startQRScanning);
    document.getElementById('stopScanBtn').addEventListener('click', stopQRScanning);
    
    // Payment confirmation
    document.getElementById('confirmPaymentBtn').addEventListener('click', confirmPayment);
    
    // Snap posting
    document.getElementById('postSnapBtn').addEventListener('click', postSnap);
    
    // Message selection
    document.getElementById('messageSelect').addEventListener('change', handleMessageSelect);
    
    // Enter key support for username input
    document.getElementById('usernameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
}

// Check for existing session
function checkExistingSession() {
    const storedUsername = localStorage.getItem('hive_username');
    if (storedUsername) {
        currentUser = storedUsername;
        showLoggedInState();
    }
}

// Populate message options from config
function populateMessageOptions() {
    const messageSelect = document.getElementById('messageSelect');
    
    if (config.messages && config.messages.length > 0) {
        config.messages.forEach(message => {
            const option = document.createElement('option');
            option.value = message;
            option.textContent = message;
            messageSelect.appendChild(option);
        });
    }
}

// Handle login with Hive Keychain
async function handleLogin() {
    const username = document.getElementById('usernameInput').value.trim();
    
    if (!username) {
        showStatus('Please enter a username', 'error');
        return;
    }
    
    if (!window.hive_keychain) {
        showStatus('Hive Keychain not found. Please install the Hive Keychain browser extension.', 'error');
        return;
    }
    
    showLoading('Authenticating with Hive Keychain...');
    
    try {
        // Create a buffer to sign for authentication
        const buffer = `Login to Pay n Snap - ${Date.now()}`;
        
        window.hive_keychain.requestSignBuffer(username, buffer, 'Posting', (response) => {
            hideLoading();
            
            if (response.success) {
                currentUser = username;
                localStorage.setItem('hive_username', username);
                showLoggedInState();
                showStatus(`Successfully logged in as @${username}`, 'success');
            } else {
                showStatus(`Login failed: ${response.message || 'Unknown error'}`, 'error');
            }
        });
    } catch (error) {
        hideLoading();
        console.error('Login error:', error);
        showStatus('Login failed. Please try again.', 'error');
    }
}

// Handle logout
function handleLogout() {
    currentUser = null;
    localStorage.removeItem('hive_username');
    showLoggedOutState();
    showStatus('Logged out successfully', 'info');
}

// Show logged in state
function showLoggedInState() {
    // Hide login section
    document.getElementById('loginSection').style.display = 'none';
    
    // Show payment section
    document.getElementById('paymentSection').style.display = 'block';
    
    // Show user info in header
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('username').textContent = `@${currentUser}`;
    
    // Set user avatar
    const avatarImg = document.getElementById('userAvatar');
    avatarImg.src = `https://images.hive.blog/u/${currentUser}/avatar/small`;
    avatarImg.onerror = function() {
        this.src = 'https://via.placeholder.com/40/1da1f2/ffffff?text=' + currentUser.charAt(0).toUpperCase();
    };
}

// Show logged out state
function showLoggedOutState() {
    // Show login section
    document.getElementById('loginSection').style.display = 'block';
    
    // Hide other sections
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('snapSection').style.display = 'none';
    
    // Hide user info
    document.getElementById('userInfo').style.display = 'none';
    
    // Reset form
    document.getElementById('usernameInput').value = '';
    
    // Stop any ongoing camera stream
    stopQRScanning();
}

// Start QR code scanning
async function startQRScanning() {
    if (isProcessing) return;
    
    try {
        showLoading('Starting camera...');
        
        // Request camera permission
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        
        currentStream = stream;
        const video = document.getElementById('cameraStream');
        video.srcObject = stream;
        
        // Show camera container
        document.getElementById('cameraContainer').style.display = 'block';
        document.getElementById('scanQRBtn').style.display = 'none';
        document.getElementById('stopScanBtn').style.display = 'inline-flex';
        
        hideLoading();
        showStatus('Camera started. Point at QR code to scan.', 'info');
        
        // Start scanning loop
        video.addEventListener('loadedmetadata', () => {
            video.play();
            scanQRCode();
        });
        
    } catch (error) {
        hideLoading();
        console.error('Camera access error:', error);
        showStatus('Camera access denied. Please allow camera access and try again.', 'error');
    }
}

// Stop QR code scanning
function stopQRScanning() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    
    if (scanningInterval) {
        clearInterval(scanningInterval);
        scanningInterval = null;
    }
    
    // Hide camera container
    document.getElementById('cameraContainer').style.display = 'none';
    document.getElementById('scanQRBtn').style.display = 'inline-flex';
    document.getElementById('stopScanBtn').style.display = 'none';
    
    showStatus('Camera stopped.', 'info');
}

// QR code scanning function
function parseHiveOpQr(qrString) {
    // 1. Validate URI format
    const prefix = "hive://sign/op/";
    if (!qrString.startsWith(prefix)) {
        throw new Error("Invalid QR code: not a Hive op URI");
    }
    // 2. Extract base64url payload
    const base64url = qrString.slice(prefix.length);
    // 3. Convert base64url to base64
    let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    // 4. Decode and parse JSON
    let op;
    try {
        const json = atob(base64);
        op = JSON.parse(json);
    } catch (e) {
        throw new Error("Invalid QR code: cannot decode or parse payload");
    }
    // 5. Validate op structure
    if (!Array.isArray(op) || op[0] !== "transfer" || typeof op[1] !== "object") {
        throw new Error("Invalid QR code: not a transfer operation");
    }
    const { to, amount, memo } = op[1];
    if (!to || !amount) {
        throw new Error("Invalid QR code: missing required fields");
    }
    return { to, amount, memo: memo || "" };
}

function scanQRCode() {
    const video = document.getElementById('cameraStream');
    const canvas = document.getElementById('qrCanvas');
    const context = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

        if (qrCode) {
            try {
                // Try to parse as Hive op QR (hive://sign/op/{base64url})
                const payment = parseHiveOpQr(qrCode.data);
                handleQRCodeScanned(payment);
                return;
            } catch (err) {
                // If not a Hive op QR, try legacy JSON (for backward compatibility)
                try {
                    const qrData = JSON.parse(qrCode.data);
                    handleQRCodeScanned(qrData);
                    return;
                } catch (error) {
                    console.error('Invalid QR code format:', error);
                    showStatus('Invalid QR code format. Expected Hive op QR or JSON with payment data.', 'error');
                }
            }
        }
    }

    // Continue scanning
    scanningInterval = requestAnimationFrame(scanQRCode);
}

// Handle QR code scanned
function handleQRCodeScanned(qrData) {
    stopQRScanning();
    
    // Validate QR data (amount can be a string like "0.100 HBD")
    if (!qrData.to || !qrData.amount) {
        showStatus('Invalid QR code: missing required fields (to, amount)', 'error');
        return;
    }

    // Optionally, validate amount format (e.g., "0.100 HBD")
    let amountStr = qrData.amount;
    if (typeof amountStr === 'number') {
        // Convert to Hive string format
        amountStr = amountStr.toFixed(3) + ' HBD';
    }
    // Accept only valid Hive amount strings
    const amountPattern = /^\d+\.\d{3} HBD$/;
    if (typeof amountStr !== 'string' || !amountPattern.test(amountStr)) {
        showStatus('Invalid QR code: amount must be a string like "0.100 HBD"', 'error');
        return;
    }

    paymentData = {
        to: qrData.to,
        amount: amountStr,
        memo: qrData.memo || 'Payment via Pay n Snap'
    };

    // Display payment details
    document.getElementById('paymentTo').textContent = paymentData.to;
    document.getElementById('paymentAmount').textContent = paymentData.amount;
    document.getElementById('paymentMemo').textContent = paymentData.memo;
    document.getElementById('paymentDetails').style.display = 'block';

    showStatus('QR code scanned successfully. Review payment details and confirm.', 'success');
}

// Confirm payment
async function confirmPayment() {
    if (!paymentData || isProcessing) return;
    
    isProcessing = true;
    document.getElementById('confirmPaymentBtn').disabled = true;
    
    showLoading('Initiating payment...');
    
    try {
        // Request transfer through Keychain
        window.hive_keychain.requestTransfer(
            currentUser,
            paymentData.to,
            paymentData.amount, // Pass as string, do not use .toString()
            paymentData.memo,
            'HBD',
            (response) => {
                if (response.success) {
                    showStatus('Payment initiated successfully. Waiting for confirmation...', 'success');
                    waitForPaymentConfirmation();
                } else {
                    hideLoading();
                    isProcessing = false;
                    document.getElementById('confirmPaymentBtn').disabled = false;
                    showStatus(`Payment failed: ${response.message || 'Unknown error'}`, 'error');
                }
            }
        );
    } catch (error) {
        hideLoading();
        isProcessing = false;
        document.getElementById('confirmPaymentBtn').disabled = false;
        console.error('Payment error:', error);
        showStatus('Payment failed. Please try again.', 'error');
    }
}

// Wait for payment confirmation
async function waitForPaymentConfirmation() {
    const maxAttempts = 10;
    const interval = 1000; // 1 second
    let attempts = 0;
    
    const checkPayment = async () => {
        try {
            const client = new dhive.Client(config.hiveNodes || ['https://api.hive.blog']);
            const history = await client.database.getAccountHistory(currentUser, -1, 50);
            
            // Look for recent transfer
            const recentTransfer = history.find(([, op]) => {
                return op[0] === 'transfer' && 
                       op[1].from === currentUser && 
                       op[1].to === paymentData.to && 
                       parseFloat(op[1].amount.split(' ')[0]) === paymentData.amount &&
                       op[1].amount.includes('HBD');
            });
            
            if (recentTransfer) {
                hideLoading();
                showStatus('Payment confirmed! Preparing to post snap...', 'success');
                document.getElementById('snapSection').style.display = 'block';
                return;
            }
            
            attempts++;
            if (attempts >= maxAttempts) {
                hideLoading();
                isProcessing = false;
                document.getElementById('confirmPaymentBtn').disabled = false;
                showStatus('Payment confirmation timeout. Please check your transaction history.', 'warning');
                return;
            }
            
            setTimeout(checkPayment, interval);
            
        } catch (error) {
            console.error('Error checking payment:', error);
            attempts++;
            if (attempts >= maxAttempts) {
                hideLoading();
                isProcessing = false;
                document.getElementById('confirmPaymentBtn').disabled = false;
                showStatus('Error confirming payment. Please check your transaction history.', 'error');
                return;
            }
            setTimeout(checkPayment, interval);
        }
    };
    
    checkPayment();
}

// Handle message selection
function handleMessageSelect() {
    const messageSelect = document.getElementById('messageSelect');
    const customMessage = document.getElementById('customMessage');
    
    if (messageSelect.value) {
        customMessage.value = messageSelect.value;
    }
}

// Post snap (reply)
async function postSnap() {
    if (isProcessing) return;
    
    const messageSelect = document.getElementById('messageSelect');
    const customMessage = document.getElementById('customMessage');
    
    let message = customMessage.value.trim() || messageSelect.value;
    
    if (!message) {
        showStatus('Please select or enter a message for your snap.', 'error');
        return;
    }
    
    isProcessing = true;
    document.getElementById('postSnapBtn').disabled = true;
    
    showLoading('Posting snap...');
    
    try {
        // Replace placeholders in message
        message = message.replace('{amount}', paymentData.amount);
        message = message.replace('{account}', paymentData.to);
        message = message.replace('{from}', currentUser);
        
        // Get target account's latest post
        const client = new dhive.Client(config.hiveNodes || ['https://api.hive.blog']);
        const discussions = await client.database.getDiscussions('blog', {
            tag: paymentData.to,
            limit: 1
        });
        
        if (discussions.length === 0) {
            hideLoading();
            isProcessing = false;
            document.getElementById('postSnapBtn').disabled = false;
            showStatus('No posts found for target account.', 'error');
            return;
        }
        
        const targetPost = discussions[0];
        
        // Create comment data
        const commentData = {
            parent_author: targetPost.author,
            parent_permlink: targetPost.permlink,
            author: currentUser,
            permlink: `pay-n-snap-${Date.now()}`,
            title: '',
            body: message,
            json_metadata: JSON.stringify({
                app: 'pay-n-snap',
                format: 'markdown',
                tags: [config.communityTag || 'payandsnap']
            }),
            comment_options: {
                author: currentUser,
                permlink: `pay-n-snap-${Date.now()}`,
                max_accepted_payout: '1000000.000 HBD',
                percent_hbd: 10000,
                allow_votes: true,
                allow_curation_rewards: true,
                extensions: []
            }
        };
        
        // Add beneficiaries if configured
        if (config.beneficiaries && config.beneficiaries.length > 0) {
            commentData.comment_options.extensions.push([
                0, {
                    beneficiaries: config.beneficiaries
                }
            ]);
        }
        
        // Post comment through Keychain
        window.hive_keychain.requestPost(
            currentUser,
            commentData.title,
            commentData.body,
            commentData.parent_permlink,
            commentData.parent_author,
            commentData.json_metadata,
            commentData.permlink,
            '',
            (response) => {
                hideLoading();
                isProcessing = false;
                document.getElementById('postSnapBtn').disabled = false;
                
                if (response.success) {
                    showStatus('Snap posted successfully!', 'success');
                    // Reset the form
                    resetForm();
                } else {
                    showStatus(`Failed to post snap: ${response.message || 'Unknown error'}`, 'error');
                }
            }
        );
        
    } catch (error) {
        hideLoading();
        isProcessing = false;
        document.getElementById('postSnapBtn').disabled = false;
        console.error('Snap posting error:', error);
        showStatus('Failed to post snap. Please try again.', 'error');
    }
}

// Reset form after successful snap
function resetForm() {
    paymentData = null;
    document.getElementById('paymentDetails').style.display = 'none';
    document.getElementById('snapSection').style.display = 'none';
    document.getElementById('messageSelect').value = '';
    document.getElementById('customMessage').value = '';
    document.getElementById('confirmPaymentBtn').disabled = false;
    document.getElementById('postSnapBtn').disabled = false;
}

// Show status message
function showStatus(message, type = 'info') {
    const statusContent = document.getElementById('statusContent');
    const statusClass = `status-${type}`;
    
    const iconMap = {
        info: 'fas fa-info-circle',
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle'
    };
    
    statusContent.innerHTML = `
        <div class="status-message ${statusClass}">
            <i class="${iconMap[type] || iconMap.info}"></i>
            ${message}
        </div>
    `;
    
    // Auto-clear success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (statusContent.innerHTML.includes(message)) {
                statusContent.innerHTML = '<p class="text-muted">Ready for next action...</p>';
            }
        }, 5000);
    }
}

// Show loading overlay
function showLoading(message = 'Loading...') {
    document.getElementById('loadingText').textContent = message;
    document.getElementById('loadingOverlay').style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Error handler for uncaught errors
window.addEventListener('error', function(event) {
    console.error('Uncaught error:', event.error);
    showStatus('An unexpected error occurred. Please refresh the page.', 'error');
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showStatus('An unexpected error occurred. Please refresh the page.', 'error');
});
