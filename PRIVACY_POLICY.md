# Privacy Policy for Forum Feed App

**Last Updated: January 17, 2025**

## Introduction

Forum Feed App ("we", "our", or "the app") respects your privacy and is committed to protecting your personal data. This privacy policy explains how we handle information when you use our mobile application.

## Information We Collect

### 1. Passport/ID Data via NFC
- **What we collect**: When you scan your passport or ID card using NFC, we read:
  - Personal information (name, date of birth, nationality, document number)
  - Document validity dates
  - Biometric photo from the document chip
  - MRZ (Machine Readable Zone) data

- **How we use it**: This data is used solely for:
  - Identity verification within the app
  - Displaying your information for voting/participation features
  - **Important**: This data is processed locally on your device and is NOT automatically transmitted to our servers

### 2. Camera Data
- **What we collect**: Camera access for MRZ scanning
- **How we use it**: Only for real-time OCR processing to read passport MRZ
- **Storage**: Images are processed in memory and not stored

### 3. Account Information
- **What we collect**:
  - Authentication tokens
  - User preferences
  - Voting history and participation data

### 4. Technical Information
- **What we collect**:
  - Device information (model, OS version)
  - App version
  - Crash reports and performance data

## Data Storage and Security

### Local Storage
- Passport data is encrypted and stored locally using AsyncStorage
- Biometric data (photos) are stored in encrypted format
- No passport data is transmitted without explicit user action

### Server Storage
- Only verified identity confirmations (not raw passport data)
- Voting records and participation history
- Account preferences

### Security Measures
- End-to-end encryption for data transmission
- Certificate pinning for API communications
- No cleartext traffic in production builds
- Secure storage using Android Keystore

## Data Sharing

We DO NOT:
- Sell your personal information
- Share passport/ID data with third parties
- Store government ID numbers on our servers
- Use your biometric data for any purpose other than verification

We MAY share:
- Anonymized voting statistics for public transparency
- Information required by law enforcement with valid legal requests

## Your Rights

You have the right to:
- **Access**: Request a copy of your personal data
- **Delete**: Request deletion of your account and associated data
- **Correct**: Update incorrect information
- **Export**: Receive your data in a portable format
- **Opt-out**: Disable certain features that process personal data

## NFC and Passport Scanning

### Special Notice about Passport Scanning
- NFC passport reading requires physical access to your document
- Data is read using secure ICAO standards
- BAC/PACE protocols ensure secure communication
- You must manually enter MRZ data to unlock NFC chip
- Passport data never leaves your device without explicit consent

### Purpose Limitation
Passport scanning is used ONLY for:
- Verifying user identity for voting eligibility
- Preventing duplicate accounts
- Ensuring one person, one vote principle

## Camera Usage

Camera is used exclusively for:
- Scanning MRZ text from passports
- Real-time OCR processing
- No photos are captured or stored

## Data Retention

- **Local passport data**: Retained until you log out or delete the app
- **Server account data**: Retained for 2 years after last activity
- **Voting records**: Permanently retained for transparency (anonymized)

## Children's Privacy

Our service is not directed to users under 18 years of age. We do not knowingly collect personal information from children.

## International Data Transfers

Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place.

## Changes to Privacy Policy

We may update this privacy policy from time to time. We will notify you of any changes by:
- Updating the "Last Updated" date
- In-app notifications for significant changes
- Requiring acceptance for material changes

## Third-Party Services

We use the following third-party services:
- **Google Play Services**: For app distribution and ML Kit (OCR)
- **React Native**: Application framework
- **JMRTD**: Open-source library for passport reading (processes data locally)

## Contact Information

For privacy concerns or data requests, contact us at:
- Email: privacy@forumfeedapp.com
- Website: https://forumfeedapp.com/privacy

## Legal Basis for Processing (GDPR)

We process personal data based on:
- **Consent**: For passport scanning and biometric data
- **Contract**: To provide voting and participation services
- **Legal obligations**: To comply with applicable laws
- **Legitimate interests**: For security and fraud prevention

## Data Protection Officer

For EU residents, our DPO can be reached at: dpo@forumfeedapp.com

## California Privacy Rights (CCPA)

California residents have additional rights under CCPA including:
- Right to know what personal information is collected
- Right to delete personal information
- Right to opt-out of sale (we do not sell personal data)
- Right to non-discrimination

## Compliance

This app complies with:
- GDPR (General Data Protection Regulation)
- CCPA (California Consumer Privacy Act)
- ICAO Document 9303 standards for passport reading
- Google Play Store privacy requirements

---

By using Forum Feed App, you acknowledge that you have read and understood this Privacy Policy.