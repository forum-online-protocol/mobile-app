package com.forumfeedapp.passport;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.graphics.Canvas;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.RectF;

import androidx.appcompat.app.AppCompatActivity;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.forumfeedapp.mlkit.camera.CameraSource;
import com.forumfeedapp.mlkit.camera.CameraSourcePreview;
import com.forumfeedapp.mlkit.other.GraphicOverlay;
import com.forumfeedapp.mlkit.text.TextRecognitionProcessor;
import com.forumfeedapp.mlkit.text.UnifiedTextRecognitionProcessor;
import com.forumfeedapp.model.DocType;

import org.jmrtd.lds.icao.MRZInfo;

import java.io.IOException;

public class CaptureActivity extends AppCompatActivity implements 
        UnifiedTextRecognitionProcessor.ResultListener {

    private CameraSource cameraSource = null;
    private CameraSourcePreview preview;
    private GraphicOverlay graphicOverlay;

    public static final String MRZ_RESULT = "MRZ_RESULT";
    public static final String DOC_TYPE = "DOC_TYPE";

    private DocType docType = DocType.PASSPORT;
    private static ReactApplicationContext reactContext;
    private boolean isProcessingMRZ = false;

    private static String TAG = CaptureActivity.class.getSimpleName();
    
    public static void setReactContext(ReactApplicationContext context) {
        reactContext = context;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Create layout programmatically
        FrameLayout layout = new FrameLayout(this);
        layout.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT));
        layout.setBackgroundColor(Color.BLACK);
        
        // Create camera preview
        preview = new CameraSourcePreview(this, null);
        preview.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT));
        layout.addView(preview);
        
        // Create graphic overlay
        graphicOverlay = new GraphicOverlay(this, null);
        graphicOverlay.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT));
        layout.addView(graphicOverlay);
        
        // Create MRZ frame overlay - optimized for portrait
        View mrzFrame = new View(this) {
            @Override
            protected void onDraw(Canvas canvas) {
                super.onDraw(canvas);
                
                int width = getWidth();
                int height = getHeight();
                
                // Create semi-transparent overlay
                Paint darkPaint = new Paint();
                darkPaint.setColor(0x88000000);
                
                // Draw dark overlay on entire screen
                canvas.drawRect(0, 0, width, height, darkPaint);
                
                // Calculate MRZ scanning area (optimized for portrait MRZ)
                int frameWidth = (int)(width * 0.9);
                int frameHeight = (int)(height * 0.2);
                int left = (width - frameWidth) / 2;
                int top = (height - frameHeight) / 2;
                int right = left + frameWidth;
                int bottom = top + frameHeight;
                
                // Clear the scanning area (make it transparent)
                Paint clearPaint = new Paint();
                clearPaint.setColor(0x00000000);
                clearPaint.setXfermode(new android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.CLEAR));
                canvas.drawRect(left, top, right, bottom, clearPaint);
                
                // Draw frame border
                Paint borderPaint = new Paint();
                borderPaint.setColor(0xFF00FF00); // Green color
                borderPaint.setStyle(Paint.Style.STROKE);
                borderPaint.setStrokeWidth(4);
                canvas.drawRect(left, top, right, bottom, borderPaint);
                
                // Draw corner highlights
                Paint cornerPaint = new Paint();
                cornerPaint.setColor(0xFF00FF00);
                cornerPaint.setStrokeWidth(8);
                int cornerLength = 40;
                
                // Top-left corner
                canvas.drawLine(left, top, left + cornerLength, top, cornerPaint);
                canvas.drawLine(left, top, left, top + cornerLength, cornerPaint);
                
                // Top-right corner
                canvas.drawLine(right - cornerLength, top, right, top, cornerPaint);
                canvas.drawLine(right, top, right, top + cornerLength, cornerPaint);
                
                // Bottom-left corner
                canvas.drawLine(left, bottom - cornerLength, left, bottom, cornerPaint);
                canvas.drawLine(left, bottom, left + cornerLength, bottom, cornerPaint);
                
                // Bottom-right corner
                canvas.drawLine(right - cornerLength, bottom, right, bottom, cornerPaint);
                canvas.drawLine(right, bottom - cornerLength, right, bottom, cornerPaint);
            }
        };
        mrzFrame.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT));
        layout.addView(mrzFrame);
        
        // Create instruction overlay
        LinearLayout instructionOverlay = new LinearLayout(this);
        instructionOverlay.setOrientation(LinearLayout.VERTICAL);
        instructionOverlay.setGravity(Gravity.CENTER_HORIZONTAL);
        instructionOverlay.setBackgroundColor(0x88000000); // Semi-transparent black
        FrameLayout.LayoutParams overlayParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT);
        overlayParams.gravity = Gravity.TOP;
        instructionOverlay.setLayoutParams(overlayParams);
        instructionOverlay.setPadding(40, 40, 40, 40);
        
        // Add title
        TextView titleText = new TextView(this);
        titleText.setText("MRZ Scanner");
        titleText.setTextColor(Color.WHITE);
        titleText.setTextSize(24);
        titleText.setGravity(Gravity.CENTER);
        instructionOverlay.addView(titleText);
        
        // Add instructions
        TextView instructionText = new TextView(this);
        instructionText.setText("Position the MRZ (bottom 2 lines) within the green frame");
        instructionText.setTextColor(Color.WHITE);
        instructionText.setTextSize(16);
        instructionText.setGravity(Gravity.CENTER);
        instructionText.setPadding(0, 20, 0, 0);
        instructionOverlay.addView(instructionText);
        
        // Add hint
        TextView hintText = new TextView(this);
        hintText.setText("Hold passport flat • Ensure good lighting");
        hintText.setTextColor(0xFFCCCCCC);
        hintText.setTextSize(14);
        hintText.setGravity(Gravity.CENTER);
        hintText.setPadding(0, 10, 0, 0);
        instructionOverlay.addView(hintText);
        
        layout.addView(instructionOverlay);
        
        setContentView(layout);

        if(getIntent().hasExtra(DOC_TYPE)) {
            docType = (DocType) getIntent().getSerializableExtra(DOC_TYPE);
        }
        
        // Use portrait orientation
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

        createCameraSource();
        startCameraSource();
    }

    @Override
    public void onResume() {
        super.onResume();
        Log.d(TAG, "onResume");
        startCameraSource();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (preview != null) {
            preview.stop();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try {
            if (cameraSource != null) {
                cameraSource.release();
                cameraSource = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in onDestroy", e);
        }
    }

    private void createCameraSource() {
        if (cameraSource == null) {
            cameraSource = new CameraSource(this, graphicOverlay);
            cameraSource.setFacing(CameraSource.CAMERA_FACING_BACK);
        }

        // Use unified processor that supports both Google ML Kit and HMS ML Kit
        UnifiedTextRecognitionProcessor unifiedProcessor = new UnifiedTextRecognitionProcessor();
        unifiedProcessor.setResultListener(this);
        cameraSource.setMachineLearningFrameProcessor(unifiedProcessor);
    }

    private void startCameraSource() {
        if (cameraSource != null) {
            try {
                if (preview == null) {
                    Log.d(TAG, "resume: Preview is null");
                }
                if (graphicOverlay == null) {
                    Log.d(TAG, "resume: graphOverlay is null");
                }
                preview.start(cameraSource, graphicOverlay);
            } catch (IOException e) {
                Log.e(TAG, "Unable to start camera source.", e);
                cameraSource.release();
                cameraSource = null;
            }
        }
    }

    @Override
    public void onSuccess(MRZInfo mrzInfo) {
        Log.d(TAG, "MRZ Detected: " + mrzInfo.getDocumentNumber());
        
        // Prevent duplicate processing
        if (isProcessingMRZ) {
            Log.d(TAG, "Already processing MRZ, ignoring duplicate detection");
            return;
        }
        
        isProcessingMRZ = true;
        Log.d(TAG, "Starting MRZ processing");
        
        // Stop camera first with error handling
        try {
            if (preview != null) {
                Log.d(TAG, "Stopping preview");
                preview.stop();
                Log.d(TAG, "Preview stopped successfully");
            }
        } catch (Exception previewError) {
            Log.e(TAG, "Error stopping preview: " + previewError.getMessage(), previewError);
        }
        
        try {
            if (cameraSource != null) {
                Log.d(TAG, "Releasing camera source");
                try {
                    cameraSource.stop();
                } catch (Exception stopError) {
                    Log.w(TAG, "Error stopping camera source: " + stopError.getMessage());
                }
                try {
                    cameraSource.release();
                } catch (Exception releaseError) {
                    Log.w(TAG, "Error in camera source release: " + releaseError.getMessage());
                }
                cameraSource = null;
                Log.d(TAG, "Camera source cleaned up successfully");
            }
        } catch (Exception cameraError) {
            Log.e(TAG, "Error releasing camera source: " + cameraError.getMessage(), cameraError);
            cameraSource = null; // Set to null even if release failed
        }
        
        // Send result back to React Native immediately
        if (reactContext != null) {
            Log.d(TAG, "Preparing to send MRZ data to React Native");
            WritableMap result = Arguments.createMap();
            result.putString("documentNumber", mrzInfo.getDocumentNumber());
            result.putString("dateOfBirth", mrzInfo.getDateOfBirth());
            result.putString("dateOfExpiry", mrzInfo.getDateOfExpiry());
            
            Log.d(TAG, "Emitting mrzScanSuccess event");
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("mrzScanSuccess", result);
            Log.d(TAG, "Event emitted successfully");
        } else {
            Log.e(TAG, "React context is null, cannot send MRZ data");
        }
        
        setResult(Activity.RESULT_OK);
        
        // Finish activity with delay
        Log.d(TAG, "Scheduling activity finish");
        new android.os.Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                Log.d(TAG, "Finishing activity now");
                finish();
            }
        }, 1000); // 1000ms delay
    }

    @Override
    public void onError(Exception exp) {
        Log.e(TAG, "MRZ Scan Error", exp);
        
        // Send error back to React Native
        if (reactContext != null) {
            WritableMap error = Arguments.createMap();
            error.putString("code", "SCAN_ERROR");
            error.putString("message", exp.getMessage());
            
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("mrzScanError", error);
        }
        
        setResult(Activity.RESULT_CANCELED);
        
        // Add delay before finishing to prevent crash
        Log.d(TAG, "Scheduling activity finish after error");
        new android.os.Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                Log.d(TAG, "Finishing activity after error");
                finish();
            }
        }, 1000); // 1000ms delay
    }
}