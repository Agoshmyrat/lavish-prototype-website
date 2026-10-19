/**
 * Site configuration — the ONLY file you need to edit to connect the booking form.
 *
 * sheetEndpoint  The Google Apps Script "Web app" URL (it ends in /exec).
 *                Leave as '' to run the form in demo mode (nothing is sent).
 * phoneDisplay   Phone number shown in confirmation / error messages.
 * debug          true  = print what the form is doing in the browser console (press F12).
 *                false = silent. Turn this on while testing.
 * effects        Animation switches (reveal, countUp, extras, steakSmoke, sparks). Set any to false to turn that effect off.
 *                heroFire  flames and smoke on the headline
 *                reveal    sections rise into view as you scroll
 *                countUp   the 4.8 / 490+ / 28 numbers count up
 *                (Visitors whose device asks for reduced motion never see these, whatever you set.)
 */
window.LAVISH_CONFIG = Object.freeze({
  sheetEndpoint:
    "https://script.google.com/macros/s/AKfycbzzBcdNcC1uu3RpBUaRiWY2NmizHfNSUsxXPrMVBUAfIvc32etmojAbJimxT6zBIQqoeQ/exec",
  phoneDisplay: "01438 222 215",
  requestTimeoutMs: 15000,

  // Menu hover photos. When a visitor rests the mouse on a dish for `delayMs`, a photo card appears.
  // Add a photo for a dish in `byDish` (key = dish name in lowercase, value = image path or full URL).
  // Dishes without their own photo fall back to the first matching `byKeyword`, then to `fallback`.
  // The images below are PLACEHOLDERS (restaurant photos) until real dish photos are added to images/dishes/.
  dishPhotos: Object.freeze({
    delayMs: 500,
    fallback: "images/gallery-dining-room.webp",
    byDish: Object.freeze({
      // 'lamb trio': 'images/dishes/lamb-trio.jpg',
    }),
    byKeyword: Object.freeze([
      ["steak", "images/hero-stairwell.webp"],
      ["sirloin", "images/hero-stairwell.webp"],
      ["fillet", "images/hero-stairwell.webp"],
      ["lamb", "images/gallery-banquette.webp"],
      ["chicken", "images/about-table-setting.webp"],
      ["kebab", "images/about-table-setting.webp"],
      ["shish", "images/about-table-setting.webp"],
      ["burger", "images/gallery-bar.webp"],
    ]),
  }),
  debug: true,
  effects: Object.freeze({
    reveal: true,
    countUp: true,
    extras: true,
    steakSmoke: true,
    sparks: true,
  }),
});
