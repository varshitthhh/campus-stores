const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logic.js");

const fresh = () => L.original();
const film = L.getReq("RQ-214");
const slip = (req, asset, who = "Kabir Sen", due) => ({
  req,
  asset,
  who,
  due: due ?? L.getReq(req).due,
});
const issueKit = (s) => {
  for (const a of ["PR-04", "SP-02", "AD-12"])
    assert.equal(L.issue(s, slip("RQ-214", a)).ok, true);
};

test("starting state has the seeded mic slip and passes its own validation", () => {
  const s = fresh();
  assert.equal(s.loans.length, 1);
  assert.deepEqual(L.restore(JSON.parse(JSON.stringify(s))).loans, s.loans);
});

test("fulfilment: nothing issued -> all issued -> partly returned -> returned in full", () => {
  const s = fresh();
  assert.equal(L.fulfilment(s, film).label, "Nothing issued");
  L.issue(s, slip("RQ-214", "PR-04"));
  assert.equal(L.fulfilment(s, film).label, "Partly issued");
  L.issue(s, slip("RQ-214", "SP-02"));
  L.issue(s, slip("RQ-214", "AD-12"));
  assert.equal(L.fulfilment(s, film).label, "All issued");
  L.returnLoan(s, 402, "Kabir Sen");
  assert.equal(L.fulfilment(s, film).label, "Partly returned");
  L.returnLoan(s, 403, "Kabir Sen");
  L.returnLoan(s, 404, "Leela Das");
  const f = L.fulfilment(s, film);
  assert.equal(f.label, "Returned in full");
  assert.equal(f.done, true);
});

test("issue rejects equipment outside the approved request", () => {
  const s = fresh();
  const r = L.issue(s, slip("RQ-214", "CA-03"));
  assert.equal(r.ok, false);
  assert.match(r.error, /outside the approved request/);
  assert.equal(s.error, r.error);
  assert.equal(s.loans.length, 1);
});

test("issue rejects a second unit of a type already on loan to the request", () => {
  const s = fresh();
  L.issue(s, slip("RQ-214", "AD-12"));
  const r = L.issue(s, slip("RQ-214", "AD-15"));
  assert.equal(r.ok, false);
  assert.match(r.error, /already on loan/);
});

test("issue rejects units in repair and units already out", () => {
  const s = fresh();
  assert.match(L.issue(s, slip("RQ-214", "PR-06")).error, /in repair/);
  assert.match(L.issue(s, slip("RQ-217", "MI-09")).error, /already out on slip L-401/);
});

test("issue gives a specific message for every missing field", () => {
  const s = fresh();
  const base = slip("RQ-214", "PR-04");
  assert.match(L.validateIssue(s, { ...base, req: "" }), /request/);
  assert.match(L.validateIssue(s, { ...base, asset: "" }), /unit/);
  assert.match(L.validateIssue(s, { ...base, who: "" }), /collecting/);
  assert.match(L.validateIssue(s, { ...base, who: "Nobody" }), /collecting/);
  assert.match(L.validateIssue(s, { ...base, due: "" }), /due back/);
  assert.equal(L.validateIssue(s, base), "");
});

test("a failed issue changes no records; a good one clears the error", () => {
  const s = fresh();
  L.issue(s, slip("RQ-214", "CA-03"));
  assert.equal(s.loans.length, 1);
  const ok = L.issue(s, slip("RQ-214", "PR-04"));
  assert.equal(ok.loan.num, 402);
  assert.equal(s.error, "");
});

test("issuableUnits narrows to approved, free, working units", () => {
  const s = fresh();
  const ids = (req) => L.issuableUnits(s, req).map((a) => a.id);
  assert.deepEqual(ids("RQ-214"), ["PR-04", "SP-02", "SP-05", "AD-12", "AD-15"]);
  L.issue(s, slip("RQ-214", "AD-12"));
  assert.deepEqual(ids("RQ-214"), ["PR-04", "SP-02", "SP-05"]);
  assert.deepEqual(ids("RQ-209"), []); // its only mic is already out
});

test("return records who brought it back and when; rejects strangers and repeats", () => {
  const s = fresh();
  L.issue(s, slip("RQ-214", "AD-12"));
  s.phase = 2;
  assert.equal(L.returnLoan(s, 402, "Someone").ok, false);
  const r = L.returnLoan(s, 402, "Leela Das");
  assert.equal(r.ok, true);
  assert.equal(r.loan.returnedBy, "Leela Das");
  assert.equal(r.loan.returnedAt, "Saturday · 9:00 am");
  assert.equal(L.returnLoan(s, 402, "Leela Das").ok, false);
  assert.equal(L.returnLoan(s, 999, "Leela Das").ok, false);
  assert.equal(L.openLoan(s, "AD-12"), undefined);
});

test("overdue depends on desk time, not on the loan alone", () => {
  const s = fresh();
  issueKit(s);
  const adapter = L.getLoan(s, 404);
  const mic = L.getLoan(s, 401);
  assert.equal(L.isOverdue(s, adapter), false); // Fri 3:45 pm, due 8 pm
  s.phase = 1;
  assert.equal(L.isOverdue(s, adapter), false); // Fri 7:30 pm
  s.phase = 2;
  assert.equal(L.isOverdue(s, adapter), true); // Sat 9:00 am
  assert.equal(L.isOverdue(s, mic), false); // due Sat 10 am
  L.returnLoan(s, 404, "Leela Das");
  assert.equal(L.isOverdue(s, adapter), false); // returned slips are never overdue
});

test("outstanding lists overdue slips first", () => {
  const s = fresh();
  L.issue(s, slip("RQ-214", "AD-12"));
  s.phase = 2;
  assert.deepEqual(
    L.outstanding(s).map((l) => l.num),
    [402, 401],
  );
});

test("reopen undoes a return and clears who/when", () => {
  const s = fresh();
  L.issue(s, slip("RQ-214", "AD-12"));
  L.returnLoan(s, 402, "Kabir Sen");
  assert.equal(L.reopenLoan(s, 402).ok, true);
  const l = L.getLoan(s, 402);
  assert.equal(l.back, false);
  assert.equal("returnedBy" in l, false);
  assert.equal(L.reopenLoan(s, 402).ok, false); // already open
});

test("reopen is blocked when the unit has been issued again", () => {
  const s = fresh();
  L.issue(s, slip("RQ-214", "AD-12"));
  L.returnLoan(s, 402, "Kabir Sen");
  L.issue(s, slip("RQ-214", "AD-12"));
  const r = L.reopenLoan(s, 402);
  assert.equal(r.ok, false);
  assert.match(r.error, /out again on slip L-403/);
  assert.equal(L.getLoan(s, 402).back, true);
});

test("a returned type can be issued again to the same request", () => {
  const s = fresh();
  L.issue(s, slip("RQ-214", "AD-12"));
  L.returnLoan(s, 402, "Kabir Sen");
  assert.equal(L.issue(s, slip("RQ-214", "AD-15")).ok, true);
  assert.equal(L.fulfilment(s, film).lines[2].loan.asset, "AD-15");
});

test("handover text names the outstanding adapter and flags it overdue", () => {
  const s = fresh();
  issueKit(s);
  L.returnLoan(s, 402, "Kabir Sen");
  L.returnLoan(s, 403, "Kabir Sen");
  s.phase = 2;
  const t = L.handoverText(s);
  assert.match(t, /AD-12 USB-C → HDMI adapter \(RQ-214, Film Society, slip L-404, with Kabir Sen, due Fri 8 pm, OVERDUE\)/);
  assert.match(t, /MI-09/);
  assert.doesNotMatch(t, /PR-04/);
  L.returnLoan(s, 404, "Leela Das");
  L.returnLoan(s, 401, "Tara Shah");
  assert.match(L.handoverText(s), /Nothing outstanding/);
});

test("restore accepts a saved shift and resets transient UI state", () => {
  const s = fresh();
  issueKit(s);
  s.editing = true;
  s.pending = 402;
  s.error = "stale";
  const r = L.restore(JSON.parse(JSON.stringify(s)));
  assert.equal(r.loans.length, 4);
  assert.equal(r.editing, false);
  assert.equal(r.pending, 0);
  assert.equal(r.error, "");
});

test("restore accepts saves from before returnedBy existed", () => {
  const s = fresh();
  s.loans[0].back = true; // no returnedBy / returnedAt
  assert.ok(L.restore(JSON.parse(JSON.stringify(s))));
});

test("restore rejects damaged or inconsistent saves", () => {
  const good = () => JSON.parse(JSON.stringify(fresh()));
  const bad = (mutate) => {
    const d = good();
    mutate(d);
    assert.equal(L.restore(d), null);
  };
  assert.equal(L.restore(null), null);
  assert.equal(L.restore("x"), null);
  bad((d) => (d.version = 2));
  bad((d) => (d.tab = "Nope"));
  bad((d) => (d.phase = 7));
  bad((d) => (d.phase = 0.5));
  bad((d) => (d.selected = "RQ-999"));
  bad((d) => (d.filter = "Everything"));
  bad((d) => (d.onlyOpen = "yes"));
  bad((d) => (d.notes = [{ phase: 9, text: "x" }]));
  bad((d) => (d.notes = [{ phase: 0, text: 5 }]));
  bad((d) => (d.loans = []));
  bad((d) => (d.loans[0].who = "Mallory"));
  bad((d) => (d.loans[0].due = "Tuesday"));
  bad((d) => (d.loans[0].back = "no"));
  bad((d) => (d.loans[0].asset = "ZZ-01"));
  bad((d) => d.loans.push({ ...d.loans[0] })); // duplicate slip number
  bad((d) => d.loans.push({ ...d.loans[0], num: 402 })); // same unit open twice
  bad((d) => {
    d.loans[0].back = true;
    d.loans[0].returnedBy = "Mallory";
  });
});
