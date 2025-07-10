# Pay n Snap - Hive Blockchain Payment & Social App

A static web application for the Hive blockchain that enables QR code payments and automated social media posting with Hive Keychain integration.

## Features

- **Hive Keychain Authentication**: Secure login using the Hive Keychain browser extension
- **QR Code Scanning**: Use device camera to scan payment QR codes
- **HBD Payments**: Send HBD payments through the Hive blockchain
- **Automated Social Posts**: Automatically post replies (snaps) after successful payments
- **Responsive Design**: Works on both desktop and mobile devices
- **Configurable Settings**: All settings loaded from config.json
- **CSP Compliant**: Secure implementation without eval or unsafe-eval

## Requirements

### Browser Extensions
- [Hive Keychain](https://chrome.google.com/webstore/detail/hive-keychain/jcacnejopjdphbnjgfaaobbfafkihpep) browser extension must be installed

### Browser Permissions
- Camera access for QR code scanning
- Local storage for session persistence

## Installation

1. Clone or download this repository
2. Ensure all files are in the same directory:
   - `index.html`
   - `app.js`
   - `styles.css`
   - `config.json`
   - `README.md`

3. Serve the files using any web server (required for camera access):
   ```bash
   # Using Python
   python -m http.server 5000
   
   # Using Node.js
   npx http-server -p 5000
   
   # Using PHP
   php -S localhost:5000
   ```

4. Open your browser and navigate to `http://localhost:5000`

## GitHub Pages Deployment

1. Fork this repository or create a new repository
2. Upload all files to the repository
3. Enable GitHub Pages in repository settings
4. Select the main branch as the source
5. Your app will be available at `https://yourusername.github.io/repository-name`

**Important**: GitHub Pages requires HTTPS for camera access. The app will work perfectly once deployed to GitHub Pages, but may show camera permission errors when testing locally without HTTPS.

## Configuration

Edit `config.json` to customize the app:

```json
{
  "hiveNodes": [
    "https://api.hive.blog",
    "https://hived.privex.io"
  ],
  "targetAccount": "your-target-account",
  "communityTag": "your-community-tag",
  "messages": [
    "Custom message templates with {amount} and {account} placeholders"
  ],
  "beneficiaries": [
    {
      "account": "beneficiary-account",
      "weight": 500
    }
  ]
}
