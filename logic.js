/* Campus Stores domain logic: sample data, state shape, and the rules that
   decide what can be issued, returned and handed over. It has no DOM access so
   it runs in the browser (as window.CampusLogic) and under Node for tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CampusLogic = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const requests = [
    {
      id: "RQ-214",
      club: "Film Society",
      event: "Courtyard screening",
      owner: "Isha Rao",
      due: "Fri 8 pm",
      items: ["HDMI projector", "Portable speaker", "USB-C → HDMI adapter"],
      note: "Playback is from a USB-C-only laptop. The host will collect at 4 pm.",
    },
    {
      id: "RQ-209",
      club: "Debate Union",
      event: "Finals rehearsal",
      owner: "Tara Shah",
      due: "Sat 10 am",
      items: ["Wireless microphone"],
      note: "Rehearsal runs into the evening.",
    },
    {
      id: "RQ-217",
      club: "Photo Circle",
      event: "Street portrait walk",
      owner: "Dev Menon",
      due: "Sat noon",
      items: ["Digital camera"],
      note: "Collection on Saturday morning.",
    },
  ];
  const assets = [
    { id: "PR-04", type: "HDMI projector", model: "BenQ MH550", bin: "A2" },
    {
      id: "PR-06",
      type: "HDMI projector",
      model: "Epson EB-X49",
      bin: "Workshop",
      repair: true,
    },
    { id: "SP-02", type: "Portable speaker", model: "JBL Eon One", bin: "B1" },
    { id: "SP-05", type: "Portable speaker", model: "Bose S1", bin: "B2" },
    {
      id: "AD-12",
      type: "USB-C → HDMI adapter",
      model: "Belkin AVC002",
      bin: "C4",
    },
    {
      id: "AD-15",
      type: "USB-C → HDMI adapter",
      model: "Anker A8312",
      bin: "C4",
    },
    { id: "MI-09", type: "Wireless microphone", model: "Shure BLX", bin: "B3" },
    { id: "CA-03", type: "Digital camera", model: "Sony A6400", bin: "D2" },
  ];
  const people = [
    "Isha Rao",
    "Kabir Sen",
    "Leela Das",
    "Tara Shah",
    "Dev Menon",
  ];
  // `at` is minutes since Friday 00:00 so desk time and due times can be compared.
  const shifts = [
    {
      time: "Friday · 3:45 pm",
      at: 15 * 60 + 45,
      title: "Pickup at the counter",
      text: "Kabir is here for the Film Society screening. The film starts at four. Can he leave with everything he needs?",
      next: "Move to return time",
    },
    {
      time: "Friday · 7:30 pm",
      at: 19 * 60 + 30,
      title: "The kit comes back in pieces",
      text: "Kabir has brought back the projector and speaker. “Leela still has the adapter. She’ll drop it off tomorrow at nine.” Take the return and hand over to the morning shift.",
      next: "Move to next morning",
    },
    {
      time: "Saturday · 9:00 am",
      at: 24 * 60 + 9 * 60,
      title: "Morning shift",
      text: "You’ve just taken over. Leela walks in with an adapter. Work out what was outstanding from the screening and close the loan for the right item.",
    },
  ];
  const dueTimes = {
    "Fri 8 pm": 20 * 60,
    "Sat 9 am": 24 * 60 + 9 * 60,
    "Sat 10 am": 24 * 60 + 10 * 60,
    "Sat noon": 24 * 60 + 12 * 60,
  };
  const dueOptions = Object.keys(dueTimes);
  const tabs = ["Requests", "Inventory", "Loan register", "Desk book"];
  const filters = ["All items", "On shelf", "On loan", "In repair"];

  const original = () => ({
    version: 1,
    tab: "Requests",
    phase: 0,
    selected: "",
    filter: "All items",
    loans: [
      {
        num: 401,
        req: "RQ-209",
        asset: "MI-09",
        who: "Tara Shah",
        due: "Sat 10 am",
        back: false,
      },
    ],
    notes: [],
    editing: false,
    draft: blankDraft(),
    pending: 0,
    transfer: 0,
    error: "",
    onlyOpen: true,
    notice: "Sample shift · All records are fictional.",
  });
  function blankDraft() {
    return { req: "", asset: "", who: "", due: "" };
  }

  const getAsset = (id) => assets.find((x) => x.id === id);
  const getReq = (id) => requests.find((x) => x.id === id);
  const getLoan = (s, num) => s.loans.find((l) => l.num === Number(num));
  const openLoan = (s, assetId) =>
    s.loans.find((l) => l.asset === assetId && !l.back);
  const deskTime = (s) => shifts[s.phase].at;
  /* Who has the unit now. `who` stays the person it was issued to. */
  const holderOf = (l) => l.holder ?? l.who;
  /* "with Leela Das (issued to Kabir Sen), promised Sat 9 am" */
  function holderText(l) {
    let t = "with " + holderOf(l);
    if (holderOf(l) !== l.who) t += " (issued to " + l.who + ")";
    if (l.promised) t += ", promised " + l.promised;
    return t;
  }

  /* A loan is overdue once desk time has passed its due time. */
  function isOverdue(s, loan) {
    return !loan.back && deskTime(s) > (dueTimes[loan.due] ?? Infinity);
  }

  /* Open slip for this request and equipment type, if any. */
  function openForType(s, reqId, type) {
    return s.loans.find(
      (l) => l.req === reqId && !l.back && getAsset(l.asset).type === type,
    );
  }

  /* Units that can be issued against a request right now: in stock, not in
     repair, of an approved type, and not already on loan to this request. */
  function issuableUnits(s, reqId) {
    const r = getReq(reqId);
    return assets.filter(
      (a) =>
        !a.repair &&
        !openLoan(s, a.id) &&
        (!r || (r.items.includes(a.type) && !openForType(s, r.id, a.type))),
    );
  }

  /* Per-item status of a request, the answer to "has everything gone out?". */
  function fulfilment(s, req) {
    const lines = req.items.map((type) => {
      const open = openForType(s, req.id, type);
      if (open) return { type, status: "out", loan: open };
      const done = s.loans
        .filter((l) => l.req === req.id && getAsset(l.asset).type === type)
        .pop();
      if (done) return { type, status: "returned", loan: done };
      return { type, status: "not-issued", loan: null };
    });
    const count = (st) => lines.filter((x) => x.status === st).length;
    const notIssued = count("not-issued");
    const out = count("out");
    const returned = count("returned");
    let label;
    if (notIssued === lines.length) label = "Nothing issued";
    else if (notIssued > 0) label = "Partly issued";
    else if (out === 0) label = "Returned in full";
    else if (returned > 0) label = "Partly returned";
    else label = "All issued";
    return {
      lines,
      notIssued,
      out,
      returned,
      label,
      done: out === 0 && notIssued === 0,
      overdue: lines.some((x) => x.loan && isOverdue(s, x.loan)),
    };
  }

  /* Returns an error message, or "" when the slip may be saved. */
  function validateIssue(s, input) {
    const { req, asset, who, due } = input;
    const r = getReq(req);
    if (!r) return "Choose an approved request.";
    const unit = getAsset(asset);
    if (!unit) return "Choose the unit that is leaving the desk.";
    if (!people.includes(who)) return "Choose who is collecting the unit.";
    if (!Object.hasOwn(dueTimes, due)) return "Choose when it is due back.";
    if (unit.repair)
      return unit.id + " is in repair and cannot be issued.";
    const held = openLoan(s, unit.id);
    if (held)
      return unit.id + " is already out on slip L-" + held.num + ".";
    if (!r.items.includes(unit.type))
      return "This equipment type is outside the approved request. Choose an approved unit.";
    if (openForType(s, r.id, unit.type))
      return "The approved quantity of this equipment type is already on loan.";
    return "";
  }

  function nextNum(s) {
    return Math.max(400, ...s.loans.map((l) => l.num)) + 1;
  }

  /* Issue a slip. Mutates s on success; on failure records s.error. */
  function issue(s, input) {
    const error = validateIssue(s, input);
    if (error) {
      s.error = error;
      return { ok: false, error };
    }
    const loan = {
      num: nextNum(s),
      req: input.req,
      asset: input.asset,
      who: input.who,
      due: input.due,
      back: false,
    };
    s.loans.push(loan);
    s.editing = false;
    s.draft = blankDraft();
    s.error = "";
    s.notice =
      "Issued " + loan.asset + " to " + loan.who + " on slip L-" + loan.num + ".";
    return { ok: true, loan };
  }

  /* Close a slip, recording who brought the unit back and when. */
  function returnLoan(s, num, by, unit) {
    const loan = getLoan(s, num);
    if (!loan || loan.back) return { ok: false, error: "That slip is not outstanding." };
    if (!people.includes(by))
      return { ok: false, error: "Choose who is returning the unit." };
    if (!getAsset(unit))
      return { ok: false, error: "Choose the unit you received." };
    if (unit !== loan.asset) {
      /* Wrong physical unit: keep the slip open and note what came back. */
      loan.mismatch = { received: unit, by, at: shifts[s.phase].time };
      s.pending = 0;
      s.notice =
        "Received " + unit + ", but slip L-" + loan.num + " is for " + loan.asset +
        ". Slip kept open — check the unit.";
      return { ok: false, mismatch: true, error: s.notice };
    }
    delete loan.mismatch;
    loan.back = true;
    loan.returnedBy = by;
    loan.returnedAt = shifts[s.phase].time;
    s.pending = 0;
    s.notice =
      loan.asset + " returned by " + by + ". Slip L-" + loan.num + " closed.";
    return { ok: true, loan };
  }

  /* Pass an open slip to someone else with a promised return time. */
  function handOver(s, num, holder, promised) {
    const loan = getLoan(s, num);
    if (!loan || loan.back) return { ok: false, error: "That slip is not outstanding." };
    if (!people.includes(holder))
      return { ok: false, error: "Choose who has the unit now." };
    if (!Object.hasOwn(dueTimes, promised))
      return { ok: false, error: "Choose when it is promised back." };
    loan.holder = holder;
    loan.promised = promised;
    s.transfer = 0;
    s.notice =
      loan.asset + " is now " + holderText(loan) + " (slip L-" + loan.num + ").";
    return { ok: true, loan };
  }

  /* Undo a mistaken return, unless the unit has been issued again since. */
  function reopenLoan(s, num) {
    const loan = getLoan(s, num);
    if (!loan || !loan.back) return { ok: false, error: "That slip is already open." };
    const held = openLoan(s, loan.asset);
    if (held) {
      const error =
        loan.asset + " is out again on slip L-" + held.num + ", so L-" + loan.num + " cannot be reopened.";
      return { ok: false, error };
    }
    loan.back = false;
    delete loan.returnedBy;
    delete loan.returnedAt;
    s.notice = "Slip L-" + loan.num + " reopened.";
    return { ok: true, loan };
  }

  /* Open slips, overdue first, then by due time. */
  function outstanding(s) {
    return s.loans
      .filter((l) => !l.back)
      .sort(
        (a, b) =>
          Number(isOverdue(s, b)) - Number(isOverdue(s, a)) ||
          dueTimes[a.due] - dueTimes[b.due] ||
          a.num - b.num,
      );
  }

  /* Plain-text handover summary generated from the register. */
  function handoverText(s) {
    const open = outstanding(s);
    if (!open.length) return "Nothing outstanding. Every issued unit is back.";
    return (
      "Outstanding: " +
      open
        .map((l) => {
          const a = getAsset(l.asset);
          return (
            l.asset +
            " " +
            a.type +
            " (" +
            l.req +
            ", " +
            getReq(l.req).club +
            ", slip L-" +
            l.num +
            ", " +
            holderText(l) +
            ", due " +
            l.due +
            (isOverdue(s, l) ? ", OVERDUE" : "") +
            (l.mismatch ? ", UNIT MISMATCH (received " + l.mismatch.received + ")" : "") +
            ")"
          );
        })
        .join("; ") +
      "."
    );
  }

  /* Validate saved data. Returns a clean state object, or null if the saved
     data cannot be trusted. Transient UI state is always reset. */
  function restore(d) {
    const isStr = (x) => typeof x === "string";
    if (!d || typeof d !== "object" || d.version !== 1) return null;
    if (!tabs.includes(d.tab)) return null;
    if (!Number.isInteger(d.phase) || !shifts[d.phase]) return null;
    if (d.selected && !getReq(d.selected)) return null;
    if (d.filter !== undefined && !filters.includes(d.filter)) return null;
    if (d.onlyOpen !== undefined && typeof d.onlyOpen !== "boolean") return null;
    if (
      !Array.isArray(d.notes) ||
      !d.notes.every(
        (n) =>
          n && Number.isInteger(n.phase) && shifts[n.phase] && isStr(n.text),
      )
    )
      return null;
    if (!Array.isArray(d.loans) || !d.loans.length) return null;
    const nums = new Set();
    const openAssets = new Set();
    for (const l of d.loans) {
      if (!l || !getReq(l.req) || !getAsset(l.asset)) return null;
      if (!Number.isInteger(l.num) || l.num < 1 || nums.has(l.num)) return null;
      if (!people.includes(l.who) || !Object.hasOwn(dueTimes, l.due)) return null;
      if (typeof l.back !== "boolean") return null;
      if (l.holder !== undefined && !people.includes(l.holder)) return null;
      if (l.promised !== undefined && !Object.hasOwn(dueTimes, l.promised)) return null;
      if (l.mismatch !== undefined) {
        const m = l.mismatch;
        if (!m || typeof m !== "object" || !getAsset(m.received) || !people.includes(m.by) || !isStr(m.at))
          return null;
      }
      if (l.back) {
        if (l.returnedBy !== undefined && !people.includes(l.returnedBy))
          return null;
        if (l.returnedAt !== undefined && !isStr(l.returnedAt)) return null;
      } else {
        if (openAssets.has(l.asset)) return null;
        openAssets.add(l.asset);
      }
      nums.add(l.num);
    }
    const base = original();
    return {
      ...base,
      version: 1,
      tab: d.tab,
      phase: d.phase,
      selected: d.selected || "",
      filter: d.filter ?? base.filter,
      onlyOpen: d.onlyOpen ?? base.onlyOpen,
      loans: d.loans.map((l) => ({ ...l })),
      notes: d.notes.map((n) => ({ phase: n.phase, text: n.text })),
      notice: isStr(d.notice) ? d.notice : base.notice,
    };
  }

  return {
    requests,
    assets,
    people,
    shifts,
    dueOptions,
    dueTimes,
    tabs,
    filters,
    original,
    blankDraft,
    getAsset,
    getReq,
    getLoan,
    holderOf,
    holderText,
    handOver,
    openLoan,
    openForType,
    isOverdue,
    issuableUnits,
    fulfilment,
    validateIssue,
    issue,
    returnLoan,
    reopenLoan,
    outstanding,
    handoverText,
    restore,
  };
});
