package com.forumfeedapp.mlkit.text;

import android.graphics.Color;
import android.os.Handler;
import android.util.Log;

import androidx.annotation.NonNull;

import com.forumfeedapp.mlkit.other.FrameMetadata;
import com.forumfeedapp.mlkit.other.GraphicOverlay;
import com.forumfeedapp.model.DocType;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.android.gms.tasks.Task;
import com.google.mlkit.common.MlKitException;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import net.sf.scuba.data.Gender;

import org.jmrtd.lds.icao.MRZInfo;

import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class TextRecognitionProcessor {

    private static final String TAG = TextRecognitionProcessor.class.getName();

    private final TextRecognizer textRecognizer;

    private ResultListener resultListener;

    private String scannedTextBuffer;

    private DocType docType;

    public static final String TYPE_PASSPORT = "P<";

    public static final String PASSPORT_TD_3_LINE_1_REGEX = "(P[A-Z0-9<]{1})([A-Z]{3})([A-Z0-9<]{39})";

    public static final String PASSPORT_TD_3_LINE_2_REGEX = "([A-Z0-9<]{9})([0-9]{1})([A-Z]{3})([0-9]{6})([0-9]{1})([M|F|X|<]{1})([0-9]{6})([0-9]{1})([A-Z0-9<]{14})([0-9<]{1})([0-9]{1})";

    // TD1 (ID Card) - 3 lines, 30 characters each
    // More flexible patterns to handle various TD1 formats
    public static final String ID_TD_1_LINE_1_REGEX = "(I[A-Z0-9<]{1})([A-Z]{3})([A-Z0-9<]{25})";
    public static final String ID_TD_1_LINE_2_REGEX = "([0-9]{6}[0-9A-Z]{1})([0-9]{1})([M|F|X|<]{1})([0-9]{6}[0-9A-Z]{1})([0-9]{1})([A-Z]{3})([A-Z0-9<]{11})";
    public static final String ID_TD_1_LINE_3_REGEX = "([A-Z<][A-Z<]+)([A-Z0-9<]*)";

    // TD2 (ID Card/Visa) - 2 lines, 36 characters each  
    public static final String ID_TD_2_LINE_1_REGEX = "([A-Z0-9<]{2})([A-Z]{3})([A-Z0-9<]{31})";
    public static final String ID_TD_2_LINE_2_REGEX = "([A-Z0-9<]{9})([0-9]{1})([A-Z]{3})([0-9]{6})([0-9]{1})([M|F|X|<]{1})([0-9]{6})([0-9]{1})([A-Z0-9<]{7})([0-9]{1})";

    // Whether we should ignore process(). This is usually caused by feeding input data faster than
    // the model can handle.
    private final AtomicBoolean shouldThrottle = new AtomicBoolean(false);
    
    // Whether we have already found and processed a valid MRZ
    private final AtomicBoolean mrzProcessed = new AtomicBoolean(false);

    public TextRecognitionProcessor(DocType docType, ResultListener resultListener) {
        this.docType = docType;
        this.resultListener = resultListener;
        textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
    }

    //region ----- Exposed Methods -----


    public void stop() {
        textRecognizer.close();
    }


    public void process(ByteBuffer data, FrameMetadata frameMetadata, GraphicOverlay graphicOverlay) throws MlKitException {

        if (shouldThrottle.get()) {
            return;
        }
        
        if (mrzProcessed.get()) {
            return; // Stop processing if we've already found a valid MRZ
        }

        InputImage inputImage = InputImage.fromByteBuffer(data,
                frameMetadata.getWidth(),
                frameMetadata.getHeight(),
                frameMetadata.getRotation(),
                InputImage.IMAGE_FORMAT_NV21);

        detectInVisionImage(inputImage, frameMetadata, graphicOverlay);
    }

    //endregion

    //region ----- Helper Methods -----

    protected Task<Text> detectInImage(InputImage image) {
        return textRecognizer.process(image);
    }


    protected void onSuccess(@NonNull Text results, @NonNull FrameMetadata frameMetadata, @NonNull GraphicOverlay graphicOverlay) {

        graphicOverlay.clear();

        scannedTextBuffer = "";

        List<Text.TextBlock> blocks = results.getTextBlocks();

        for (int i = 0; i < blocks.size(); i++) {
            List<Text.Line> lines = blocks.get(i).getLines();
            for (int j = 0; j < lines.size(); j++) {
                List<Text.Element> elements = lines.get(j).getElements();
                for (int k = 0; k < elements.size(); k++) {
                    filterScannedText(graphicOverlay, elements.get(k));
                }
            }
        }
    }

    private void filterScannedText(GraphicOverlay graphicOverlay, Text.Element element) {
        try {
            GraphicOverlay.Graphic textGraphic = new TextGraphic(graphicOverlay, element, Color.GREEN);
            graphicOverlay.add(textGraphic);
            
            // Safe text extraction
            String elementText = "";
            try {
                elementText = element.getText();
                if (elementText != null) {
                    scannedTextBuffer += elementText;
                } else {
                    Log.w(TAG, "Element text is null");
                }
            } catch (Exception textError) {
                Log.e(TAG, "Error getting element text: " + textError.getMessage(), textError);
                return;
            }

            // Process different document types
            if (docType == DocType.PASSPORT) {
                processPassportMRZ();
            } else if (docType == DocType.ID_CARD) {
                processIDCardMRZ();
            }
        
        } catch (Exception e) {
            Log.e(TAG, "Error in filterScannedText: " + e.getMessage(), e);
            if (resultListener != null) {
                resultListener.onError(e);
            }
        }
    }

    private void processPassportMRZ() {
        try {
            Pattern patternPassportTD3Line1 = Pattern.compile(PASSPORT_TD_3_LINE_1_REGEX);
            Matcher matcherPassportTD3Line1 = patternPassportTD3Line1.matcher(scannedTextBuffer);

            Pattern patternPassportTD3Line2 = Pattern.compile(PASSPORT_TD_3_LINE_2_REGEX);
            Matcher matcherPassportTD3Line2 = patternPassportTD3Line2.matcher(scannedTextBuffer);

            if(matcherPassportTD3Line1.find() && matcherPassportTD3Line2.find()) {
                try {
                    String line2 = matcherPassportTD3Line2.group(0);
                    
                    // Add comprehensive bounds checking
                    if (line2 == null) {
                        Log.w(TAG, "Passport line2 is null");
                        return;
                    }
                    
                    if (line2.length() < 27) {
                        Log.w(TAG, "Passport line2 too short: " + line2.length() + " chars: '" + line2 + "'");
                        return;
                    }
                    
                    // Safe substring extraction with additional bounds checks
                    String documentNumber = "";
                    String dateOfBirthDay = "";
                    String expiryDate = "";
                    
                    try {
                        if (line2.length() >= 9) {
                            documentNumber = line2.substring(0, 9).replace("O", "0").replace("<", "");
                        }
                        if (line2.length() >= 19) {
                            dateOfBirthDay = line2.substring(13, 19);
                        }
                        if (line2.length() >= 27) {
                            expiryDate = line2.substring(21, 27);
                        }
                        
                        // Validate extracted data
                        if (documentNumber.trim().isEmpty() || dateOfBirthDay.trim().isEmpty() || expiryDate.trim().isEmpty()) {
                            Log.w(TAG, "Extracted data is empty - Doc: '" + documentNumber + "' DOB: '" + dateOfBirthDay + "' Exp: '" + expiryDate + "'");
                            return;
                        }
                        
                    } catch (Exception substringError) {
                        Log.e(TAG, "Error extracting passport data: " + substringError.getMessage(), substringError);
                        return;
                    }

                    Log.d(TAG, "Scanned Text Buffer Passport ->>>> " + "Doc Number: " + documentNumber + " DateOfBirth: " + dateOfBirthDay + " ExpiryDate: " + expiryDate);

                    try {
                        MRZInfo mrzInfo = buildTempMrz(documentNumber, dateOfBirthDay, expiryDate);
                        
                        if (mrzInfo != null) {
                            // Set flag to prevent duplicate processing
                            if (mrzProcessed.compareAndSet(false, true)) {
                                Log.d(TAG, "MRZInfo created successfully, finishing scan");
                                finishScanning(mrzInfo);
                            } else {
                                Log.d(TAG, "MRZ already processed, ignoring duplicate");
                            }
                        } else {
                            Log.w(TAG, "MRZInfo is null, cannot finish scanning");
                        }
                    } catch (Exception mrzError) {
                        Log.e(TAG, "Error creating or processing MRZInfo: " + mrzError.getMessage(), mrzError);
                        resultListener.onError(mrzError);
                    }
                        
                } catch (Exception e) {
                    Log.e(TAG, "Error processing passport MRZ data: " + e.getMessage(), e);
                    resultListener.onError(e);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing passport MRZ: " + e.getMessage(), e);
            if (resultListener != null) {
                resultListener.onError(e);
            }
        }
    }

    private void processIDCardMRZ() {
        try {
            // Log the scanned buffer for debugging
            Log.d(TAG, "Processing ID Card MRZ. Buffer length: " + scannedTextBuffer.length());
            if (scannedTextBuffer.length() > 0) {
                // Log first 100 chars or full buffer if shorter
                String preview = scannedTextBuffer.substring(0, Math.min(scannedTextBuffer.length(), 100));
                Log.d(TAG, "Buffer preview: " + preview);
            }
            
            // Try TD1 format (3 lines, 30 chars each)
            Pattern patternTD1Line1 = Pattern.compile(ID_TD_1_LINE_1_REGEX);
            Pattern patternTD1Line2 = Pattern.compile(ID_TD_1_LINE_2_REGEX);
            Pattern patternTD1Line3 = Pattern.compile(ID_TD_1_LINE_3_REGEX);
            
            Matcher matcherTD1Line1 = patternTD1Line1.matcher(scannedTextBuffer);
            Matcher matcherTD1Line2 = patternTD1Line2.matcher(scannedTextBuffer);
            Matcher matcherTD1Line3 = patternTD1Line3.matcher(scannedTextBuffer);

            boolean line1Found = matcherTD1Line1.find();
            boolean line2Found = matcherTD1Line2.find();
            boolean line3Found = matcherTD1Line3.find();
            
            Log.d(TAG, "TD1 detection - Line1: " + line1Found + ", Line2: " + line2Found + ", Line3: " + line3Found);
            
            if (line1Found && line2Found && line3Found) {
                processTD1Format(matcherTD1Line1, matcherTD1Line2, matcherTD1Line3);
                return;
            }

            // Try TD2 format (2 lines, 36 chars each)
            Pattern patternTD2Line1 = Pattern.compile(ID_TD_2_LINE_1_REGEX);
            Pattern patternTD2Line2 = Pattern.compile(ID_TD_2_LINE_2_REGEX);
            
            Matcher matcherTD2Line1 = patternTD2Line1.matcher(scannedTextBuffer);
            Matcher matcherTD2Line2 = patternTD2Line2.matcher(scannedTextBuffer);

            if (matcherTD2Line1.find() && matcherTD2Line2.find()) {
                processTD2Format(matcherTD2Line1, matcherTD2Line2);
                return;
            }

        } catch (Exception e) {
            Log.e(TAG, "Error processing ID card MRZ: " + e.getMessage(), e);
            if (resultListener != null) {
                resultListener.onError(e);
            }
        }
    }

    private void processTD1Format(Matcher line1, Matcher line2, Matcher line3) {
        try {
            String line1Text = line1.group(0);
            String line2Text = line2.group(0);
            
            if (line1Text == null || line2Text == null) {
                Log.w(TAG, "TD1 line data is null");
                return;
            }
            
            Log.d(TAG, "TD1 Line 1: " + line1Text);
            Log.d(TAG, "TD1 Line 2: " + line2Text);
            
            if (line1Text.length() < 30 || line2Text.length() < 30) {
                Log.w(TAG, "TD1 lines too short - Line1: " + line1Text.length() + " Line2: " + line2Text.length());
                return;
            }
            
            // Extract data from TD1 format
            // For Kazakhstan ID: document number is at positions 5-14 in line 1
            // But some IDs have longer document numbers, so we need to be flexible
            String documentNumber = "";
            if (line1Text.startsWith("ID")) {
                // Extract everything after country code until we hit multiple <
                String afterCountry = line1Text.substring(5);
                int endIndex = afterCountry.indexOf("<<");
                if (endIndex == -1) endIndex = afterCountry.indexOf("<O");
                if (endIndex == -1) endIndex = 14; // fallback to fixed position
                documentNumber = afterCountry.substring(0, Math.min(endIndex, 14)).replace("O", "0").replace("<", "");
            } else {
                documentNumber = line1Text.substring(5, Math.min(line1Text.length(), 14)).replace("O", "0").replace("<", "");
            }
            
            // Date of birth is at positions 0-6 in line 2 (YYMMDD format)
            String dateOfBirth = line2Text.substring(0, 6);
            
            // Date of expiry is at positions 8-14 in line 2
            String dateOfExpiry = line2Text.substring(8, 14);
            
            // Clean up the values
            documentNumber = documentNumber.trim();
            dateOfBirth = dateOfBirth.replace("O", "0").trim();
            dateOfExpiry = dateOfExpiry.replace("O", "0").trim();
            
            // Validate extracted data
            if (documentNumber.isEmpty() || dateOfBirth.isEmpty() || dateOfExpiry.isEmpty()) {
                Log.w(TAG, "TD1 extracted data is empty - Doc: '" + documentNumber + "' DOB: '" + dateOfBirth + "' Exp: '" + dateOfExpiry + "'");
                return;
            }
            
            Log.d(TAG, "Scanned TD1 ID Card ->>>> Doc Number: " + documentNumber + " DateOfBirth: " + dateOfBirth + " ExpiryDate: " + dateOfExpiry);
            
            processMRZData(documentNumber, dateOfBirth, dateOfExpiry);
            
        } catch (Exception e) {
            Log.e(TAG, "Error processing TD1 format: " + e.getMessage(), e);
            if (resultListener != null) {
                resultListener.onError(e);
            }
        }
    }

    private void processTD2Format(Matcher line1, Matcher line2) {
        try {
            String line2Text = line2.group(0);
            
            if (line2Text == null) {
                Log.w(TAG, "TD2 line2 data is null");
                return;
            }
            
            if (line2Text.length() < 27) {
                Log.w(TAG, "TD2 line2 too short: " + line2Text.length() + " chars");
                return;
            }
            
            // Extract data from TD2 format (similar to passport TD3 line 2)
            String documentNumber = line2Text.substring(0, 9).replace("O", "0").replace("<", "");
            String dateOfBirth = line2Text.substring(13, 19);
            String dateOfExpiry = line2Text.substring(21, 27);
            
            // Validate extracted data
            if (documentNumber.trim().isEmpty() || dateOfBirth.trim().isEmpty() || dateOfExpiry.trim().isEmpty()) {
                Log.w(TAG, "TD2 extracted data is empty");
                return;
            }
            
            Log.d(TAG, "Scanned TD2 ID Card ->>>> Doc Number: " + documentNumber + " DateOfBirth: " + dateOfBirth + " ExpiryDate: " + dateOfExpiry);
            
            processMRZData(documentNumber, dateOfBirth, dateOfExpiry);
            
        } catch (Exception e) {
            Log.e(TAG, "Error processing TD2 format: " + e.getMessage(), e);
            if (resultListener != null) {
                resultListener.onError(e);
            }
        }
    }

    private void processMRZData(String documentNumber, String dateOfBirth, String dateOfExpiry) {
        try {
            MRZInfo mrzInfo = buildTempMrz(documentNumber, dateOfBirth, dateOfExpiry);
            
            if (mrzInfo != null) {
                // Set flag to prevent duplicate processing
                if (mrzProcessed.compareAndSet(false, true)) {
                    Log.d(TAG, "MRZInfo created successfully, finishing scan");
                    finishScanning(mrzInfo);
                } else {
                    Log.d(TAG, "MRZ already processed, ignoring duplicate");
                }
            } else {
                Log.w(TAG, "MRZInfo is null, cannot finish scanning");
            }
        } catch (Exception mrzError) {
            Log.e(TAG, "Error creating or processing MRZInfo: " + mrzError.getMessage(), mrzError);
            if (resultListener != null) {
                resultListener.onError(mrzError);
            }
        }
    }

    protected void onFailure(@NonNull Exception e) {
        Log.w(TAG, "Text detection failed." + e);
        resultListener.onError(e);
    }

    private void detectInVisionImage(InputImage image, final FrameMetadata metadata, final GraphicOverlay graphicOverlay) {

        detectInImage(image)
                .addOnSuccessListener(
                        new OnSuccessListener<Text>() {
                            @Override
                            public void onSuccess(Text results) {
                                shouldThrottle.set(false);
                                TextRecognitionProcessor.this.onSuccess(results, metadata, graphicOverlay);
                            }
                        })
                .addOnFailureListener(
                        new OnFailureListener() {
                            @Override
                            public void onFailure(@NonNull Exception e) {
                                shouldThrottle.set(false);
                                TextRecognitionProcessor.this.onFailure(e);
                            }
                        });
        // Begin throttling until this frame of input has been processed, either in onSuccess or
        // onFailure.
        shouldThrottle.set(true);
    }

    private void finishScanning(final MRZInfo mrzInfo) {
        try {
            if (mrzInfo == null) {
                Log.e(TAG, "Cannot finish scanning - MRZInfo is null");
                return;
            }
            
            if (resultListener == null) {
                Log.e(TAG, "Cannot finish scanning - ResultListener is null");
                return;
            }
            
            if(isMrzValid(mrzInfo)) {
                Log.d(TAG, "MRZ is valid, scheduling success callback");
                // Delay returning result 1 sec. in order to make mrz text become visible on graphicOverlay by user
                // You want to call 'resultListener.onSuccess(mrzInfo)' without no delay
                new Handler().postDelayed(() -> {
                    try {
                        if (resultListener != null) {
                            resultListener.onSuccess(mrzInfo);
                        }
                    } catch (Exception callbackError) {
                        Log.e(TAG, "Error calling success callback: " + callbackError.getMessage(), callbackError);
                    }
                }, 1000);
            } else {
                Log.w(TAG, "MRZ data is not valid");
            }

        } catch(Exception exp) {
            Log.e(TAG, "Error in finishScanning: " + exp.getMessage(), exp);
            if (resultListener != null) {
                resultListener.onError(exp);
            }
        }
    }

    private MRZInfo buildTempMrz(String documentNumber, String dateOfBirth, String expiryDate) {
        MRZInfo mrzInfo = null;
        try {
            mrzInfo = new MRZInfo("P","NNN", "", "", documentNumber, "NNN", dateOfBirth, Gender.UNSPECIFIED, expiryDate, "");
        } catch (Exception e) {
            Log.d(TAG, "MRZInfo error : " + e.getLocalizedMessage());
        }

        return mrzInfo;
    }

    private boolean isMrzValid(MRZInfo mrzInfo) {
        return mrzInfo.getDocumentNumber() != null && mrzInfo.getDocumentNumber().length() >= 8 &&
                mrzInfo.getDateOfBirth() != null && mrzInfo.getDateOfBirth().length() == 6 &&
                mrzInfo.getDateOfExpiry() != null && mrzInfo.getDateOfExpiry().length() == 6;
    }

    public interface ResultListener {
        void onSuccess(MRZInfo mrzInfo);
        void onError(Exception exp);
    }
}

