package com.chaska.pos;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrinterPlugin.class);
        registerPlugin(KotKeepalivePlugin.class); // Background print keepalive
        super.onCreate(savedInstanceState);
    }
}
