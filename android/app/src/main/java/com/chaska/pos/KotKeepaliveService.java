package com.chaska.pos;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import java.util.Timer;
import java.util.TimerTask;

import androidx.core.app.NotificationCompat;

/**
 * KotKeepaliveService
 *
 * Android Foreground Service that keeps the app process alive even when
 * the screen is off or the user switches to another app.
 *
 * Problem it solves: Android suspends JavaScript setInterval() when the
 * WebView/screen goes off. This means the auto-print queue in JS stops.
 *
 * Solution: A native Java Timer (unaffected by WebView suspension) broadcasts
 * an intent every 3 seconds. KotKeepalivePlugin relays this as a JS event
 * ("kotTick") which triggers the print queue in useKotAutoPrint.ts.
 *
 * Lifecycle:
 *   startForegroundService() → called from KotKeepalivePlugin when role = "billing"
 *   stopService()            → called when user leaves billing role or app closes
 */
public class KotKeepaliveService extends Service {

    private static final String CHANNEL_ID = "kot_printer_channel";
    private static final int    NOTIF_ID   = 1001;

    /** Broadcast action that KotKeepalivePlugin listens for */
    public static final String ACTION_TICK = "com.chaska.pos.KOT_TICK";

    private PowerManager.WakeLock wakeLock;
    private Timer keepaliveTimer;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        // CRITICAL: Must call startForeground() within 5 seconds of startForegroundService()
        // or Android will throw an ANR and kill the app.
        startForeground(NOTIF_ID, buildNotification());

        // Acquire a PARTIAL_WAKE_LOCK so the CPU keeps running when the screen is off.
        // This does NOT keep the screen on — only the processor.
        // ⚠️  Always use acquire(timeout) — Android Lint flags bare acquire() as a battery leak
        // risk. If the service crashes before onDestroy(), the lock auto-releases after 10 min.
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "ChaskaPos:PrinterWakeLock"
            );
            wakeLock.acquire(10 * 60 * 1000L); // 10-minute safety timeout
        }

        // Native Java Timer — NOT affected by WebView JS suspension.
        // Broadcasts every 3 seconds so useKotAutoPrint can run even with screen off.
        keepaliveTimer = new Timer("KotKeepaliveTimer", true);
        keepaliveTimer.schedule(new TimerTask() {
            @Override
            public void run() {
                sendBroadcast(new Intent(ACTION_TICK));
            }
        }, 0, 3000);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // START_STICKY: if the service is killed by the OS, restart it automatically.
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        if (keepaliveTimer != null) {
            keepaliveTimer.cancel();
            keepaliveTimer = null;
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null; // Not a bound service
    }

    // ── Notification helpers ─────────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "KOT Printer",
                NotificationManager.IMPORTANCE_LOW // Silent — no sound or vibration
            );
            channel.setDescription("Keeps KOT printing active in the background");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        // getLaunchIntentForPackage returns null on some ROM configurations
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent == null) {
            launchIntent = new Intent(); // fallback: empty intent so PendingIntent doesn't NPE
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🖨️ KOT Printer Active")
            .setContentText("Chaska POS — printing orders in background")
            .setSmallIcon(android.R.drawable.ic_menu_send)
            .setContentIntent(pendingIntent)
            .setOngoing(true)         // User cannot swipe this away
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }
}
