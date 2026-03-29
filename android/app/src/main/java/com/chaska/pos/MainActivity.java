package com.chaska.pos;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register the PrinterPlugin so Capacitor can find it
        registerPlugin(PrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
