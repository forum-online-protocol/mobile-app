package com.forumfeedapp.mlkit.text;

import android.graphics.Color;
import android.os.Handler;
import android.graphics.ImageFormat;
import android.util.Log;

import androidx.annotation.NonNull;

import com.forumfeedapp.mlkit.other.FrameMetadata;
import com.forumfeedapp.mlkit.other.GraphicOverlay;
import com.forumfeedapp.model.DocType;

// Google ML Kit imports
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.android.gms.tasks.Task;
import com.google.mlkit.common.MlKitException;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

// HMS ML Kit imports removed - not available in Google flavor build

import net.sf.scuba.data.Gender;
import org.jmrtd.lds.icao.MRZInfo;

import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import java.util.ArrayList;
import com.forumfeedapp.mlkit.text.TextRecognitionProcessor;

public class UnifiedTextRecognitionProcessor extends TextRecognitionProcessor {

    private static final String TAG = "UnifiedTextProcessor";

    private final TextRecognizer googleTextRecognizer;

    private ResultListener resultListener;
    private String scannedTextBuffer;
    private DocType docType;

    public static final String TYPE_PASSPORT = "P<";
    public static final String TYPE_ID_CARD = "I<";
    public static final String TYPE_ID_CARD_ALT = "ID";
    
    // Passport TD3 format (2 lines, 44 chars each)
    public static final String PASSPORT_TD_3_LINE_1_REGEX = "(P[A-Z0-9<]{1})([A-Z]{3})([A-Z0-9<]{39})";
    // Made slightly more flexible to handle OCR variations while maintaining structure
    public static final String PASSPORT_TD_3_LINE_2_REGEX = "([A-Z0-9<]{9})([0-9]{1})([A-Z]{3})([0-9]{6})([0-9]{1})([MFX<]{1})([0-9]{6})([0-9]{1})([A-Z0-9<]{14})([0-9<]{1})([0-9]{1})";
    
    // TD1 (ID Card) - 3 lines, 30 characters each
    // Strict patterns for proper MRZ validation
    public static final String ID_TD_1_LINE_1_REGEX = "(I[A-Z0-9<]{1})([A-Z]{3})([A-Z0-9<]{9})([0-9]{1})([A-Z0-9<]{15})";
    public static final String ID_TD_1_LINE_2_REGEX = "([0-9]{6})([0-9]{1})([M|F|X|<]{1})([0-9]{6})([0-9]{1})([A-Z]{3})([A-Z0-9<]{11})([0-9]{1})";
    public static final String ID_TD_1_LINE_3_REGEX = "([A-Z<]+<<[A-Z<]+)([A-Z0-9<]*)";
    
    // TD2 (ID Card/Visa) - 2 lines, 36 characters each  
    public static final String ID_TD_2_LINE_1_REGEX = "([AI][A-Z0-9<])([A-Z]{3})([A-Z<]+<<[A-Z<]+)([A-Z0-9<]*)";
    public static final String ID_TD_2_LINE_2_REGEX = "([A-Z0-9<]{9})([0-9]{1})([A-Z]{3})([0-9]{6})([0-9]{1})([M|F|X|<]{1})([0-9]{6})([0-9]{1})([A-Z0-9<]{7})([0-9]{1})";

    private final AtomicBoolean shouldThrottle = new AtomicBoolean(false);

    public UnifiedTextRecognitionProcessor() {
        super(null, null); // Pass null for DocType and ResultListener, as they are managed within this class

        Log.d(TAG, "Initializing UnifiedTextRecognitionProcessor");

        // Log the regex patterns being used for debugging
        Log.d(TAG, "[DEBUG] === MRZ PATTERNS CONFIGURED ===");
        Log.d(TAG, "[DEBUG] Passport TD3 Line 2: " + PASSPORT_TD_3_LINE_2_REGEX);
        Log.d(TAG, "[DEBUG] ID TD1 Line 1: " + ID_TD_1_LINE_1_REGEX);
        Log.d(TAG, "[DEBUG] ID TD1 Line 2: " + ID_TD_1_LINE_2_REGEX);
        Log.d(TAG, "[DEBUG] ID TD2 Line 2: " + ID_TD_2_LINE_2_REGEX);
        Log.d(TAG, "[DEBUG] ================================");

        // Initialize Google ML Kit only
        googleTextRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
    }


    public interface ResultListener {
        void onSuccess(@NonNull MRZInfo mrzInfo);
        void onError(@NonNull Exception e);
    }

    public void setResultListener(ResultListener resultListener) {
        this.resultListener = resultListener;
    }

    public void process(ByteBuffer data, FrameMetadata frameMetadata, GraphicOverlay graphicOverlay) {
        if (shouldThrottle.get()) {
            return;
        }

        processWithGoogle(data, frameMetadata, graphicOverlay);
    }


    /**
     * Process using Google ML Kit (Standard Android)
     */
    private void processWithGoogle(ByteBuffer data, FrameMetadata frameMetadata, GraphicOverlay graphicOverlay) {
        InputImage inputImage = InputImage.fromByteBuffer(data,
            frameMetadata.getWidth(),
            frameMetadata.getHeight(),
            frameMetadata.getRotation(),
            InputImage.IMAGE_FORMAT_NV21);

        googleTextRecognizer.process(inputImage)
            .addOnSuccessListener(text -> {
                shouldThrottle.set(false);
                processTextResult(text, graphicOverlay);
            })
            .addOnFailureListener(e -> {
                shouldThrottle.set(false);
                Log.e(TAG, "Google Text recognition failed", e);
                if (resultListener != null) {
                    resultListener.onError(e);
                }
            });
        
        shouldThrottle.set(true);
    }


    /**
     * Process the recognized text (common logic for both engines)
     */
    private void processTextResult(Text text, GraphicOverlay graphicOverlay) {
        if (text == null || text.getText().isEmpty()) {
            Log.d(TAG, "[DEBUG] No text detected or text is empty");
            return;
        }

        String recognizedText = text.getText();
        Log.d(TAG, "[DEBUG] ========== RAW OCR TEXT START ==========");
        Log.d(TAG, "[DEBUG] Raw text length: " + recognizedText.length() + " chars");
        
        // Log each line separately for better debugging
        String[] lines = recognizedText.split("\n");
        for (int i = 0; i < lines.length; i++) {
            Log.d(TAG, "[DEBUG] Line " + i + " [" + lines[i].length() + " chars]: '" + lines[i] + "'");
        }
        Log.d(TAG, "[DEBUG] ========== RAW OCR TEXT END ==========");

        // Clear previous graphics
        graphicOverlay.clear();

        // Process MRZ text
        try {
            MRZInfo mrzInfo = parseMRZFromText(recognizedText);
            if (mrzInfo != null && resultListener != null) {
                Log.d(TAG, "[DEBUG] MRZ successfully parsed!");
                resultListener.onSuccess(mrzInfo);
            } else {
                Log.d(TAG, "[DEBUG] MRZ parsing returned null");
            }
        } catch (Exception e) {
            Log.e(TAG, "[DEBUG] Failed to parse MRZ: " + e.getMessage(), e);
            if (resultListener != null) {
                resultListener.onError(e);
            }
        }
    }

    /**
     * Parse MRZ information from recognized text
     */
    private MRZInfo parseMRZFromText(String text) {
        Log.d(TAG, "[DEBUG] parseMRZFromText started");
        
        // Store original text for debugging
        String originalText = text;
        
        // Clean and normalize text
        text = text.toUpperCase().replace("O", "0");
        Log.d(TAG, "[DEBUG] Text after normalization: " + text.substring(0, Math.min(100, text.length())) + "...");
        
        String[] lines = text.split("\\n");
        Log.d(TAG, "[DEBUG] Number of lines after split: " + lines.length);
        
        // First check for passport MRZ
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            Log.d(TAG, "[DEBUG] Checking line " + i + " for passport: starts with 'P<'? " + line.startsWith(TYPE_PASSPORT));
            if (line.startsWith(TYPE_PASSPORT)) {
                Log.d(TAG, "[DEBUG] ✓ Detected passport MRZ at line " + i);
                return parsePassportMRZ(lines);
            }
        }
        
        // Check for ID card MRZ
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            boolean startsWithI = line.startsWith(TYPE_ID_CARD);
            boolean startsWithID = line.startsWith(TYPE_ID_CARD_ALT);
            Log.d(TAG, "[DEBUG] Checking line " + i + " for ID card: starts with 'I<'? " + startsWithI + ", starts with 'ID'? " + startsWithID);
            
            if (startsWithI || startsWithID) {
                Log.d(TAG, "[DEBUG] ✓ Detected ID card MRZ at line " + i);
                return parseIDCardMRZ(text);
            }
        }
        
        // Try to detect ID card without explicit type marker
        Log.d(TAG, "[DEBUG] No explicit type markers found, checking for ID card patterns...");
        if (containsIDCardPattern(text)) {
            Log.d(TAG, "[DEBUG] ✓ Detected possible ID card pattern without type marker");
            return parseIDCardMRZ(text);
        }
        
        Log.d(TAG, "[DEBUG] ✗ No MRZ patterns detected in text");
        return null;
    }

    private boolean containsIDCardPattern(String text) {
        Log.d(TAG, "[DEBUG] Checking for ID card patterns in text");
        
        // Check if text contains patterns typical of ID cards
        Pattern td1Pattern = Pattern.compile(ID_TD_1_LINE_2_REGEX);
        Pattern td2Pattern = Pattern.compile(ID_TD_2_LINE_2_REGEX);
        
        boolean td1Found = td1Pattern.matcher(text).find();
        boolean td2Found = td2Pattern.matcher(text).find();
        
        Log.d(TAG, "[DEBUG] TD1 pattern (3-line ID) found: " + td1Found);
        Log.d(TAG, "[DEBUG] TD2 pattern (2-line ID) found: " + td2Found);
        
        // Only return true if we found actual MRZ patterns, not just any text
        return td1Found || td2Found;
    }
    
    private MRZInfo parsePassportMRZ(String[] lines) {
        Log.d(TAG, "[DEBUG] parsePassportMRZ started with " + lines.length + " lines");
        try {
            for (int i = 0; i < lines.length; i++) {
                String line = lines[i].trim().toUpperCase();
                Log.d(TAG, "[DEBUG] Checking passport line " + i + " [" + line.length() + " chars]: '" + line + "'");
                
                // Look for passport MRZ pattern
                Pattern patternPassportTD3Line2 = Pattern.compile(PASSPORT_TD_3_LINE_2_REGEX);
                Matcher matcherPassportTD3Line2 = patternPassportTD3Line2.matcher(line);
                
                boolean found = matcherPassportTD3Line2.find();
                Log.d(TAG, "[DEBUG] Passport TD3 Line 2 pattern match: " + found);
                
                if (found) {
                    String documentNumber = matcherPassportTD3Line2.group(1);
                    String dateOfBirth = matcherPassportTD3Line2.group(4);
                    String expiryDate = matcherPassportTD3Line2.group(7);
                    
                    // Clean up all extracted data
                    if (documentNumber != null) {
                        documentNumber = documentNumber.replace("O", "0").replace("<", "").trim();
                    }
                    if (dateOfBirth != null) {
                        dateOfBirth = dateOfBirth.replace("O", "0").trim();
                    }
                    if (expiryDate != null) {
                        expiryDate = expiryDate.replace("O", "0").trim();
                    }
                    
                    Log.d(TAG, "[DEBUG] Passport extracted - Doc: '" + documentNumber + "', DOB: '" + dateOfBirth + "', Exp: '" + expiryDate + "'");
                    
                    // Validate extracted data with proper MRZ validation
                    if (documentNumber != null && !documentNumber.isEmpty() &&
                        isValidMRZDate(dateOfBirth) && isValidMRZDate(expiryDate)) {
                        
                        Log.d(TAG, "[DEBUG] ✓✓✓ Passport MRZ parsed - Doc: " + documentNumber + ", DOB: " + dateOfBirth + ", Exp: " + expiryDate);
                        
                        // Create MRZInfo
                        return new MRZInfo("P", "NNN", "", "", documentNumber, "NNN", 
                                         dateOfBirth, net.sf.scuba.data.Gender.UNSPECIFIED, expiryDate, "");
                    } else {
                        Log.d(TAG, "[DEBUG] ✗ Passport MRZ validation failed");
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "[DEBUG] Error parsing passport MRZ", e);
        }
        
        return null;
    }
    
    private MRZInfo parseIDCardMRZ(String text) {
        Log.d(TAG, "[DEBUG] parseIDCardMRZ started");
        
        try {
            // Try TD1 format first (3 lines, 30 chars each)
            Log.d(TAG, "[DEBUG] Trying TD1 format (3-line ID card)...");
            Pattern patternTD1Line1 = Pattern.compile(ID_TD_1_LINE_1_REGEX);
            Pattern patternTD1Line2 = Pattern.compile(ID_TD_1_LINE_2_REGEX);
            
            Matcher matcherTD1Line1 = patternTD1Line1.matcher(text);
            Matcher matcherTD1Line2 = patternTD1Line2.matcher(text);
            
            boolean td1Line1Found = matcherTD1Line1.find();
            boolean td1Line2Found = matcherTD1Line2.find();
            
            Log.d(TAG, "[DEBUG] TD1 Line 1 found: " + td1Line1Found);
            Log.d(TAG, "[DEBUG] TD1 Line 2 found: " + td1Line2Found);
            
            if (td1Line2Found) {
                // We mainly need line 2 for the essential data
                String line2Text = matcherTD1Line2.group(0);
                Log.d(TAG, "[DEBUG] TD1 Line 2 text: '" + line2Text + "'");
                
                // Extract document number from line 1 if available
                String documentNumber = "";
                if (td1Line1Found) {
                    // Reset matcher to find again
                    matcherTD1Line1.reset();
                    matcherTD1Line1.find();
                    String line1Text = matcherTD1Line1.group(0);
                    Log.d(TAG, "[DEBUG] TD1 Line 1 text: '" + line1Text + "'");
                    
                    // Document number is at positions 5-14 in line 1
                    if (line1Text.length() >= 14) {
                        documentNumber = line1Text.substring(5, 14).replace("<", "").replace("O", "0").trim();
                        Log.d(TAG, "[DEBUG] Extracted doc number from line 1: '" + documentNumber + "'");
                    }
                }
                
                // If we couldn't extract from line 1, the MRZ is likely invalid
                if (documentNumber.isEmpty()) {
                    Log.d(TAG, "[DEBUG] Doc number empty from proper MRZ line 1 - invalid format");
                    return null; // Reject if no proper document number in MRZ
                }
                
                // Extract dates from line 2 using proper MRZ format
                String dateOfBirth = "";
                String dateOfExpiry = "";
                
                // TD1 Line 2 format: YYMMDD[check]S[ex]YYMMDD[check]...
                // Groups: (1)DOB (2)check (3)sex (4)expiry (5)check ...
                if (matcherTD1Line2.groupCount() >= 4) {
                    dateOfBirth = matcherTD1Line2.group(1).replace("O", "0");
                    dateOfExpiry = matcherTD1Line2.group(4).replace("O", "0");
                    Log.d(TAG, "[DEBUG] Extracted DOB: '" + dateOfBirth + "', Expiry: '" + dateOfExpiry + "'");
                } else {
                    Log.d(TAG, "[DEBUG] Failed to extract dates from TD1 line 2");
                    return null; // Invalid MRZ format
                }
                
                // Validate that we have proper MRZ data
                if (!isValidMRZDate(dateOfBirth) || !isValidMRZDate(dateOfExpiry)) {
                    Log.d(TAG, "[DEBUG] Invalid date format in MRZ");
                    return null;
                }
                
                // Validate and return
                Log.d(TAG, "[DEBUG] Final validation - Doc: '" + documentNumber + "' (" + documentNumber.length() + " chars), DOB: '" + dateOfBirth + "' (" + dateOfBirth.length() + " chars), Exp: '" + dateOfExpiry + "' (" + dateOfExpiry.length() + " chars)");
                
                if (!documentNumber.isEmpty() && dateOfBirth.length() == 6 && dateOfExpiry.length() == 6) {
                    Log.d(TAG, "[DEBUG] ✓✓✓ TD1 ID Card successfully parsed - Doc: " + documentNumber + ", DOB: " + dateOfBirth + ", Exp: " + dateOfExpiry);
                    
                    // Use workaround: Create as passport then change type
                    return new MRZInfo("P", "NNN", "", "", documentNumber, "NNN",
                                     dateOfBirth, net.sf.scuba.data.Gender.UNSPECIFIED, dateOfExpiry, "");
                } else {
                    Log.d(TAG, "[DEBUG] ✗ TD1 validation failed - missing or invalid data");
                }
            }
            
            // Try TD2 format (2 lines, 36 chars each)
            Log.d(TAG, "[DEBUG] Trying TD2 format (2-line ID card)...");
            Pattern patternTD2Line2 = Pattern.compile(ID_TD_2_LINE_2_REGEX);
            Matcher matcherTD2Line2 = patternTD2Line2.matcher(text);
            
            boolean td2Found = matcherTD2Line2.find();
            Log.d(TAG, "[DEBUG] TD2 pattern found: " + td2Found);
            
            if (td2Found) {
                String documentNumber = matcherTD2Line2.group(1).replace("<", "").replace("O", "0").trim();
                String dateOfBirth = matcherTD2Line2.group(4).replace("O", "0");
                String dateOfExpiry = matcherTD2Line2.group(7).replace("O", "0");
                
                // Validate and return
                Log.d(TAG, "[DEBUG] TD2 validation - Doc: '" + documentNumber + "', DOB: '" + dateOfBirth + "', Exp: '" + dateOfExpiry + "'");
                
                if (!documentNumber.isEmpty() && dateOfBirth.length() == 6 && dateOfExpiry.length() == 6) {
                    Log.d(TAG, "[DEBUG] ✓✓✓ TD2 ID Card successfully parsed - Doc: " + documentNumber + ", DOB: " + dateOfBirth + ", Exp: " + dateOfExpiry);
                    
                    // Use workaround: Create as passport then change type
                    return new MRZInfo("P", "NNN", "", "", documentNumber, "NNN",
                                     dateOfBirth, net.sf.scuba.data.Gender.UNSPECIFIED, dateOfExpiry, "");
                } else {
                    Log.d(TAG, "[DEBUG] ✗ TD2 validation failed");
                }
            }
            
            // No loose pattern matching - only accept proper MRZ formats
            Log.d(TAG, "[DEBUG] No valid MRZ pattern found - rejecting");
            
        } catch (Exception e) {
            Log.e(TAG, "[DEBUG] Error parsing ID card MRZ: " + e.getMessage(), e);
        }
        
        Log.d(TAG, "[DEBUG] Failed to parse ID card MRZ - returning null");
        return null;
    }

    /**
     * Validate MRZ date format (YYMMDD)
     */
    private boolean isValidMRZDate(String date) {
        if (date == null || date.length() != 6) {
            Log.d(TAG, "[DEBUG] Date validation failed - null or wrong length: " + (date == null ? "null" : date.length()));
            return false;
        }
        
        try {
            int year = Integer.parseInt(date.substring(0, 2));
            int month = Integer.parseInt(date.substring(2, 4));
            int day = Integer.parseInt(date.substring(4, 6));
            
            // Basic validation
            if (month < 1 || month > 12) {
                Log.d(TAG, "[DEBUG] Date validation failed - invalid month: " + month + " in date: " + date);
                return false;
            }
            if (day < 1 || day > 31) {
                Log.d(TAG, "[DEBUG] Date validation failed - invalid day: " + day + " in date: " + date);
                return false;
            }
            
            Log.d(TAG, "[DEBUG] Date validation passed for: " + date);
            return true;
        } catch (NumberFormatException e) {
            Log.d(TAG, "[DEBUG] Date validation failed - not numeric: " + date);
            return false;
        }
    }
    
    public void stop() {
        try {
            if (googleTextRecognizer != null) {
                googleTextRecognizer.close();
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop text recognizer", e);
        }
    }
}