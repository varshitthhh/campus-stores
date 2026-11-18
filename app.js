(() => {
  const storageKey = "campus-stores.shift.v1";
  const L = window.CampusLogic;
  const { requests, assets, people, shifts, tabs } = L;
  const root = document.getElementById("campus-stores");
  const q = (selector) => root.querySelector(selector);
  const pages = [
    ["Requests", "clipboard-list"],
    ["Inventory", "package"],
    ["Loan register", "book-open"],
    ["Desk book", "messages-square"],
  ];
  let s = L.original();
  let tdraft = {}; // hand-over fields kept across a failed submit
  const { getAsset, getReq, openLoan, isOverdue, holderText } = L;
  const esc = (x) =>
    String(x).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const opts = (list, selected = "") =>
    list
      .map(
        ([v, t]) =>
          '<option value="' +
          esc(v) +
          '"' +
          (v === selected ? " selected" : "") +
          ">" +
          esc(t) +
          "</option>",
      )
      .join("");
  const btn = (label, act, val = "", style = "") =>
    '<button type="button" data-action="' +
    act +
    '" data-val="' +
    esc(val) +
    '" class="' +
    style +
    '">' +
    esc(label) +
    "</button>";
  const head = (title, sub, control = "") =>
    '<div class="sectionhead"><div><h2>' +
    esc(title) +
    "</h2><small>" +
    esc(sub) +
    "</small></div>" +
    control +
    "</div>";
  const row = (label, sub, right) =>
    '<div class="row"><div><strong>' +
    esc(label) +
    "</strong><small>" +
    esc(sub) +
    "</small></div><div class=\"rowend\">" +
    right +
    "</div></div>";
  const badge = (t, kind = "") =>
    '<span class="tag' + (kind ? " " + kind : "") + '">' + esc(t) + "</span>";
  const overdueBadge = (loan) =>
    isOverdue(s, loan) ? badge("Overdue", "warn") : "";
  const promiseBadge = (loan) =>
    loan.promised ? badge("Promised " + loan.promised) : "";
  const errorBox = () =>
    s.error
      ? '<p class="formerror" role="alert" tabindex="-1" data-error>' +
        esc(s.error) +
        "</p>"
      : "";
  const first = (list) => list[0];

  function requestPage() {
    let html = head(
      "Approved requests",
      "Student Activities Office · 3 approved forms",
    );
    if (s.selected) {
      const r = getReq(s.selected);
      const f = L.fulfilment(s, r);
      html +=
        btn("Back to list", "close") +
        '<div class="record"><small>' +
        esc(r.id) +
        " · Approved</small><h3>" +
        esc(r.event) +
        "</h3><p>" +
        esc(r.club) +
        " · Filed by " +
        esc(r.owner) +
        "</p><p><b>Return by</b> " +
        esc(r.due) +
        "</p><p><b>Approved equipment</b> " +
        badge(f.label, f.done ? "good" : "") +
        (f.overdue ? " " + badge("Overdue", "warn") : "") +
        '</p><ul class="lines">' +
        f.lines.map((x) => lineItem(r, x)).join("") +
        "</ul><p>" +
        esc(r.note) +
        "</p></div>";
    } else
      html += requests
        .map((r) => {
          const f = L.fulfilment(s, r);
          return row(
            r.event,
            r.id + " · " + r.club + " · Return by " + r.due,
            badge(f.label, f.done ? "good" : "") +
              (f.overdue ? badge("Overdue", "warn") : "") +
              btn("View form", "request", r.id),
          );
        })
        .join("");
    return html;
  }
  /* One approved item on a request, with its status and the next action. */
  function lineItem(r, line) {
    const l = line.loan;
    let detail = "",
      action = "";
    if (line.status === "not-issued") {
      const unit = first(
        L.issuableUnits(s, r.id).filter((a) => a.type === line.type),
      );
      detail = badge("Not issued");
      action = unit
        ? btn("Issue " + unit.id, "issueunit", r.id + "|" + unit.id)
        : "<small>No unit available</small>";
    } else if (line.status === "out") {
      detail =
        badge("Out", isOverdue(s, l) ? "warn" : "") +
        " <small>" +
        esc(l.asset + " · " + holderText(l) + " · due " + l.due) +
        "</small>";
      action = btn("Record return", "return", String(l.num));
    } else {
      detail =
        badge("Returned", "good") +
        " <small>" +
        esc(
          l.asset +
            (l.returnedBy
              ? " · returned by " + l.returnedBy + " · " + l.returnedAt
              : ""),
        ) +
        "</small>";
    }
    return (
      '<li><span class="linetype">' +
      esc(line.type) +
      "</span> " +
      detail +
      (action ? " " + action : "") +
      "</li>"
    );
  }
  function inventory() {
    let html = head(
      "Inventory",
      "Physical units · home shelf and current availability",
    );
    html +=
      '<div class="buttons"><label>Show <select data-filter>' +
      opts(
        L.filters.map((f) => [f, f]),
        s.filter,
      ) +
      "</select></label></div>";
    for (const a of assets) {
      const loan = openLoan(s, a.id);
      const status = a.repair ? "In repair" : loan ? "On loan" : "On shelf";
      if (s.filter !== "All items" && s.filter !== status) continue;
      html += row(
        a.id + " · " + a.type,
        a.model +
          " · " +
          a.bin +
          (loan
            ? " · " +
              holderText(loan).replace(/^with/, "With") +
              " (L-" + loan.num + ", due " + loan.due + ")"
            : ""),
        badge(status, status === "On shelf" ? "good" : "") +
          (loan ? promiseBadge(loan) + overdueBadge(loan) : ""),
      );
    }
    return html;
  }
  function issueForm() {
    const d = s.draft;
    const r = getReq(d.req);
    const units = r ? L.issuableUnits(s, r.id) : [];
    const select = (label, key, options, value, disabled = false) =>
      "<label><span>" +
      label +
      '</span><select name="' +
      key +
      '" data-draft' +
      (disabled ? " disabled" : "") +
      '><option value="">Select…</option>' +
      opts(options, value) +
      "</select></label>";
    let hint = "";
    if (r && !units.length)
      hint =
        '<p class="hint">Everything approved on ' +
        esc(r.id) +
        " is already out.</p>";
    else if (r && d.due && d.due !== r.due)
      hint =
        '<p class="hint warn">' +
        esc(r.id) +
        " is approved to " +
        esc(r.due) +
        ". You chose " +
        esc(d.due) +
        ".</p>";
    return (
      '<form data-issue novalidate>' +
      (s.error
        ? '<p class="formerror" role="alert" tabindex="-1" data-error>' +
          esc(s.error) +
          "</p>"
        : "") +
      '<div class="form">' +
      select(
        "Approved request",
        "req",
        requests.map((x) => [x.id, x.id + " · " + x.club]),
        d.req,
      ) +
      select(
        r ? "Unit leaving the desk" : "Unit leaving the desk (pick a request first)",
        "asset",
        units.map((a) => [a.id, a.id + " · " + a.type + " · " + a.bin]),
        d.asset,
        !r,
      ) +
      select(
        "Collected by",
        "who",
        people.map((p) => [p, p]),
        d.who,
      ) +
      select(
        "Return by",
        "due",
        L.dueOptions.map((x) => [x, x]),
        d.due,
      ) +
      "</div>" +
      hint +
      '<button type="submit" class="primary">Save issue slip</button></form>'
    );
  }
  function returnPanel(l) {
    const a = getAsset(l.asset);
    const r = getReq(l.req);
    return (
      '<form data-return novalidate class="record confirm" data-num="' +
      l.num +
      '"><strong>Return slip L-' +
      l.num +
      " · " +
      esc(l.asset) +
      "</strong><p>" +
      esc(a.type + " · " + a.model + " · bin " + a.bin) +
      "</p><p>" +
      esc(l.req + " · " + r.club + " · " + holderText(l) + " · due " + l.due) +
      " " +
      overdueBadge(l) +
      "</p>" +
      errorBox() +
      '<label><span>Returned by</span><select name="by"><option value="">Select…</option>' +
      opts(people.map((p) => [p, p])) +
      '</select></label><div class="buttons"><button type="submit" class="primary">Confirm return</button>' +
      btn("Cancel", "cancelreturn") +
      "</div></form>"
    );
  }
  function transferPanel(l) {
    return (
      '<form data-transfer novalidate class="record confirm" data-num="' +
      l.num +
      '"><strong>Hand over slip L-' +
      l.num +
      " · " +
      esc(l.asset) +
      "</strong><p>" +
      esc(getAsset(l.asset).type + " · " + holderText(l)) +
      "</p>" +
      errorBox() +
      '<div class="form"><label><span>Now with</span><select name="holder"><option value="">Select…</option>' +
      opts(
        people.map((p) => [p, p]),
        tdraft.holder,
      ) +
      '</select></label><label><span>Promised back</span><select name="promised"><option value="">Select…</option>' +
      opts(
        L.dueOptions.map((d) => [d, d]),
        tdraft.promised,
      ) +
      '</select></label></div><div class="buttons"><button type="submit" class="primary">Save hand over</button>' +
      btn("Cancel", "canceltransfer") +
      "</div></form>"
    );
  }
  function register() {
    let html = head(
      "Loan register",
      "One slip per physical unit",
      s.editing
        ? btn("Cancel", "cancel")
        : btn("New issue slip", "new", "", "primary"),
    );
    if (s.editing) return html + issueForm();
    html +=
      '<div class="buttons">' +
      ["Outstanding", "All slips"]
        .map(
          (v, i) =>
            '<button type="button" data-action="scope" data-val="' +
            i +
            '" aria-pressed="' +
            (s.onlyOpen === (i === 0)) +
            '">' +
            v +
            "</button>",
        )
        .join("") +
      "</div>";
    const shown = s.loans
      .filter((l) => !s.onlyOpen || !l.back)
      .slice()
      .reverse();
    if (!shown.length) html += "<p>No outstanding slips.</p>";
    for (const l of shown) {
      if (l.num === s.pending && !l.back) {
        html += returnPanel(l);
        continue;
      }
      if (l.num === s.transfer && !l.back) {
        html += transferPanel(l);
        continue;
      }
      html += row(
        "L-" + l.num + " · " + l.asset,
        l.req +
          " · " +
          (l.back ? "issued to " + l.who : holderText(l)) +
          " · Due " +
          l.due +
          (l.back && l.returnedBy
            ? " · Returned by " + l.returnedBy + " · " + l.returnedAt
            : ""),
        l.back
          ? badge("Returned") + btn("Reopen", "reopen", String(l.num))
          : promiseBadge(l) +
              overdueBadge(l) +
              btn("Hand over", "transfer", String(l.num)) +
              btn("Record return", "return", String(l.num)),
      );
    }
    return html;
  }
  function deskbook() {
    let html = head(
      "Desk book",
      "Messages from clubs and notes for the next shift",
    );
    const open = L.outstanding(s);
    html +=
      '<div class="record memo"><small>Still outstanding · from the loan register</small>' +
      (open.length
        ? '<ul class="lines">' +
          open
            .map((l) => {
              const a = getAsset(l.asset);
              return (
                "<li><b>" +
                esc(l.asset + " " + a.type) +
                "</b> · " +
                esc(l.req + " " + getReq(l.req).club) +
                " · slip L-" +
                l.num +
                " · " +
                esc(holderText(l)) +
                " · due " +
                esc(l.due) +
                " " +
                overdueBadge(l) +
                "</li>"
              );
            })
            .join("")
        : "<p>Nothing outstanding. Every issued unit is back.</p>") +
      btn("Save as handover note", "handover") +
      "</div>";
    const entries = [
      [
        "Friday · 3:20 pm",
        "Isha Rao · Film Society",
        "Kabir Sen is picking up our whole screening kit. Please issue it in his name. I’m setting up in the courtyard.",
      ],
      [
        "Friday · 3:30 pm",
        "Tara Shah · Debate Union",
        "Our microphone stays with me overnight. I’ll return it by 10 am Saturday.",
      ],
    ];
    if (s.phase >= 1)
      entries.push([
        "Friday · 7:30 pm",
        "Kabir Sen · Film Society",
        "I brought the projector and speaker. Leela Das has our adapter. She’ll be at the counter at 9 am tomorrow.",
      ]);
    for (const n of s.notes)
      entries.push([shifts[n.phase].time, "Counter handover", n.text]);
    for (const [t, author, body] of entries.slice().reverse())
      html +=
        '<article class="record"><small>' +
        esc(t) +
        "</small><h3>" +
        esc(author) +
        "</h3><p>" +
        esc(body) +
        "</p></article>";
    return (
      html +
      '<form data-note><div class="form"><label class="full"><span>Note for the next shift</span><textarea name="note" rows="2" maxlength="400" required></textarea></label></div><button type="submit">Add handover note</button></form>'
    );
  }
  const screens = {
    Requests: requestPage,
    Inventory: inventory,
    "Loan register": register,
    "Desk book": deskbook,
  };
  /* Selector for the focused control, so focus survives a full re-render. */
  function focusKey(el) {
    if (!el || el === document.body || !root.contains(el)) return null;
    if (el.dataset.action)
      return (
        '[data-action="' +
        el.dataset.action +
        '"][data-val="' +
        CSS.escape(el.dataset.val ?? "") +
        '"]'
      );
    if (el.name) return '[name="' + el.name + '"]';
    if (el.hasAttribute("data-filter")) return "[data-filter]";
    return null;
  }
  function paint(focus) {
    const key = focusKey(document.activeElement);
    const phase = shifts[s.phase];
    q("[data-clock]").textContent = phase.time;
    q("[data-shift-title]").textContent = phase.title;
    q("[data-shift]").textContent = phase.text;
    const advance = q('[data-action="advance"]');
    advance.hidden = !phase.next;
    advance.textContent = phase.next || "";
    q("[data-nav]").innerHTML = pages
      .map(
        ([n, icon]) =>
          '<button type="button" data-action="tab" data-val="' +
          n +
          '" aria-pressed="' +
          (s.tab === n) +
          '"><svg aria-hidden="true" class="store-icon"><use href="#icon-' +
          icon +
          '"></use></svg>' +
          n +
          "</button>",
      )
      .join("");
    q("[data-page]").innerHTML = screens[s.tab]();
    q("[data-status]").textContent = s.notice;
    const target = (focus && q(focus)) || (key && q(key));
    if (target) target.focus();
  }
  function commit(msg, focus) {
    if (msg) s.notice = msg;
    paint(focus);
    try {
      localStorage.setItem(storageKey, JSON.stringify(s));
    } catch {
      q("[data-status]").textContent +=
        " Browser storage is unavailable. Progress lasts for this visit.";
    }
  }
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    const v = b.dataset.val;
    let focus;
    switch (b.dataset.action) {
      case "restart":
        s = L.original();
        break;
      case "advance": {
        if (s.phase < 2) s.phase++;
        const late = L.outstanding(s).filter((l) => isOverdue(s, l)).length;
        s.notice =
          "Desk time is now " +
          shifts[s.phase].time +
          "." +
          (late ? " " + late + (late === 1 ? " slip is" : " slips are") + " overdue." : "");
        break;
      }
      case "tab":
        s.tab = v;
        s.editing = false;
        s.pending = 0;
        s.transfer = 0;
        s.error = "";
        break;
      case "close":
        s.selected = "";
        break;
      case "request":
        s.selected = v;
        break;
      case "new":
        s.editing = true;
        s.draft = L.blankDraft();
        s.error = "";
        focus = '[name="req"]';
        break;
      case "issueunit": {
        const [req, asset] = v.split("|");
        s.tab = "Loan register";
        s.editing = true;
        s.error = "";
        s.draft = { req, asset, who: "", due: getReq(req).due };
        focus = '[name="who"]';
        break;
      }
      case "cancel":
        s.editing = false;
        s.error = "";
        break;
      case "scope":
        s.onlyOpen = v === "0";
        break;
      case "return": {
        const l = L.getLoan(s, v);
        if (!l || l.back) return;
        s.tab = "Loan register";
        s.onlyOpen = true;
        s.editing = false;
        s.transfer = 0;
        s.error = "";
        s.pending = l.num;
        focus = '[name="by"]';
        break;
      }
      case "cancelreturn":
        s.pending = 0;
        s.error = "";
        break;
      case "transfer": {
        const l = L.getLoan(s, v);
        if (!l || l.back) return;
        s.tab = "Loan register";
        s.onlyOpen = true;
        s.editing = false;
        s.pending = 0;
        s.error = "";
        s.transfer = l.num;
        tdraft = {};
        focus = '[name="holder"]';
        break;
      }
      case "canceltransfer":
        tdraft = {};
        s.transfer = 0;
        s.error = "";
        break;
      case "reopen": {
        const res = L.reopenLoan(s, v);
        if (!res.ok) s.notice = res.error;
        break;
      }
      case "handover":
        s.notes.push({ phase: s.phase, text: L.handoverText(s) });
        s.notice = "Outstanding list saved to the desk book.";
        break;
    }
    commit(null, focus);
  });
  root.addEventListener("change", (e) => {
    if (e.target.matches("[data-filter]")) {
      s.filter = e.target.value;
      commit();
    } else if (e.target.matches("[data-draft]")) {
      const { name, value } = e.target;
      s.draft[name] = value;
      if (name === "req") {
        s.draft.asset = "";
        s.draft.due = getReq(value)?.due ?? "";
      }
      s.error = "";
      commit();
    }
  });
  root.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const form = new FormData(f);
    if (f.matches("[data-note]")) {
      const text = String(form.get("note")).trim();
      if (!text) return;
      s.notes.push({ phase: s.phase, text });
      commit("Handover note saved.");
      return;
    }
    if (f.matches("[data-return]")) {
      const res = L.returnLoan(s, Number(f.dataset.num), form.get("by"));
      s.error = res.ok ? "" : res.error;
      commit(null, res.ok ? "" : "[data-error]");
      return;
    }
    if (f.matches("[data-transfer]")) {
      const res = L.handOver(
        s,
        Number(f.dataset.num),
        form.get("holder"),
        form.get("promised"),
      );
      s.error = res.ok ? "" : res.error;
      tdraft = res.ok
        ? {}
        : { holder: form.get("holder") || "", promised: form.get("promised") || "" };
      commit(null, res.ok ? "" : "[data-error]");
      return;
    }
    if (!f.matches("[data-issue]")) return;
    const res = L.issue(s, s.draft);
    commit(null, res.ok ? "" : "[data-error]");
  });
  paint();
  try {
    const saved = L.restore(JSON.parse(localStorage.getItem(storageKey)));
    if (saved) {
      s = saved;
      paint();
    }
  } catch {
    // Keep the fresh shift when storage is unavailable or the saved data is invalid.
  }
})();
