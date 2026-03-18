import Foundation
import CoreNFC
import UIKit
import NFCPassportReader

class PassportReader {

  struct PassportData {
    let documentNumber: String
    let firstName: String
    let lastName: String
    let nationality: String
    let issuingState: String
    let dateOfBirth: String
    let dateOfExpiry: String
    let gender: String
    let documentType: String
    let faceImage: UIImage?
  }

  enum PassportError: Error, LocalizedError {
    case invalidTag
    case communicationError
    case authenticationError
    case readError(String)
    case cancelled

    var errorDescription: String? {
      switch self {
      case .invalidTag:
        return "Invalid passport tag"
      case .communicationError:
        return "Communication error with passport"
      case .authenticationError:
        return "Authentication failed - check MRZ data"
      case .readError(let message):
        return "Read error: \(message)"
      case .cancelled:
        return "Scan cancelled"
      }
    }
  }

  private let passportReader = NFCPassportReader.PassportReader()

  func readPassport(
    tag: NFCISO7816Tag,
    documentNumber: String,
    dateOfBirth: String,
    dateOfExpiry: String,
    completion: @escaping (Result<PassportData, Error>) -> Void
  ) {
    print("[PassportReader] Starting passport read with NFCPassportReader library")
    print("[PassportReader] Document: \(documentNumber), DOB: \(dateOfBirth), DOE: \(dateOfExpiry)")

    // Generate MRZ key for BAC authentication
    let mrzKey = generateMRZKey(
      documentNumber: documentNumber,
      dateOfBirth: dateOfBirth,
      dateOfExpiry: dateOfExpiry
    )
    print("[PassportReader] Generated MRZ key: \(mrzKey)")

    // Use NFCPassportReader library for proper BAC/PACE authentication
    performPassportRead(mrzKey: mrzKey, completion: completion)
  }

  private func performPassportRead(mrzKey: String, completion: @escaping (Result<PassportData, Error>) -> Void) {
    Task {
      await readPassportAsync(mrzKey: mrzKey, completion: completion)
    }
  }

  @MainActor
  private func readPassportAsync(mrzKey: String, completion: @escaping (Result<PassportData, Error>) -> Void) async {
    do {
      print("[PassportReader] Starting passport read with NFCPassportReader...")

      let passport = try await passportReader.readPassport(
        mrzKey: mrzKey,
        tags: [.COM, .DG1, .DG2],
        skipSecureElements: true,
        customDisplayMessage: { displayMessage in
          self.handleDisplayMessage(displayMessage)
        }
      )

      print("[PassportReader] Successfully read passport!")
      print("[PassportReader] Name: \(passport.firstName) \(passport.lastName)")
      print("[PassportReader] Document: \(passport.documentNumber)")
      print("[PassportReader] Nationality: \(passport.nationality)")

      // Extract data from passport
      let passportData = PassportData(
        documentNumber: passport.documentNumber,
        firstName: passport.firstName,
        lastName: passport.lastName,
        nationality: passport.nationality,
        issuingState: passport.issuingAuthority,
        dateOfBirth: passport.dateOfBirth,
        dateOfExpiry: passport.documentExpiryDate,
        gender: passport.gender,
        documentType: passport.documentType,
        faceImage: passport.passportImage
      )

      completion(.success(passportData))

    } catch let error as NFCPassportReaderError {
      print("[PassportReader] NFCPassportReaderError: \(error)")
      handleNFCError(error, completion: completion)

    } catch {
      print("[PassportReader] General error: \(error)")
      completion(.failure(PassportError.readError(error.localizedDescription)))
    }
  }

  private func handleDisplayMessage(_ displayMessage: NFCViewDisplayMessage) -> String? {
    switch displayMessage {
    case .requestPresentPassport:
      return "Hold your passport near the top of your iPhone"
    case .authenticatingWithPassport(let progress):
      return "Authenticating... \(Int(progress))%"
    case .readingDataGroupProgress(_, let progress):
      return "Reading passport... \(Int(progress))%"
    case .error(let tagError):
      return "Error: \(tagError.localizedDescription)"
    case .successfulRead:
      return "Passport read successfully!"
    @unknown default:
      return nil
    }
  }

  private func handleNFCError(_ error: NFCPassportReaderError, completion: @escaping (Result<PassportData, Error>) -> Void) {
    switch error {
    case .UserCanceled:
      completion(.failure(PassportError.cancelled))
    case .InvalidMRZKey:
      completion(.failure(PassportError.authenticationError))
    case .ResponseError(let reason, _, _):
      completion(.failure(PassportError.readError(reason)))
    default:
      completion(.failure(PassportError.readError(error.localizedDescription)))
    }
  }

  // Generate MRZ key for BAC authentication
  private func generateMRZKey(documentNumber: String, dateOfBirth: String, dateOfExpiry: String) -> String {
    // Clean and pad document number to 9 characters
    let cleanDocNum = documentNumber.uppercased().trimmingCharacters(in: .whitespaces)
    let paddedDocNum = String(cleanDocNum.prefix(9)).padding(toLength: 9, withPad: "<", startingAt: 0)

    // Calculate checksums
    let docNumChecksum = calcCheckSum(paddedDocNum)
    let dobChecksum = calcCheckSum(dateOfBirth)
    let doeChecksum = calcCheckSum(dateOfExpiry)

    // MRZ key format: docNum + checksum + dob + checksum + doe + checksum
    let mrzKey = "\(paddedDocNum)\(docNumChecksum)\(dateOfBirth)\(dobChecksum)\(dateOfExpiry)\(doeChecksum)"
    return mrzKey
  }

  private func calcCheckSum(_ data: String) -> Int {
    let weights = [7, 3, 1]
    var sum = 0

    for (index, char) in data.enumerated() {
      var value = 0
      if char >= "0" && char <= "9" {
        value = Int(String(char))!
      } else if char >= "A" && char <= "Z" {
        value = Int(char.asciiValue!) - 55 // A=10, B=11, etc.
      } else if char == "<" {
        value = 0
      }

      sum += value * weights[index % 3]
    }

    return sum % 10
  }
}
