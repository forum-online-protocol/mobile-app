package com.forumfeedapp.passport;

import android.nfc.tech.IsoDep;
import net.sf.scuba.smartcards.CardService;
import net.sf.scuba.smartcards.CardServiceException;
import net.sf.scuba.smartcards.ISO7816;
import net.sf.scuba.smartcards.CommandAPDU;
import net.sf.scuba.smartcards.ResponseAPDU;

import java.io.IOException;

public class AndroidNfcCardService extends CardService {
    private IsoDep isoDep;
    private int apduCount = 0;

    public AndroidNfcCardService(IsoDep isoDep) {
        this.isoDep = isoDep;
    }

    @Override
    public void open() throws CardServiceException {
        if (isoDep != null) {
            try {
                if (!isoDep.isConnected()) {
                    isoDep.connect();
                }
                // Set timeout to 10 seconds for passport operations
                isoDep.setTimeout(10000);
            } catch (IOException e) {
                throw new CardServiceException("Failed to connect to card: " + e.getMessage(), e);
            }
        }
    }

    public boolean isOpen() {
        return isoDep != null && isoDep.isConnected();
    }

    public byte[] transmit(byte[] commandData) throws CardServiceException {
        if (!isOpen()) {
            throw new CardServiceException("Card service is not open");
        }

        try {
            apduCount++;
            byte[] responseData = isoDep.transceive(commandData);
            if (responseData == null || responseData.length < 2) {
                throw new CardServiceException("Invalid response from card");
            }
            return responseData;
        } catch (IOException e) {
            throw new CardServiceException("Failed to transmit APDU: " + e.getMessage(), e);
        }
    }

    @Override
    public ResponseAPDU transmit(CommandAPDU commandAPDU) throws CardServiceException {
        byte[] commandData = commandAPDU.getBytes();
        byte[] responseData = transmit(commandData);
        return new ResponseAPDU(responseData);
    }

    @Override
    public byte[] getATR() {
        // IsoDep doesn't provide ATR in Android
        return null;
    }

    @Override
    public boolean isExtendedAPDULengthSupported() {
        if (isoDep != null) {
            return isoDep.isExtendedLengthApduSupported();
        }
        return false;
    }

    @Override
    public void close() {
        if (isoDep != null) {
            try {
                isoDep.close();
            } catch (IOException e) {
                // Ignore close errors
            }
        }
    }

    public int getApduCount() {
        return apduCount;
    }

    @Override
    public boolean isConnectionLost(Exception e) {
        // Check if the exception indicates a lost connection
        if (e instanceof IOException) {
            String message = e.getMessage();
            if (message != null) {
                return message.contains("Transceive failed") ||
                       message.contains("Tag was lost") ||
                       message.contains("TagLostException");
            }
        }
        return false;
    }
}