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

### Would I keep it?

Yes, with one change: make the desk's records say who actually has each unit and when it is promised back.

### What it handles well

The issue slip refuses equipment outside the approved request, and a second unit of a type already on loan, and it says why. This was in the original app, not something I added. In my shift on the original app, while issuing the Film Society kit, trying a second adapter was refused with "The approved quantity of this equipment type is already on loan", and trying a camera was refused with "This equipment type is outside the approved request". Both stop a wrong slip at the counter instead of at the handover. My version keeps those rules but also hides ineligible units from the unit list once a request is chosen, so the mistake is harder to make in the first place.

### What I would change

The desk could not answer "can he leave with everything he needs?", and the loan record only knew one person per unit. At 7:30 pm Kabir says Leela has the adapter and will bring it at 9. The app could only keep Kabir as the holder, so the morning handover would point at the wrong person.

### Walkthrough: same shift, before and after

- **3:45 pm pickup.** Before: three separate slips, with nothing showing what was still missing. After: the request shows each approved item as Not issued, Out, or Returned, with a one-click Issue button that fills in the slip.
- **7:30 pm partial return.** Before: return the projector and speaker; the adapter stays on a slip in Kabir's name. After: the return asks who is bringing it back and records it. **Hand over** sets the adapter as "with Leela Das (issued to Kabir Sen), promised Sat 9 am".
- **9:00 am handover.** Before: guess which open slip is the adapter and who has it. After: the Desk book lists what is still outstanding with the holder and promise, and the adapter is marked Overdue against the club's Fri 8 pm deadline. Leela returns it and "Returned by" is chosen explicitly, never preselected.

### What I kept

The one-slip-per-unit register, the request validation, the local-only design, and the free-text desk book.

### What I deliberately did not build

Bulk issue, because it would speed up the step where checking each unit matters. Accounts, a backend, and quantities, which this job does not need.

### Known limits

- The app does not verify which physical adapter came back. AD-12 and AD-15 sit in the same bin. Recording a mismatch without overwriting the slip is my next step.
- Reopening a returned slip still clears the earlier return details.
- Tested in jsdom, plus one headless-browser load check. No manual mobile or screen-reader pass.

### One observation at a real counter

At each morning handover, count the open slips the incoming shift finds that the handover note did not mention, or that named the wrong holder. If the change works, that number should drop towards zero.

### Code layout

Rules and sample data live in `logic.js` (no DOM, shared by the app and tests). `app.js` renders and wires events. The saved-state key and version are unchanged; older saves still load.

## Tests

The app itself needs nothing installed. The tests need Node 22 or newer (the `npm test` script relies on `node --test` expanding a file glob) and one dev dependency (jsdom).

```sh
npm install
npm test
```

The suite has 42 tests. `tests/logic.test.js` covers the rules (issue validation, fulfilment, overdue, returns, reopen, restore). `tests/app.test.js` drives the real page end to end: the full pickup to return story, validation errors, persistence, blocked storage, and markup injection.

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
