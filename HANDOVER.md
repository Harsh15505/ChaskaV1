# Chaska — Restaurant Management System
## Handover Document

> This document is for the restaurant owner. It explains how the system works, how to set it up, and what to do if something goes wrong.

---

## 1. What This System Does

Chaska is a digital ordering and billing system for your restaurant. It replaces pen-and-paper order slips.

| Who uses it | How | What they can do |
|---|---|---|
| **Waiter** | Phone browser (web app) | Take orders at tables, request bill |
| **Kitchen Staff** | Phone/tablet browser (web app) | See live orders, mark as done |
| **Owner / Billing** | Android tablet (app) | Generate bills, print receipts, clear tables |

**How an order flows:**
1. Waiter selects a table → adds items → taps "Send to Kitchen"
2. Kitchen screen instantly shows the new order (no refresh needed)
3. Kitchen marks it done → Waiter can add more rounds
4. When done, Waiter taps "Request Bill"
5. Owner/Billing generates receipt → prints via Bluetooth → taps "Clear Table"

---

## 2. How Staff Open the Web App

Share this link with all staff: **[Your Vercel URL here]**

**Steps for each device (one time only):**
1. Open the link in Chrome / Safari
2. Tap the "Share" or "Menu" button in the browser
3. Tap **"Add to Home Screen"**
4. The app icon will appear on their home screen like a normal app

**Every time they open the app**, they will see: *Select Your Role*
- Tap **Waiter** or **Kitchen** — no password needed
- Tap **Billing** — must enter the 4-digit PIN (only you know this)

---

## 3. Role Guide

### Waiter
- Tap a table → choose items → Send to Kitchen
- Can add more rounds to the same table
- When customer asks for bill → tap "Request Bill"
- **Cannot** access billing or kitchen area

### Kitchen
- Sees all active orders in real time
- Tap "Mark Done" when food is ready
- **Cannot** access billing

### Billing (Owner Only)
- Protected by a 4-digit PIN
- See all tables and their status
- Generate receipt with UPI QR code
- Print via Bluetooth (needs printer paired)
- Clear table after payment

---

## 4. How to Install the Android App (Owner Tablet)

The Android APK is the billing app. Only the owner needs this.

1. Transfer the `chaska.apk` file to the Android tablet (via WhatsApp, USB cable, or Google Drive)
2. Open the file on the tablet
3. If asked about "Install from Unknown Sources" → tap Allow → Install
4. Open **Chaska** from the app list
5. Select **Billing** → enter PIN → you're in
6. For printing: pair your Niyama BT-58 printer first via **Android Settings → Bluetooth**

---

## 5. How to Use the Bluetooth Printer

1. Turn on the Niyama BT-58 printer (hold power button)
2. Go to Android Settings → Bluetooth → scan → pair with "BT-58" or similar name
3. Open Chaska app → Billing → select a table → tap "Print Bill"
4. First time: tap the Bluetooth icon → select your printer from the list
5. The printer MAC address is saved — next time it connects automatically

---

## 6. About Firebase (Cloud Database)

Your data (tables, orders) is stored on **Firebase** — a database service run by Google.

- **Free tier:** Up to 50,000 reads and 20,000 writes per day — more than enough for a restaurant
- **What happens if it breaks?** The app shows a loading indicator. It usually fixes itself within a minute. If not, see Section 8.
- **Who controls it?** Your developer controls the Firebase account. Make sure they give you access or keep paying for maintenance.

---

## 7. PINs and Security

| What | Details |
|---|---|
| **Billing PIN** | 4 digits known only to the owner. Set in the system by your developer. |
| **How to reset PIN** | Ask your developer — they change `NEXT_PUBLIC_BILLING_PIN` in the system and re-deploy |
| **Session duration** | PIN is remembered for 12 hours on each device. After 12 hours, re-select role |
| **Wrong PIN 3 times** | App locks for 30 seconds |

---

## 8. What to Do if Something Breaks

| Problem | What to do |
|---|---|
| **App won't load** | Check internet connection. Reload the page. |
| **Orders not showing in kitchen** | Check that both devices have internet. Reload both. |
| **Printer not connecting** | Make sure printer is on and paired in Android Bluetooth settings. |
| **Billed tables still showing as active** | Refresh the page. If stuck, contact your developer. |
| **Forgot the billing PIN** | Contact your developer to reset it. |
| **App asks to select role every time** | This is normal after 12 hours. Just tap your role again. |

---

## 9. Maintenance Policy

*(To be agreed with your developer)*

| Service | Included |
|---|---|
| Bug fixes (first 30 days) | Free |
| New features (e.g. inventory, staff login) | Charged separately |
| Monthly hosting maintenance | ₹___ / month |
| Printer issues | Not included (hardware support) |

---

## 10. Future Upgrades (Possible)

These features are NOT included now but can be added later:

- [ ] Staff login with individual accounts
- [ ] Daily sales reports / export to Excel
- [ ] Multiple restaurant locations (stall isolation)
- [ ] Customer-facing digital menu (QR scan to view menu)
- [ ] Inventory and stock tracking
- [ ] Loyalty points / repeat customer tracking
- [ ] Custom logo and branding on the app

---

*Document prepared by the developer. Last updated: March 2026.*
