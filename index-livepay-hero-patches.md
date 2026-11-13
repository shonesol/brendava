# index.html edits: Pesapal → LivePay, and hero admin fix

Everything else in the page stays untouched. Each edit is a find → replace.

---

## PART 1 — Payment: Pesapal → LivePay

### 1A. Wording (use Find & Replace)

| Find | Replace with |
|---|---|
| `Secure checkout powered by Pesapal` | `Secure checkout powered by LivePay` |
| `pay securely through Pesapal.` | `pay securely through LivePay.` |
| `pay securely online with Pesapal.` | `pay securely online with LivePay.` |
| `Pesapal's secure checkout page` (2 places) | `LivePay's secure checkout page` |
| `Pay securely with Pesapal</button>` | `Pay securely with LivePay</button>` |

### 1B. Intro box text

Find:
```html
<div><strong>One secure payment option</strong><span>Visa, Mastercard and supported mobile-money options are displayed by Pesapal at checkout, depending on your country.</span></div>
```
Replace:
```html
<div><strong>Secure payment by LivePay</strong><span>Pay by Visa / Mastercard (charged in USD) or by MTN / Airtel Mobile Money (charged in UGX).</span></div>
```

### 1C. Add a "Pay with" choice

Find:
```html
<label>Currency<select name="currency"><option value="USD">USD</option></select></label>
```
Replace with (keeps the currency field and adds the new one right after it):
```html
<label>Currency<select name="currency"><option value="USD">USD</option></select></label>
    <label>Pay with<select name="paymentMethod" id="bvPaymentMethod"><option value="card">Visa / Mastercard</option><option value="mobile_money">Mobile Money (MTN / Airtel)</option></select></label>
```

### 1D. Replace the submit handler

In the classic `<script>` that starts with `// Brendava Pesapal checkout`, find the block that starts at

```js
 const bvForm = document.getElementById("brendavaBookingForm");
 if (bvForm) bvForm.addEventListener("submit", async event => {
```
and ends with the matching `});` just before `</script>`. Delete that whole block and put this in its place:

```js
 const bvForm = document.getElementById("brendavaBookingForm");
 const bvMsg = text => { const m = document.getElementById("bvPaymentMessage"); if (m) m.textContent = text; };
 const BV_PAY_LABEL = '<i class="fas fa-shield-alt"></i> Pay securely with LivePay';

 document.getElementById("bvPaymentMethod")?.addEventListener("change", function () {
  bvMsg(this.value === "mobile_money"
   ? "You will get a Mobile Money approval prompt on the phone number above (MTN or Airtel Uganda). The amount is charged in UGX at today's rate."
   : "You will be taken to LivePay's secure card page. Card details are never entered on this website.");
 });

 // Customer returns from the LivePay card page (LivePay appends ?checkout_id=...)
 (function () {
  if (new URLSearchParams(window.location.search).get("checkout_id")) {
   bvMsg("Thank you! Your card payment was completed. Brendava will confirm your booking by email shortly.");
   document.getElementById("payment")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
 })();

 async function bvPollMobile(reference) {
  const base = BV_WORKER_URL.replace(/\/$/, "");
  for (let i = 0; i < 24; i++) {            // ~2 minutes
   await new Promise(r => setTimeout(r, 5000));
   try {
    const r = await fetch(base + "/api/payment-status?ref=" + encodeURIComponent(reference));
    const d = await r.json();
    if (d.payment_status === "COMPLETED") return "success";
    if (d.payment_status === "FAILED") return "failed";
   } catch (e) {}
  }
  return "pending";
 }

 if (bvForm) bvForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = document.getElementById("bvPayButton");
  const formData = new FormData(bvForm);
  await bvLoadCatalogue();

  let itineraryId = bvForm.dataset.itineraryId || document.getElementById("bvItineraryId")?.value || "";
  if (!itineraryId) {
   const sel = document.getElementById("bvSelectedItinerary");
   const opt = sel && sel.tagName === "SELECT" ? sel.selectedOptions[0] : null;
   if (opt && opt.dataset.id) itineraryId = opt.dataset.id;
  }
  if (!window.__bvSelected && formData.get("itinerary")) {
   window.__bvSelected = { id: itineraryId, title: formData.get("itinerary") };
  }
  const quote = bvQuote(bvFindPackage(window.__bvSelected), formData.get("travellers"), formData.get("paymentPercent"));
  if (!window.__bvSelected || !formData.get("itinerary")) { bvMsg("Please select a safari itinerary before continuing."); return; }
  if (!quote) { bvMsg("This itinerary needs a confirmed price. Please contact Brendava to receive a payment quote."); return; }

  const method = formData.get("paymentMethod") === "mobile_money" ? "mobile_money" : "card";
  if (method === "card" && (quote.deposit < 1 || quote.deposit > 5000)) {
   bvMsg("Card payments are limited to $5,000 per transaction. Please choose the 30% or 50% option, or pay by Mobile Money.");
   return;
  }

  const payload = {
   name: formData.get("name"), email: formData.get("email"), phone: formData.get("phone"),
   travelDate: formData.get("travelDate"), travellers: Number(formData.get("travellers")),
   itinerary: formData.get("itinerary"), itineraryId: itineraryId || window.__bvSelected.id || "",
   notes: formData.get("notes"), currency: quote.currency, paymentPercent: quote.percent,
   method: method
  };

  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting to LivePay...';
  bvMsg(method === "mobile_money" ? "Sending the Mobile Money request..." : "Creating your secure card checkout...");

  try {
   const response = await fetch(BV_WORKER_URL.replace(/\/$/, "") + "/api/create-payment", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
   });
   const result = await response.json();
   if (!response.ok) throw new Error(result.message || "Could not start the payment.");

   if (method === "card") {
    if (!result.redirect_url) throw new Error("Could not start card checkout.");
    window.location.assign(result.redirect_url);
    return;
   }

   bvMsg("Check your phone and approve the Mobile Money prompt. Waiting for confirmation...");
   const outcome = await bvPollMobile(result.reference);
   if (outcome === "success") bvMsg("Payment confirmed. Thank you! Brendava will confirm your booking by email shortly.");
   else if (outcome === "failed") bvMsg("The payment was not completed. Please try again or contact Brendava on WhatsApp.");
   else bvMsg("We are still waiting for confirmation. If you approved the prompt, Brendava will confirm by email.");
  } catch (error) {
   bvMsg(error.message || "Payment could not be started. Please try again.");
  }
  button.disabled = false;
  button.innerHTML = BV_PAY_LABEL;
 });
```

**Do not use `livepay-worker.js`.** Your own Worker already has LivePay built in (`/api/create-payment`, `/api/payment-status`, signed webhook). The handler above is written for it.

---

## PART 2 — Hero changes from the admin panel

Why it was failing: the admin saved the hero to Firestore **without being signed in**, so Firestore (correctly) rejected the write. The page then said "updated on this browser", so it only changed on the admin's own device. Visitors also only loaded the hero once, so they never saw later changes.

### 2A. Homepage: live hero

In the first `<script type="module">`, change the import line:
```js
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, doc, getDoc, setDoc, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
```
to:
```js
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, doc, getDoc, setDoc, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
```

Then replace everything from `window.loadHeroBackground = async function () {` down to the end of `window.applyHeroFromAdmin = function (...) { ... };` with:

```js
 let heroLastSig = "";
 function heroApplyIfChanged(type, url, poster, videos) {
  const list = Array.isArray(videos) ? videos.filter(Boolean) : [];
  const t = type === "video" ? "video" : "image";
  const sig = JSON.stringify([t, url || "", t === "video" ? list : []]);
  if (sig === heroLastSig) return;          // no restart/flicker when nothing changed
  heroLastSig = sig;
  applyHeroMedia(t, url, poster, t === "video" ? list : []);
 }

 window.loadHeroBackground = async function () {
  let hadCache = false;
  try {
   const cached = localStorage.getItem(HERO_LS_KEY);
   if (cached) {
    const data = JSON.parse(cached);
    if (data) { heroApplyIfChanged(data.type, data.url, data.poster, data.videos); hadCache = true; }
   }
  } catch (e) {}
  if (!hadCache) applyHeroImage(HERO_DEFAULT);

  // Live: any hero change saved in the admin appears for visitors without a reload
  try {
   onSnapshot(doc(db, "siteSettings", "hero"), snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    const type = data.type || "image";
    const url = data.url || HERO_DEFAULT;
    const poster = data.poster || "";
    const videos = Array.isArray(data.videos) ? data.videos : [];
    heroApplyIfChanged(type, url, poster, videos);
    try { localStorage.setItem(HERO_LS_KEY, JSON.stringify({ type, url, poster, videos })); } catch (e) {}
   }, err => console.warn("Hero live listener failed:", err));
  } catch (err) {
   console.warn("Hero Firestore load failed:", err);
  }
 };

 window.applyHeroFromAdmin = function (type, url, poster, videos) {
  heroApplyIfChanged(type, url, poster, videos);
  try {
   localStorage.setItem(HERO_LS_KEY, JSON.stringify({ type, url: url || "", poster: poster || "", videos: videos || [] }));
  } catch (e) {}
 };
```

### 2B. Admin panel: sign-in box on the Hero tab

Find:
```html
<div class="admin-preview" id="adminPreview"><span>Preview appears here</span></div>
```
Put this **above** it:
```html
<div id="heroAuthBox" style="border:1px dashed #cbd5e1;border-radius:10px;padding:12px;margin-bottom:14px;">
 <p class="admin-hint" style="margin-top:0;">To publish the hero to all visitors, sign in with your Firebase admin account (the same one used in Messages). <strong id="heroAuthState">Not signed in.</strong></p>
 <div id="heroAuthFields">
  <input type="email" id="heroAuthEmail" placeholder="Admin email" autocomplete="username">
  <input type="password" id="heroAuthPass" placeholder="Password" autocomplete="current-password">
  <button type="button" class="btn" onclick="adminHeroSignIn()"><i class="fas fa-unlock"></i> Sign in</button>
 </div>
</div>
```

### 2C. Admin module: auth + honest save

In the second `<script type="module">` ("Admin Firebase helpers"):

1. Add this import line under the existing imports:
```js
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
```
2. After `const db = getFirestore(app);` add:
```js
 const auth = getAuth(app);
 onAuthStateChanged(auth, u => {
  const s = document.getElementById("heroAuthState");
  const f = document.getElementById("heroAuthFields");
  if (s) s.textContent = u ? "Signed in as " + u.email : "Not signed in.";
  if (f) f.style.display = u ? "none" : "block";
 });
 window.adminHeroSignIn = async function () {
  const msg = document.getElementById("adminHeroMsg");
  try {
   await signInWithEmailAndPassword(auth, document.getElementById("heroAuthEmail").value.trim(), document.getElementById("heroAuthPass").value);
   document.getElementById("heroAuthPass").value = "";
   msg.className = "admin-msg";
  } catch (err) {
   msg.className = "admin-msg err";
   msg.textContent = "Sign-in failed (" + (err.code || "error") + ").";
  }
 };
```
3. Replace the whole `window.adminSaveHero = async function () { ... };` with:
```js
 window.adminSaveHero = async function () {
  const btn = document.getElementById("adminSaveHeroBtn");
  const msg = document.getElementById("adminHeroMsg");
  const type = document.getElementById("adminBgType").value;
  const poster = document.getElementById("adminBgPoster").value.trim();
  const videos = ["adminVid1","adminVid2","adminVid3","adminVid4"]
   .map(id => document.getElementById(id).value.trim()).filter(Boolean);
  let url = document.getElementById("adminBgUrl").value.trim();

  if (type === "video") {
   if (!videos.length) { msg.className = "admin-msg err"; msg.textContent = "Paste at least Video 1 (Cloudinary mp4 URL)."; return; }
   url = videos[0];
  } else if (!url) {
   msg.className = "admin-msg err"; msg.textContent = "Please paste a Cloudinary image URL."; return;
  }
  if (!auth.currentUser) {
   msg.className = "admin-msg err";
   msg.textContent = "Sign in with your Firebase admin account (box above) first, otherwise visitors will not see the change.";
   return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  msg.className = "admin-msg";
  try {
   await setDoc(doc(db, "siteSettings", "hero"), {
    type, url, poster: poster || null,
    videos: type === "video" ? videos : [],
    updatedAt: Date.now()
   }, { merge: true });
   if (typeof window.applyHeroFromAdmin === "function") window.applyHeroFromAdmin(type, url, poster, type === "video" ? videos : []);
   msg.className = "admin-msg ok";
   msg.textContent = type === "video"
    ? "Published. " + videos.length + " video(s) now play on the homepage for all visitors."
    : "Published. The new hero image is live for all visitors.";
  } catch (err) {
   console.warn("Hero save failed:", err);
   msg.className = "admin-msg err";
   msg.textContent = "NOT published for visitors (" + (err.code || err.message) + "). Check the Firestore rules for siteSettings (see below).";
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-save"></i> Save & Publish Hero';
 };
```

### 2D. Firestore rules (Firebase console → Firestore → Rules)

Make sure this exists, otherwise saving/reading the hero is blocked:
```
match /siteSettings/{docId} {
  allow read: if true;
  allow write: if request.auth != null;   // or: request.auth.token.email == "your-admin@email.com"
}
```

---

## Security note
`ADMIN_PASS = "Brendava2026!"` sits in the page source, so anyone can read it. It only opens the admin screen; real protection is the Firebase sign-in + rules above. Treat that password as public.
