# Running the Lavish Google Sheet: daily use, problems and fixes

This guide is for the people who look after the booking Sheet. It covers everyday use, everything that can go wrong, and what to do about each thing. You do not need to know how to code.

**How to use this guide:** use *Find* (Ctrl+F) and search for the word you are seeing (for example `busy`, `#REF`, `email`, `blank`). Each problem has the same layout: **What you see**, **Why**, **What to do**.

---

## 1. The big picture (read this once)

Three tabs live in the Sheet:

| Tab | What it is | Can staff edit it? |
|---|---|---|
| **Requests** | One row per table request from the website. This is the real data. | Yes: change Status, add Notes. |
| **Statistics** | Numbers, tables and charts, all calculated from Requests. | No. Look only. It rebuilds itself. |
| **Calc** (hidden) | Helper arithmetic for Statistics. | No. Never. |

How a booking travels: guest fills the form on the website → the website sends it to a small program (the *Apps Script*) that lives inside this Sheet → the program checks the request, adds a row to **Requests** and emails the restaurant.

**Important to understand:** the website cannot see Google's answer (browsers block it). So a guest can see "your request has been received" even when the Sheet refused the request. **The proof that a booking arrived is the row in the Sheet (and the email), never the message on the website.** If a guest says "I booked but nothing is there", go to section 5.

### The columns in Requests

| Col | Name | Filled by | Notes |
|---|---|---|---|
| A | Received | script | When the request arrived (UK time). |
| B | Name | script | |
| C | Guests | script | e.g. `2 guests`, `10+ guests (call us)`. |
| D | Date | script | The day the guest wants, written `2026-12-24`. |
| E | Time | script | `19:30` |
| F | Contact | script | Phone or email. |
| G | Status | **staff** | New / Confirmed / Declined / Waitlist / Cancelled / No-show |
| H | Notes | **staff** | Anything you like. |
| I | Reply | script | One-click WhatsApp or email link. |

### What the statuses mean (use them the same way every time)

| Status | Use it when |
|---|---|
| **New** | Nobody has answered yet. (Set automatically. A blank Status counts as New.) |
| **Confirmed** | You told the guest yes. |
| **Declined** | You told the guest no (fully booked, closed, etc.). |
| **Waitlist** | You cannot confirm yet but might. |
| **Cancelled** | The guest cancelled a confirmed booking. |
| **No-show** | Confirmed, but the guest never came. |

The statistics are only as good as these statuses. Five minutes of tidy statuses after each service is the best habit you can have.

---

## 2. Daily routine (about 5 minutes)

**Morning**
1. Open the Sheet, **Requests** tab.
2. Click the **Status** heading → **Data → Create a filter** (once) → filter Status to **New**.
3. For each New row: click the **Reply** link (opens WhatsApp or an email to the guest), answer them, then set Status to **Confirmed**, **Declined** or **Waitlist**.
4. Open **Statistics**: the *Waiting for a reply (New)* number should be 0.

**After service**
1. Filter Date to today.
2. Anyone Confirmed who did not come → **No-show**. Anyone who cancelled → **Cancelled**.

**Once a month**
- **File → Download → Microsoft Excel** and keep the file somewhere safe (a backup).
- Look at Statistics for trends (busiest days, no-show rate).
- Delete test rows (see 4.4) and, if your policy says so, old rows that you no longer need to keep (guests' names and phone numbers are personal data; do not keep them longer than you need to).

---

## 3. Safe and unsafe things to do

### Safe
- Change Status and Notes.
- Colour cells or add comments (right-click → *Comment*).
- Create a filter (**Data → Create a filter**) or a *filter view*.
- Sort: click the number of row 2, Shift+click the number of the last row (so the heading row is **not** selected), then **Data → Sort range → Advanced range sorting options**, and sort by column A. Never sort with the heading row selected.
- Add **extra columns to the right** (column J and beyond), for your own use.
- Delete a whole row (right-click the row number → *Delete row*), for example duplicates and tests.
- Freeze, resize or hide columns for display only.

### Unsafe (please do not)
| Don't | Why |
|---|---|
| **Rename the Requests tab** | The script looks for a tab called exactly `Requests`. If it does not find one it creates a new empty one and new bookings land there, while your history stays in the renamed tab. |
| **Delete, rename or edit the Statistics or Calc tabs** | They are rebuilt automatically, but edits are overwritten and deleting Calc breaks the numbers until you rebuild. |
| **Insert or delete columns between A and I** | The script writes by column position. Bookings would land in the wrong columns. Add columns to the right instead. |
| **Move or reorder columns A–I** | Same reason. |
| **Type over the heading row** | It is repaired automatically, but do not rely on that. |
| **Type `DEMO` in the Notes of a real booking** | *Remove DEMO requests* deletes every row with exactly `DEMO` in Notes. |
| **Share the Sheet with "Anyone with the link"** | It holds guests' names and phone numbers. |
| **Paste values into the Status column from elsewhere** | Pasting skips the dropdown check, and a misspelt status is counted as something the statistics do not know. |

---

## 4. Problems inside the Sheet and how to fix them

### 4.1 The headings (Received, Name, Guests…) are missing or changed
- **Why:** someone typed over or deleted row 1.
- **Fix:** nothing needed: the next booking repairs them. To repair now: Extensions → Apps Script → choose `setup` → **Run**.

### 4.2 The Status dropdown or the row colours stopped working
- **Why:** rows were pasted over or the tab was copied.
- **Fix:** Apps Script → run `setup`. It re-applies dropdowns and colours (data is never touched).

### 4.3 A new booking is in the wrong columns or a cell shows a strange value
- **Why:** a column was inserted, deleted or moved inside A–I.
- **Fix:**
  1. Press **Ctrl+Z** repeatedly until the column is back, **or** use **File → Version history → See version history** and restore a version from before the change.
  2. If you cannot undo, move the data by hand so the columns match the table in section 1, then run `setup`.

### 4.4 Test or demo rows are still in the data (numbers look too high)
- **Test Guest (delete me):** created by `testWrite`. Delete the row (right-click row number → *Delete row*).
- **DEMO rows:** menu **Lavish → Remove DEMO requests**. If the menu is missing, reload the Sheet; or Apps Script → choose `clearDemoData` → **Run**.

### 4.5 The same guest appears twice
- **Why:** they pressed the button twice, or booked on two devices.
- **Fix:** keep one row, delete the other. If you want to keep both (for the record), set the extra one to **Cancelled** and add a note "duplicate". Duplicates inflate the statistics.

### 4.6 The Reply link opens the wrong WhatsApp number or says "WhatsApp guest" for an email
- **Why:** phone numbers are assumed to be UK. A number typed without a country code gets `+44` added; a foreign number must start with `+` or `00`.
- **Fix:** copy the number from the Contact column and message it by hand. Optionally correct the Contact cell (add `+` and the country code) and re-click the link; the link itself is a formula, so if it is wrong, retype it: `=HYPERLINK("https://wa.me/447700900123","WhatsApp guest")`.

### 4.7 I deleted the Requests tab
- **Why:** accident.
- **Fix, step by step:**
  1. **Ctrl+Z** right away (works if you do it at once).
  2. If too late: **File → Version history → See version history**, pick the last version before the deletion, click **Restore this version**.
  3. If there is no history: the next booking creates a new empty Requests tab, so new requests are not lost, but old ones are gone unless you have a monthly Excel backup (section 2).

### 4.8 I renamed the Requests tab
- **Why:** accident. The script now creates a second, new `Requests` tab for new bookings.
- **Fix:**
  1. Delete the new, empty `Requests` tab (only if it has no rows you need), or copy its rows to the old tab first.
  2. Rename the old tab back to exactly `Requests` (capital R, no spaces).
  3. Menu **Lavish → Rebuild statistics**.

### 4.9 The sheet is slow or very long
- It handles thousands of rows. If it feels slow, delete old rows (after saving a backup) or ask the person who runs the site to archive last year into a copy.

### 4.10 Somebody sorted or filtered and now "rows are missing"
- Filtered rows are only hidden. Check for the small green filter icon on the header and press **Data → Remove filter**. Hidden rows are still there and new bookings are still added at the bottom.

---

## 5. A guest says they booked, but there is no row

Work through this in order. Stop when you find it.

1. **Look in the right place:** the **Requests** tab, scroll to the bottom. Check there is no active filter (see 4.10). Search for their name with **Ctrl+F**, and search for the phone number or email too.
2. **Look in the email inbox** of the address in `NOTIFY_EMAIL` (also Spam). An email with no row, or a row with no email, tells you which half failed.
3. **Open the log:** Extensions → Apps Script → **Executions** (the clock icon on the left). Find the time the guest tried. Each line is one request:
   - **Completed**, and the log text says `Saved request in row N`: it *was* saved. Look at row N.
   - **Completed**, and the log text says `Rejected request: …`: the Sheet refused it. See the table below.
   - **Failed**: click it and read the red message. See section 7.
   - **Nothing at that time:** the request never reached the Sheet. See section 6.

**What the `Rejected request` messages mean**

| Message in the log | Meaning | What to do |
|---|---|---|
| `name missing` / `guests missing` | A field was empty. | Ask the guest to try again or phone. |
| `bad date` | The date was not a real date. | Ask them to try again. |
| `date in the past` | They chose a day that has already passed (or the computer's clock was wrong). | Ask them to try again. |
| `bad time` | The time was not valid. | Ask them to try again. |
| `bad contact` | The phone number or email did not look real (a phone needs at least 7 digits). | Ask them to try again with a working number or email. |
| `flood guard tripped` / `busy` | More than **30 requests in 10 minutes** came in for the whole site (a safety limit against spam). | See 5.1. |

The guest never sees these messages, because the website cannot read the Sheet's answer. This is why you should always tell guests: *"if you do not hear from us within a few hours, please call 01438 222 215"*.

### 5.1 The "busy" limit was hit
- **Why:** 30 requests within 10 minutes. On an ordinary day this means a robot is hammering the form. During a big promotion it could be real guests.
- **What to do:** wait 10 minutes (the counter resets by itself). If it keeps happening with real guests, raise `MAX_REQUESTS_PER_10_MIN` at the top of the script (try 60), **save**, then **Deploy → Manage deployments → ✎ → Version: New version → Deploy** (see 7.1).

### 5.2 A burst of junk or strange rows
- **Why:** spam. The form has a hidden trap field that catches simple robots; the script rejects invalid contacts; and the 30-per-10-minutes limit caps the damage.
- **What to do:** delete the junk rows. Set the junk rows' Status to **Declined** if you prefer to keep a record. If it continues, tell the person who looks after the website; the answer is usually a stronger spam check.

### 5.3 Rare: two people booked at exactly the same moment and one vanished
- The script processes one booking at a time. If the Sheet is extremely busy, a second booking can wait up to 10 seconds and then fail with `Could not obtain lock`. It shows up as **Failed** in Executions. Ask that guest to resend.

---

## 6. The website says it sent, but nothing even arrives in Executions

That means the request never reached the Sheet's program. Causes, most likely first:

| Cause | How to check | Fix |
|---|---|---|
| **Wrong or old address in `js/config.js`** | Open the address from `sheetEndpoint` in a normal browser tab. You must see `{"ok":true,"service":"lavish-bookings",…}`. | Copy the address again from Apps Script → **Deploy → Manage deployments** (it ends in `/exec`) into `js/config.js`. Paste, do not retype. |
| **A new deployment made a new address** | Choosing **New deployment** (instead of **New version** on the existing one) gives a *different* address. | Either put the new address in `js/config.js`, or always use **Manage deployments → ✎ → New version** so the address never changes. |
| **Access is not "Anyone"** | The address shows a Google sign-in page instead of `{"ok":true…`. | Deploy → Manage deployments → ✎ → *Who has access*: **Anyone** → New version → Deploy. |
| **Script not saved or not deployed after an edit** | Executions shows no new activity after you edited. | Press Save, then redeploy a **New version** (7.1). |
| **The website file was edited wrongly** | Press **F12 → Console**, reload; red text naming `config.js` or `booking.js`. | Re-copy that file from the original zip and re-paste the address. |
| **`sheetEndpoint` is empty** | The website says "this is a concept form and doesn't send live bookings". | Paste the address into `sheetEndpoint` in `js/config.js`. |
| **Guest has no internet or uses a blocker** | The website shows "We couldn't send that just now". | The guest can phone 01438 222 215 or try another network. |
| **The Sheet owner's Google account has a problem** | Opening the address shows a Google error page. | See 8 (account problems). |

---

## 7. Apps Script problems (the "Executions" list shows Failed, or you see an error)

### 7.1 How to publish a change safely
Any time you edit the code, the live address keeps running the **old** code until you publish a new version:
1. Press **Save** (Ctrl+S).
2. **Deploy → Manage deployments**.
3. Click the **✎ pencil** on the existing deployment.
4. **Version: New version**, then **Deploy**. The address stays the same.

### 7.2 Error messages and fixes

| Message | Why | Fix |
|---|---|---|
| `Authorization is required` / `You do not have permission to call MailApp.sendEmail` / `…SpreadsheetApp…` | The code changed and Google needs you to approve it again. | Pick `setup` → **Run** → **Review permissions → Allow** (choose the Google account, then *Advanced → Go to … (unsafe)* is normal for your own script). Then redeploy a New version. |
| `No spreadsheet found. Open the Sheet, choose Extensions > Apps Script…` | The code lives in a separate script, not inside the Sheet. | Open the Sheet → Extensions → Apps Script → paste the code there. (Or put the Sheet's ID into `SPREADSHEET_ID` at the top.) |
| `Script function not found: doGet` / `doPost` | The code was not saved, was pasted incompletely, or the wrong file was pasted. | Select everything in the editor, paste the full `Code.gs` again, Save, redeploy a New version. |
| `SyntaxError: …` | The pasted code was cut or edited wrongly. | Paste the complete `Code.gs` again. |
| `Exception: Service invoked too many times: email` / `Email quota exceeded` | Free Gmail accounts can send roughly 100 script emails a day. | The bookings are still saved. Wait until tomorrow, or use a Google Workspace account (far higher limit). |
| `Could not obtain lock after 10000ms` | Too many bookings at the same instant (rare). | Ask that guest to try again. |
| `Booking saved, but the alert email failed: …` (in the log) | The row is safe; the email did not send. | Check `NOTIFY_EMAIL` for typos, approve permissions (first row of this table), check the daily limit. |
| `The caller does not have permission` when running a function from the editor | You are not signed in as the Sheet's owner/editor. | Sign in with the right Google account. |
| An error mentioning `Requests` or `#REF!` when running `buildStatistics` | The Requests tab is missing or renamed. | See 4.7 / 4.8, then run `buildStatistics`. |

### 7.3 Changing the email address that receives alerts
1. Apps Script → near the top, find `NOTIFY_EMAIL: '…'` and change it. To send to two people, set it to `'a@x.com,b@x.com'`.
2. **Save**, then redeploy a **New version** (7.1).

### 7.4 Testing that everything works (no website needed)
Apps Script → choose `testWrite` → **Run**. Within seconds a row `Test Guest (delete me)` appears in Requests and an email arrives. If both happen, the Sheet side is healthy. Then delete the test row.

---

## 8. Google account and ownership problems

| Situation | Effect | What to do |
|---|---|---|
| **The owner's Google account is suspended, deleted or its password is lost** | The script runs as its owner, so **bookings stop** and emails stop. | Recover the account, or, from another account: make a copy of the Sheet (File → Make a copy), paste the script, deploy it, and put the **new address** into `js/config.js`. Use a **restaurant-owned account**, not a personal one, to avoid this. |
| **A staff member who owns the Sheet leaves** | Same risk. | Before they leave: File → Share → give the new person Editor, then use the ⋮ menu next to their name → *Transfer ownership*. The new owner opens Apps Script → Deploy → **New deployment** (Web app, Execute as: Me, Anyone) and updates `sheetEndpoint` in `js/config.js` with the new address. |
| **A staff member needs access** | | File → Share → add their email as **Editor** (they can change statuses). Use **Viewer** for people who only look. Avoid giving everyone Editor: editors can also open and change the script. |
| **Someone you do not know has access** | Privacy risk. | File → Share → remove them, and check *General access* is **Restricted**. |
| **Two-step verification asks for a code when opening the Sheet** | Normal. | Use the owner's phone. |

---

## 9. Statistics problems

The Statistics tab recalculates by itself. If something looks off, run **Lavish → Rebuild statistics** first; it fixes most things and never touches your bookings.

| What you see | Why | What to do |
|---|---|---|
| **The Lavish menu is missing** | The Sheet was not reloaded since the script was pasted. | Reload the browser tab. If still missing, run `setup` once from Apps Script. |
| **The Statistics tab is missing** | Deleted or never created. | Apps Script → run `buildStatistics` (or `setup`). |
| **Everything shows `0` or `–`** | There are no requests yet (normal), or the Requests tab was renamed. | Add DEMO requests to preview (menu **Lavish → Add DEMO requests**), remember to remove them afterwards. |
| **`#REF!`, `#NAME?`, `#VALUE!`, `#N/A` in many cells** | The Calc tab was deleted, edited or its formulas were overwritten. | **Lavish → Rebuild statistics**. |
| **`Loading…` or the numbers appear after a few seconds** | The tab recalculates thousands of cells. | Wait. Then reload the page if it stays. |
| **"Repeat guests" shows "No repeat guests yet"** | Nobody has asked twice with the same phone or email. | Normal. |
| **Numbers include fake or test rows** | Test or DEMO rows are still in Requests. | See 4.4. |
| **A request counts as "New" though you replied** | The Status is still blank or New. | Set the Status. |
| **A status is not counted in the rates** | A misspelt Status was pasted in. | Re-pick it from the dropdown. |
| **Same person counted as two guests** | They gave two different contacts (phone once, email next time). | Normal; the statistics identify people by contact. |
| **Rates look odd with few bookings** | Percentages of small numbers jump a lot. | Look again when you have 30+ requests. |
| **Charts are missing or empty** | The tab was rebuilt while empty, or charts were deleted. | **Lavish → Rebuild statistics** recreates all nine charts. |
| **The numbers stopped at 3,000 requests** | The statistics read the first 3,000 rows. | At the top of the script change `STATS_ROWS: 3000` to e.g. `10000`, Save, then **Lavish → Rebuild statistics**. (Very large values make the Sheet slower; archive old years instead.) |
| **"Today", "last 7 days" look off by a day** | The Sheet's own time zone differs from the restaurant's. | File → Settings → **Time zone**: *(GMT+00:00) London*. |
| **Weekday or time tables are empty but total is not** | Dates or times in the Requests tab were retyped in another format. | Dates must read `2026-12-24`, times `19:30` (plain text). Fix the cells, then the numbers return by themselves. |

---

## 10. Backups and getting things back

| Need | How |
|---|---|
| **Undo a recent mistake** | Ctrl+Z (works for a while, even after other edits). |
| **See who changed what and when** | File → Version history → **See version history**. Click a version to preview it. |
| **Go back to an earlier day** | In version history choose the version → **Restore this version**. (Make a copy first if you are unsure.) |
| **Keep a copy safe** | File → Download → **Microsoft Excel (.xlsx)** monthly, store it somewhere safe. Or File → **Make a copy** (copies the script too, but the copy needs its own deployment, section 8). |
| **Restore one deleted row** | Version history → copy the row from the old version → paste it back in the right place. |

---

## 11. If everything seems broken: the safe reset order

Your bookings live in the **Requests** tab. Nothing below deletes them.

1. **Stay calm and do not delete anything.**
2. Check **File → Version history** to make sure the data is there.
3. Apps Script → run `setup` (repairs Requests and rebuilds Statistics). Approve permissions if asked.
4. Apps Script → run `testWrite`. A test row and an email should appear. Delete the test row.
5. Open the website address from `sheetEndpoint` in a browser: it should show `{"ok":true…`.
6. If not: Deploy → Manage deployments → ✎ → **New version** → Deploy.
7. Submit one real test booking from the website. Check the row (and the email).
8. Still failing? Look at **Executions**, copy the red error text, and look it up in section 7.2.

---

## 12. Quick answers

- **Where is the proof a booking arrived?** The row in Requests and the email, not the message on the website.
- **A guest says nothing arrived:** section 5.
- **I edited the script and nothing changed:** you must redeploy a **New version** (7.1).
- **Can I add my own columns?** Yes, to the right of column I.
- **Can I sort the data?** Yes, select only the data rows (section 3).
- **How do I preview Statistics with example data?** Lavish → Add DEMO requests (then Remove DEMO requests).
- **How do I change who gets the emails?** Section 7.3.
- **Who should own the Sheet?** A restaurant-owned Google account, with at least two trusted people as Editors.
- **What should I tell guests?** "If you do not hear from us within a few hours, call 01438 222 215."
