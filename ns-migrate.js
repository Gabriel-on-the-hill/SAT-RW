// ─────────────────────────────────────────────────────────────────
// ns-migrate.js — rename the storage namespace without losing anybody's work.
//
// MUST BE THE FIRST SCRIPT ON THE PAGE. Everything else — progress.js, storage.js,
// config.js, the per-page note state — reads its keys at load time. If this runs
// second, they read an empty store and the student's history looks deleted.
//
// WHY THIS EXISTS
//
// Every key in this app used to carry the prefix `wayne_` — a legacy namespace
// inherited from the directory this app was first built in, and never a name that
// belonged in the app itself. This is the shared SAT R&W Mastery app: everyone who
// signs in at the gate uses the same build, and it is nobody's in particular. The
// prefix is now `satrw_`, pairing with the sister app's `psat89_`.
//
// The rename is not a find-and-replace, because the old keys are not in this repo
// — they are in the students' browsers, holding their mastery ledger, their
// session history, their retention counter and their notes. Renaming the code
// without moving the data would silently wipe every one of them: nothing would
// error, the app would simply greet each of them as a brand-new student with no
// history, and the review ladder would forget everything they had ever learned.
// That is the exact class of silent loss the ladder itself exists to prevent.
//
// So: copy every `wayne_*` key to `satrw_*` once, then leave the originals alone.
//
// It is deliberately GENERIC rather than a list of known keys. A list is a thing
// you forget to update — and the key it would miss is somebody's progress. It is
// idempotent (guarded by a marker), it never overwrites a newer value, and it does
// not delete the legacy keys: if this migration is ever wrong, the originals are
// still there to migrate again. They cost a few KB and they are the undo.
// ─────────────────────────────────────────────────────────────────
(function () {
    var LEGACY = 'wayne_';
    var NS     = 'satrw_';
    var MARK   = 'satrw_ns_migrated_v1';

    try {
        if (localStorage.getItem(MARK)) return;

        // Snapshot the keys first. Writing to localStorage while iterating it by
        // index reindexes the store underneath the loop and skips entries.
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && k.indexOf(LEGACY) === 0) keys.push(k);
        }

        for (var j = 0; j < keys.length; j++) {
            var from = keys[j];
            var to   = NS + from.slice(LEGACY.length);
            // Never clobber: if a value already exists under the new name it is the
            // newer one, and the legacy copy is a stale leftover.
            if (localStorage.getItem(to) == null) {
                localStorage.setItem(to, localStorage.getItem(from));
            }
        }

        localStorage.setItem(MARK, '1');
    } catch (e) {
        // A quota error or a locked-down browser must not take the page down with
        // it. Worst case the student reads from empty state this session and the
        // migration retries on the next load, because MARK was never written.
    }
})();
