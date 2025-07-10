# Pay n Snap

A lightweight, static web app for quick HBD payments and posting “snaps” (replies) on the Hive blockchain. Designed for GitHub Pages, styled like classic Twitter, and integrates with Hive Keychain for secure authentication and payments.

## Features
- **Hive Keychain login** (persistent)
- **QR code scanning** for payment details
- **HBD transfer** and on-chain confirmation
- **Automated reply (snap)** to the latest post in a configurable Hive community/account
- **Configurable beneficiaries** for sustainable rewards
- **Twitter-inspired UI**
- **Fully static**: No backend required

## Quick Start
1. **Clone or download this repo.**
2. **Edit `config.json`** to set your community, target account, beneficiaries, and messages.
3. **Deploy to GitHub Pages:**
   - Push to your GitHub repo.
   - In repo settings, enable Pages (main branch, `/root`).
   - Access at `https://yourusername.github.io/paynsnap`.
4. **Test locally:**
   - Install [http-server](https://www.npmjs.com/package/http-server):
     ```sh
     npm install -g http-server
     ```
   - Run:
     ```sh
     http-server -p 8080
     ```
   - Open [http://localhost:8080](http://localhost:8080) in your browser.

## Configuration
Edit `config.json` to set:
- `community`: Hive community ID (e.g., `hive-124838`)
- `targetAccount`: Account to reply to (e.g., `peak.snaps`)
- `beneficiaries`: Array of `{ account, percentage }` objects
- `messages`: Array of reply message templates
- `defaultMessageIndex`: Default message (0-based index)

## Usage
- **Login** with Hive Keychain (browser extension or mobile app)
- **Scan QR code** with payment details
- **Confirm payment** and post a snap reply
- **Choose or customize your message**

## Dependencies
- [Hive Keychain SDK](https://github.com/stoodkev/hive-keychain)
- [dhive](https://github.com/holgern/dhive)
- [jsQR](https://github.com/cozmo/jsQR)

## Notes
- App is static—no backend required
- All settings are persistent via `localStorage`
- Error handling and timeouts are user-friendly
- Easily adaptable for other Hive communities or use cases

## License
MIT
