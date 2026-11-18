/* End-to-end flows: the real index.html, logic.js and app.js running in jsdom. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const dir = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const KEY = "campus-stores.shift.v1";

function boot({ saved, brokenStorage } = {}) {
  const dom = new JSDOM(read("index.html"), {
    url: "http://localhost/",
    runScripts: "outside-only",
  });
  const w = dom.window;
  w.CSS = { escape: (x) => String(x).replace(/["\\]/g, "\\$&") };
  if (brokenStorage)
    Object.defineProperty(w, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
  else if (saved !== undefined) w.localStorage.setItem(KEY, saved);
  w.eval(read("logic.js"));
  w.eval(read("app.js"));
  const d = w.document;
  const $ = (sel) => d.querySelector(sel);
  const $$ = (sel) => [...d.querySelectorAll(sel)];
  const app = {
    w,
    d,
    $,
    $$,
    page: () => $("[data-page]").textContent.replace(/\s+/g, " ").trim(),
    status: () => $("[data-status]").textContent,
    click: (sel) => {
      const el = $(sel);
      assert.ok(el, "missing " + sel);
      el.click();
    },
    tab: (name) => app.click('[data-action="tab"][data-val="' + name + '"]'),
    set: (name, value) => {
      const el = $('[name="' + name + '"]');
      assert.ok(el, "missing field " + name);
      el.value = value;
      el.dispatchEvent(new w.Event("change", { bubbles: true }));
    },
    submit: (sel) => $(sel).requestSubmit(),
    saved: () => JSON.parse(w.localStorage.getItem(KEY)),
    issue: (req, asset, who) => {
      app.tab("Loan register");
      app.click('[data-action="new"]');
      app.set("req", req);
      app.set("asset", asset);
      app.set("who", who);
      app.submit("[data-issue]");
    },
    ret: (num, by) => {
      app.tab("Loan register");
      app.click('[data-action="return"][data-val="' + num + '"]');
      app.set("by", by);
      app.submit("[data-return]");
    },
  };
  return app;
}

test("renders the desk, three requests and no console-breaking errors", () => {
  const a = boot();
  assert.equal(a.$("[data-clock]").textContent, "Friday · 3:45 pm");
  assert.equal(a.$$(".row").length, 3);
  assert.match(a.page(), /Nothing issued/);
  assert.equal(a.$$("[data-nav] button").length, 4);
});

test("pickup: request detail shows each approved item and issues with a prefilled slip", () => {
  const a = boot();
  a.click('[data-action="request"][data-val="RQ-214"]');
  const lines = a.$$(".lines li").map((li) => li.textContent.replace(/\s+/g, " ").trim());
  assert.equal(lines.length, 3);
  assert.ok(lines.every((l) => /Not issued/.test(l)));
  a.click('[data-action="issueunit"][data-val="RQ-214|AD-12"]');
  assert.equal(a.$("[data-nav] [aria-pressed=true]").textContent.trim(), "Loan register");
  assert.equal(a.$('[name="req"]').value, "RQ-214");
  assert.equal(a.$('[name="asset"]').value, "AD-12");
  assert.equal(a.$('[name="due"]').value, "Fri 8 pm"); // defaults from the request
  assert.equal(a.d.activeElement.name, "who"); // focus moves to the missing field
  a.set("who", "Kabir Sen");
  a.submit("[data-issue]");
  assert.match(a.status(), /Issued AD-12 to Kabir Sen on slip L-402/);
  assert.equal(a.$("[data-issue]"), null);
});

test("full story: kit out, partial return, overnight, adapter closed by Leela", () => {
  const a = boot();
  a.issue("RQ-214", "PR-04", "Kabir Sen");
  a.issue("RQ-214", "SP-02", "Kabir Sen");
  a.issue("RQ-214", "AD-12", "Kabir Sen");
  a.tab("Requests");
  assert.match(a.page(), /All issued/);

  a.click('[data-action="advance"]');
  assert.equal(a.$("[data-clock]").textContent, "Friday · 7:30 pm");
  a.ret(402, "Kabir Sen");
  a.ret(403, "Kabir Sen");
  a.tab("Requests");
  assert.match(a.page(), /Partly returned/);
  assert.doesNotMatch(a.page(), /Overdue/);

  a.click('[data-action="advance"]');
  assert.equal(a.$("[data-clock]").textContent, "Saturday · 9:00 am");
  assert.match(a.status(), /1 slip is overdue/);
  assert.equal(a.$('[data-action="advance"]').hidden, true);

  a.tab("Desk book");
  const memo = a.$(".memo").textContent;
  assert.match(memo, /AD-12 USB-C → HDMI adapter/);
  assert.match(memo, /Overdue/);
  assert.match(memo, /MI-09/); // Debate Union mic is still out too
  assert.doesNotMatch(memo, /PR-04/);

  a.ret(404, "Leela Das");
  assert.match(a.status(), /AD-12 returned by Leela Das\. Slip L-404 closed\./);
  assert.equal(a.$('[data-action="return"][data-val="404"]'), null);
  assert.ok(a.$('[data-action="return"][data-val="401"]')); // mic slip untouched
  a.tab("Requests");
  assert.match(a.page(), /Returned in full/);
});

test("return needs confirmation, shows the exact unit, and can be cancelled", () => {
  const a = boot();
  a.tab("Loan register");
  a.click('[data-action="return"][data-val="401"]');
  const panel = a.$("[data-return]").textContent.replace(/\s+/g, " ");
  assert.match(panel, /MI-09/);
  assert.match(panel, /Shure BLX/);
  assert.match(panel, /bin B3/);
  assert.equal(a.$('[name="by"]').value, ""); // nobody is preselected
  assert.equal(a.saved().loans[0].back, false);
  a.click('[data-action="cancelreturn"]');
  assert.equal(a.$("[data-return]"), null);
  assert.equal(a.saved().loans[0].back, false);
});

test("return history shows who brought it back and can be reopened", () => {
  const a = boot();
  a.ret(401, "Dev Menon");
  assert.match(a.page(), /No outstanding slips/);
  a.click('[data-action="scope"][data-val="1"]');
  assert.match(a.page(), /Returned by Dev Menon · Friday · 3:45 pm/);
  a.click('[data-action="reopen"][data-val="401"]');
  assert.match(a.status(), /Slip L-401 reopened/);
  assert.ok(a.$('[data-action="return"][data-val="401"]'));
});

test("issue errors are visible, announced and persistent until fixed", () => {
  const a = boot();
  a.tab("Loan register");
  a.click('[data-action="new"]');
  assert.equal(a.$('[name="asset"]').disabled, true); // pick a request first
  a.submit("[data-issue]");
  const err = a.$('[role="alert"]');
  assert.match(err.textContent, /Choose an approved request/);
  assert.equal(a.d.activeElement, err);
  a.set("req", "RQ-214");
  assert.equal(a.$('[role="alert"]'), null); // editing clears it
  assert.equal(a.$('[name="asset"]').disabled, false);
  a.submit("[data-issue]");
  assert.match(a.$('[role="alert"]').textContent, /unit/);
  a.set("asset", "PR-04");
  a.submit("[data-issue]");
  assert.match(a.$('[role="alert"]').textContent, /collecting/);
  assert.equal(a.saved().loans.length, 1); // nothing was saved
});

test("the unit list only offers approved, free, working units", () => {
  const a = boot();
  a.tab("Loan register");
  a.click('[data-action="new"]');
  a.set("req", "RQ-214");
  const units = [...a.$('[name="asset"]').options].map((o) => o.value).filter(Boolean);
  assert.deepEqual(units, ["PR-04", "SP-02", "SP-05", "AD-12", "AD-15"]);
  assert.ok(!units.includes("PR-06")); // in repair
  assert.ok(!units.includes("MI-09")); // wrong type
  a.set("req", "RQ-209");
  assert.match(a.page(), /Everything approved on RQ-209 is already out/);
});

test("a due time later than the request allows is flagged but not blocked", () => {
  const a = boot();
  a.tab("Loan register");
  a.click('[data-action="new"]');
  a.set("req", "RQ-214");
  a.set("due", "Sat noon");
  assert.match(a.$(".hint.warn").textContent, /RQ-214 is approved to Fri 8 pm\. You chose Sat noon\./);
  a.set("asset", "PR-04");
  a.set("who", "Kabir Sen");
  a.submit("[data-issue]");
  assert.match(a.status(), /Issued PR-04/);
});

test("inventory shows who has each loaned unit and the filter still works", () => {
  const a = boot();
  a.issue("RQ-214", "AD-12", "Kabir Sen");
  a.tab("Inventory");
  assert.match(a.page(), /AD-12[\s\S]*With Kabir Sen \(L-402, due Fri 8 pm\)/);
});

test("inventory filter keeps its value and lists only matching units", () => {
  const a = boot();
  a.tab("Inventory");
  const f = a.$("[data-filter]");
  f.value = "On loan";
  f.dispatchEvent(new a.w.Event("change", { bubbles: true }));
  assert.equal(a.$("[data-filter]").value, "On loan");
  assert.equal(a.$$(".row").length, 1);
  assert.match(a.page(), /MI-09/);
  const f2 = a.$("[data-filter]");
  f2.value = "In repair";
  f2.dispatchEvent(new a.w.Event("change", { bubbles: true }));
  assert.match(a.page(), /PR-06/);
});

test("handover: auto summary can be saved as a desk-book note", () => {
  const a = boot();
  a.tab("Desk book");
  a.click('[data-action="handover"]');
  assert.match(a.status(), /saved to the desk book/);
  assert.match(a.page(), /Counter handover/);
  assert.match(a.saved().notes[0].text, /MI-09 Wireless microphone/);
});

test("handover notes are stored as text, never as markup", () => {
  const a = boot();
  a.tab("Desk book");
  a.$('[name="note"]').value = '<img src=x onerror="window.__pwned=1"> hi';
  a.submit("[data-note]");
  assert.equal(a.$(".record img"), null);
  assert.match(a.page(), /<img src=x/);
  assert.equal(a.w.__pwned, undefined);
});

test("progress survives a reload and restart restores the sample shift", () => {
  const a = boot();
  a.issue("RQ-214", "AD-12", "Kabir Sen");
  a.click('[data-action="advance"]');
  const b = boot({ saved: a.w.localStorage.getItem(KEY) });
  assert.equal(b.$("[data-clock]").textContent, "Friday · 7:30 pm");
  b.tab("Loan register");
  assert.match(b.page(), /L-402 · AD-12/);
  b.click('[data-action="restart"]');
  assert.equal(b.$("[data-clock]").textContent, "Friday · 3:45 pm");
  assert.equal(b.saved().loans.length, 1);
});

test("damaged saved data falls back to a fresh shift", () => {
  for (const bad of [
    "not json",
    "null",
    JSON.stringify({ version: 1 }),
    JSON.stringify({ version: 9 }),
  ]) {
    const a = boot({ saved: bad });
    assert.equal(a.$("[data-clock]").textContent, "Friday · 3:45 pm");
    assert.equal(a.$$(".row").length, 3);
  }
  // A stale filter value used to leave the inventory blank; now the save is ignored.
  const seed = boot();
  seed.tab("Inventory");
  const d = JSON.parse(seed.w.localStorage.getItem(KEY));
  d.filter = "Gone";
  const a = boot({ saved: JSON.stringify(d) });
  a.tab("Inventory");
  assert.equal(a.$("[data-filter]").value, "All items");
  assert.equal(a.$$(".row").length, 8);
});

test("works when browser storage is blocked, and says so", () => {
  const a = boot({ brokenStorage: true });
  a.issue("RQ-214", "AD-12", "Kabir Sen");
  assert.match(a.status(), /Issued AD-12/);
  assert.match(a.status(), /Browser storage is unavailable/);
});

test("keyboard focus stays on the control after a re-render", () => {
  const a = boot();
  a.tab("Loan register");
  const toggle = a.$('[data-action="scope"][data-val="1"]');
  toggle.focus();
  toggle.click();
  assert.equal(a.d.activeElement.dataset.val, "1");
  assert.equal(a.d.activeElement.getAttribute("aria-pressed"), "true");
});

test("return requires choosing who returned it; blank keeps the slip open", () => {
  const a = boot();
  a.tab("Loan register");
  a.click('[data-action="return"][data-val="401"]');
  a.submit("[data-return]");
  const err = a.$("[data-return] [role=alert]");
  assert.match(err.textContent, /Choose who is returning the unit/);
  assert.equal(a.d.activeElement, err);
  assert.ok(a.$("[data-return]")); // panel still open
  assert.equal(a.saved().loans[0].back, false);
  a.set("by", "Tara Shah");
  a.submit("[data-return]");
  assert.match(a.status(), /MI-09 returned by Tara Shah/);
});

test("7:30 hand over: Kabir -> Leela, promised Sat 9 am, shown everywhere and survives reload", () => {
  const a = boot();
  a.issue("RQ-214", "AD-12", "Kabir Sen");
  a.click('[data-action="advance"]');
  a.tab("Loan register");
  a.click('[data-action="transfer"][data-val="402"]');
  // both fields start blank and are required
  assert.equal(a.$('[name="holder"]').value, "");
  assert.equal(a.$('[name="promised"]').value, "");
  a.submit("[data-transfer]");
  assert.match(a.$("[data-transfer] [role=alert]").textContent, /who has the unit/);
  a.set("holder", "Leela Das");
  a.submit("[data-transfer]");
  assert.match(a.$("[data-transfer] [role=alert]").textContent, /promised back/);
  a.set("promised", "Sat 9 am");
  a.submit("[data-transfer]");
  const want = "with Leela Das (issued to Kabir Sen), promised Sat 9 am";
  assert.ok(a.status().includes("AD-12 is now " + want));
  assert.ok(a.page().includes(want)); // register
  assert.match(a.page(), /Promised Sat 9 am/); // separate tag
  assert.doesNotMatch(a.page(), /Overdue/); // 7:30 pm, due 8 pm
  a.tab("Inventory");
  assert.ok(a.page().includes("With Leela Das (issued to Kabir Sen), promised Sat 9 am (L-402"));
  a.tab("Desk book");
  assert.ok(a.$(".memo").textContent.includes(want));
  a.tab("Requests");
  a.click('[data-action="request"][data-val="RQ-214"]');
  assert.ok(a.page().includes(want));

  const b = boot({ saved: a.w.localStorage.getItem(KEY) });
  b.tab("Loan register");
  assert.ok(b.page().includes(want));
  assert.equal(b.saved().loans[1].who, "Kabir Sen"); // original issuee kept

  // Saturday 9:00: overdue is judged against the club's due time, not the promise
  b.click('[data-action="advance"]');
  assert.match(b.status(), /1 slip is overdue/);
  assert.match(b.page(), /Overdue/);
  assert.match(b.page(), /Promised Sat 9 am/);
});
