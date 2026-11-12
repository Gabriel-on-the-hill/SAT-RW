// This app's settings for the server gate (gate.mjs).
//   tutorPaths: pages a student may not open (each also sets GATE_REQUIRE = 'tutor';
//               gate.test.mjs checks the two lists agree).
//   keyedPaths: files the tutor sheet's Apps Script fetches with ?key=GATE_FETCH_KEY
//               (tutor-sheet/reminders.md, 'Plans URL').
export default {
  app: 'SAT Reading and Writing',
  tutorPaths: ['/assign.html', '/tutor-dashboard.html'],
  keyedPaths: ['/homework/assignments.js'],
};
