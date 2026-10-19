# Connect the booking form to Google Sheets (no internet publishing needed)

**You can do all of this with the website only on your own computer.**
When you press "Request table", *your computer* sends the request straight to Google,
so the site does not have to be on the internet.

How the pieces fit together:

```
 index.html + js/booking.js        Google Apps Script (Code.gs)
 (your browser, on your computer)  (a small robot living inside your Sheet)
            |                                   |
            |   1. sends the request ---------> |
            |                                   |  2. adds a row to the Sheet
            |                                   |  3. emails the restaurant
```

You will do four things: **A** open the folder, **B** make the Sheet, **C** paste the script
and get its address, **D** give that address to the website.

---

## A. Open the website on your computer

1. Find the downloaded file `lavish-website.zip` (usually in **Downloads**).
2. **Windows:** right-click it, choose **Extract All…**, then click **Extract**.
   **Mac:** double-click it.
3. Open the new folder `lavish-website`. You should see: `index.html`, `css`, `js`, `images`, `apps-script`, `docs`.
4. **Do not move `index.html` out of the folder** and do not rename anything. The page finds its photos and styles by their position inside the folder.
5. Double-click `index.html`. It opens in your browser. The address bar starts with `file:///`. That is correct.
6. Check that you see the photos. If you do, the folder is fine.

## B. Create the Google Sheet

1. In your browser go to **https://sheets.new** (sign in with the Google account that should own the bookings).
2. Click **Untitled spreadsheet** (top-left), type `Lavish bookings`, press **Enter**.
3. Leave the sheet empty. The script creates the columns for you.

## C. Put the script into the Sheet and get its address

**C1. Open the script editor**

1. In the Sheet's menu bar click **Extensions** → **Apps Script**.
2. A new browser tab opens with a code box containing `function myFunction() { }`.

**C2. Paste the script**

1. Click inside the code box. Press **Ctrl+A** (Mac: **Cmd+A**) to select everything. Press **Delete**.
2. On your computer open `lavish-website/apps-script/Code.gs` (right-click → **Open with** → Notepad / TextEdit / VS Code).
3. Press **Ctrl+A**, then **Ctrl+C** to copy all of it.
4. Go back to the Apps Script tab, click in the empty code box, press **Ctrl+V**.
5. Near the top find the line `NOTIFY_EMAIL: 'bookings@lavishrestaurant.co.uk',`.
   Replace only the email **between the quotes** with the address that should receive the alerts. Keep the quotes and the comma.
6. Press **Ctrl+S** to save. If Google asks for a project name, type `Lavish bookings`.

**C3. Allow the script and build the "Requests" tab**

1. At the top of the editor there is a dropdown showing a function name. Click it and choose **setup**.
2. Click **▶ Run**.
3. A box says **Authorization required**. Click **Review permissions** and choose your account.
4. A warning says **"Google hasn't verified this app"**. This is normal for your own script. Click **Advanced** (small, bottom-left), then **Go to Lavish bookings (unsafe)**, then **Allow**.
5. The panel at the bottom shows `Ready. Tab "Requests" is set up…`.
6. Go back to the Sheet tab. At the bottom there is now a tab called **Requests** with the headings
   `Received · Name · Guests · Date · Time · Contact · Status · Notes · Reply`.

**C4. Test the Sheet side on its own (before touching the website)**

1. In the editor, change the function dropdown to **testWrite** and click **▶ Run**.
2. In the Sheet a new row appears: **Test Guest (delete me)**, Status **New**.
3. An email arrives at your alert address (look in **Spam** if you do not see it).
4. If both happened, the Sheet side works. Delete the test row: right-click its row number, **Delete row**.
5. If not, click the **clock icon** on the left of the editor (**Executions**), click the red line and read the message. See *Troubleshooting* below.

**C5. Turn the script into a web address**

1. Top-right of the editor click the blue **Deploy** button, then **New deployment**.
2. Click the **gear ⚙** next to "Select type" and choose **Web app**.
3. Description: type `v1`.
4. **Execute as:** `Me`.
5. **Who has access:** `Anyone`. (Not "Anyone with Google account". If you pick that, the website cannot reach it.)
6. Click **Deploy**. If Google asks to authorize again, click **Allow**.
7. Click **Copy** next to **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy…/exec` and ends in **/exec**.
8. **Check it works:** open a new browser tab, paste the address, press **Enter**.
   You should see text like `{"ok":true,"service":"lavish-bookings", …}`.
   If Google asks you to sign in, or you see an error page, the access is not "Anyone". Go to **Deploy → Manage deployments → ✎ (pencil) → Who has access → Anyone → Version: New version → Deploy**.

## D. Give the address to the website

1. Open `lavish-website/js/config.js` (right-click → **Open with** → a plain text editor; **VS Code** is best and free; Notepad is fine).
2. Find the line starting with `sheetEndpoint:`.
3. Select the old address **between the two quote marks** and **paste** the one you copied. **Paste it, do not retype it.** Keep the quote marks and the comma at the end.
4. Save (**Ctrl+S**).
   - Notepad: make sure the file is still called `config.js` (not `config.js.txt`). In the Save window set *Save as type* to **All files**, and *Encoding* to **UTF-8**.
   - Mac TextEdit: choose **Format → Make Plain Text** first.

## E. Try it for real

1. Go to the browser tab with the website and press **Ctrl+Shift+R** (Mac: **Cmd+Shift+R**) to reload without old copies. If you closed it, double-click `index.html` again.
2. Press **F12** to open the developer panel and click the **Console** tab. You should see `[Lavish] Booking form ready. Endpoint is set.`
3. Scroll to **Request a table**. Fill in every box and click **Request table**.
4. The button says **Sending…**, then you see the thank-you message.
5. Look at the Sheet's **Requests** tab: a new row appears within a few seconds. An email arrives too.
6. Extra proof: in the Apps Script editor click the **clock icon (Executions)**. You should see a line `doPost` marked **Completed**.

Done. You now have a working website → Google Sheet connection without publishing anything.

---

## Changing the script later

Whenever you edit the code inside Apps Script, the live address keeps running the **old** version until you publish a new one:

1. **Save** (Ctrl+S).
2. **Deploy → Manage deployments**.
3. Click the **✎ pencil**.
4. **Version:** choose **New version**.
5. Click **Deploy**. The address stays the same.

If Google asks for permission again, run `setup` once and click **Allow**.

## How staff use the Sheet

- **Status** column: click a cell and pick **New / Confirmed / Declined / Waitlist / Cancelled / No-show**. The whole row changes colour. Keeping Status up to date is what makes the statistics accurate (for example, set **No-show** for guests who never came).
- **Reply** column: one click opens WhatsApp (for phone numbers) or an email (for email addresses) to that guest.
- The alert email's **Reply** button answers the guest directly when they gave an email address.

## The Statistics tab

After you paste the new script and run **setup** once, the Sheet gets a second tab called **Statistics**, right next to **Requests**. (A third tab called *Calc* is hidden on purpose: it only does the arithmetic.)

What you will find there, all updating by themselves:

- **Key numbers:** requests today / last 7 / last 30 days and the change against the week before, how many are waiting for a reply, confirmed / declined / waitlist / cancelled / no-show and the matching rates, guests and covers (tonight and next 7 days), average and typical party size, largest party, how far ahead guests book, same-day requests, different guests, repeat guests, email vs phone, and the busiest day, hour and party size.
- **Tables:** by status, day of the week, arrival hour, party size, lead time, month (12 months), last 14 days, the next 14 days of bookings, the hour guests send requests, contact method, top repeat guests, and a day × hour "busy times" heat map.
- **Charts:** nine charts to the right of the key numbers.

To **preview it with example data** before real bookings arrive: menu **Lavish → Add DEMO requests**. When you have looked, use **Lavish → Remove DEMO requests**. Only rows whose Notes say DEMO are removed. (If the Lavish menu is not there, reload the Sheet; or pick `seedDemoData` / `clearDemoData` in the Apps Script editor and press Run.)

If a chart or number ever looks wrong, menu **Lavish → Rebuild statistics** rebuilds the tab. The statistics read the first 3,000 requests; raise `STATS_ROWS` at the top of the script if you ever get more.

## Troubleshooting

> Looking after the Sheet day to day, or something unusual happened? See **SHEET-MANAGEMENT-AND-TROUBLESHOOTING.md** in this folder: it lists every problem that can occur and what to do.

Always start here: press **F12** → **Console**, reload, and look for red text.

| What you see | What it means | What to do |
|---|---|---|
| Button does nothing, no "Sending…" | The page script did not run. Usually a file was edited wrongly or moved. | Press F12 → Console. Red error naming `config.js` or `booking.js`? Re-copy that file from the original zip and redo step D (paste the address, do not retype). |
| "We couldn't send that just now" | The request could not leave your computer (no internet, or a blocked/incorrect address). | Check your internet. Re-copy the address from **Deploy → Manage deployments**. It must end in `/exec`. |
| Thank-you shows but no row in the Sheet | The request left, but Google did not store it. | Open **Executions** (clock icon) in Apps Script. **No `doPost` line:** wrong address, or access is not "Anyone", or an old deployment. Open the address in a browser: you must see `{"ok":true…`. **`doPost` marked Failed:** click it and read the message. |
| `doPost` Completed but row not visible | Row went to the same Sheet but you are looking elsewhere. | Open the **Requests** tab and scroll down. Make sure you opened Apps Script *from this Sheet* (Extensions → Apps Script). |
| Row appears, no email | Email blocked or wrong address. | Check Spam. Check `NOTIFY_EMAIL` at the top of the script. Google limits free accounts to about 100 emails a day. |
| Headings (Received, Name…) vanished | Someone deleted them. | Nothing to fix: the next request rebuilds them. Or run `setup`. |
| Executions says "Authorization is required" | The script was edited and needs permission again. | Run `setup`, click **Allow**. |

## Good to know

- **The page cannot read Google's reply.** Browsers block that for security. So the page can say "sent", but the *proof* of delivery is the new row, the email and the Executions list.
- **The claude.ai preview link cannot send requests** (it is sandboxed). Opening `index.html` from your own computer can.
- **Spam:** the form has a hidden trap field, and the script refuses obviously invalid requests and caps the whole site at 30 requests per 10 minutes. Real guests are never limited.
- Never share the Sheet publicly. It contains guests' names and phone numbers.
