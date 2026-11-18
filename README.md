# Campus Stores

Campus Stores is a Product Engineer work sample set at a fictional campus media equipment desk. Work through a club’s screening, from equipment pickup to a partial return and the next morning’s handover. Open **Candidate brief** in the app for the assignment.

## Run the app

Open `index.html` in a modern browser. The app includes its scripts, styles, and icons and can run offline.

To serve it over local HTTP, run this from the repository folder and visit `http://localhost:8000`.

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Each browser stores its own sample shift locally when browser storage is available. **Restart sample shift** restores the fictional starting records.

## My changes (for reviewers)

**The one moment I would change.** At pickup the desk is asked "can he leave with everything he needs?", but the product could not answer it. Requests showed no status, so the one easy-to-miss item, the USB-C adapter for a USB-C-only laptop, was invisible. The next morning it also made the handover guesswork: the register listed slips but nothing said which unit was outstanding, with whom, or whether it was late.

**What I changed, and why these three:**

1. **Request fulfilment view.** Every request now shows per-item status (not issued, out with whom and due when, returned by whom). The list shows a roll-up ("All issued", "Partly returned"). Each unissued item has a one-click **Issue AD-12** shortcut that opens a slip with request, unit and return time pre-filled. This answers the pickup question at a glance.
2. **Safer returns and a computed handover.** **Record return** now opens a confirmation showing the exact unit, model, bin and holder, and asks who is actually returning it (Leela, not Kabir, brings the adapter back). The slip keeps who and when, and a mistaken return can be reopened. Slips past their due time against desk time are marked **Overdue**. The Desk book shows a live "Still outstanding" list from the register, which can be saved as a handover note, replacing guesswork with the answer: the adapter on L-404, overdue, with Kabir.
3. **Reliable forms and state.** Validation errors are shown in the form (announced to screen readers, focus moved to them) instead of vanishing on the next repaint. The unit list only offers approved, free, working units, and the return time defaults from the request, with a warning if you override it. Saved-state restore is stricter, so a stale or damaged save falls back to a fresh shift instead of rendering a broken screen (the inventory filter used to blank out). Keyboard focus survives re-renders.

**Decisions I made on purpose.** Returns ask for confirmation because closing the wrong slip is the costly mistake, but reopening is one click so it never traps anyone. A later-than-approved return time is flagged, not blocked, because desk staff may have agreed it with the club. I did not add accounts, a backend or a quantity model; none is needed for this job.

**What I would watch at a real counter.** Count how often staff open the request form before handing over the kit, and how many slips are still open at the morning handover that nobody on the new shift knew about. If the confirmation step adds seconds to returns with no fewer wrong closures, I would drop it for returns of a single unit.

**Code layout.** Rules and sample data live in `logic.js` (no DOM, shared by the app and tests). `app.js` renders and wires events. The saved-state key and version are unchanged; older saves still load.

## Tests

The app itself needs nothing installed. The tests use Node 20+ and one dev dependency (jsdom).

```sh
npm install
npm test
```

`tests/logic.test.js` covers the rules (issue validation, fulfilment, overdue, returns, reopen, restore). `tests/app.test.js` drives the real page end to end: the full pickup to return story, validation errors, persistence, blocked storage, and markup injection.

## Source

- `index.html` contains the desk layout, candidate brief, and bundled icons.
- `logic.js` contains the sample records and the rules for issuing, returning and handover.
- `app.js` contains the screens and interactions.
- `styles.css` defines the desktop and mobile layouts.

Icon license notices are in [third-party/lucide-LICENSE.txt](third-party/lucide-LICENSE.txt).


## Submit your work

1. [Fork Campus Stores](https://github.com/virinchi-healthcare/campus-stores/fork) into your GitHub account. Complete the candidate brief and push your changes to your public fork. In your README, point reviewers to your work and explain the decision you made.
2. In your fork, open **Commits**, select the final commit you want reviewed, and copy the page URL. It should look like `https://github.com/YOUR-USERNAME/campus-stores/commit/COMMIT-SHA`.
3. [Submit your work through the Google Form](https://docs.google.com/forms/d/e/1FAIpQLScvzoh1R4WS-SkiwAVBQbMvniieJYSoOEfLMyVo5CyjOvYUgQ/viewform). Your **roll number**, **email ID**, and **final commit link from your public fork** are required. Enter your roll number and email ID in the form only.
