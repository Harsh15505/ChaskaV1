package com.chaska.pos;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import com.dantsu.escposprinter.EscPosPrinter;
import com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection;
import com.dantsu.escposprinter.textparser.PrinterTextParserImg;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Set;

/**
 * PrinterPlugin — Capacitor plugin for Bluetooth ESC/POS printing.
 *
 * Exposes two methods to JavaScript:
 *   1. getPairedDevices() — list already-paired Bluetooth devices
 *   2. printReceipt({ address, data }) — send ESC/POS commands to the printer
 */
@CapacitorPlugin(
    name = "Printer",
    permissions = {
        @Permission(
            strings = {
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            },
            alias = "bluetooth"
        )
    }
)
public class PrinterPlugin extends Plugin {

    // ── getPairedDevices ──────────────────────────────────────────────────────

    /**
     * Returns the list of Bluetooth devices already paired with the phone.
     * No scanning needed — thermal printers are paired via Android settings first.
     *
     * JS: const { devices } = await Printer.getPairedDevices();
     */
    @PluginMethod
    public void getPairedDevices(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();

        if (adapter == null) {
            call.reject("Bluetooth not supported on this device");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth is turned off. Please enable it in settings.");
            return;
        }

        // On Android 12+ (API 31+), need BLUETOOTH_CONNECT permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ActivityCompat.checkSelfPermission(getActivity(),
                    Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                call.reject("Bluetooth permission not granted. Please allow in app settings.");
                return;
            }
        }

        Set<BluetoothDevice> bondedDevices = adapter.getBondedDevices();
        JSArray devicesArray = new JSArray();

        for (BluetoothDevice device : bondedDevices) {
            try {
                JSObject obj = new JSObject();
                obj.put("name", device.getName() != null ? device.getName() : "Unknown Device");
                obj.put("address", device.getAddress());
                devicesArray.put(obj);
            } catch (Exception ignored) {}
        }

        JSObject result = new JSObject();
        result.put("devices", devicesArray);
        call.resolve(result);
    }

    // ── printReceipt ──────────────────────────────────────────────────────────

    /**
     * Connects to the printer via Bluetooth and prints the receipt.
     *
     * Expected call from JS:
     *   await Printer.printReceipt({
     *     address: "XX:XX:XX:XX:XX:XX",
     *     data: {
     *       tableNumber: 3,
     *       time: "10:42 PM",
     *       items: [{ name, quantity, total }],
     *       totalAmount: 450,
     *       upiString: "upi://pay?..."
     *     }
     *   });
     */
    @PluginMethod
    public void printReceipt(PluginCall call) {
        String address = call.getString("address");
        JSObject data = call.getObject("data");

        if (address == null || address.isEmpty()) {
            call.reject("No printer selected. Please connect a printer first.");
            return;
        }
        if (data == null) {
            call.reject("Missing receipt data.");
            return;
        }

        // Run printing on a background thread — printing takes ~1-3 seconds
        // and will block the UI thread if not offloaded.
        new Thread(() -> {
            try {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();

                if (adapter == null || !adapter.isEnabled()) {
                    call.reject("Bluetooth is off. Please enable it.");
                    return;
                }

                BluetoothDevice device = adapter.getRemoteDevice(address);

                // DantSu printer config for Niyama BT-58:
                //   DPI: 203     — standard for 58mm thermal printers
                //   Width: 48mm  — effective print width of the Niyama BT-58
                //   Chars: 32    — characters per line for typical 58mm
                EscPosPrinter printer = new EscPosPrinter(
                    new BluetoothConnection(device),
                    203,  // printer DPI
                    48f,  // print width in mm
                    32    // chars per line
                );

                // Build the receipt text using DantSu's markup:
                // [C] = center, [L] = left align, [R] = right align (same line as [L])
                // <b> = bold, <qrcode size='N'> = QR code
                String receiptText = buildReceiptText(data);

                printer.printFormattedTextAndCut(receiptText);
                printer.disconnectPrinter();

                call.resolve();

            } catch (Exception e) {
                call.reject("Printing failed: " + e.getMessage());
            }
        }).start();
    }

    // ── Helper: build ESC/POS markup string ───────────────────────────────────

    private String buildReceiptText(JSObject data) throws Exception {
        StringBuilder sb = new StringBuilder();

        int tableNumber = data.getInteger("tableNumber", 0);
        String time = data.getString("time", "");
        int totalAmount = data.getInteger("totalAmount", 0);
        String upiString = data.getString("upiString", "");
        JSONArray items = data.getJSONArray("items");
        Boolean isKot = data.optBoolean("isKot", false);
        String billNumber = data.optString("billNumber", "N/A");

        if (isKot) {
            sb.append("[C]<b><font size='wide'>** KOT **</font></b>\n");
            sb.append("[C]Order No: ").append(billNumber).append(" | Table: ").append(tableNumber).append("\n");
            sb.append("[C]").append(time).append("\n");
            sb.append("[C]--------------------------------\n");

            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i);
                String name = item.getString("name");
                int qty = item.getInt("quantity");
                String note = item.optString("note", "");

                String label = qty + "x " + name;
                sb.append("[L]<b>").append(label).append("</b>\n");
                
                if (!note.isEmpty()) {
                    sb.append("[L]   * NOTE: ").append(note).append("\n");
                }
            }

            sb.append("[C]--------------------------------\n");
            sb.append("[C]********** END ***********\n");
            sb.append("[C]\n[C]\n[C]\n");

            return sb.toString();
        }

        // Header
        sb.append("[C]<b><font size='big'>CHASKA</font></b>\n");
        sb.append("[C]<b>PUNJABI & CHINESE</b>\n");
        sb.append("[C]--------------------------------\n");
        sb.append("[C]Bill No: ").append(billNumber).append(" | Table: ").append(tableNumber).append("\n");
        sb.append("[C]").append(time).append("\n");
        sb.append("[C]--------------------------------\n");

        // Items — each on its own line: "2x Noodles      Rs.140"
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.getJSONObject(i);
            String name = item.getString("name");
            int qty = item.getInt("quantity");
            int itemTotal = item.getInt("total");

            // Truncate name if too long (max ~24 chars to leave room for price)
            String label = qty + "x " + name;
            if (label.length() > 24) {
                label = label.substring(0, 23) + ".";
            }

            sb.append("[L]").append(label)
              .append("[R]Rs.").append(itemTotal).append("\n");
        }

        // Total
        sb.append("[C]--------------------------------\n");
        sb.append("[L]<b>TOTAL</b>[R]<b>Rs.").append(totalAmount).append("</b>\n");
        sb.append("[C]--------------------------------\n");

        // UPI QR code
        sb.append("[L]\n");
        sb.append("[C]<qrcode size='20'>").append(upiString).append("</qrcode>\n");
        sb.append("[L]\n");
        sb.append("[C]Scan to Pay via UPI\n");
        sb.append("[L]\n");

        // Footer
        sb.append("[C]Thank you for dining with us!\n");
        sb.append("[C]Have a wonderful day\n");

        // Feed paper before cut
        sb.append("[L]\n[L]\n[L]\n");

        return sb.toString();
    }
}
