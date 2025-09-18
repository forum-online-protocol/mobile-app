# Forum - The Decentralized Voting Platform

> Join us and help create the next public forum together

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Open Source](https://img.shields.io/badge/Open%20Source-100%25-green.svg)](https://github.com/forum-protocol)
[![Security](https://img.shields.io/badge/Security-256--bit%20Encryption-orange.svg)](./SECURITY.md)

## What is Forum?

Forum is a revolutionary decentralized voting platform that combines cutting-edge cryptography with blockchain technology to create a secure, anonymous, and censorship-resistant voting system. Built on Ethereum Layer 2, Forum enables communities to host opinion polls, promote petitions, and make collective decisions while preserving complete voter privacy.

## Key Features

### 🗳️ Democratic Tools
- **Host Opinion Polls** - Create polls to gather public opinion on any topic
- **Promote Petitions** - Start petitions for causes you care about and gather support
- **Collective Decision Making** - Participate in discussions and make your voice heard

### 🔒 Security & Privacy
- **Sybil Resistant** - Prevents fake accounts and ensures one person, one vote through verified identity
- **Anonymous Voting** - Your votes are private and cannot be traced back to your identity
- **Censorship Resistant** - Decentralized platform that cannot be controlled or shut down by any authority

### 🏗️ Technical Architecture
- **On-Device Verification** - Identity verification happens locally on your device for maximum privacy
- **Zero-Knowledge Proofs** - Prove eligibility without revealing personal information
- **Smart Contracts** - Transparent and immutable voting records on blockchain

## Getting Started

### Prerequisites
- Node.js 18.x or higher
- React Native development environment
- Android Studio (for Android development)
- Xcode (for iOS development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/forum-protocol/nfc-pass-v2.git
   cd nfc-pass-v2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **iOS Setup (Mac only)**
   ```bash
   cd ios && pod install
   cd ..
   ```

4. **Run the application**

   For Android:
   ```bash
   npm run android
   ```

   For iOS:
   ```bash
   npm run ios
   ```

## Security Architecture

### 100% Open Source & Verifiable
Every line of code, every smart contract, and every cryptographic proof is open source and publicly auditable. We believe trust comes from verification, not promises.

### Core Security Principles

#### 🔐 Device-Only Processing
- Local NFC chip reading
- On-device biometric processing
- Client-side zero-knowledge proof generation
- Passport photos and personal information never leave your phone

#### 🎭 Zero-Knowledge Architecture
- Plonk proof system
- Anonymous credential verification
- Unlinkable vote receipts
- Prove eligibility without revealing identity

#### 🔑 Cryptographic Security
- **Encryption**: AES-256 for data at rest, TLS 1.3 for data in transit
- **Digital Signatures**: ECDSA for authentication
- **Hash Functions**: Poseidon hash for ZK circuits
- **Key Management**: Hardware security modules, BIP-32 key derivation

## Privacy Protection

### Data Minimization
- Only necessary data collected
- Automatic data purging
- Pseudonymization techniques
- Privacy by design

### Anonymous Voting System
- Vote-identity unlinkability
- Mixing networks
- Temporal decorrelation
- Metadata protection

## Threat Model & Mitigations

| Threat | Mitigation |
|--------|------------|
| **Sybil Attacks** | Social Graph Verification with 2-of-3 vouching |
| **Vote Buying** | Anonymous Receipt System - no way to prove how you voted |
| **Coercion** | Zero-Knowledge Privacy - impossible to link votes to individuals |
| **State Attacks** | Decentralized Architecture - no central point of control |

## Development

### Project Structure
```
src/
├── screens/          # Application screens
├── components/       # Reusable UI components
├── services/         # API and service layers
├── store/           # Redux state management
├── navigation/      # Navigation configuration
├── localization/    # Multi-language support
└── utils/           # Utility functions
```

### Available Scripts
```bash
npm start              # Start Metro bundler
npm run android        # Run on Android device/emulator
npm run ios           # Run on iOS device/simulator
npm run lint          # Run ESLint
npm test              # Run test suite
npm run build:android # Build Android APK
npm run build:ios     # Build iOS app
```

## Supported Features

### Identity Verification
- NFC passport reading (biometric passports)
- MRZ scanner for passport data extraction
- Manual MRZ input fallback
- On-device biometric verification

### Voting System
- Anonymous voting with zero-knowledge proofs
- Age and nationality restrictions
- Real-time vote counting
- Temporal voting deadlines

### Multi-Language Support
- English
- Russian (Русский)
- Ukrainian (Українська)

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Security Reporting
Found a security issue? Please report it responsibly:
- Email: security@forum.online
- Response time: Within 24 hours
- Encrypted communication available

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Verification

Don't trust, verify. All our code is open for inspection:
- [Mobile App Source Code](https://github.com/forum-protocol/nfc-pass-v2)
- [Zero-Knowledge Circuits](https://github.com/forum-protocol/zk-circuits)
- [Smart Contracts](https://github.com/forum-protocol/contracts)

## Version

Current version: v1.0.0

---

Built with ❤️ for democracy • Powered by Ethereum Layer 2
