# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# React Native
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep,allowobfuscation @interface com.facebook.common.internal.DoNotStrip
-keep,allowobfuscation @interface com.facebook.jni.annotations.DoNotStrip

# JMRTD and passport reading libraries - CRITICAL FOR NFC
-keep class org.jmrtd.** { *; }
-keep class net.sf.scuba.** { *; }
-keep class org.spongycastle.** { *; }
-keep class org.bouncycastle.** { *; }
-keep class com.madgag.spongycastle.** { *; }
-keep class edu.ucar.** { *; }
-keep class com.github.mhshams.** { *; }

# Keep ALL security and crypto classes
-keep class javax.security.** { *; }
-keep class java.security.** { *; }
-keep class javax.crypto.** { *; }

# Keep reflection-accessed classes
-keepclassmembers class * {
    @org.jmrtd.* <fields>;
    @org.jmrtd.* <methods>;
}

# Prevent stripping of security exceptions
-keep class * extends java.security.GeneralSecurityException { *; }
-keep class * extends javax.crypto.BadPaddingException { *; }

# Keep passport-related classes
-keep class com.forumfeedapp.passport.** { *; }
-keepclassmembers class com.forumfeedapp.passport.** { *; }

# JMRTD specific
-keepattributes Exceptions,InnerClasses,Signature,Deprecated,SourceFile,LineNumberTable,*Annotation*,EnclosingMethod
-dontwarn org.jmrtd.**
-dontwarn net.sf.scuba.**
-dontwarn org.ejbca.**
-dontwarn org.spongycastle.**
-dontwarn org.bouncycastle.**

# Keep PassportService and all its methods
-keep class org.jmrtd.PassportService { *; }
-keepclassmembers class org.jmrtd.PassportService {
    public <init>(...);
    public <methods>;
    protected <methods>;
    private <fields>;
}

# Keep BAC/PACE authentication
-keep class org.jmrtd.protocol.** { *; }
-keep class org.jmrtd.lds.** { *; }
-keep class org.jmrtd.cert.** { *; }

# Keep native methods
-keepclasseswithmembernames,includedescriptorclasses class * {
    native <methods>;
}

# Keep custom exceptions
-keep public class * extends java.lang.Exception

# Preserve security providers
-keep class org.spongycastle.jce.provider.** { *; }
-keep class org.bouncycastle.jce.provider.** { *; }
-keep class com.madgag.spongycastle.provider.** { *; }

# Keep serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# NFC related - CRITICAL
-keep class android.nfc.** { *; }
-keep class android.nfc.tech.** { *; }
-keep class android.nfc.tech.IsoDep { *; }
-keepclassmembers class android.nfc.tech.IsoDep { *; }

# Keep our custom NFC service
-keep class com.forumfeedapp.passport.AndroidNfcCardService { *; }
-keepclassmembers class com.forumfeedapp.passport.AndroidNfcCardService {
    <init>(...);
    public <methods>;
    private <methods>;
    protected <methods>;
}

# Keep smartcard classes with all members
-keep class net.sf.scuba.smartcards.** { *; }
-keep interface net.sf.scuba.smartcards.** { *; }
-keepclassmembers class net.sf.scuba.smartcards.** { *; }

# Keep ISO7816 and APDU classes
-keep class net.sf.scuba.smartcards.CommandAPDU { *; }
-keep class net.sf.scuba.smartcards.ResponseAPDU { *; }
-keep class net.sf.scuba.smartcards.ISO7816 { *; }
-keep class net.sf.scuba.smartcards.APDUWrapper { *; }

# Don't obfuscate CardService methods
-keepclassmembers class * extends net.sf.scuba.smartcards.CardService {
    public <methods>;
    protected <methods>;
    private <methods>;
}

# Keep IsoDep methods intact
-keep class android.nfc.tech.IsoDep {
    public byte[] transceive(byte[]);
    public void connect();
    public void close();
    public boolean isConnected();
    public void setTimeout(int);
    public int getTimeout();
    public int getMaxTransceiveLength();
    public boolean isExtendedLengthApduSupported();
}