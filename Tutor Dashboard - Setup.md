# Tutor Dashboard — setup (5 minutes, no coding)

`tutor-dashboard.html` shows every student's sessions — scores, weak skills, and
tab-switch flags — pulled live from the Google Sheet your app already syncs to.
It reads the Sheet as a **published CSV**, so you don't need to touch the Apps
Script. (Published CSV URLs are served by Google with CORS, which is why the
page can read them directly.)

## 1. Publish your responses sheet as CSV

1. Open the Google Sheet that receives the sync rows.
2. **File → Share → Publish to web**.
3. Under "Link", pick the **specific sheet/tab** that holds the rows (not "Entire
   Document" unless that's the only tab).
4. Choose **Comma-separated values (.csv)**.
5. Click **Publish**, confirm, and **copy the link**. It looks like:
   `https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?gid=0&single=true&output=csv`

## 2. Load it

1. Open `tutor-dashboard.html` (same folder as the app; it shares the app
   password gate).
2. Paste the URL, click **Save URL**, then **Load data**. It remembers the URL
   on that device.

## What it shows

- **Top tiles:** number of students, total sessions, total tab-switches.
- **By student:** average score, session count, total tab-switches (flagged in
  red), and the three weakest skills (needs a `skillStats` column — see below).
- **Recent sessions:** a table of date, student, type (practice/homework), score,
  %, average seconds/question, tab-switches, and the assignment/skills.

The dashboard maps columns by **header name** (case-insensitive) and shows
whatever it finds, so it won't break if a column is missing. Useful headers:
`date, student, type, score, total, pct, avgSecs, blurCount, skills, skillStats, assignmentTitle, mode`.

## Making sure the new columns arrive

The app now sends two extra fields with every session:

- `blurCount` — tab-switches / focus-losses during the session (integrity signal).
- `questions` — a per-question array `[{id, skill, difficulty, chosen, correct, isCorrect, secs, trap}]`
  for deeper diagnostics.

Whether these land as columns depends on how your Apps Script writes rows:

- **If your script appends values by header/key** (it builds the row from the
  incoming JSON keys), the new columns appear automatically — just add the
  header cells `blurCount` and `questions` to the sheet, or let the script add them.
- **If your script writes a fixed list of columns**, add `blurCount` (and
  optionally `questions`) to that list. A minimal example inside `doPost`:

  ```js
  // data = JSON.parse(e.postData.contents)
  sheet.appendRow([
    data.date, data.student, data.type, data.assignmentTitle,
    data.score, data.total, data.pct,
    (data.skills||[]).join('|'), data.mode, data.duration, data.avgSecs,
    JSON.stringify(data.skillStats||{}),
    data.blurCount,                       // ← add
    JSON.stringify(data.questions||[])    // ← add (optional, large)
  ]);
  ```

`questions` can be large; if you'd rather keep the sheet lean, skip it — the
dashboard works fine on the summary columns alone.
