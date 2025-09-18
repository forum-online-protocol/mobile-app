package com.forumfeedapp.passport;

import android.app.Activity;
import android.content.Intent;
import android.nfc.Tag;
import android.nfc.tech.IsoDep;
import android.util.Base64;
import android.util.Log;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.forumfeedapp.model.DocType;

import net.sf.scuba.smartcards.CardService;

import org.jmrtd.BACKey;
import org.jmrtd.BACKeySpec;
import org.jmrtd.PassportService;
import org.jmrtd.lds.CardSecurityFile;
import org.jmrtd.lds.PACEInfo;
import org.jmrtd.lds.SecurityInfo;
import org.jmrtd.lds.icao.DG1File;
import org.jmrtd.lds.icao.DG2File;
import org.jmrtd.lds.icao.MRZInfo;
import org.jmrtd.lds.iso19794.FaceImageInfo;
import org.jmrtd.lds.iso19794.FaceInfo;

import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.InputStream;
import java.util.Collection;
import java.util.List;

public class PassportReaderModule extends ReactContextBaseJavaModule implements ActivityEventListener, LifecycleEventListener {
    private static final String TAG = "PassportReader";
    private static final String MODULE_NAME = "PassportReader";
    private Promise currentPromise;

    public PassportReaderModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addActivityEventListener(this);
        reactContext.addLifecycleEventListener(this);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void startPassportScan(String documentNumber, String dateOfBirth, String dateOfExpiry, Promise promise) {
        try {
            Log.d(TAG, "Starting passport scan with MRZ: " + documentNumber);
            currentPromise = promise;
            
            // Set parameters for the activity
            PassportNFCActivity.setParameters(getReactApplicationContext(), documentNumber, dateOfBirth, dateOfExpiry);
            
            // Launch the NFC activity
            Activity currentActivity = getCurrentActivity();
            if (currentActivity != null) {
                Intent intent = new Intent(currentActivity, PassportNFCActivity.class);
                currentActivity.startActivity(intent);
            } else {
                promise.reject("NO_ACTIVITY", "No current activity");
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error starting passport scan", e);
            promise.reject("START_ERROR", e.getMessage());
        }
    }
    
    @ReactMethod
    public void startMRZScanner(Promise promise) {
        try {
            Log.d(TAG, "Starting MRZ scanner");
            
            // Set React context for the scanner activity
            CaptureActivity.setReactContext(getReactApplicationContext());
            
            // Launch the Capture activity for MRZ scanning
            Activity currentActivity = getCurrentActivity();
            if (currentActivity != null) {
                Intent intent = new Intent(currentActivity, CaptureActivity.class);
                intent.putExtra(CaptureActivity.DOC_TYPE, DocType.PASSPORT);
                currentActivity.startActivity(intent);
                
                // Resolve the promise immediately since we're using events for results
                promise.resolve("Scanner started successfully");
            } else {
                promise.reject("NO_ACTIVITY", "No current activity");
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error starting MRZ scanner", e);
            promise.reject("START_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void startIDCardScanner(Promise promise) {
        try {
            Log.d(TAG, "Starting MRZ scanner for ID card");
            
            // Set React context for the scanner activity
            CaptureActivity.setReactContext(getReactApplicationContext());
            
            // Launch the Capture activity for ID card MRZ scanning
            Activity currentActivity = getCurrentActivity();
            if (currentActivity != null) {
                Intent intent = new Intent(currentActivity, CaptureActivity.class);
                intent.putExtra(CaptureActivity.DOC_TYPE, DocType.ID_CARD);
                currentActivity.startActivity(intent);
                
                // Resolve the promise immediately since we're using events for results
                promise.resolve("ID Card scanner started successfully");
            } else {
                promise.reject("NO_ACTIVITY", "No current activity");
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error starting ID card scanner", e);
            promise.reject("START_ERROR", e.getMessage());
        }
    }
    
    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
        // Not used for this implementation
    }
    
    @Override
    public void onNewIntent(Intent intent) {
        // Not used for this implementation
    }
    
    @Override
    public void onHostResume() {
        // Not used for this implementation
    }
    
    @Override
    public void onHostPause() {
        // Not used for this implementation
    }
    
    @Override
    public void onHostDestroy() {
        // Not used for this implementation
    }

    // This method needs to be called directly from NFC intent handling
    public void readPassportWithTag(Tag tag, String documentNumber, String dateOfBirth, String dateOfExpiry, Promise promise) {
        try {
            Log.d(TAG, "Reading passport with tag");
            
            // Create BAC key from MRZ data
            BACKeySpec bacKey = new BACKey(documentNumber, dateOfBirth, dateOfExpiry);
            
            // Open ISO-DEP connection
            IsoDep isoDep = IsoDep.get(tag);
            if (isoDep == null) {
                promise.reject("NO_ISODEP", "Tag doesn't support IsoDep");
                return;
            }
            
            // Create card service
            CardService cardService = CardService.getInstance(isoDep);
            cardService.open();
            
            // Create passport service - this is the key JMRTD component
            PassportService passportService = new PassportService(
                cardService,
                PassportService.NORMAL_MAX_TRANCEIVE_LENGTH,
                PassportService.DEFAULT_MAX_BLOCKSIZE,
                true,  // shouldCheckMAC
                false  // shouldCheckAA
            );
            passportService.open();
            
            // Try PACE first if available
            boolean paceSucceeded = false;
            try {
                CardSecurityFile cardSecurityFile = new CardSecurityFile(
                    passportService.getInputStream(PassportService.EF_CARD_SECURITY)
                );
                Collection<SecurityInfo> securityInfos = cardSecurityFile.getSecurityInfos();
                for (SecurityInfo securityInfo : securityInfos) {
                    if (securityInfo instanceof PACEInfo) {
                        PACEInfo paceInfo = (PACEInfo) securityInfo;
                        passportService.doPACE(
                            bacKey,
                            paceInfo.getObjectIdentifier(),
                            PACEInfo.toParameterSpec(paceInfo.getParameterId()),
                            null
                        );
                        paceSucceeded = true;
                        Log.d(TAG, "PACE succeeded");
                        break;
                    }
                }
            } catch (Exception e) {
                Log.d(TAG, "PACE not supported or failed: " + e.getMessage());
            }
            
            // Select passport application
            passportService.sendSelectApplet(paceSucceeded);
            
            // If PACE didn't succeed, do BAC
            if (!paceSucceeded) {
                try {
                    // Try to read COM to check if BAC is needed
                    passportService.getInputStream(PassportService.EF_COM).read();
                } catch (Exception e) {
                    // BAC required - this is the magic that handles all secure messaging!
                    Log.d(TAG, "Performing BAC authentication");
                    passportService.doBAC(bacKey);
                    Log.d(TAG, "BAC authentication successful");
                }
            }
            
            // Now we can read the data - JMRTD handles all secure messaging transparently!
            WritableMap result = Arguments.createMap();
            
            // Read DG1 (MRZ data)
            try {
                DG1File dg1 = new DG1File(passportService.getInputStream(PassportService.EF_DG1));
                MRZInfo mrzInfo = dg1.getMRZInfo();
                
                WritableMap personalData = Arguments.createMap();
                personalData.putString("documentNumber", mrzInfo.getDocumentNumber());
                personalData.putString("firstName", mrzInfo.getSecondaryIdentifier().replace("<", " ").trim());
                personalData.putString("lastName", mrzInfo.getPrimaryIdentifier().replace("<", " ").trim());
                personalData.putString("nationality", mrzInfo.getNationality());
                personalData.putString("issuingState", mrzInfo.getIssuingState());
                personalData.putString("dateOfBirth", mrzInfo.getDateOfBirth());
                personalData.putString("dateOfExpiry", mrzInfo.getDateOfExpiry());
                personalData.putString("gender", mrzInfo.getGender().toString());
                personalData.putString("documentType", mrzInfo.getDocumentCode());
                
                result.putMap("personalData", personalData);
                Log.d(TAG, "Successfully read personal data");
            } catch (Exception e) {
                Log.e(TAG, "Error reading DG1", e);
                result.putString("dg1Error", e.getMessage());
            }
            
            // Read DG2 (Face image) if needed
            try {
                DG2File dg2 = new DG2File(passportService.getInputStream(PassportService.EF_DG2));
                List<FaceInfo> faceInfos = dg2.getFaceInfos();
                
                if (!faceInfos.isEmpty()) {
                    FaceInfo faceInfo = faceInfos.get(0);
                    List<FaceImageInfo> faceImageInfos = faceInfo.getFaceImageInfos();
                    
                    if (!faceImageInfos.isEmpty()) {
                        FaceImageInfo faceImageInfo = faceImageInfos.get(0);
                        
                        // Read image data
                        InputStream imageStream = faceImageInfo.getImageInputStream();
                        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                        int nRead;
                        byte[] data = new byte[1024];
                        while ((nRead = imageStream.read(data, 0, data.length)) != -1) {
                            buffer.write(data, 0, nRead);
                        }
                        
                        // Convert to base64
                        String base64Image = Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP);
                        result.putString("faceImage", base64Image);
                        result.putString("faceImageMimeType", faceImageInfo.getMimeType());
                        Log.d(TAG, "Successfully read face image");
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error reading DG2", e);
                result.putString("dg2Error", e.getMessage());
            }
            
            // Close services
            passportService.close();
            cardService.close();
            
            promise.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Error reading passport", e);
            promise.reject("READ_ERROR", e.getMessage(), e);
        }
    }
}