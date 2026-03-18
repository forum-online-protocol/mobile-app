import Foundation
import CoreNFC
import UIKit
import React
import NFCPassportReader

@objc(PassportReaderModule)
class PassportReaderModule: RCTEventEmitter {

  private var passportReader: NFCPassportReader.PassportReader?

  // Helper method to get root view controller
  private func getRootViewController() -> UIViewController? {
    if #available(iOS 13.0, *) {
      if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
         let window = windowScene.windows.first(where: { $0.isKeyWindow }),
         let rootVC = window.rootViewController {
        return rootVC
      }
    }

    if let delegate = UIApplication.shared.delegate,
       let window = delegate.window ?? nil,
       let rootVC = window.rootViewController {
      return rootVC
    }

    return nil
  }

  override init() {
    super.init()
    print("[PassportReaderModule] Initializing module with NFCPassportReader")
  }

  @objc
  override static func moduleName() -> String! {
    return "PassportReader"
  }

  @objc
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func supportedEvents() -> [String]! {
    return ["mrzScanSuccess", "mrzScanError", "passportReadSuccess", "passportReadError", "passportReadProgress"]
  }

  @objc
  func startPassportScan(_ documentNumber: String,
                        dateOfBirth: String,
                        dateOfExpiry: String,
                        resolver: @escaping RCTPromiseResolveBlock,
                        rejecter: @escaping RCTPromiseRejectBlock) {
    print("[PassportReaderModule] ========================================")
    print("[PassportReaderModule] startPassportScan called")
    print("[PassportReaderModule] Document: \(documentNumber)")
    print("[PassportReaderModule] DOB: \(dateOfBirth), DOE: \(dateOfExpiry)")
    print("[PassportReaderModule] ========================================")

    // Check NFC availability
    guard NFCTagReaderSession.readingAvailable else {
      print("[PassportReaderModule] NFC not available")
      rejecter("NFC_UNAVAILABLE", "NFC reading is not available on this device", nil)
      return
    }

    // Generate MRZ key for BAC authentication
    let mrzKey = generateMRZKey(
      documentNumber: documentNumber,
      dateOfBirth: dateOfBirth,
      dateOfExpiry: dateOfExpiry
    )
    print("[PassportReaderModule] Generated MRZ key: \(mrzKey)")

    // Create passport reader instance
    passportReader = NFCPassportReader.PassportReader()

    // Start reading passport
    performPassportRead(mrzKey: mrzKey, resolver: resolver, rejecter: rejecter)
  }

  private func performPassportRead(mrzKey: String,
                                   resolver: @escaping RCTPromiseResolveBlock,
                                   rejecter: @escaping RCTPromiseRejectBlock) {
    Task {
      await readPassportAsync(mrzKey: mrzKey, resolver: resolver, rejecter: rejecter)
    }
  }

  @MainActor
  private func readPassportAsync(mrzKey: String,
                                 resolver: @escaping RCTPromiseResolveBlock,
                                 rejecter: @escaping RCTPromiseRejectBlock) async {
    do {
      print("[PassportReaderModule] Starting NFCPassportReader...")

      let passport = try await passportReader!.readPassport(
        mrzKey: mrzKey,
        tags: [.COM, .DG1, .DG2],
        skipSecureElements: true,
        customDisplayMessage: { [weak self] displayMessage in
          self?.handleDisplayMessage(displayMessage) ?? ""
        }
      )

      print("[PassportReaderModule] ========================================")
      print("[PassportReaderModule] SUCCESS! Passport read completed")
      print("[PassportReaderModule] Name: \(passport.firstName) \(passport.lastName)")
      print("[PassportReaderModule] Document: \(passport.documentNumber)")
      print("[PassportReaderModule] Nationality: \(passport.nationality)")
      print("[PassportReaderModule] ========================================")

      // Build result dictionary
      var resultDict: [String: Any] = [:]

      // Personal data
      var personalData: [String: String] = [:]
      personalData["documentNumber"] = passport.documentNumber
      personalData["firstName"] = passport.firstName
      personalData["lastName"] = passport.lastName
      personalData["nationality"] = passport.nationality
      personalData["issuingState"] = passport.issuingAuthority
      personalData["dateOfBirth"] = passport.dateOfBirth
      personalData["dateOfExpiry"] = passport.documentExpiryDate
      personalData["gender"] = passport.gender
      personalData["documentType"] = passport.documentType

      resultDict["personalData"] = personalData

      // Face image
      if let faceImage = passport.passportImage,
         let imageData = faceImage.jpegData(compressionQuality: 0.8) {
        let base64Image = imageData.base64EncodedString()
        resultDict["faceImage"] = base64Image
        resultDict["faceImageMimeType"] = "image/jpeg"
      }

      // Send success event
      self.sendEvent(withName: "passportReadSuccess", body: resultDict)
      resolver("Passport read successfully")

    } catch let error as NFCPassportReaderError {
      print("[PassportReaderModule] NFCPassportReaderError: \(error)")
      handleNFCError(error, rejecter: rejecter)

    } catch {
      print("[PassportReaderModule] General error: \(error)")
      self.sendEvent(withName: "passportReadError", body: [
        "code": "UNKNOWN_ERROR",
        "message": error.localizedDescription
      ])
      rejecter("UNKNOWN_ERROR", error.localizedDescription, error)
    }
  }

  private func handleDisplayMessage(_ displayMessage: NFCViewDisplayMessage) -> String? {
    var progress: Double = 0
    var message = ""

    switch displayMessage {
    case .requestPresentPassport:
      message = "Hold your passport near the top of your iPhone"
      progress = 0
    case .authenticatingWithPassport(let p):
      message = "Authenticating..."
      progress = Double(p) / 100.0 * 0.3 // 0-30%
    case .readingDataGroupProgress(_, let p):
      message = "Reading passport data..."
      progress = 0.3 + (Double(p) / 100.0 * 0.7) // 30-100%
    case .error(let error):
      message = "Error: \(error.localizedDescription)"
      progress = 0
    case .successfulRead:
      message = "Passport read successfully!"
      progress = 1.0
    @unknown default:
      return nil
    }

    // Send progress event
    DispatchQueue.main.async {
      self.sendEvent(withName: "passportReadProgress", body: [
        "progress": progress,
        "message": message
      ])
    }

    return message
  }

  private func handleNFCError(_ error: NFCPassportReaderError, rejecter: @escaping RCTPromiseRejectBlock) {
    var errorCode = "READ_ERROR"
    var errorMessage = error.localizedDescription

    switch error {
    case .UserCanceled:
      errorCode = "USER_CANCELED"
      errorMessage = "Scan was cancelled by user"
    case .InvalidMRZKey:
      errorCode = "INVALID_MRZ"
      errorMessage = "Invalid MRZ data - please check document number and dates"
    case .ResponseError(let reason, let sw1, let sw2):
      errorCode = "RESPONSE_ERROR"
      errorMessage = "\(reason) (SW: \(sw1), \(sw2))"
    case .NFCNotSupported:
      errorCode = "NFC_NOT_SUPPORTED"
      errorMessage = "NFC is not supported on this device"
    case .NoConnectedTag:
      errorCode = "NO_TAG"
      errorMessage = "No passport detected - hold it closer"
    case .ConnectionError:
      errorCode = "CONNECTION_ERROR"
      errorMessage = "Connection lost - keep passport steady"
    case .InvalidDataPassed(let msg):
      errorCode = "INVALID_DATA"
      errorMessage = msg
    default:
      errorCode = "UNKNOWN_ERROR"
    }

    self.sendEvent(withName: "passportReadError", body: [
      "code": errorCode,
      "message": errorMessage
    ])
    rejecter(errorCode, errorMessage, error)
  }

  // Generate MRZ key for BAC authentication
  private func generateMRZKey(documentNumber: String, dateOfBirth: String, dateOfExpiry: String) -> String {
    let cleanDocNum = documentNumber.uppercased().trimmingCharacters(in: .whitespaces)
    let paddedDocNum = String(cleanDocNum.prefix(9)).padding(toLength: 9, withPad: "<", startingAt: 0)

    let docNumChecksum = calcCheckSum(paddedDocNum)
    let dobChecksum = calcCheckSum(dateOfBirth)
    let doeChecksum = calcCheckSum(dateOfExpiry)

    return "\(paddedDocNum)\(docNumChecksum)\(dateOfBirth)\(dobChecksum)\(dateOfExpiry)\(doeChecksum)"
  }

  private func calcCheckSum(_ data: String) -> Int {
    let weights = [7, 3, 1]
    var sum = 0

    for (index, char) in data.enumerated() {
      var value = 0
      if char >= "0" && char <= "9" {
        value = Int(String(char))!
      } else if char >= "A" && char <= "Z" {
        value = Int(char.asciiValue!) - 55
      } else if char == "<" {
        value = 0
      }
      sum += value * weights[index % 3]
    }

    return sum % 10
  }

  @objc
  func startMRZScanner(_ resolver: @escaping RCTPromiseResolveBlock,
                      rejecter: @escaping RCTPromiseRejectBlock) {
    print("[PassportReaderModule] startMRZScanner called")

    DispatchQueue.main.async {
      guard let rootViewController = self.getRootViewController() else {
        rejecter("NO_VIEW_CONTROLLER", "Could not find root view controller", nil)
        return
      }

      let mrzScannerVC = MRZScannerViewController()
      mrzScannerVC.delegate = self
      mrzScannerVC.modalPresentationStyle = .fullScreen

      rootViewController.present(mrzScannerVC, animated: true) {
        resolver("MRZ scanner started")
      }
    }
  }

  @objc
  func startIDCardScanner(_ resolver: @escaping RCTPromiseResolveBlock,
                         rejecter: @escaping RCTPromiseRejectBlock) {
    print("[PassportReaderModule] startIDCardScanner called")

    DispatchQueue.main.async {
      guard let rootViewController = self.getRootViewController() else {
        rejecter("NO_VIEW_CONTROLLER", "Could not find root view controller", nil)
        return
      }

      let mrzScannerVC = MRZScannerViewController()
      mrzScannerVC.documentType = .idCard
      mrzScannerVC.delegate = self
      mrzScannerVC.modalPresentationStyle = .fullScreen

      rootViewController.present(mrzScannerVC, animated: true) {
        resolver("ID card scanner started")
      }
    }
  }
}

// MARK: - MRZ Scanner Delegate

extension PassportReaderModule: MRZScannerDelegate {
  func mrzScannerDidScan(_ mrzData: MRZData) {
    print("[PassportReaderModule] MRZ scanned: \(mrzData.documentNumber)")

    DispatchQueue.main.async {
      self.sendEvent(withName: "mrzScanSuccess", body: [
        "documentNumber": mrzData.documentNumber,
        "dateOfBirth": mrzData.dateOfBirth,
        "dateOfExpiry": mrzData.dateOfExpiry
      ])
    }
  }

  func mrzScannerDidFail(with error: Error) {
    print("[PassportReaderModule] MRZ scan error: \(error.localizedDescription)")

    DispatchQueue.main.async {
      self.sendEvent(withName: "mrzScanError", body: [
        "code": "MRZ_SCAN_ERROR",
        "message": error.localizedDescription
      ])
    }
  }
}
