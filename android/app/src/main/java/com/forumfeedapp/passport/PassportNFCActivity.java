package com.forumfeedapp.passport;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.IsoDep;
import android.os.Bundle;
import android.util.Base64;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import net.sf.scuba.smartcards.CardService;
import net.sf.scuba.smartcards.CardServiceException;
import net.sf.scuba.smartcards.ISO7816;

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
import java.io.InputStream;
import java.util.Collection;
import java.util.List;

public class PassportNFCActivity extends Activity {
    private static final String TAG = "PassportNFCActivity";
    private NfcAdapter nfcAdapter;
    private PendingIntent pendingIntent;
    private static ReactApplicationContext reactContext;
    private static String documentNumber;
    private static String dateOfBirth;
    private static String dateOfExpiry;
    
    public static void setParameters(ReactApplicationContext context, String docNum, String dob, String doe) {
        reactContext = context;
        documentNumber = docNum;
        dateOfBirth = dob;
        dateOfExpiry = doe;
    }
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);
        pendingIntent = PendingIntent.getActivity(
            this, 0, new Intent(this, getClass()).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        );
        
        // Check if launched from NFC intent
        handleIntent(getIntent());
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        if (nfcAdapter != null) {
            nfcAdapter.enableForegroundDispatch(this, pendingIntent, null, null);
        }
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        if (nfcAdapter != null) {
            nfcAdapter.disableForegroundDispatch(this);
        }
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }
    
    private void handleIntent(Intent intent) {
        String action = intent.getAction();
        if (NfcAdapter.ACTION_TECH_DISCOVERED.equals(action) || 
            NfcAdapter.ACTION_TAG_DISCOVERED.equals(action)) {
            
            Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
            if (tag != null) {
                readPassport(tag);
            }
        }
    }
    
    private void readPassport(Tag tag) {
        try {
            Log.d(TAG, "Reading passport with JMRTD");
            
            // Create BAC key from MRZ data
            BACKeySpec bacKey = new BACKey(documentNumber, dateOfBirth, dateOfExpiry);
            
            // Open ISO-DEP connection
            IsoDep isoDep = IsoDep.get(tag);
            if (isoDep == null) {
                sendError("NO_ISODEP", "Tag doesn't support IsoDep");
                // Add delay before finishing to prevent crash
                new android.os.Handler().postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        finish();
                    }
                }, 500); // 500ms delay
                return;
            }
            
            // Create Android-specific card service
            AndroidNfcCardService cardService = new AndroidNfcCardService(isoDep);
            cardService.open();
            
            // Create passport service
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
                    // BAC required
                    Log.d(TAG, "Performing BAC authentication");
                    passportService.doBAC(bacKey);
                    Log.d(TAG, "BAC authentication successful");
                }
            }
            
            // Now read the data
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
            
            // Send result back to React Native
            sendEvent("passportReadSuccess", result);
            // Add delay before finishing to prevent crash
            new android.os.Handler().postDelayed(new Runnable() {
                @Override
                public void run() {
                    finish();
                }
            }, 500); // 500ms delay
            
        } catch (Exception e) {
            Log.e(TAG, "Error reading passport", e);
            sendError("READ_ERROR", e.getMessage());
            // Add delay before finishing to prevent crash
            new android.os.Handler().postDelayed(new Runnable() {
                @Override
                public void run() {
                    finish();
                }
            }, 500); // 500ms delay
        }
    }
    
    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext != null) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }
    
    private void sendError(String code, String message) {
        WritableMap error = Arguments.createMap();
        error.putString("code", code);
        error.putString("message", message);
        sendEvent("passportReadError", error);
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        try {
            // Clean up any resources if needed
            if (nfcAdapter != null) {
                nfcAdapter.disableForegroundDispatch(this);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in onDestroy", e);
        }
    }
}