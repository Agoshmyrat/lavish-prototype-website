/**
 * LAVISH — table request receiver (Google Apps Script)
 * ---------------------------------------------------------------------------
 * Paste this whole file into the Google Sheet that should receive requests:
 *   Sheet  ->  Extensions  ->  Apps Script  ->  replace everything  ->  Save.
 *
 * Functions you can run from the editor (pick one in the dropdown, press Run):
 *   setup()      Builds / repairs the "Requests" tab. Safe to run any number of times.
 *   testWrite()  Adds a fake request + sends the alert email. Proves the Sheet side works
 *                without involving the website at all.
 *   buildStatistics()  Builds / refreshes the "Statistics" tab (live numbers, tables and charts
 *                calculated from the Requests tab). Safe to run any number of times.
 *   seedDemoData()   Adds ~150 clearly marked DEMO requests so you can see the statistics filled in.
 *   clearDemoData()  Removes every DEMO row again.
 *   (A "Lavish" menu with the same actions also appears in the Sheet after you reload it.)
 *
 * Called by the website (do not run by hand):
 *   doPost(e)    Receives a request, validates it, writes a row, emails the restaurant.
 *   doGet(e)     Health check: open the web app URL in a browser to see {"ok":true,...}.
 */

/* ============================== SETTINGS ============================== */
var CONFIG = {
  NOTIFY_EMAIL: 'bookings@lavishrestaurant.co.uk', // who receives an email for every request
  SHEET_NAME: 'Requests',                          // tab name (created automatically)
  TIMEZONE: 'Europe/London',
  SPREADSHEET_ID: '',                              // leave empty when created via Extensions > Apps Script
  MAX_REQUESTS_PER_10_MIN: 30,                     // flood guard for the whole site, not per guest
  STATS_SHEET_NAME: 'Statistics',                  // tab with the numbers, tables and charts
  STATS_ROWS: 3000                                 // how many request rows the statistics read (raise it if you ever pass it)
};
/* ====================================================================== */

var HEADERS = ['Received', 'Name', 'Guests', 'Date', 'Time', 'Contact', 'Status', 'Notes', 'Reply'];
var STATUSES = ['New', 'Confirmed', 'Declined', 'Waitlist', 'Cancelled', 'No-show'];
var STATUS_COLOURS = { New: '#FFF2CC', Confirmed: '#D9EAD3', Declined: '#F4CCCC', Waitlist: '#D9E2F3', Cancelled: '#E7E6E6', 'No-show': '#F9CB9C' };
var STATUS_COLUMN = 7;
var FIELD_COUNT = 8; // columns A..H hold data; column I holds the Reply link

/* ------------------------------- entry points ------------------------------- */

/** Run once by hand (also re-run it after pasting a new version of this file). */
function setup() {
  var sheet = getRequestsSheet_();
  initSheet_(sheet);
  try {
    buildStatistics();
  } catch (error) {
    console.error('The Requests tab is ready, but the Statistics tab could not be built: ' + error + '. Run buildStatistics() to see the details.');
  }
  console.log('Ready. Tabs "' + sheet.getName() + '" and "' + CONFIG.STATS_SHEET_NAME + '" are set up in: ' + sheet.getParent().getUrl());
}

/** Adds a "Lavish" menu to the Sheet (appears after the Sheet is reloaded). */
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Lavish')
      .addItem('Rebuild statistics', 'buildStatistics')
      .addItem('Repair Requests tab', 'setup')
      .addSeparator()
      .addItem('Add DEMO requests (to preview statistics)', 'seedDemoData')
      .addItem('Remove DEMO requests', 'clearDemoData')
      .addToUi();
  } catch (error) { /* no UI available (for example when run by a trigger): nothing to do */ }
}

/** The website posts each request here. */
function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    if (!raw) return json_({ ok: false, error: 'empty request' });

    var data = JSON.parse(raw);
    if (data.website) return json_({ ok: true });            // honeypot: pretend it worked, store nothing

    return json_(handleRequest_(data));
  } catch (error) {
    console.error('doPost failed: ' + error + (error && error.stack ? '\n' + error.stack : ''));
    return json_({ ok: false, error: 'server error' });
  }
}

/** Health check. Never exposes any guest data. */
function doGet() {
  return json_({ ok: true, service: 'lavish-bookings', time: new Date().toISOString() });
}

/** Editor-only test: writes a fake request end-to-end (row + email). Delete the test row afterwards. */
function testWrite() {
  var tomorrow = Utilities.formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  var result = handleRequest_({
    name: 'Test Guest (delete me)',
    guests: '2 guests',
    date: tomorrow,
    time: '19:00',
    contact: '+44 7700 900123'
  });
  console.log('testWrite result: ' + JSON.stringify(result));
  if (!result.ok) throw new Error('testWrite failed: ' + result.error);
}

/* ------------------------------- core logic ------------------------------- */

function handleRequest_(data) {
  var checked = validate_(data);
  if (!checked.ok) {
    console.warn('Rejected request: ' + checked.error);
    return { ok: false, error: checked.error };
  }
  if (tooManyRequests_()) {
    console.warn('Rejected request: flood guard tripped');
    return { ok: false, error: 'busy' };
  }

  var r = checked.clean;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);                                      // two guests submitting at once must not share a row
  var row;
  try {
    var sheet = getRequestsSheet_();
    row = nextRow_(sheet);
    var stamp = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm');
    sheet.getRange(row, 1, 1, FIELD_COUNT)
      .setValues([[stamp, r.name, r.guests, r.date, r.time, r.contact, 'New', '']]);
    var link = replyLink_(r.contact);
    sheet.getRange(row, FIELD_COUNT + 1).setFormula('=HYPERLINK("' + link.url + '","' + link.label + '")');
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  notify_(r, row);                                           // an email problem must never lose the booking
  console.log('Saved request in row ' + row + ' for ' + r.name);
  return { ok: true };
}

function validate_(data) {
  if (!data || typeof data !== 'object') return { ok: false, error: 'bad request' };

  var clean = {
    name: tidy_(data.name, 80),
    guests: tidy_(data.guests, 40),
    date: tidy_(data.date, 10),
    time: tidy_(data.time, 5),
    contact: tidy_(data.contact, 120)
  };

  if (!clean.name) return { ok: false, error: 'name missing' };
  if (!clean.guests) return { ok: false, error: 'guests missing' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean.date)) return { ok: false, error: 'bad date' };
  if (!/^\d{2}:\d{2}$/.test(clean.time)) return { ok: false, error: 'bad time' };

  var today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  if (clean.date < today) return { ok: false, error: 'date in the past' };

  var isEmail = /^[^\s@"']+@[^\s@"']+\.[^\s@"']{2,}$/.test(clean.contact);
  var isPhone = /^[+\d\s().-]+$/.test(clean.contact) && clean.contact.replace(/\D/g, '').length >= 7;
  if (!isEmail && !isPhone) return { ok: false, error: 'bad contact' };

  return { ok: true, clean: clean };
}

/** Trim, drop control characters, collapse spaces, cap the length. */
function tidy_(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Simple site-wide guard against floods (protects the mailbox and Google's daily email quota). */
function tooManyRequests_() {
  var cache = CacheService.getScriptCache();
  var count = parseInt(cache.get('recent_requests') || '0', 10) + 1;
  cache.put('recent_requests', String(count), 600);
  return count > CONFIG.MAX_REQUESTS_PER_10_MIN;
}

function notify_(r, row) {
  try {
    var isEmail = r.contact.indexOf('@') > -1;
    var options = {
      to: CONFIG.NOTIFY_EMAIL,
      subject: 'New table request: ' + r.name + ', ' + r.guests + ', ' + r.date + ' ' + r.time,
      body: 'A new table request just arrived from the website.\n\n' +
            'Name:    ' + r.name + '\n' +
            'Guests:  ' + r.guests + '\n' +
            'Date:    ' + r.date + '\n' +
            'Time:    ' + r.time + '\n' +
            'Contact: ' + r.contact + '\n\n' +
            'It is in row ' + row + ' of the Sheet. Set the Status to Confirmed, Declined or Waitlist:\n' +
            getSpreadsheet_().getUrl()
    };
    if (isEmail) options.replyTo = r.contact;                // pressing Reply answers the guest directly
    MailApp.sendEmail(options);
  } catch (error) {
    console.error('Booking saved, but the alert email failed: ' + error);
  }
}

/* ============================== STATISTICS ============================== */
/*
 * Everything on the "Statistics" tab is a live formula on a hidden helper tab ("Calc"), which in turn reads
 * the "Requests" tab. Nothing here runs when a guest books, so statistics can never get in the way of a booking.
 * Change a Status in Requests and the numbers update by themselves.
 */

var CALC_SHEET = 'Calc';
var WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
var SLOT_HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
var PARTY_BUCKETS = ['1-2 guests', '3-4 guests', '5-6 guests', '7-9 guests', '10+ guests'];
var LEAD_BUCKETS = ['Same day', '1-2 days', '3-7 days', '8-14 days', '15-30 days', '31+ days'];
var INK = '#14100D', PAPER = '#EDE6DA', BRASS = '#B8935A', EMBER = '#A8432D';

/** Builds (or rebuilds) the hidden Calc tab and the Statistics tab. Safe to run any number of times. */
function buildStatistics() {
  var ss = getSpreadsheet_();
  var requests = getRequestsSheet_();
  buildCalc_(ss);

  var sh = ss.getSheetByName(CONFIG.STATS_SHEET_NAME) || ss.insertSheet(CONFIG.STATS_SHEET_NAME);
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.clearConditionalFormatRules();
  sh.clear();
  sh.setHiddenGridlines(true);
  sh.setTabColor(BRASS);

  var layout = layoutStatistics_(sh);

  // keep tab order: Requests, Statistics, (hidden) Calc
  ss.setActiveSheet(sh);
  ss.moveActiveSheet(2);
  ss.setActiveSheet(requests);
  console.log('Statistics rebuilt: ' + layout.rows + ' rows.');
}

/* ------------------------------- helper tab ------------------------------- */

function calcRange_(col) {
  return CALC_SHEET + '!$' + col + '$2:$' + col + '$' + (CONFIG.STATS_ROWS + 1);
}

/** One formula per Requests row, turning the text cells into numbers the statistics can count and add up. */
function buildCalc_(ss) {
  var calc = ss.getSheetByName(CALC_SHEET) || ss.insertSheet(CALC_SHEET);
  calc.clear();
  var heads = ['Received', 'Visit date', 'Visit time', 'Guests', 'Weekday (Mon=1)', 'Visit hour', 'Lead days',
               'Request hour', 'Status', 'Contact type', 'Guest key', 'Name', 'Received month', 'Party size',
               'Received day', 'Lead time'];
  calc.getRange(1, 1, 1, heads.length).setValues([heads]).setFontWeight('bold');

  var rows = CONFIG.STATS_ROWS, f = [];
  for (var i = 0; i < rows; i++) {
    var r = i + 2, q = 'Requests!';
    var blank = q + 'A' + r + '=""';
    f.push([
      /* A */ '=IF(' + blank + ',"",IFERROR(IF(ISNUMBER(' + q + 'A' + r + '),' + q + 'A' + r + ',DATEVALUE(LEFT(' + q + 'A' + r + ',10))+TIMEVALUE(MID(' + q + 'A' + r + ',12,5))),""))',
      /* B */ '=IF(' + blank + ',"",IFERROR(IF(ISNUMBER(' + q + 'D' + r + '),' + q + 'D' + r + ',DATEVALUE(' + q + 'D' + r + ')),""))',
      /* C */ '=IF(' + blank + ',"",IFERROR(IF(ISNUMBER(' + q + 'E' + r + '),' + q + 'E' + r + ',TIMEVALUE(' + q + 'E' + r + ')),""))',
      /* D */ '=IF(' + blank + ',"",IFERROR(VALUE(SUBSTITUTE(LEFT(' + q + 'C' + r + ',FIND(" ",' + q + 'C' + r + '&" ")-1),"+","")),""))',
      /* E */ '=IF(B' + r + '="","",WEEKDAY(B' + r + ',2))',
      /* F */ '=IF(C' + r + '="","",HOUR(C' + r + '))',
      /* G */ '=IF(OR(A' + r + '="",B' + r + '=""),"",B' + r + '-INT(A' + r + '))',
      /* H */ '=IF(A' + r + '="","",HOUR(A' + r + '))',
      /* I */ '=IF(' + blank + ',"",IF(' + q + 'G' + r + '="","New",' + q + 'G' + r + '))',
      /* J */ '=IF(' + blank + ',"",IF(ISNUMBER(SEARCH("@",' + q + 'F' + r + ')),"Email","Phone"))',
      /* K */ '=IF(' + blank + ',"",SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(LOWER(TRIM(' + q + 'F' + r + ')), " ",""),"(",""),")",""),"-",""),".",""))',
      /* L */ '=IF(' + blank + ',"",' + q + 'B' + r + ')',
      /* M */ '=IF(A' + r + '="","",YEAR(A' + r + ')*100+MONTH(A' + r + '))',
      /* N */ '=IF(D' + r + '="","",IF(D' + r + '<=2,"1-2 guests",IF(D' + r + '<=4,"3-4 guests",IF(D' + r + '<=6,"5-6 guests",IF(D' + r + '<=9,"7-9 guests","10+ guests")))))',
      /* O */ '=IF(A' + r + '="","",INT(A' + r + '))',
      /* P */ '=IF(G' + r + '="","",IF(G' + r + '<=0,"Same day",IF(G' + r + '<=2,"1-2 days",IF(G' + r + '<=7,"3-7 days",IF(G' + r + '<=14,"8-14 days",IF(G' + r + '<=30,"15-30 days","31+ days"))))))'
    ]);
  }
  calc.getRange(2, 1, rows, heads.length).setFormulas(f);
  calc.getRange(2, 1, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  calc.getRange(2, 2, rows, 1).setNumberFormat('yyyy-mm-dd');
  calc.getRange(2, 3, rows, 1).setNumberFormat('hh:mm');
  calc.setFrozenRows(1);
  calc.setTabColor('#888888');
  calc.hideSheet();
  return calc;
}

/* ------------------------------- statistics layout ------------------------------- */

function layoutStatistics_(sh) {
  var ST = calcRange_('I'), GU = calcRange_('D'), VD = calcRange_('B'), WD = calcRange_('E'), SH = calcRange_('F'),
      LD = calcRange_('G'), RH = calcRange_('H'), CT = calcRange_('J'), KEY = calcRange_('K'), NAME = calcRange_('L'),
      RM = calcRange_('M'), PB = calcRange_('N'), RD = calcRange_('O'), LB = calcRange_('P');

  var grid = {};            // "row,col" -> value or formula
  var formats = [];         // [a1 range, number format]
  var titles = [], heads = [], subheads = [], labels = [];
  var charts = [];
  var maxCol = 6;
  function put(r, c, v) { grid[r + ',' + c] = v; if (c > maxCol) maxCol = c; }
  function a1(r, c, r2, c2) { return sh.getRange(r, c, (r2 || r) - r + 1, (c2 || c) - c + 1).getA1Notation(); }
  function col(c) { return String.fromCharCode(64 + c); }

  var row = 1;
  put(row, 1, 'LAVISH · Reservation statistics');
  titles.push([row, 6]);
  row++;
  put(row, 1, 'Live numbers calculated from the Requests tab. Change a Status there and everything here updates by itself.');
  put(row + 0, 4, '');
  row += 2;

  /* ---------- Key numbers (rows are reserved first, formulas are filled in once the tables exist) ---------- */
  var kpis = [];
  function head(text) { kpis.push({ head: text }); }
  function kpi(key, label, fn, fmt, note) { kpis.push({ key: key, label: label, fn: fn, fmt: fmt || '#,##0', note: note || '' }); }

  var kpiStart = row;
  var addr = {};
  var idx = 0;
  // addresses must be known before formulas are written, so lay the list out first
  function a(key) { return '$B$' + addr[key]; }

  head('Requests');
  kpi('total', 'Total requests', function () { return '=COUNTIF(' + ST + ',"?*")'; }, '#,##0', 'Every request ever received.');
  kpi('today', 'Received today', function () { return '=COUNTIF(' + RD + ',TODAY())'; });
  kpi('d7', 'Received in the last 7 days', function () { return '=COUNTIF(' + RD + ',">="&(TODAY()-6))'; });
  kpi('d30', 'Received in the last 30 days', function () { return '=COUNTIF(' + RD + ',">="&(TODAY()-29))'; });
  kpi('wow', 'Change vs the 7 days before', function () {
    return '=IFERROR(' + a('d7') + '/COUNTIFS(' + RD + ',">="&(TODAY()-13),' + RD + ',"<="&(TODAY()-7))-1,0)';
  }, '+0.0%;-0.0%;0.0%', 'Last 7 days compared with the 7 days before them.');
  kpi('perDay', 'Average requests per day (last 30 days)', function () { return '=' + a('d30') + '/30'; }, '0.0');
  kpi('upcoming', 'Requests for today or later', function () { return '=COUNTIF(' + VD + ',">="&TODAY())'; }, '#,##0', 'By the date the guest wants to visit.');
  kpi('tonightReq', 'Requests for tonight', function () { return '=COUNTIF(' + VD + ',TODAY())'; });

  head('What happened to them');
  kpi('new', 'Waiting for a reply (New)', function () { return '=COUNTIF(' + ST + ',"New")'; }, '#,##0', 'Needs attention.');
  kpi('conf', 'Confirmed', function () { return '=COUNTIF(' + ST + ',"Confirmed")'; });
  kpi('decl', 'Declined', function () { return '=COUNTIF(' + ST + ',"Declined")'; });
  kpi('wait', 'Waitlist', function () { return '=COUNTIF(' + ST + ',"Waitlist")'; });
  kpi('canc', 'Cancelled by the guest', function () { return '=COUNTIF(' + ST + ',"Cancelled")'; });
  kpi('nosh', 'No-show', function () { return '=COUNTIF(' + ST + ',"No-show")'; });
  kpi('confRate', 'Confirmation rate', function () { return '=IFERROR(' + a('conf') + '/(' + a('total') + '-' + a('new') + '),0)'; }, '0.0%', 'Confirmed out of requests that have been answered.');
  kpi('declRate', 'Decline rate', function () { return '=IFERROR(' + a('decl') + '/(' + a('total') + '-' + a('new') + '),0)'; }, '0.0%', 'High = often fully booked or tables too tight.');
  kpi('cancRate', 'Cancellation rate', function () { return '=IFERROR(' + a('canc') + '/(' + a('conf') + '+' + a('canc') + '+' + a('nosh') + '),0)'; }, '0.0%', 'Cancelled out of confirmed bookings.');
  kpi('noshRate', 'No-show rate', function () { return '=IFERROR(' + a('nosh') + '/(' + a('conf') + '+' + a('nosh') + '),0)'; }, '0.0%', 'Guests who confirmed and never came.');

  head('Guests');
  kpi('guestsReq', 'Guests requested (all requests)', function () { return '=SUM(' + GU + ')'; });
  kpi('guestsConf', 'Guests confirmed (covers)', function () { return '=SUMIFS(' + GU + ',' + ST + ',"Confirmed")'; });
  kpi('avgParty', 'Average party size', function () { return '=IFERROR(AVERAGE(' + GU + '),0)'; }, '0.0');
  kpi('avgPartyConf', 'Average party size (confirmed)', function () { return '=IFERROR(AVERAGEIFS(' + GU + ',' + ST + ',"Confirmed"),0)'; }, '0.0');
  kpi('medParty', 'Typical (median) party size', function () { return '=IFERROR(MEDIAN(' + GU + '),0)'; }, '0.0');
  kpi('maxParty', 'Largest party', function () { return '=IF(COUNT(' + GU + ')=0,0,MAX(' + GU + '))'; });
  kpi('coversTonight', 'Confirmed covers tonight', function () { return '=SUMIFS(' + GU + ',' + ST + ',"Confirmed",' + VD + ',TODAY())'; });
  kpi('covers7', 'Confirmed covers in the next 7 days', function () { return '=SUMIFS(' + GU + ',' + ST + ',"Confirmed",' + VD + ',">="&TODAY(),' + VD + ',"<="&(TODAY()+7))'; });

  head('Timing');
  kpi('avgLead', 'Average booking lead time (days)', function () { return '=IFERROR(AVERAGE(' + LD + '),0)'; }, '0.0', 'How far ahead guests ask.');
  kpi('medLead', 'Typical (median) lead time (days)', function () { return '=IFERROR(MEDIAN(' + LD + '),0)'; }, '0.0');
  kpi('sameDay', 'Same-day requests', function () { return '=IFERROR(COUNTIF(' + LB + ',"Same day")/' + a('total') + ',0)'; }, '0.0%', 'Share of requests made for the day itself.');

  head('Guests as people');
  kpi('unique', 'Different guests (by contact)', function () {
    return '=IFERROR(SUMPRODUCT((' + KEY + '<>"")/COUNTIF(' + KEY + ',' + KEY + '&"")),0)';
  }, '#,##0', 'The same phone number or email counts once.');
  kpi('repeat', 'Guests who asked more than once', function () {
    return '=IFERROR(SUMPRODUCT((' + KEY + '<>"")*(COUNTIF(' + KEY + ',' + KEY + '&"")>1)/COUNTIF(' + KEY + ',' + KEY + '&"")),0)';
  }, '#,##0');
  kpi('repeatRate', 'Repeat-guest share', function () { return '=IFERROR(' + a('repeat') + '/' + a('unique') + ',0)'; }, '0.0%');
  kpi('emailShare', 'Prefer email', function () { return '=IFERROR(COUNTIF(' + CT + ',"Email")/' + a('total') + ',0)'; }, '0.0%');
  kpi('phoneShare', 'Prefer phone / WhatsApp', function () { return '=IFERROR(COUNTIF(' + CT + ',"Phone")/' + a('total') + ',0)'; }, '0.0%');

  head('Highlights');
  kpi('busyDay', 'Busiest day of the week', function () { return refs.busyDay; }, '@', 'Most requests, by visit date.');
  kpi('busySlot', 'Busiest arrival hour', function () { return refs.busySlot; }, '@');
  kpi('busyParty', 'Most common party size', function () { return refs.busyParty; }, '@');
  kpi('busyReqHour', 'Guests send requests most at', function () { return refs.busyReqHour; }, '@', 'Good time to have someone watching the Sheet.');

  var refs = {};
  kpis.forEach(function (k) { if (k.key) addr[k.key] = kpiStart + idx; idx++; });
  var r0 = row;
  row += kpis.length + 1;

  /* ---------- Tables ---------- */
  function sectionTitle(text) { put(row, 1, text); subheads.push([row, 6]); row++; }
  function headerRow(cols) { cols.forEach(function (t, i) { put(row, i + 1, t); }); heads.push([row, cols.length]); row++; }

  // Status
  sectionTitle('By status');
  headerRow(['Status', 'Requests', 'Guests', 'Share']);
  var stFirst = row;
  STATUSES.forEach(function (s) {
    put(row, 1, s);
    put(row, 2, '=COUNTIF(' + ST + ',A' + row + ')');
    put(row, 3, '=SUMIFS(' + GU + ',' + ST + ',A' + row + ')');
    put(row, 4, '=IFERROR(B' + row + '/' + a('total') + ',0)');
    row++;
  });
  var stLast = row - 1;
  formats.push([a1(stFirst, 2, stLast, 3), '#,##0'], [a1(stFirst, 4, stLast, 4), '0.0%']);
  row++;

  // Weekday
  sectionTitle('By day of the week (day the guest wants to visit)');
  headerRow(['Day', 'Requests', 'Guests', 'Average party', 'Confirmed', 'Confirmed %']);
  var wdFirst = row;
  WEEKDAYS.forEach(function (d, i) {
    put(row, 1, d);
    put(row, 2, '=COUNTIF(' + WD + ',' + (i + 1) + ')');
    put(row, 3, '=SUMIFS(' + GU + ',' + WD + ',' + (i + 1) + ')');
    put(row, 4, '=IFERROR(C' + row + '/B' + row + ',0)');
    put(row, 5, '=COUNTIFS(' + WD + ',' + (i + 1) + ',' + ST + ',"Confirmed")');
    put(row, 6, '=IFERROR(E' + row + '/B' + row + ',0)');
    row++;
  });
  var wdLast = row - 1;
  formats.push([a1(wdFirst, 2, wdLast, 3), '#,##0'], [a1(wdFirst, 4, wdLast, 4), '0.0'], [a1(wdFirst, 5, wdLast, 5), '#,##0'], [a1(wdFirst, 6, wdLast, 6), '0.0%']);
  refs.busyDay = '=IF(MAX(B' + wdFirst + ':B' + wdLast + ')=0,"–",INDEX(A' + wdFirst + ':A' + wdLast + ',MATCH(MAX(B' + wdFirst + ':B' + wdLast + '),B' + wdFirst + ':B' + wdLast + ',0)))';
  row++;

  // Arrival hour
  sectionTitle('By arrival time');
  headerRow(['Hour', 'Requests', 'Guests', 'Confirmed']);
  var slFirst = row;
  SLOT_HOURS.forEach(function (h) {
    put(row, 1, (h < 10 ? '0' : '') + h + ':00');
    put(row, 2, '=COUNTIF(' + SH + ',' + h + ')');
    put(row, 3, '=SUMIFS(' + GU + ',' + SH + ',' + h + ')');
    put(row, 4, '=COUNTIFS(' + SH + ',' + h + ',' + ST + ',"Confirmed")');
    row++;
  });
  var slLast = row - 1;
  put(row, 1, 'Other hours');
  put(row, 2, '=COUNT(' + SH + ')-SUM(B' + slFirst + ':B' + slLast + ')');
  put(row, 3, '=SUM(' + GU + ')-SUM(C' + slFirst + ':C' + slLast + ')');
  put(row, 4, '=COUNTIFS(' + ST + ',"Confirmed")-SUM(D' + slFirst + ':D' + slLast + ')');
  formats.push([a1(slFirst, 2, row, 4), '#,##0']);
  refs.busySlot = '=IF(MAX(B' + slFirst + ':B' + slLast + ')=0,"–",INDEX(A' + slFirst + ':A' + slLast + ',MATCH(MAX(B' + slFirst + ':B' + slLast + '),B' + slFirst + ':B' + slLast + ',0)))';
  row += 2;

  // Party size
  sectionTitle('By party size');
  headerRow(['Party size', 'Requests', 'Guests', 'Share', 'Confirmed %']);
  var pbFirst = row;
  PARTY_BUCKETS.forEach(function (b) {
    put(row, 1, b);
    put(row, 2, '=COUNTIF(' + PB + ',A' + row + ')');
    put(row, 3, '=SUMIFS(' + GU + ',' + PB + ',A' + row + ')');
    put(row, 4, '=IFERROR(B' + row + '/' + a('total') + ',0)');
    put(row, 5, '=IFERROR(COUNTIFS(' + PB + ',A' + row + ',' + ST + ',"Confirmed")/B' + row + ',0)');
    row++;
  });
  var pbLast = row - 1;
  formats.push([a1(pbFirst, 2, pbLast, 3), '#,##0'], [a1(pbFirst, 4, pbLast, 5), '0.0%']);
  refs.busyParty = '=IF(MAX(B' + pbFirst + ':B' + pbLast + ')=0,"–",INDEX(A' + pbFirst + ':A' + pbLast + ',MATCH(MAX(B' + pbFirst + ':B' + pbLast + '),B' + pbFirst + ':B' + pbLast + ',0)))';
  row++;

  // Lead time
  sectionTitle('How far ahead guests ask');
  headerRow(['Lead time', 'Requests', 'Share', 'Confirmed %']);
  var ldFirst = row;
  LEAD_BUCKETS.forEach(function (b) {
    put(row, 1, b);
    put(row, 2, '=COUNTIF(' + LB + ',A' + row + ')');
    put(row, 3, '=IFERROR(B' + row + '/' + a('total') + ',0)');
    put(row, 4, '=IFERROR(COUNTIFS(' + LB + ',A' + row + ',' + ST + ',"Confirmed")/B' + row + ',0)');
    row++;
  });
  var ldLast = row - 1;
  formats.push([a1(ldFirst, 2, ldLast, 2), '#,##0'], [a1(ldFirst, 3, ldLast, 4), '0.0%']);
  row++;

  // Months
  sectionTitle('By month (requests received, last 12 months)');
  headerRow(['Month', 'Requests', 'Guests', 'Confirmed', 'Confirmed %']);
  var moFirst = row;
  for (var m = 11; m >= 0; m--) {
    put(row, 1, '=EDATE(DATE(YEAR(TODAY()),MONTH(TODAY()),1),-' + m + ')');
    var key = '(YEAR(A' + row + ')*100+MONTH(A' + row + '))';
    put(row, 2, '=COUNTIF(' + RM + ',' + key + ')');
    put(row, 3, '=SUMIFS(' + GU + ',' + RM + ',' + key + ')');
    put(row, 4, '=COUNTIFS(' + RM + ',' + key + ',' + ST + ',"Confirmed")');
    put(row, 5, '=IFERROR(D' + row + '/B' + row + ',0)');
    row++;
  }
  var moLast = row - 1;
  formats.push([a1(moFirst, 1, moLast, 1), 'mmm yyyy'], [a1(moFirst, 2, moLast, 4), '#,##0'], [a1(moFirst, 5, moLast, 5), '0.0%']);
  row++;

  // Last 14 days received
  sectionTitle('Requests received, last 14 days');
  headerRow(['Day', 'Requests']);
  var l14First = row;
  for (var d = 13; d >= 0; d--) {
    put(row, 1, '=TODAY()-' + d);
    put(row, 2, '=COUNTIF(' + RD + ',A' + row + ')');
    row++;
  }
  var l14Last = row - 1;
  formats.push([a1(l14First, 1, l14Last, 1), 'ddd d mmm'], [a1(l14First, 2, l14Last, 2), '#,##0']);
  row++;

  // Next 14 days visits
  sectionTitle('Coming up: next 14 days (by visit date)');
  headerRow(['Day', 'Requests', 'Confirmed covers', 'Guests requested']);
  var n14First = row;
  for (var n = 0; n < 14; n++) {
    put(row, 1, '=TODAY()+' + n);
    put(row, 2, '=COUNTIF(' + VD + ',A' + row + ')');
    put(row, 3, '=SUMIFS(' + GU + ',' + VD + ',A' + row + ',' + ST + ',"Confirmed")');
    put(row, 4, '=SUMIFS(' + GU + ',' + VD + ',A' + row + ')');
    row++;
  }
  var n14Last = row - 1;
  formats.push([a1(n14First, 1, n14Last, 1), 'ddd d mmm'], [a1(n14First, 2, n14Last, 4), '#,##0']);
  row++;

  // Hour requests are sent
  sectionTitle('When guests send requests (hour of the day)');
  headerRow(['Hour', 'Requests']);
  var rhFirst = row;
  for (var h = 0; h < 24; h++) {
    put(row, 1, (h < 10 ? '0' : '') + h + ':00');
    put(row, 2, '=COUNTIF(' + RH + ',' + h + ')');
    row++;
  }
  var rhLast = row - 1;
  formats.push([a1(rhFirst, 2, rhLast, 2), '#,##0']);
  refs.busyReqHour = '=IF(MAX(B' + rhFirst + ':B' + rhLast + ')=0,"–",INDEX(A' + rhFirst + ':A' + rhLast + ',MATCH(MAX(B' + rhFirst + ':B' + rhLast + '),B' + rhFirst + ':B' + rhLast + ',0)))';
  row++;

  // Contact method
  sectionTitle('How guests want to be reached');
  headerRow(['Method', 'Requests', 'Share']);
  var ctFirst = row;
  ['Email', 'Phone'].forEach(function (c) {
    put(row, 1, c);
    put(row, 2, '=COUNTIF(' + CT + ',A' + row + ')');
    put(row, 3, '=IFERROR(B' + row + '/' + a('total') + ',0)');
    row++;
  });
  formats.push([a1(ctFirst, 2, row - 1, 2), '#,##0'], [a1(ctFirst, 3, row - 1, 3), '0.0%']);
  row++;

  // Top repeat guests
  sectionTitle('Repeat guests (asked 2 or more times, top 10)');
  headerRow(['Guest', 'Contact', 'Requests']);
  put(row, 1, '=IFERROR(QUERY({' + NAME + ',' + KEY + '},"select Col1, Col2, count(Col2) where Col2 <> \'\' group by Col1, Col2 having count(Col2) > 1 order by count(Col2) desc limit 10 label Col1 \'\', Col2 \'\', count(Col2) \'\'"),"No repeat guests yet")');
  row += 10;
  row++;

  // Heat map weekday x hour
  sectionTitle('Busy times: requests by day and arrival hour');
  var hmHead = row;
  put(row, 1, 'Day / hour');
  SLOT_HOURS.forEach(function (h, i) { put(row, i + 2, (h < 10 ? '0' : '') + h + ':00'); });
  heads.push([row, SLOT_HOURS.length + 1]);
  row++;
  var hmFirst = row;
  WEEKDAYS.forEach(function (dname, i) {
    put(row, 1, dname);
    SLOT_HOURS.forEach(function (h, j) {
      put(row, j + 2, '=COUNTIFS(' + WD + ',' + (i + 1) + ',' + SH + ',' + h + ')');
    });
    row++;
  });
  var hmLast = row - 1;
  formats.push([a1(hmFirst, 2, hmLast, SLOT_HOURS.length + 1), '0']);
  var lastRow = row;

  /* ---------- write the key numbers now that table addresses are known ---------- */
  var kr = r0;
  kpis.forEach(function (k) {
    if (k.head) {
      put(kr, 1, k.head); labels.push([kr, 3]);
    } else {
      put(kr, 1, k.label);
      put(kr, 2, k.fn());
      put(kr, 3, k.note);
      formats.push([a1(kr, 2), k.fmt]);
    }
    kr++;
  });

  /* ---------- flush the grid in one go ---------- */
  var values = [];
  for (var rr = 1; rr <= lastRow; rr++) {
    var line = [];
    for (var cc = 1; cc <= maxCol; cc++) {
      var v = grid[rr + ',' + cc];
      line.push(v === undefined ? '' : v);
    }
    values.push(line);
  }
  sh.getRange(1, 1, lastRow, maxCol).setValues(values);

  /* ---------- look ---------- */
  sh.getRange(1, 1, lastRow, maxCol).setFontFamily('Arial').setVerticalAlignment('middle');
  sh.setColumnWidth(1, 250);
  for (var w = 2; w <= maxCol; w++) sh.setColumnWidth(w, 112);
  sh.getRange(r0, 3, kpis.length, 1).setFontColor('#777777').setFontStyle('italic');
  sh.getRange(2, 1).setFontColor('#777777').setFontStyle('italic');

  titles.forEach(function (t) {
    sh.getRange(t[0], 1, 1, t[1]).setBackground(INK).setFontColor(PAPER).setFontWeight('bold').setFontSize(14);
    sh.setRowHeight(t[0], 34);
  });
  labels.forEach(function (t) {
    sh.getRange(t[0], 1, 1, t[1]).setBackground(INK).setFontColor(PAPER).setFontWeight('bold');
  });
  subheads.forEach(function (t) {
    sh.getRange(t[0], 1, 1, t[1]).setBackground(INK).setFontColor(PAPER).setFontWeight('bold');
  });
  heads.forEach(function (t) {
    sh.getRange(t[0], 1, 1, t[1]).setBackground(BRASS).setFontColor(INK).setFontWeight('bold');
    sh.getRange(t[0], 2, 1, t[1] - 1).setHorizontalAlignment('right');
  });
  sh.getRange(r0, 2, kpis.length, 1).setFontWeight('bold').setHorizontalAlignment('right');
  formats.forEach(function (f) { sh.getRange(f[0]).setNumberFormat(f[1]); });
  [[stFirst, stLast, 4], [wdFirst, wdLast, 6], [slFirst, slLast + 1, 4], [pbFirst, pbLast, 5], [ldFirst, ldLast, 4],
   [moFirst, moLast, 5], [l14First, l14Last, 2], [n14First, n14Last, 4], [rhFirst, rhLast, 2], [ctFirst, ctFirst + 1, 3]]
    .forEach(function (t) {
      sh.getRange(t[0], 2, t[1] - t[0] + 1, t[2] - 1).setHorizontalAlignment('right');
      sh.getRange(t[0], 1, t[1] - t[0] + 1, t[2]).setBorder(false, false, true, false, false, true, '#E5DFD3', SpreadsheetApp.BorderStyle.SOLID);
    });
  sh.getRange(hmFirst, 2, 7, SLOT_HOURS.length).setHorizontalAlignment('center');
  sh.getRange(hmHead, 2, 1, SLOT_HOURS.length).setHorizontalAlignment('center');

  // heat map colours: white -> ember
  var rules = [SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpoint('#FFFFFF').setGradientMaxpoint('#C1572E')
    .setRanges([sh.getRange(hmFirst, 2, 7, SLOT_HOURS.length)]).build()];
  // waiting-for-reply count turns amber when something needs attention
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0).setBackground('#FFF2CC').setBold(true)
    .setRanges([sh.getRange(addr.new, 2)]).build());
  sh.setConditionalFormatRules(rules);

  /* ---------- charts (to the right of the key numbers) ---------- */
  function chart(type, title, ranges, anchorRow, anchorCol, colours, legend) {
    var b = sh.newChart().setChartType(type).setPosition(anchorRow, anchorCol, 0, 0)
      .setOption('title', title).setOption('width', 520).setOption('height', 270)
      .setOption('colors', colours || [EMBER, BRASS]).setOption('legend', { position: legend ? 'bottom' : 'none' })
      .setOption('titleTextStyle', { fontSize: 13, bold: true }).setOption('backgroundColor', '#FFFFFF');
    ranges.forEach(function (rg) { b.addRange(rg); });
    sh.insertChart(b.build());
  }
  var X1 = maxCol + 2, X2 = maxCol + 2 + 5, STEP = 14, Y = 3;
  var C = Charts.ChartType;
  chart(C.COLUMN, 'Requests by day of the week', [sh.getRange(wdFirst, 1, 7, 2)], Y, X1);
  chart(C.COLUMN, 'Requests by arrival hour', [sh.getRange(slFirst, 1, SLOT_HOURS.length, 2)], Y, X2);
  chart(C.PIE, 'Outcome of requests', [sh.getRange(stFirst, 1, STATUSES.length, 2)], Y + STEP, X1, ['#E0B84C', '#6AA84F', '#CC4125', '#6D9EEB', '#999999', '#E69138'], true);
  chart(C.COLUMN, 'Party sizes', [sh.getRange(pbFirst, 1, PARTY_BUCKETS.length, 2)], Y + STEP, X2);
  chart(C.LINE, 'Requests received, last 14 days', [sh.getRange(l14First, 1, 14, 2)], Y + STEP * 2, X1);
  chart(C.COLUMN, 'Coming up: next 14 days', [sh.getRange(n14First, 1, 14, 1), sh.getRange(n14First, 3, 14, 1)], Y + STEP * 2, X2);
  chart(C.COLUMN, 'Requests per month', [sh.getRange(moFirst, 1, 12, 2)], Y + STEP * 3, X1);
  chart(C.COLUMN, 'When guests send requests', [sh.getRange(rhFirst, 1, 24, 2)], Y + STEP * 3, X2);
  chart(C.COLUMN, 'How far ahead guests ask', [sh.getRange(ldFirst, 1, LEAD_BUCKETS.length, 2)], Y + STEP * 4, X1);

  sh.setFrozenRows(0);
  return { rows: lastRow };
}

/* ------------------------------- demo data ------------------------------- */

/** Adds ~150 clearly marked DEMO requests (Notes = "DEMO") so the Statistics tab can be previewed. */
function seedDemoData() {
  var sheet = getRequestsSheet_();
  var names = ['Amelia', 'Oliver', 'Isla', 'Noah', 'Ava', 'Arthur', 'Mia', 'Leo', 'Grace', 'Harry', 'Sophia', 'Jack',
               'Emily', 'George', 'Ella', 'Freddie', 'Lily', 'Theo', 'Chloe', 'Max', 'Ayse', 'Mehmet', 'Elif', 'Can'];
  var slots = [12, 13, 14, 17, 18, 18, 19, 19, 19, 20, 20, 21];
  var tz = CONFIG.TIMEZONE, day = 24 * 60 * 60 * 1000, now = Date.now();
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  var rows = [], links = [];
  for (var i = 0; i < 150; i++) {
    var receivedAt = new Date(now - Math.floor(Math.random() * 75 * day) - Math.floor(Math.random() * day));
    var leadDays = pick([0, 0, 1, 2, 3, 4, 5, 7, 7, 10, 14, 14, 21, 28]);
    var visit = new Date(receivedAt.getTime() + leadDays * day);
    var future = visit.getTime() > now;
    var weekday = Number(Utilities.formatDate(visit, tz, 'u'));                // 1 = Monday ... 7 = Sunday
    if ((weekday === 5 || weekday === 6) && Math.random() < 0.5) { /* weekends are busier: keep */ }
    var party = pick([2, 2, 2, 2, 3, 4, 4, 4, 5, 6, 6, 8, 10]);
    var guests = party >= 10 ? '10+ guests (call us)' : (party === 1 ? '1 guest' : party + ' guests');
    var hour = pick(slots), minute = pick(['00', '00', '15', '30', '45']);
    var status;
    var roll = Math.random();
    if (future) status = roll < 0.35 ? 'New' : (roll < 0.85 ? 'Confirmed' : (roll < 0.93 ? 'Waitlist' : 'Declined'));
    else status = roll < 0.66 ? 'Confirmed' : (roll < 0.74 ? 'Declined' : (roll < 0.79 ? 'Waitlist' : (roll < 0.88 ? 'Cancelled' : (roll < 0.95 ? 'No-show' : 'Confirmed'))));
    var name = pick(names) + ' Demo' + (i % 40);
    var contact = Math.random() < 0.35 ? name.toLowerCase().replace(/\s/g, '.') + '@example.com' : '+44 7700 900' + ('000' + (100 + (i * 7) % 900)).slice(-3);
    rows.push([
      Utilities.formatDate(receivedAt, tz, 'yyyy-MM-dd HH:mm'), name, guests,
      Utilities.formatDate(visit, tz, 'yyyy-MM-dd'), (hour < 10 ? '0' : '') + hour + ':' + minute, contact, status, 'DEMO'
    ]);
    var link = replyLink_(contact);
    links.push(['=HYPERLINK("' + link.url + '","' + link.label + '")']);
  }
  rows.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var start = nextRow_(sheet);
    if (start + rows.length > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), start + rows.length - sheet.getMaxRows() + 10);
    sheet.getRange(start, 1, rows.length, FIELD_COUNT).setValues(rows);
    sheet.getRange(start, FIELD_COUNT + 1, rows.length, 1).setFormulas(links);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  console.log('Added ' + rows.length + ' DEMO requests. Remove them with clearDemoData() when you are done looking.');
}

/** Deletes every row whose Notes say DEMO. Real requests are never touched. */
function clearDemoData() {
  var sheet = getRequestsSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return;
  var notes = sheet.getRange(2, 8, last - 1, 1).getValues();
  var removed = 0;
  for (var i = notes.length - 1; i >= 0; i--) {
    if (String(notes[i][0]).trim() === 'DEMO') { sheet.deleteRow(i + 2); removed++; }
  }
  console.log('Removed ' + removed + ' DEMO requests.');
}

/* ------------------------------- sheet helpers ------------------------------- */

function getSpreadsheet_() {
  var ss = CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('No spreadsheet found. Open the Sheet, choose Extensions > Apps Script, and paste the code there ' +
                    '(or put the Sheet ID into CONFIG.SPREADSHEET_ID).');
  }
  return ss;
}

/** Returns the Requests tab. Creates it, and restores missing headers, if needed (self-healing). */
function getRequestsSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    initSheet_(sheet);
  } else if (sheet.getRange(1, 1).getValue() !== HEADERS[0]) {
    initSheet_(sheet);
  }
  return sheet;
}

function initSheet_(sheet) {
  var maxRows = sheet.getMaxRows();

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#14100D').setFontColor('#EDE6DA');
  sheet.setFrozenRows(1);

  // Plain-text cells: dates, times and phone numbers stay exactly as typed, and nothing is ever run as a formula.
  sheet.getRange(2, 1, maxRows - 1, FIELD_COUNT).setNumberFormat('@');

  sheet.getRange(2, STATUS_COLUMN, maxRows - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build()
  );

  var area = sheet.getRange(2, 1, maxRows - 1, HEADERS.length);
  sheet.setConditionalFormatRules(Object.keys(STATUS_COLOURS).map(function (status) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$G2="' + status + '"')
      .setBackground(STATUS_COLOURS[status]).setRanges([area]).build();
  }));

  sheet.setColumnWidths(1, HEADERS.length, 130);
  sheet.setColumnWidth(6, 200);
  sheet.setColumnWidth(8, 220);
}

/** First empty row, found by reading column A (immune to formatting or leftover formulas lower down). */
function nextRow_(sheet) {
  var maxRows = sheet.getMaxRows();
  var column = sheet.getRange(1, 1, maxRows, 1).getValues();
  var last = 1;                                              // row 1 is the header
  for (var i = column.length - 1; i >= 1; i--) {
    if (column[i][0] !== '') { last = i + 1; break; }
  }
  var next = last + 1;
  if (next > maxRows) sheet.insertRowsAfter(maxRows, 100);
  return next;
}

/** One-tap reply: email link for email addresses, WhatsApp link for phone numbers (UK assumed). */
function replyLink_(contact) {
  if (contact.indexOf('@') > -1) {
    return { url: 'mailto:' + contact, label: 'Email guest' };
  }
  var digits = contact.replace(/\D/g, '');
  if (contact.charAt(0) === '+') { /* already international */ }
  else if (digits.indexOf('00') === 0) digits = digits.slice(2);
  else if (digits.charAt(0) === '0') digits = '44' + digits.slice(1);
  else if (digits.indexOf('44') !== 0) digits = '44' + digits;
  return { url: 'https://wa.me/' + digits, label: 'WhatsApp guest' };
}

function json_(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}
