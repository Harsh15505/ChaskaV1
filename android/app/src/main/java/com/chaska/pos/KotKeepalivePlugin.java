package com.chaska.pos;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * KotKeepalivePlugin
 *
 * Capacitor bridge between the native KotKeepaliveService and the JS layer.
 *
 * Exposes two plugin methods to JavaScript:
 *   - startKeepalive() → starts the foreground service
 *   - stopKeepalive()  → stops the foreground service
 *
 * Also registers a BroadcastReceiver that listens to the 3-second native
 * timer ticks from KotKeepaliveService and forwards them to JS as a
 * "kotTick" event (via Capacitor's notifyListeners).
 *
 * JS side usage (see lib/printer.ts):
 *   KeepaliveBridge.addListener("kotTick", () => runPrintTick())
 */
@CapacitorPlugin(name = "KotKeepalive")
public class KotKeepalivePlugin extends Plugin {

    /**
     * Receives the broadcast that KotKeepaliveService sends every 3 seconds.
     * Relays it to JS as a "kotTick" event so useKotAutoPrint can run
     * even when the WebView's setInterval is frozen (screen off).
     */
    private final BroadcastReceiver tickReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (KotKeepaliveService.ACTION_TICK.equals(intent.getAction())) {
                notifyListeners("kotTick", new JSObject());
            }
        }
    };

    @Override
    public void load() {
        super.load();
        IntentFilter filter = new IntentFilter(KotKeepaliveService.ACTION_TICK);
        // Android 13+ requires an explicit exported flag when registering receivers at runtime
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(tickReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(tickReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        try {
            getContext().unregisterReceiver(tickReceiver);
        } catch (Exception ignored) {
            // Receiver might not be registered if load() failed — safe to ignore
        }
        super.handleOnDestroy();
    }

    /**
     * JS call: await KeepaliveBridge.startKeepalive()
     * Starts the foreground service so the CPU stays awake for background printing.
     */
    @PluginMethod
    public void startKeepalive(PluginCall call) {
        try {
            Context ctx = getContext();
            Intent serviceIntent = new Intent(ctx, KotKeepaliveService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(serviceIntent);
            } else {
                ctx.startService(serviceIntent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to start keepalive service: " + e.getMessage());
        }
    }

    /**
     * JS call: await KeepaliveBridge.stopKeepalive()
     * Stops the foreground service and releases the WakeLock.
     */
    @PluginMethod
    public void stopKeepalive(PluginCall call) {
        try {
            Context ctx = getContext();
            ctx.stopService(new Intent(ctx, KotKeepaliveService.class));
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to stop keepalive service: " + e.getMessage());
        }
    }
}
