# iOS Build Instructions

This React Native app includes NFC passport reading capabilities for iOS. Follow these instructions to build and run the app on iOS.

## Requirements

- **macOS** (required for iOS development)
- **Xcode 14+** with iOS 13+ SDK
- **CocoaPods** (for dependency management)
- **iPhone 7 or newer** (NFC only works on iPhone 7+)
- **Apple Developer Account** with NFC entitlement enabled

## Prerequisites

1. Install Xcode from the Mac App Store
2. Install CocoaPods:
   ```bash
   sudo gem install cocoapods
   ```
3. Install project dependencies:
   ```bash
   cd ios
   pod install
   ```

## Important Configuration Steps

### 1. Update Bundle Identifier

Open `ios/ForumFeedApp.xcworkspace` in Xcode and:
- Select the ForumFeedApp target
- Go to "Signing & Capabilities"
- Change the Bundle Identifier to your own (e.g., `com.yourcompany.forumfeedapp`)
- Select your development team

### 2. Enable NFC Capability

In Xcode:
- Go to "Signing & Capabilities" tab
- Click "+ Capability"
- Add "Near Field Communication Tag Reading"
- The entitlements file should automatically be linked

**Important:** You must have NFC entitlement enabled in your Apple Developer account. To request it:
1. Go to https://developer.apple.com/account
2. Navigate to Certificates, Identifiers & Profiles
3. Select your App ID
4. Enable "NFC Tag Reading"

### 3. Xcode Project Configuration

You need to manually add the Swift files to your Xcode project:

1. Open `ForumFeedApp.xcworkspace` in Xcode
2. Right-click on the ForumFeedApp folder in the project navigator
3. Select "Add Files to ForumFeedApp..."
4. Add these files:
   - `PassportReaderModule.swift`
   - `PassportReaderModule.m`
   - `PassportReader.swift`
   - `MRZScannerViewController.swift`
5. When prompted, select:
   - ✅ Copy items if needed
   - ✅ Create groups
   - ✅ Add to target: ForumFeedApp

### 4. Configure Swift Bridging Header

In Xcode project settings:
1. Select the ForumFeedApp target
2. Go to Build Settings
3. Search for "bridging"
4. Set "Objective-C Bridging Header" to: `ForumFeedApp/ForumFeedApp-Bridging-Header.h`
5. Set "Swift Language Version" to: Swift 5

## Building the App

### Using Command Line

```bash
# From project root
npx react-native run-ios
```

### Using Xcode

1. Open `ios/ForumFeedApp.xcworkspace` (NOT .xcodeproj)
2. Select your target device (must be a real iPhone 7+, simulator doesn't support NFC)
3. Click Run (⌘R)

## Testing NFC Features

**Important:** NFC features only work on physical devices (iPhone 7+), not on the simulator.

1. Build and install the app on a real device
2. Navigate to passport scan screen
3. Scan the MRZ (bottom 2 lines) of the passport
4. Hold the passport near the top of the iPhone
5. Wait for NFC reading to complete

## Troubleshooting

### "NFC is not available"
- Ensure you're using iPhone 7 or newer
- Check that NFC is enabled in device settings
- Verify NFC capability is enabled in Xcode

### "Entitlement not found"
- Add NFC Tag Reading capability in Xcode
- Ensure entitlements file is linked to target
- Check that your Apple Developer account has NFC entitlement

### Build Errors
- Clean build folder: Product > Clean Build Folder (⌘⇧K)
- Delete derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData`
- Reinstall pods: `cd ios && rm -rf Pods && pod install`

### Module Not Found Errors
- Verify all Swift files are added to Xcode target
- Check bridging header path is correct
- Clean and rebuild project

## Architecture Notes

The iOS implementation mirrors the Android version:

- **PassportReaderModule.swift**: React Native bridge for NFC and MRZ scanning
- **PassportReader.swift**: Core NFC passport reading logic
- **MRZScannerViewController.swift**: Camera-based MRZ scanner using Vision framework

## Production Considerations

The current `PassportReader.swift` is a simplified implementation. For production use:

1. Integrate the [NFCPassportReader](https://github.com/AndyQ/NFCPassportReader) library
2. Implement proper BAC (Basic Access Control) authentication
3. Add support for PACE (Password Authenticated Connection Establishment)
4. Verify document signatures (Active Authentication)
5. Handle all passport types (TD1, TD2, TD3)

## Platform Differences from Android

- iOS requires iOS 13+ and iPhone 7+
- NFC reading can be slower on iOS
- iOS Vision framework for text recognition (vs ML Kit on Android)
- Different entitlements/permissions model
- Must use Xcode and CocoaPods (vs Gradle on Android)

## Resources

- [Apple NFC Documentation](https://developer.apple.com/documentation/corenfc)
- [React Native iOS Guide](https://reactnative.dev/docs/running-on-device)
- [NFCPassportReader Library](https://github.com/AndyQ/NFCPassportReader)