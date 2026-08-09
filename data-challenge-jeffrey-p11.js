// ─────────────────────────────────────────────────────────────────
// data-challenge-jeffrey-p11.js
//
// The incorrect R&W questions from SAT Practice 11 (8 August 2026),
// transcribed from the Bluebook review screens.
//
// This is LAYER 1 of the Challenge module: the debrief. It is UNSCORED —
// these ids exist in no question bank, so they are never part of the
// "Mastered N of M" denominator. Referenced from challenge/sets.js as the
// optional `review` payload of the `p11-rw` set.
//
// ── What is here, and what is not ────────────────────────────────
//
//  • 17 questions. The score report records 17 R&W incorrect, so the set is
//    complete in count.
//  • TWO ARE PARTIAL. `p11_rw_q13` is missing options C and D, and
//    `p11_rw_bar` has its figure only — no stem, no options. Both are marked
//    `partial: true` and carry what was captured. They are kept rather than
//    dropped: a partial question still names the skill and the trap, and the
//    denominator here is not scored.
//  • The chosen answers were not captured. Explanations below describe why each
//    distractor is built to attract, not which one was taken.
//
// Difficulty labels are read from the Bluebook review header, not inferred.
// ─────────────────────────────────────────────────────────────────

const CHALLENGE_P11 = [

  // ── Information & Ideas ────────────────────────────────────────
  {
    id: 'p11_rw_q08', source: 'Practice 11 · R&W Q8',
    skill: 'Central Ideas and Details', difficulty: 'Easy',
    passage: "When Kenyan writer Ngũgĩ wa Thiong'o, who had previously published four novels in English, began writing in his native language, Gĩkũyũ, in the 1970s, several fellow writers and critics cautioned that doing so might make his works inaccessible outside his own community. Some noted that Kiswahili—widely spoken in Kenya and elsewhere in Africa—would be a more practical choice. Rejecting their arguments, Ngũgĩ went on to author dozens of acclaimed works in Gĩkũyũ that have been translated into a total of more than thirty languages.",
    question: 'Which choice best states the main idea of the text?',
    options: [
      'A. The reaction to Ngũgĩ\'s rejection of English illustrates that some literary experts believe that fame is most easily gained by writing in a widely understood language, such as Gĩkũyũ.',
      'B. Although Ngũgĩ insisted on publishing his first works in Gĩkũyũ, they have since been translated into many other languages.',
      'C. Although Ngũgĩ\'s decision to write in Gĩkũyũ was met with some skepticism, it didn\'t prevent him from achieving literary success.',
      'D. In the 1970s, Ngũgĩ became convinced that literature ought to be written in authors\' native languages, and he proceeded to publish many works in Gĩkũyũ.',
    ],
    answer: 'C',
    explanation: "C is correct: skepticism, then success anyway. That concessive shape — 'although X, still Y' — is the whole text.\n\nA swaps a fact. The passage calls KISWAHILI the widely spoken language; A attaches that to Gĩkũyũ. One noun out of place makes a whole option wrong.\n\nB is true and small. The translations are the last clause of the passage, not its point, and 'his first works' is wrong — he had already published four novels in English.\n\nD invents a motive. The passage says he rejected their arguments. It never says he came to believe literature OUGHT to be written in native languages.",
  },
  {
    id: 'p11_rw_seal', source: 'Practice 11 · R&W (gray seal)',
    skill: 'Central Ideas and Details', difficulty: 'Easy',
    passage: "Few animals are known to spit: among them are humans, cobras, and camels. But in January 2022 at a nature preserve in southern England, bird-watcher Clare Jacobs observed a gray seal spitting a jet of water at a white-tailed eagle flying overhead. Seals had never been seen spitting before. Biologist Sean Twiss, who studies gray seals, believes that the seal may have been attempting to scare the eagle away from a food source or that the seal may have just been playing.",
    question: 'Which choice best states the main topic of the text?',
    options: [
      'A. Bird-watching in southern England',
      'B. A previously unseen behavior of gray seals',
      'C. How white-tailed eagles defend their territory against other predators',
      'D. Differences between gray seals and white-tailed eagles',
    ],
    answer: 'B',
    explanation: "B is correct. The sentence that carries the topic is 'Seals had never been seen spitting before.'\n\nA, C and D are all things the passage MENTIONS. That is what makes them attractive and what makes them wrong. A bird-watcher appears, an eagle appears, both animals appear — none of them is what the text is about.\n\nC is the sharpest trap: it echoes the last sentence's hypothesis about scaring the eagle off, so it feels like the ending. An idea can be in the final sentence and still not be the topic.",
  },
  {
    id: 'p11_rw_q09', source: 'Practice 11 · R&W Q9',
    skill: 'Inferences', difficulty: 'Easy',
    passage: "The following text is from Mark Haber's 2022 novel Saint Sebastian's Abyss. The narrator and Schmidt are both art critics.\n\nWhen my first wife admitted to Schmidt over dinner that she didn't find art, painting in particular, especially compelling, Schmidt winced, set down his fork, and sighed dramatically; he then excused himself, explaining an appointment he'd forgotten about had suddenly and inexplicably been remembered, while making it abundantly clear there was no appointment at all.",
    question: "Based on the text, what is notable about Schmidt's behavior?",
    options: [
      'A. Schmidt is only given to theatrical behavior when in the company of the narrator and his first wife.',
      "B. Schmidt's absentmindedness regarding his schedule is uncharacteristic of him.",
      "C. Schmidt's departure is occasioned by the resumption of a previous disagreement with the narrator's first wife about a particular painting.",
      'D. Schmidt conveys his feelings about one of his dining companions without explicitly stating them.',
    ],
    answer: 'D',
    explanation: "D is correct. Wince, fork down, dramatic sigh, an invented appointment he takes no trouble to make believable — every signal, no statement.\n\nA fails on one word: ONLY. The passage shows one dinner. It cannot tell you what Schmidt does elsewhere.\n\nB takes the appointment at face value. The passage says outright there was no appointment; nothing was forgotten.\n\nC invents a history. There is no previous disagreement and no particular painting in the text — she said she doesn't find painting compelling, which is the first we hear of it.",
  },
  {
    id: 'p11_rw_evelina', source: 'Practice 11 · R&W (Evelina)',
    skill: 'Inferences', difficulty: 'Medium',
    passage: "From Fanny Burney's 1778 novel Evelina. Lady Howard writes to Evelina's guardian, Reverend Villars, about a trip to London planned by her daughter Mrs. Mirvan's family.\n\nIt is very earnestly [the Mirvans'] wish to enlarge and enliven their party by the addition of your amiable ward, who would share, equally with her own daughter, the care and attention of Mrs. Mirvan. Do not start at this proposal; it is time that [Evelina] should see something of the world. When young people are too rigidly sequestered from it, their lively and romantic imaginations paint it to them as a paradise of which they have been beguiled; but when they are shown it properly, and in due time, they see it such as it really is, equally shared by pain and pleasure, hope and disappointment.",
    question: 'Based on the text, Lady Howard would most likely agree with which statement about Reverend Villars?',
    options: [
      'A. Although the manner in which he has raised Evelina is in many ways exemplary, he has been misguided in shielding her from the influence of other young people.',
      'B. He has imparted to Evelina his own idealistic view of the world, which results in her being unprepared to face inevitable disappointments.',
      'C. Although his desire to guard Evelina from unscrupulous people is commendable, his general mistrust has led him to be unduly wary of the Mirvans.',
      'D. He is overly protective of Evelina, who would likely benefit from a greater variety of experiences than she has had thus far.',
    ],
    answer: 'D',
    explanation: "D is correct. 'Do not start at this proposal; it is time that Evelina should see something of the world' is the whole argument — he has kept her in, and she would be better for going out.\n\nB reverses where the idealism comes from. Lady Howard says SEQUESTRATION makes young people imagine the world as a paradise. Villars didn't teach her that; keeping her in did.\n\nA imports 'other young people'. The passage is about seeing the world, not about company of her own age.\n\nC imports 'unscrupulous people' and a mistrust of the Mirvans. Neither appears. Lady Howard anticipates he will START at the proposal — that is not the same as saying he distrusts her family.",
  },
  {
    id: 'p11_rw_q12', source: 'Practice 11 · R&W Q12',
    skill: 'Command of Evidence — Textual', difficulty: 'Easy',
    passage: "Founded in 1965 and originally established as a cultural extension of the United Farm Workers—a union representing many Mexican American agricultural workers at the time—the theater troupe El Teatro Campesino has achieved recognition as a source of inspiration for subsequent Chicano theater companies and as a contributor to the dramatic arts. In an article about the company, a theater historian posits that a significant stylistic influence on El Teatro's early performances was the audience-mediated slapstick comedy of carpa theater, vaudeville-style shows popular in Mexico and the US Southwest in the 1920s and '30s.",
    question: "Which quotation from the article would best illustrate the theater historian's claim?",
    options: [
      'A. "The company presented actos, short comedy sketches, that often relied on exaggerated physical humor to groups of agricultural workers, whose reactions—enthusiastic cheers of appreciation and, occasionally, loud boos of disapproval—promoted improvisation."',
      'B. "The company was focused on the reality of the present situation and discovered that humor was often found in that reality; consequently, comedy became a tool to convey social critique while entertaining and inspiring audiences."',
      'C. "The company relied heavily on satire, humor, and references to contemporary popular culture as well as a make-do aesthetic—often referred to as rasquache—that reflected not only the troupe\'s limited financial resources but also its sociopolitical message."',
      'D. "The members of the company, which in addition to founder Luis Valdez consisted entirely of nonprofessional actors, traveled into farm fields, where they, with minimal props and costumes, performed comedy in the form of brief humorous vignettes."',
    ],
    answer: 'A',
    explanation: "The live word in the claim is AUDIENCE-MEDIATED. Underline it and three options die.\n\nA is the only quotation in which the audience does anything: their cheers and boos 'promoted improvisation' — the audience shaping the performance, which is what audience-mediated means. It also carries the slapstick ('exaggerated physical humor').\n\nB, C and D are all accurate, all about the company's comic style, and all silent on the audience. B is about social critique. C is about rasquache and resources. D is about nonprofessional actors and minimal props.\n\nThis is the test's most common trap and the reason for the rule: test each choice against the underline, cross out on the first failure, do not rank.",
  },
  {
    id: 'p11_rw_q13', source: 'Practice 11 · R&W Q13', partial: true,
    skill: 'Command of Evidence — Quantitative', difficulty: 'Easy',
    passage: "Fiber Characteristics of Mouflon, Navajo-Churro, and Spanish Merino Sheep\n\nType of sheep | Diameter of outer coat fibers (microns) | Diameter of inner coat fibers (microns)\nSpanish Merino | 19–24 | 17–21\nNavajo-Churro | 35 or higher | 10–35\nMouflon | 150 | 15\n\nDomestic sheep's wild ancestor, the mouflon, has a coarse outer coat and an inner coat of wool fiber that is finer in diameter and therefore much softer. In some domestic breeds, such as the Spanish Merino, the outer fiber is only marginally coarser than the inner, and the wool is soft overall. Thus, Merino wool is ideal for delicate garments worn against the skin. Meanwhile, the Navajo-Churro has been selected to retain the marked distinction between outer and inner fiber that the Merino has lost. Being coarser than Merino wool overall, Navajo-Churro wool yields a more durable yarn, which Diné (Navajo) weavers use in their celebrated rugs. Yet a comparison of the fiber characteristics of all three sheep reveals that ______",
    question: 'Which choice most effectively uses data from the table to complete the text?',
    options: [
      'A. the selection process that enabled the Navajo-Churro to retain its somewhat coarse outer fiber also resulted in inner fiber that, at its softest, is softer than either the mouflon\'s or the Merino\'s inner fiber.',
      'B. the Navajo-Churro more closely resembles its ancestor, the mouflon, in the uniform softness of its inner fiber, while the Merino more closely resembles the mouflon in the variable diameter of its outer fiber.',
      'C. [not captured]',
      'D. [not captured]',
    ],
    answer: 'A (inferred — C and D were not captured)',
    explanation: "The question turns on one phrase: AT ITS SOFTEST. Navajo-Churro inner fiber is a RANGE, 10–35. Its softest is 10 — finer than the mouflon's 15 and finer than the Merino's 17–21. So A holds.\n\nB inverts both halves. It is the MERINO whose inner fiber is uniform-ish and close to the mouflon in softness; and 'variable diameter of its outer fiber' describes the Navajo-Churro (35 or higher), not the Merino (19–24).\n\nThe habit: when a cell holds a range and the sentence holds a superlative — softest, largest, earliest — the answer is at one END of the range, not its middle.",
  },
  {
    id: 'p11_rw_q14', source: 'Practice 11 · R&W Q14',
    skill: 'Inferences', difficulty: 'Easy',
    passage: "Researchers Eugeni Vidal-Tortosa and Robin Lovelace looked at the relationship between street lighting in a city and people's willingness to ride a bicycle. Their results suggest that poor street lighting can deter new or inexperienced cyclists from riding in a city but has little effect on experienced cyclists. Therefore, increasing the number of streetlights in a city could potentially ______",
    question: 'Which choice most logically completes the text?',
    options: [
      'A. decrease the number of new or inexperienced cyclists riding in the city.',
      'B. increase the number of experienced cyclists riding in the city.',
      'C. decrease the number of experienced cyclists riding in the city.',
      'D. increase the number of new or inexperienced cyclists riding in the city.',
    ],
    answer: 'D',
    explanation: "Two axes, both stated in the passage. WHICH GROUP: new or inexperienced cyclists (experienced ones are 'little affected'). WHICH DIRECTION: poor lighting deters, so more lighting encourages.\n\nD is the only option that gets both right.\n\nA has the right group and the wrong direction. B and C both use the group the study says is unaffected — B moves it up, C moves it down, and the passage supports neither.\n\nNo outside knowledge is required here. Everything needed is in two clauses.",
  },
  {
    id: 'p11_rw_q15', source: 'Practice 11 · R&W Q15',
    skill: 'Inferences', difficulty: 'Easy',
    passage: "Outi Tervo and team studied the effect of human-caused noise on narwhals (Monodon monoceros), arctic marine mammals that are sensitive to acoustic changes in their environment. Hypothesizing that elevated sound levels affect foraging among narwhals, Tervo's team compared narwhal diving behaviors in natural sound conditions with those behaviors in two human-caused sound exposure conditions—ship sounds and ship sounds coupled with sonic pulses. Both exposure conditions resulted in significant decreases in the number and target depth of deep dives (associated with foraging) relative to natural conditions. However, differences between diving behaviors in the two exposure types were negligible, a finding that could be attributed to the fact that ______",
    question: 'Which choice most logically completes the text?',
    options: [
      'A. sonic pulses can be heard at significantly greater ocean depths than ship sounds can.',
      "B. ship sounds contribute so much to the overall sound level that the addition of sonic pulses has little effect on the narwhals' auditory environment.",
      'C. narwhals forage at shallower depths in the presence of ship sounds alone than in the presence of ship sounds coupled with sonic pulses.',
      "D. the narwhals weren't as sensitive to human-caused sounds as the researchers had predicted.",
    ],
    answer: 'B',
    explanation: "The blank has one job: explain why the two exposure types produced NEGLIGIBLE DIFFERENCE. Not why noise matters — why the two noises came out the same.\n\nB does exactly that: if ship sound already dominates, adding pulses changes little.\n\nA is a plausible sentence about underwater sound and explains nothing about the similarity. It is the 'true but not on-task' trap.\n\nC asserts a difference between the two conditions — the opposite of the finding.\n\nD contradicts the passage, which says BOTH conditions significantly decreased deep dives. They were sensitive.",
  },
  {
    id: 'p11_rw_bar', source: 'Practice 11 · R&W (animal drawings bar chart)', partial: true,
    skill: 'Command of Evidence — Quantitative', difficulty: 'Not captured',
    passage: "Percent of Drawings Containing an Example of Each Animal Group (bar chart)\nmammals ≈ 81% · birds ≈ 69% · insects ≈ 55%\n\n[Stem and options were not captured.]",
    question: '[Not captured]',
    options: [],
    answer: '[Not captured]',
    explanation: "Only the figure survives. What it supports: three categories, one quantity each, in a clear order — mammals > birds > insects.\n\nSo the answer to a question on this chart has to make a COMPARISON, and the trap will be an option that reports a single bar accurately without comparing anything, or that compares the wrong pair.\n\nThe habit to carry over: read the axis label and the units before the text. Here the axis is 'Percent of drawings' — so every number is a share of drawings, not a count of animals. An option that talks about how many animals were drawn is misreading the axis, however true it sounds.",
  },

  // ── Craft & Structure ──────────────────────────────────────────
  {
    id: 'p11_rw_garcia', source: 'Practice 11 · R&W (Scherezade García)',
    skill: 'Words in Context', difficulty: 'Medium',
    passage: "A casual description of Scherezade García's 2019 mural Blame It on the Bean: The Power of Coffee can make the work seem ______—a painting that is housed in a coffee shop and that depicts three women drinking coffee may not sound particularly ambitious—but in fact the work is a complex, dynamic meditation on gender and the legacy of colonialism that demands serious attention.",
    question: 'Which choice completes the text with the most logical and precise word or phrase?',
    options: ['A. unassuming', 'B. shrewd', 'C. incongruous', 'D. pretentious'],
    answer: 'A',
    explanation: "The sentence defines its own blank. Between the dashes: 'may not sound particularly ambitious'. After them: 'but in fact... demands serious attention'. So the blank means modest-seeming. That is unassuming.\n\nC is the trap worth naming. A colonialism mural hanging in a coffee shop IS incongruous — but that is something you know about the world, not something this sentence says. The sentence contrasts UNIMPRESSIVE with SERIOUS, not mismatched with fitting.\n\nD points the wrong way: pretentious means claiming too much, and the whole first half says the work seems to claim too little.\n\nB has nothing to attach to.",
  },
  {
    id: 'p11_rw_q04', source: 'Practice 11 · R&W Q4',
    skill: 'Words in Context', difficulty: 'Medium',
    passage: "Steiger Butte Drum, a family ensemble from the Klamath Tribes of the Pacific Northwest, collaborated with composer Michael Gordon to create Natural History, a work featuring traditional drumming and vocals alongside an orchestra and chorus. Steiger Butte Drum's participation is ______ to the piece: members not only contributed to its composition but also must be included in all performances.",
    question: 'Which choice completes the text with the most logical and precise word or phrase?',
    options: ['A. tangential', 'B. subsequent', 'C. analogous', 'D. integral'],
    answer: 'D',
    explanation: "The colon is the instruction. What follows it defines the blank: they helped write it AND must be in every performance. That is integral — essential, built in.\n\nA is the exact opposite. Tangential means beside the point.\n\nB and C describe relationships in time and likeness that the colon never mentions.\n\nSame structure as the García item: the definition is on the page. Two Words in Context misses on one test, both with the answer written into the sentence.",
  },
  {
    id: 'p11_rw_yellowstone', source: 'Practice 11 · R&W (Yellowstone wolves)',
    skill: 'Text Structure and Purpose', difficulty: 'Medium',
    passage: "Following the eradication of the gray wolf in Yellowstone National Park in 1926, the population of elk—a primary prey of the gray wolf—exceeded a healthy size for the park's ecosystem. Elk overpopulation led to overgrazing of areas that a multitude of other animals relied on for food and shelter. As scientists began to see how essential the gray wolf was to the Yellowstone food chain, ecological restoration strategies were employed to reintroduce the gray wolf to the park in 1996. The rebound effect in the park's natural ecosystem was noticed almost immediately.",
    question: 'Which choice best describes the overall structure of the text?',
    options: [
      'A. It summarizes a problem that developed in Yellowstone National Park in the 1920s and then offers potential solutions to that problem.',
      'B. It mentions the elimination of the gray wolf from Yellowstone National Park and then explains why the wolf was eventually restored to the park.',
      'C. It presents a claim about the health of the Yellowstone National Park gray wolf population and then gives specific examples to support that claim.',
      'D. It explains why Yellowstone National Park allowed the eradication of the gray wolf and then discusses the consequences of reintroducing the wolf to the park.',
    ],
    answer: 'B',
    explanation: "A structure option has two halves and BOTH have to be true. Check them separately.\n\nB: elimination mentioned (yes, first sentence), then why it was restored (yes — scientists saw the wolf was essential). Both hold.\n\nA: 'potential solutions'. The text describes a reintroduction that actually happened in 1996. Not potential.\n\nC: 'specific examples to support a claim'. The text tells a sequence of events, not a claim with examples.\n\nD: 'explains WHY the park allowed the eradication'. The text never says why. It only says it happened, in 1926.\n\nEvery wrong option here names a real essay shape and then attaches content the passage doesn't contain.",
  },
  {
    id: 'p11_rw_publicart', source: 'Practice 11 · R&W (public art, Text 1 / Text 2)',
    skill: 'Cross-Text Connections', difficulty: 'Medium',
    passage: "Text 1: Good art often challenges and disrupts social and aesthetic norms, but the creation of public art—paintings, sculptures, and performance pieces displayed in nonmuseum or nontheatrical public settings—typically requires broad agreement among artists, civic officials, and community members about the works' message and artistic goals. [UNDERLINED] Public art that fails to appease everyone by being sufficiently aesthetically and conceptually bland almost inevitably provokes backlash.\n\nText 2: Public art is commonly displayed in spaces intended for purposes other than meaningful aesthetic engagement. Some critics of public art therefore note that norm-defying pieces that aren't effectively integrated within their surroundings in a manner that primes passersby to appreciate the pieces' merits (as is often the case) tend to be regarded more unfavorably than similarly provocative art encountered in museums.",
    question: 'Based on the texts, how would the critics mentioned in Text 2 most likely respond to the underlined claim in Text 1?',
    options: [
      "A. By arguing that the reason members of the general public might disagree about a public artwork's merits is unrelated to the unconventionality of its appearance and ideas",
      'B. By agreeing with the idea that only works of art that are universally appealing are suitable for displaying in public spaces',
      'C. By disputing the notion that civic leaders and community members are easily placated by art that is intended mainly to reinforce social norms',
      "D. By contending that the kinds of reactions controversial public artworks often receive aren't exclusively the result of attributes inherent in the works themselves",
    ],
    answer: 'D',
    explanation: "Pin the underlined claim first: bold public art provokes backlash because it is bold. Text 2 adds a second cause — the SETTING. Provocative art in a museum fares better than the same art badly integrated into a public space.\n\nD says exactly that: the reaction isn't exclusively about the work itself.\n\nA overstates it into an absolute. 'Unrelated to the unconventionality' — Text 2 never denies the boldness matters; it says it isn't the only thing that matters. One word, 'unrelated', makes the option too strong.\n\nB is a misreading of the critics, who describe how art is received, not what is suitable.\n\nC disputes a claim Text 1 never made.",
  },

  // ── Expression of Ideas ────────────────────────────────────────
  {
    id: 'p11_rw_q23', source: 'Practice 11 · R&W Q23',
    skill: 'Transitions', difficulty: 'Medium',
    passage: "Long thought to be sessile (immobile), adult Chelonibia testudinaria, barnacles that adhere to sea turtle shells, have been observed to shift slightly in position over time—a phenomenon that has been attributed to the barnacles' passive displacement by water currents. ______ a research team found that adult C. testudinaria moved toward the heads of their sea turtle hosts and thus against the prevailing water flow, behavior consistent with self-initiated locomotion.",
    question: 'Which choice completes the text with the most logical transition?',
    options: ['A. Contrary to this phenomenon,', 'B. Undermining this explanation,', 'C. Drawing a similar conclusion,', 'D. Confirming this hypothesis,'],
    answer: 'B',
    explanation: "Two things are in the first sentence and they are not the same thing. The PHENOMENON: barnacles shift position. The EXPLANATION: water currents push them. The new finding — they move AGAINST the flow — leaves the phenomenon intact and destroys the explanation.\n\nB targets the explanation. Correct.\n\nA is the trap, and it is a good one. It gets the direction right — something is being contradicted — and attaches it to the wrong noun. The phenomenon is not contradicted; the barnacles really do move.\n\nC and D reverse the direction outright.\n\nThe habit: before choosing a contrast transition, say out loud WHAT is being contrasted with WHAT.",
  },
  {
    id: 'p11_rw_q25', source: 'Practice 11 · R&W Q25',
    skill: 'Transitions', difficulty: 'Medium',
    passage: "A staunch supporter of women's voting rights, Wilhelmina Kekelaokalaninui Widemann Dowsett sought to coordinate the efforts of suffragists in her native Hawai'i. ______ in 1912, she founded the National Women's Equal Suffrage Association of Hawai'i, an organization that lobbied for women's voting rights in the US territory.",
    question: 'Which choice completes the text with the most logical transition?',
    options: ['A. In other words,', 'B. Conversely,', 'C. To that end,', 'D. Alternatively,'],
    answer: 'C',
    explanation: "'Sought to coordinate' states a GOAL. Founding the association is how she pursued it. Goal, then means — that relationship is 'to that end'.\n\nA claims the second sentence restates the first. It doesn't; it reports a different, later action.\n\nB and D both signal opposition or an alternative. Nothing here opposes anything.\n\nThis miss is not about direction. It is about naming the relationship: purpose and means, rather than contrast, restatement or result. Name the relationship first, then pick the word.",
  },
  {
    id: 'p11_rw_q27', source: 'Practice 11 · R&W Q27',
    skill: 'Rhetorical Synthesis', difficulty: 'Medium',
    passage: "While researching a topic, a student has taken the following notes:\n• Pedestrian malls are outdoor streets in a city or town where vehicle traffic is prohibited.\n• Many pedestrian malls were built in the 19th and 20th centuries in Europe and Asia.\n• Qianmen Dajie is a famous pedestrian mall in Beijing.\n• It has existed since the Ming dynasty (1368–1644 CE).\n• Rue Mouffetard is a famous pedestrian mall in Paris.\n• It has existed since the mid-Roman Empire (117–235 CE).",
    question: 'The student wants to emphasize a similarity between the ages of the malls. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
    options: [
      'A. The Qianmen Dajie pedestrian mall has roots as far back as the Ming dynasty; likewise, Rue Mouffetard has existed for centuries.',
      'B. Both Qianmen Dajie and Rue Mouffetard are famous pedestrian malls, the former in Beijing and the latter in Paris.',
      'C. Qianmen Dajie and Rue Mouffetard are pedestrian malls, outdoor streets closed to vehicle traffic.',
      'D. Qianmen Dajie and Rue Mouffetard are examples of pedestrian malls, which proliferated in Europe in the 19th and 20th centuries.',
    ],
    answer: 'A',
    explanation: "Read the goal before the notes: a similarity between the AGES. Age is the only thing that counts.\n\nA compares ages and marks the similarity with 'likewise'. Done.\n\nB compares LOCATIONS — Beijing and Paris. A real similarity, the wrong one.\n\nC defines what a pedestrian mall is. True, off-task.\n\nD dates the malls generally but says nothing about these two being comparably old — and it is wrong besides, since both predate the 19th century.\n\nEvery option uses real notes. On this question type, being accurate is never the test. Serving the stated goal is.",
  },

  // ── Standard English Conventions ───────────────────────────────
  {
    id: 'p11_rw_q17', source: 'Practice 11 · R&W Q17',
    skill: 'Form, Structure, and Sense', difficulty: 'Hard', ruleType: 'VTense',
    passage: "Following her debut album release in 2002, Mexican singer-songwriter Natalia Lafourcade quickly shot to fame. By 2023, she ______ one of the most celebrated musicians in Latin America, having released twelve albums and won seventeen Latin Grammy awards—more than any other female artist in history.",
    question: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: ['A. will become', 'B. becomes', 'C. will have become', 'D. had become'],
    answer: 'D',
    explanation: "Find the time anchor before you read a single option. It is 'By 2023' — a point in the past, and the sentence describes something completed before it.\n\nOne past event finished before another past point takes the past perfect: HAD + past participle. D.\n\nA and C are future forms. They only look right if the anchor was never located — and this is exactly why the anchor comes first.\n\nB is present tense, which cannot describe a state reached by a past date.\n\nThe rule is short and it is worth memorising: 'by [past year]' + a completed action = had.",
  },

];
