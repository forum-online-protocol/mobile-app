import UIKit
import AVFoundation
import Vision

public protocol MRZScannerDelegate: AnyObject {
  func mrzScannerDidScan(_ mrzData: MRZData)
  func mrzScannerDidFail(with error: Error)
}

public enum DocumentType {
  case passport
  case idCard
}

public struct MRZData {
  public let documentNumber: String
  public let dateOfBirth: String
  public let dateOfExpiry: String
  
  public init(documentNumber: String, dateOfBirth: String, dateOfExpiry: String) {
    self.documentNumber = documentNumber
    self.dateOfBirth = dateOfBirth
    self.dateOfExpiry = dateOfExpiry
  }
}

class MRZScannerViewController: UIViewController {

  weak var delegate: MRZScannerDelegate?
  var documentType: DocumentType = .passport

  private var captureSession: AVCaptureSession?
  private var previewLayer: AVCaptureVideoPreviewLayer?
  private var isProcessing = false

  private let overlayView = UIView()
  private let frameView = UIView()
  private let titleLabel = UILabel()
  private let instructionLabel = UILabel()
  private let hintLabel = UILabel()

  override func viewDidLoad() {
    super.viewDidLoad()
    requestCameraPermission()
  }
  
  private func requestCameraPermission() {
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized:
      setupCamera()
      setupUI()
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
        DispatchQueue.main.async {
          if granted {
            self?.setupCamera()
            self?.setupUI()
          } else {
            self?.delegate?.mrzScannerDidFail(with: NSError(domain: "CameraError", code: 1001, userInfo: [NSLocalizedDescriptionKey: "Camera permission denied"]))
          }
        }
      }
    case .denied, .restricted:
      DispatchQueue.main.async {
        self.delegate?.mrzScannerDidFail(with: NSError(domain: "CameraError", code: 1001, userInfo: [NSLocalizedDescriptionKey: "Camera permission denied or restricted"]))
      }
    @unknown default:
      DispatchQueue.main.async {
        self.delegate?.mrzScannerDidFail(with: NSError(domain: "CameraError", code: 1001, userInfo: [NSLocalizedDescriptionKey: "Camera permission unknown status"]))
      }
    }
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    startCamera()
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    stopCamera()
  }

  private func setupCamera() {
    captureSession = AVCaptureSession()
    captureSession?.sessionPreset = .high

    // Check camera availability first
    guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
      DispatchQueue.main.async {
        self.delegate?.mrzScannerDidFail(with: NSError(domain: "CameraError", code: 1001, userInfo: [NSLocalizedDescriptionKey: "Camera permission not granted"]))
      }
      return
    }

    guard let videoCaptureDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
      DispatchQueue.main.async {
        self.delegate?.mrzScannerDidFail(with: NSError(domain: "CameraError", code: 1002, userInfo: [NSLocalizedDescriptionKey: "Camera not available on this device"]))
      }
      return
    }

    guard let videoInput = try? AVCaptureDeviceInput(device: videoCaptureDevice) else {
      DispatchQueue.main.async {
        self.delegate?.mrzScannerDidFail(with: NSError(domain: "CameraError", code: 1003, userInfo: [NSLocalizedDescriptionKey: "Failed to create camera input"]))
      }
      return
    }

    guard let captureSession = captureSession, captureSession.canAddInput(videoInput) else {
      DispatchQueue.main.async {
        self.delegate?.mrzScannerDidFail(with: NSError(domain: "CameraError", code: 1004, userInfo: [NSLocalizedDescriptionKey: "Cannot add camera input to session"]))
      }
      return
    }

    captureSession.addInput(videoInput)

    let videoOutput = AVCaptureVideoDataOutput()
    videoOutput.setSampleBufferDelegate(self, queue: DispatchQueue(label: "videoQueue"))

    if captureSession.canAddOutput(videoOutput) {
      captureSession.addOutput(videoOutput)
    }

    previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
    previewLayer?.videoGravity = .resizeAspectFill
  }

  private func setupUI() {
    view.backgroundColor = .black

    // Add preview layer
    if let previewLayer = previewLayer {
      previewLayer.frame = view.bounds
      view.layer.addSublayer(previewLayer)
    }

    // Overlay view
    overlayView.backgroundColor = UIColor.black.withAlphaComponent(0.6)
    overlayView.frame = view.bounds
    view.addSubview(overlayView)

    // Frame view for MRZ area
    frameView.layer.borderColor = UIColor.green.cgColor
    frameView.layer.borderWidth = 2
    frameView.backgroundColor = .clear
    view.addSubview(frameView)

    // Title
    titleLabel.text = "MRZ Scanner"
    titleLabel.font = UIFont.boldSystemFont(ofSize: 24)
    titleLabel.textColor = .white
    titleLabel.textAlignment = .center
    view.addSubview(titleLabel)

    // Instruction
    instructionLabel.text = "Position the MRZ (bottom 2 lines) within the green frame"
    instructionLabel.font = UIFont.systemFont(ofSize: 16)
    instructionLabel.textColor = .white
    instructionLabel.textAlignment = .center
    instructionLabel.numberOfLines = 0
    view.addSubview(instructionLabel)

    // Hint
    hintLabel.text = "Hold passport flat • Ensure good lighting"
    hintLabel.font = UIFont.systemFont(ofSize: 14)
    hintLabel.textColor = UIColor(white: 0.8, alpha: 1.0)
    hintLabel.textAlignment = .center
    view.addSubview(hintLabel)

    // Close button
    let closeButton = UIButton(type: .system)
    closeButton.setTitle("✕", for: .normal)
    closeButton.titleLabel?.font = UIFont.systemFont(ofSize: 30)
    closeButton.setTitleColor(.white, for: .normal)
    closeButton.addTarget(self, action: #selector(closeButtonTapped), for: .touchUpInside)
    view.addSubview(closeButton)

    // Layout
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    instructionLabel.translatesAutoresizingMaskIntoConstraints = false
    hintLabel.translatesAutoresizingMaskIntoConstraints = false
    frameView.translatesAutoresizingMaskIntoConstraints = false
    closeButton.translatesAutoresizingMaskIntoConstraints = false

    NSLayoutConstraint.activate([
      titleLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
      titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
      titleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),

      instructionLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 20),
      instructionLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
      instructionLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),

      hintLabel.topAnchor.constraint(equalTo: instructionLabel.bottomAnchor, constant: 10),
      hintLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
      hintLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),

      frameView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      frameView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
      frameView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
      frameView.heightAnchor.constraint(equalToConstant: 120),

      closeButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 10),
      closeButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
      closeButton.widthAnchor.constraint(equalToConstant: 44),
      closeButton.heightAnchor.constraint(equalToConstant: 44)
    ])

    // Create cutout in overlay
    updateOverlayMask()
  }

  private func updateOverlayMask() {
    let path = UIBezierPath(rect: overlayView.bounds)
    let cutoutPath = UIBezierPath(rect: frameView.frame)
    path.append(cutoutPath)
    path.usesEvenOddFillRule = true

    let maskLayer = CAShapeLayer()
    maskLayer.path = path.cgPath
    maskLayer.fillRule = .evenOdd
    overlayView.layer.mask = maskLayer
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    previewLayer?.frame = view.bounds
    overlayView.frame = view.bounds
    updateOverlayMask()
  }

  private func startCamera() {
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      self?.captureSession?.startRunning()
    }
  }

  private func stopCamera() {
    captureSession?.stopRunning()
  }

  @objc private func closeButtonTapped() {
    dismiss(animated: true)
  }

  private func handleDetectedMRZ(_ mrzData: MRZData) {
    guard !isProcessing else { return }
    isProcessing = true

    DispatchQueue.main.async { [weak self] in
      self?.stopCamera()
      self?.delegate?.mrzScannerDidScan(mrzData)
      self?.dismiss(animated: true)
    }
  }
}

// MARK: - AVCaptureVideoDataOutputSampleBufferDelegate

extension MRZScannerViewController: AVCaptureVideoDataOutputSampleBufferDelegate {

  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    guard !isProcessing,
          let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
      return
    }

    let requestHandler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])
    let request = VNRecognizeTextRequest { [weak self] request, error in
      self?.handleTextRecognition(request: request, error: error)
    }

    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false

    try? requestHandler.perform([request])
  }

  private func handleTextRecognition(request: VNRequest, error: Error?) {
    guard let observations = request.results as? [VNRecognizedTextObservation] else {
      return
    }

    var allText: [String] = []

    for observation in observations {
      guard let topCandidate = observation.topCandidates(1).first else { continue }
      allText.append(topCandidate.string)
    }

    // Try to parse MRZ from recognized text
    if let mrzData = parseMRZ(from: allText) {
      handleDetectedMRZ(mrzData)
    }
  }

  private func parseMRZ(from lines: [String]) -> MRZData? {
    // MRZ parsing logic
    // TD3 (passport): 2 lines of 44 characters each
    // TD1 (ID card): 3 lines of 30 characters each

    let cleanedLines = lines.map { $0.replacingOccurrences(of: " ", with: "") }
      .filter { $0.count >= 30 }

    // Try TD3 (Passport)
    if cleanedLines.count >= 2 {
      let line1 = cleanedLines[cleanedLines.count - 2]
      let line2 = cleanedLines[cleanedLines.count - 1]

      if line1.count == 44 && line2.count == 44 {
        return parseTD3(line1: line1, line2: line2)
      }
    }

    // Try TD1 (ID Card)
    if cleanedLines.count >= 3 {
      let line1 = cleanedLines[cleanedLines.count - 3]
      let line2 = cleanedLines[cleanedLines.count - 2]
      let line3 = cleanedLines[cleanedLines.count - 1]

      if line1.count == 30 && line2.count == 30 && line3.count == 30 {
        return parseTD1(line1: line1, line2: line2, line3: line3)
      }
    }

    return nil
  }

  private func parseTD3(line1: String, line2: String) -> MRZData? {
    // Line 2 format: DocumentNumber(9) CheckDigit(1) Nationality(3) DOB(6) CheckDigit(1) Gender(1) Expiry(6) ...
    let docNumber = String(line2.prefix(9)).trimmingCharacters(in: CharacterSet(charactersIn: "<"))
    let dob = String(line2.dropFirst(13).prefix(6))
    let expiry = String(line2.dropFirst(21).prefix(6))

    // Validate
    guard docNumber.count > 0,
          dob.count == 6,
          expiry.count == 6 else {
      return nil
    }

    return MRZData(documentNumber: docNumber, dateOfBirth: dob, dateOfExpiry: expiry)
  }

  private func parseTD1(line1: String, line2: String, line3: String) -> MRZData? {
    // Line 1: DocumentType(2) IssuingState(3) DocumentNumber(9)
    let docNumber = String(line1.dropFirst(5).prefix(9)).trimmingCharacters(in: CharacterSet(charactersIn: "<"))

    // Line 2: DOB(6) CheckDigit(1) Gender(1) Expiry(6) ...
    let dob = String(line2.prefix(6))
    let expiry = String(line2.dropFirst(8).prefix(6))

    // Validate
    guard docNumber.count > 0,
          dob.count == 6,
          expiry.count == 6 else {
      return nil
    }

    return MRZData(documentNumber: docNumber, dateOfBirth: dob, dateOfExpiry: expiry)
  }
}