/* Brendava: adds a "Select & Pay online" button to every payable safari on itineraries.html.
   Add this ONE line just before </body> in itineraries.html:
       <script src="pay-buttons.js"></script>
   Upload pay-buttons.js to the same folder as itineraries.html and index.html. */
(function () {
  var API = "https://brendava-global-ai.shonesol28.workers.dev";
  var catalogue = [];

  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function daysOf(title) { var m = String(title).match(/(\d+)\s*-?\s*day/i); return m ? Number(m[1]) : null; }
  function link(id) { return "index.html?select=" + encodeURIComponent(id) + "#payment"; }

  function matchArticle(article) {
    var price = Number(article.getAttribute("data-price"));
    var days = Number(article.getAttribute("data-days"));
    return catalogue.find(function (p) {
      var prices = Object.keys(p.prices || {}).map(function (k) { return Number(p.prices[k]); });
      return daysOf(p.title) === days && prices.indexOf(price) !== -1;
    });
  }

  function matchLibraryCard(card) {
    var viewBtn = card.querySelector(".lib-view");
    var url = viewBtn ? String(viewBtn.getAttribute("data-url") || "").toLowerCase() : "";
    var title = norm(viewBtn ? viewBtn.getAttribute("data-title") : "");
    return catalogue.find(function (p) {
      return (url && url.indexOf(String(p.id).toLowerCase()) !== -1) || (title && norm(p.title) === title);
    });
  }

  function addButtons() {
    if (!catalogue.length) return;

    document.querySelectorAll(".itinerary[data-price]").forEach(function (article) {
      var actions = article.querySelector(".booking-actions");
      if (!actions || actions.querySelector("[data-bv-pay]")) return;
      var p = matchArticle(article);
      if (!p) return;
      var a = document.createElement("a");
      a.className = "book-button";
      a.setAttribute("data-bv-pay", "1");
      a.style.background = "#0f766e";
      a.href = link(p.id);
      a.textContent = "Select & Pay online";
      actions.insertBefore(a, actions.firstChild);
    });

    document.querySelectorAll(".library-card").forEach(function (card) {
      var actions = card.querySelector(".lib-actions");
      if (!actions || actions.querySelector("[data-bv-pay]")) return;
      var p = matchLibraryCard(card);
      if (!p) return;
      var a = document.createElement("a");
      a.className = "lib-view";
      a.setAttribute("data-bv-pay", "1");
      a.href = link(p.id);
      a.textContent = "Select & Pay online";
      actions.insertBefore(a, actions.firstChild);
    });
  }

  function start() {
    fetch(API + "/api/itineraries")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        catalogue = (d.itineraries || []).filter(function (p) { return p.paymentEnabled; });
        addButtons();
        // The uploaded-PDF list is drawn later and redrawn on edits; add buttons again when that happens.
        var grid = document.getElementById("libraryGrid");
        if (grid && window.MutationObserver) {
          new MutationObserver(addButtons).observe(grid, { childList: true });
        }
      })
      .catch(function (e) { console.warn("Pay buttons unavailable", e); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
