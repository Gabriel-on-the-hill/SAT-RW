// ─────────────────────────────────────────────────────────────────
// data-challenge-jeffrey-p8.js
//
// Jeffrey's incorrect R&W questions from SAT Practice 8 (4 July 2026),
// transcribed from the Bluebook export in
// "Jeffrey Ejike/Bluebook Incorrect answers for June SAT 8".
//
// This is LAYER 1 of the Challenge module: the debrief. It is UNSCORED —
// these ids exist in no question bank, so they are never part of the
// "Mastered N of M" denominator. Referenced from challenge/sets.js as the
// optional `review` payload of Jeffrey's `p8-rw` set.
//
// ── What is here, and what is not ────────────────────────────────
//
//  • 16 questions. The score report records 23 R&W incorrect answers, so
//    the export is incomplete. The 7 absent misses are almost certainly
//    Information & Ideas — its Knowledge-and-Skills bar reads 2/7 while
//    Standard English Conventions, at 5/7, accounts for 6 of the 16 here.
//    The challenge set's domain quotas are sized from those bars rather
//    than from these counts, so the gap does not skew the drill.
//
//  • No `difficulty` field. The Bluebook export does not carry difficulty.
//    Earlier revisions of this file guessed it from question position and
//    stated it as fact. Those guesses are removed rather than frozen: the
//    generator never seeds on difficulty, and nothing should.
//
//  • No Math. Q21 and Q22 (Problem-Solving and Data Analysis) were dropped.
//    This app has no math bank, and their skill has no entry in SKILL_DOMAIN
//    or SKILL_ABBR. They are already covered next door: Michael SAT's
//    Challenge_App seeds Jeffrey on mean / median / histogram.
//
// ── Corrections, 10 July 2026 ────────────────────────────────────
// Three items were mis-keyed on transcription and are fixed here. Each was
// verified against the original screenshot. See the shortlist for details.
//   Q17  answer D → C ("emerged:").   ruleType Commas → Colon.
//   Q20  answer C → A ("varied:").    ruleType Commas → Colon.
//   Q19b answer A → C ("works,").     skill Form/Structure/Sense → Boundaries,
//        ruleType VTense → Commas. The sentence already has its main verb.
// ─────────────────────────────────────────────────────────────────

const CHALLENGE_P8 = [

  // ── WORDS IN CONTEXT ────────────────────────────────────────────

  {
    id: 'p8_rw_q03',
    source: 'Practice 8 · R&W Q3',
    skill: 'Words in Context',
    passage: 'The author\'s claim about the relationship between Neanderthals and Homo sapiens is ______, as it fails to account for several recent archaeological discoveries. To be convincing, his argument would need to address recent finds of additional hominid fossils, such as the latest Denisovan specimens and Homo longi.',
    question: 'Which choice completes the text with the most logical and precise word or phrase?',
    options: [
      'A. disorienting',
      'B. tenuous',
      'C. nuanced',
      'D. unoriginal',
    ],
    answer: 'B',
    explanation: 'Choice B is correct. "Tenuous" means weak or not firmly supported by evidence — exactly what the sentence describes: the claim "fails to account for several recent archaeological discoveries," making it poorly supported. The argument is not disorienting (A), which would mean it confuses people, rather than being evidentially weak. It is not nuanced (C) — a nuanced argument accounts for complexity; this one ignores evidence. It is not unoriginal (D) — lack of originality has nothing to do with ignoring discoveries.',
    strategy: 'Contrast Logic',
  },

  {
    id: 'p8_rw_q04',
    source: 'Practice 8 · R&W Q4',
    skill: 'Words in Context',
    passage: 'Diego Velázquez was the leading artist in the court of King Philip IV of Spain during the seventeenth century, but his influence was hardly ______ Spain: realist and impressionist painters around the world employed his techniques and echoed elements of his style.',
    question: 'Which choice completes the text with the most logical and precise word or phrase?',
    options: [
      'A. derived from',
      'B. recognized in',
      'C. confined to',
      'D. repressed by',
    ],
    answer: 'C',
    explanation: 'Choice C is correct. The sentence sets up a contrast with "but": Velázquez worked in Spain, yet his influence was NOT limited to Spain — painters "around the world" followed his style. "Confined to" means restricted to or limited to, which fits perfectly. "Derived from" (A) would mean his influence did not originate from Spain — but it did. "Recognized in" (B) would say he was "hardly recognized in Spain," which contradicts his role as the leading royal court artist. "Repressed by" (D) makes no sense in context.',
    strategy: 'Contrast Logic',
  },

  // ── TEXT STRUCTURE AND PURPOSE ───────────────────────────────────

  {
    id: 'p8_rw_q05',
    source: 'Practice 8 · R&W Q5',
    skill: 'Text Structure and Purpose',
    passage: 'The following text is adapted from Zora Neale Hurston\'s 1921 short story "John Redding Goes to Sea." John is a child who lives in a town in the woods.\n\n    Perhaps ten-year-old John was puzzling to the folk there in the Florida woods for he was an imaginative child and fond of day-dreams. The St. John River flowed a scarce three hundred feet from his back door. On its banks at this point grow numerous palms, luxuriant magnolias and bay trees. On the bosom of the stream float millions of delicately colored hyacinths. [John Redding] loved to wander down to the water\'s edge, and, casting in dry twigs, watch them sail away down stream to Jacksonville, the sea, the wide world and [he] wanted to follow them.',
    question: 'Which choice best describes the function of the underlined sentence in the text as a whole?',
    options: [
      'A. It provides an extended description of a location that John likes to visit.',
      'B. It reveals that some residents of John\'s town are confused by his behavior.',
      'C. It illustrates the uniqueness of John\'s imagination compared to the imaginations of other children.',
      'D. It suggests that John longs to experience a larger life outside the Florida woods.',
    ],
    answer: 'D',
    explanation: 'Choice D is correct. The underlined sentence shows John watching twigs drift downstream toward "Jacksonville, the sea, the wide world" and wanting to follow them — he dreams of escaping his small town for a bigger existence. This is the function of the sentence in the passage: it reveals his longing for adventure beyond the Florida woods. Choice A is wrong — the sentence is about John\'s desire, not a description of the river location (that comes in the preceding sentences). Choice B is wrong — residents being confused by John is mentioned earlier; the underlined sentence is about John\'s own feelings. Choice C is wrong — no other children are mentioned in the underlined sentence.',
    strategy: 'Function in Context',
  },

  // ── CROSS-TEXT CONNECTIONS ───────────────────────────────────────

  {
    id: 'p8_rw_ctc',
    source: 'Practice 8 · R&W (Cross-Text)',
    skill: 'Cross-Text Connections',
    passage: 'Text 1\n\nWhen companies in the same industry propose merging with one another, they often claim that the merger will benefit consumers by increasing efficiency and therefore lowering prices. Economist Ying Fan investigated this notion in the context of the United States newspaper market. She modeled a hypothetical merger of Minneapolis-area newspapers and found that subscription prices would rise following a merger.\n\nText 2\n\nEconomists Dario Focarelli and Fabio Panetta have argued that research on the effect of mergers on prices has focused excessively on short-term effects, which tend to be adverse for consumers. Using the case of consumer banking in Italy, they show that over the long term (several years, in their study), the efficiency gains realized by merged companies do result in economic benefits for consumers.',
    question: 'Based on the texts, how would Focarelli and Panetta (Text 2) most likely respond to Fan\'s findings (Text 1)?',
    options: [
      'A. They would recommend that Fan compare the near-term effect of a merger on subscription prices in the Minneapolis area with the effect of a merger in another newspaper market.',
      'B. They would argue that over the long term the expenses incurred by the merged newspaper company will also increase.',
      'C. They would encourage Fan to investigate whether the projected effect on subscription prices persists over an extended period.',
      'D. They would claim that mergers have a different effect on consumer prices in the newspaper industry than in most other industries.',
    ],
    answer: 'C',
    explanation: 'Choice C is correct. Focarelli and Panetta\'s central argument is that research on mergers focuses too much on short-term effects, which tend to hurt consumers, while long-term effects can be beneficial. Fan\'s study modeled short-term subscription price increases. Focarelli and Panetta would naturally push back by saying: you need to look at the long term, not just the short term. Choice C captures exactly that — they would encourage her to investigate whether the price increase persists over a longer period. Choice A is wrong — Focarelli and Panetta\'s point is about time horizon (short vs. long term), not about comparing geographic markets. Choice B is wrong — they would not argue that expenses also increase long-term; their argument is that long-term efficiency gains benefit consumers. Choice D is wrong — they do not claim newspapers are uniquely different; their argument applies to mergers in general.',
    strategy: 'Author Response',
  },

  // ── COMMAND OF EVIDENCE — TEXTUAL ───────────────────────────────

  {
    id: 'p8_rw_q11',
    source: 'Practice 8 · R&W Q11',
    skill: 'Command of Evidence — Textual',
    passage: 'In a research paper, a student criticizes some historians of modern African politics, claiming that they have evaluated Patrice Lumumba, the first prime minister of what is now the Democratic Republic of the Congo, primarily as a symbol rather than in terms of his actions.',
    question: 'Which quotation from a work by a historian would best illustrate the student\'s claim?',
    options: [
      'A. "Lumumba is a difficult figure to evaluate due to the starkly conflicting opinions he inspired during his life and continues to inspire today."',
      'B. "The available information makes it clear that Lumumba\'s political beliefs and values were largely consistent throughout his career."',
      'C. "Lumumba\'s practical accomplishments can be passed over quickly; it is mainly as the personification of Congolese independence that he warrants scholarly attention."',
      'D. "Many questions remain about Lumumba\'s ultimate vision for an independent Congo; without new evidence coming to light, these questions are likely to remain unanswered."',
    ],
    answer: 'C',
    explanation: 'Choice C is correct. The student\'s claim is that historians evaluate Lumumba as a symbol rather than in terms of his actions. Choice C directly shows a historian doing exactly that — dismissing his "practical accomplishments" as passable and saying it is mainly his symbolic role ("personification of Congolese independence") that matters. This is a textbook example of prioritizing symbolism over actions. Choice A is wrong — conflicting opinions about Lumumba say nothing about whether historians focus on his symbol vs. his actions. Choice B is wrong — noting consistency in his beliefs talks about his character/ideology, not the symbol-vs-action distinction. Choice D is wrong — saying questions remain unanswered is about gaps in knowledge, not about treating him as a symbol.',
    strategy: 'Quotation Match',
  },

  {
    id: 'p8_rw_q12',
    source: 'Practice 8 · R&W Q12',
    skill: 'Command of Evidence — Textual',
    passage: 'Researchers hypothesized that a decline in the population of dusky sharks near the mid-Atlantic coast of North America led to a decline in the population of eastern oysters in the region. Dusky sharks do not typically consume eastern oysters but do consume cownose rays, which are the main predators of the oysters.',
    question: 'Which finding, if true, would most directly support the researchers\' hypothesis?',
    options: [
      'A. Declines in the regional abundance of dusky sharks\' prey other than cownose rays are associated with regional declines in dusky shark abundance.',
      'B. Eastern oyster abundance tends to be greater in areas with both dusky sharks and cownose rays than in areas with only dusky sharks.',
      'C. Consumption of eastern oysters by cownose rays in the region substantially increased before the regional decline in dusky shark abundance began.',
      'D. Cownose rays have increased in regional abundance as dusky sharks have decreased in regional abundance.',
    ],
    answer: 'D',
    explanation: 'Choice D is correct. The hypothesis chain is: fewer dusky sharks → fewer cownose rays eaten → more cownose rays → more oysters eaten → fewer oysters. For this chain to work, you need evidence that cownose rays increased when sharks decreased. Choice D provides exactly that link. Choice A is wrong — it\'s about other prey of dusky sharks, which is irrelevant to the oyster chain. Choice B is wrong — it actually goes against the hypothesis: if oysters are MORE abundant where BOTH sharks AND cownose rays are present, that suggests cownose rays don\'t reduce oyster populations. Choice C is wrong — if cownose rays increased oyster consumption BEFORE shark decline, that breaks the causal chain the hypothesis depends on.',
    strategy: 'Support Check',
  },

  // ── INFERENCES ──────────────────────────────────────────────────

  {
    id: 'p8_rw_q13',
    source: 'Practice 8 · R&W Q13',
    skill: 'Inferences',
    passage: 'The musical Hadestown was produced off-Broadway in New York in 2016. A revised version of the musical premiered on Broadway in 2019, in a larger production. In a review of the Broadway production, theater critic Jesse Green enthusiastically praised the musical\'s storytelling. However, Green also explained that he had seen the earlier version of Hadestown in 2016 and had found the storytelling to be very confusing. This suggests that in Green\'s view, ______',
    question: 'Which choice most logically completes the text?',
    options: [
      'A. the 2016 version of Hadestown had fewer storytelling problems than the 2019 version did.',
      'B. Hadestown should have had a larger production in 2019 than it actually did.',
      'C. the 2019 version of Hadestown was less enjoyable than the 2016 version.',
      'D. Hadestown improved greatly between 2016 and its premiere on Broadway.',
    ],
    answer: 'D',
    explanation: 'Choice D is correct. Green found the 2016 version "very confusing" in its storytelling, but "enthusiastically praised" the 2019 Broadway production\'s storytelling. The only logical conclusion: something changed for the better between 2016 and 2019 — the show improved. Choice A is wrong — it reverses the judgment: Green found 2016 confusing and 2019 excellent, not the other way around. Choice B is wrong — production size is never mentioned as the issue; storytelling quality is. Choice C is wrong — this also reverses what Green actually said.',
    strategy: 'Logical Completion',
  },

  {
    id: 'p8_rw_q14',
    source: 'Practice 8 · R&W Q14',
    skill: 'Inferences',
    passage: 'If some artifacts recovered from excavations of the settlement of Kuulo Kataa, in modern Ghana, date from the thirteenth century CE, that may lend credence to claims that the settlement was founded before or around that time. There is other evidence, however, strongly supporting a fourteenth century CE founding date for Kuulo Kataa. If both the artifact dates and the fourteenth century CE founding date are correct, that would imply that ______',
    question: 'Which choice most logically completes the text?',
    options: [
      'A. artifacts from the fourteenth century CE are more commonly recovered than are artifacts from the thirteenth century CE.',
      'B. the artifacts originated elsewhere and eventually reached Kuulo Kataa through trade or migration.',
      'C. Kuulo Kataa was founded by people from a different region than had previously been assumed.',
      'D. excavations at Kuulo Kataa may have inadvertently damaged some artifacts dating to the fourteenth century CE.',
    ],
    answer: 'B',
    explanation: 'Choice B is correct. The puzzle: the settlement was founded in the fourteenth century CE, but artifacts date to the thirteenth century CE — before the settlement existed. If both facts are true simultaneously, the only logical resolution is that the thirteenth-century artifacts did not originate there. They must have come from somewhere else — brought by trade or migration. Choice A is wrong — it talks about fourteenth-century artifacts being more common; this doesn\'t resolve the contradiction of pre-founding artifacts being present. Choice C is wrong — founding origins don\'t explain how thirteenth-century artifacts predate the fourteenth-century founding. Choice D is wrong — damage to fourteenth-century artifacts doesn\'t explain how thirteenth-century artifacts are present at a fourteenth-century site.',
    strategy: 'Logical Completion',
  },

  {
    id: 'p8_rw_q15',
    source: 'Practice 8 · R&W Q15',
    skill: 'Inferences',
    passage: 'Birds of many species ingest foods containing carotenoids, pigmented molecules that are converted into feather coloration. Coloration tends to be especially saturated in male birds\' feathers, and because carotenoids also confer health benefits, the deeply saturated colors generally serve to communicate what is known as an honest signal of a bird\'s overall fitness to potential mates. However, ornithologist Allison J. Shultz and others have found that males in several species of the tanager genus Ramphocelus use microstructures in their feathers to manipulate light, creating the appearance of deeper saturation without the birds necessarily having to maintain a carotenoid-rich diet. These findings suggest that ______',
    question: 'Which choice most logically completes the text?',
    options: [
      'A. individual male tanagers can engage in honest signaling without relying on carotenoid consumption.',
      'B. feather microstructures may be less effective than deeply saturated feathers for signaling overall fitness.',
      'C. scientists have yet to determine why tanagers have a preference for mates with colorful appearances.',
      'D. a male tanager\'s appearance may function as a dishonest signal of the individual\'s overall fitness.',
    ],
    answer: 'D',
    explanation: 'Choice D is correct. Deep feather coloration is supposed to be an "honest signal" because it requires a carotenoid-rich diet, which reflects true health. But these tanagers fake the appearance of deep color using feather microstructures — without the actual carotenoid-rich diet. That means the visual signal (appears healthy/fit) no longer matches the underlying reality (no carotenoid consumption required). The signal becomes dishonest. Choice A is wrong — it says they can engage in HONEST signaling without carotenoids, but faking color saturation is the opposite of honest signaling. Choice B is wrong — the passage says microstructures CREATE the appearance of deep saturation, not that they are less effective. Choice C is wrong — the passage is about how the signal is produced, not about mate preference research gaps.',
    strategy: 'Logical Completion',
  },

  // ── RHETORICAL SYNTHESIS ─────────────────────────────────────────

  {
    id: 'p8_rw_q25',
    source: 'Practice 8 · R&W Q25',
    skill: 'Rhetorical Synthesis',
    passage: 'While researching a topic, a student has taken the following notes:\n• Malapportionment is the over- or underrepresentation (relative to population size) of electoral districts in a governing body.\n• It is a common feature of representative governments.\n• There are 169 seats in Norway\'s supreme legislature (the Storting).\n• Seats are distributed by a formula that awards 1 point per resident and 1.8 points per unit of land.\n• Less populated rural districts with large tracts of land receive a disproportionate number of seats compared to smaller but more populated urban districts.\n\nThe student wants to refute a claim that malapportionment in the Storting favors small urban districts.',
    question: 'Which choice most effectively uses relevant information from the notes to accomplish this goal?',
    options: [
      'A. Less populated rural districts are disproportionally underrepresented in the Storting, creating an unfair advantage for smaller but more populated urban districts.',
      'B. It\'s untrue that malapportionment in the 169-seat Storting favors small urban districts; rather, the formula for distributing seats overrepresents more populated districts.',
      'C. A common feature of representative governments, malapportionment occurs when electoral districts are over- or underrepresented.',
      'D. Awarding more points per unit of land than points per resident, the formula for distributing Storting seats overrepresents less populated rural districts with large tracts of land.',
    ],
    answer: 'D',
    explanation: 'Choice D is correct. The goal is to REFUTE the claim that the Storting favors small urban districts. The notes say the formula awards 1.8 points per unit of land vs. 1 point per resident, meaning land-heavy rural districts get more seats — the opposite of what the claim says. Choice D directly uses this mechanism to refute: it names the formula, its land-heavy weighting, and concludes that RURAL districts are overrepresented. Choice A is wrong — it actually says the opposite of what the notes say (notes say rural districts get MORE seats, not fewer). Choice B is wrong — it says the formula overrepresents "more populated districts," which is the opposite of what the notes say (less populated rural districts are overrepresented). Choice C is wrong — it only defines malapportionment; it doesn\'t engage with the specific claim about the Storting at all.',
    strategy: 'Goal Match',
  },

  // ── BOUNDARIES ──────────────────────────────────────────────────

  {
    id: 'p8_rw_q17',
    source: 'Practice 8 · R&W Q17',
    skill: 'Boundaries',
    passage: 'As cheesemaking practices spread throughout Europe and Asia during and after the Neolithic, divergent strategies for preserving milk ______ whereas rennet-coagulated cheesemaking became key to milk preservation in Europe and Southwest Asia, acid-heat coagulation methods became common among nomadic herding populations of the northeastern Eurasian steppe.',
    question: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      'A. emerged',
      'B. emerged and',
      'C. emerged:',
      'D. emerged,',
    ],
    answer: 'C',
    explanation: 'Choice C is correct. Split the sentence at the blank and test each side. Before it: "As cheesemaking practices spread throughout Europe and Asia during and after the Neolithic, divergent strategies for preserving milk emerged" — a complete sentence. After it: "whereas rennet-coagulated cheesemaking became key to milk preservation in Europe and Southwest Asia, acid-heat coagulation methods became common among nomadic herding populations of the northeastern Eurasian steppe" — also a complete sentence, in which the "whereas" clause attaches to "acid-heat coagulation methods became common." A colon is the mark that follows a complete sentence and introduces a second one that explains or specifies it, and that is exactly the relationship here: the second half spells out what the divergent strategies were.\n\nChoice D is the trap, and it is the one worth understanding. "Whereas" usually takes a comma in front of it, so "emerged, whereas" looks right. But the "whereas" clause belongs to the sentence that follows, not to "strategies emerged." Read the whole thing through: "strategies emerged, whereas A became key..., B became common..." leaves "acid-heat coagulation methods became common" as a second complete sentence joined to the first by nothing but a comma. That is a comma splice.\n\nChoice A runs the two halves together with no punctuation at all. Choice B stacks the coordinating conjunction "and" on top of the subordinating "whereas."\n\nWatch for: picking the punctuation from the word that follows it ("whereas takes a comma") instead of from what sits on either side of the blank. Test both sides first.',
    strategy: 'The Decision Flowchart',
    ruleType: 'Colon',
  },

  {
    id: 'p8_rw_q19a',
    source: 'Practice 8 · R&W Q19 (Gil Scott-Heron)',
    skill: 'Boundaries',
    passage: 'Journalists have dubbed Gil Scott-Heron the "godfather of rap," a title that has appeared in hundreds of articles about him since the 1990s. Scott-Heron himself resisted the godfather ______ feeling that it didn\'t encapsulate his devotion to the broader African American blues music tradition as well as "bluesologist," the moniker he preferred.',
    question: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      'A. nickname, however',
      'B. nickname, however;',
      'C. nickname, however,',
      'D. nickname; however,',
    ],
    answer: 'C',
    explanation: 'Choice C is correct. "However" here is a transitional adverb (interrupter) that contrasts with the previous sentence. When an adverb like "however" interrupts mid-sentence, it must be set off by commas on BOTH sides: "resisted the godfather nickname, however, feeling that..." Choice A is wrong — missing the comma AFTER "however." Choice B is wrong — "however;" with a semicolon after it would cut the sentence in two, but "feeling that..." is not an independent clause on its own. Choice D is wrong — "nickname; however," treats everything before the semicolon as a complete independent clause, but "Scott-Heron himself resisted the godfather nickname" ends abruptly; the participial phrase "feeling that..." must stay attached to the main clause.',
    strategy: 'Interrupter Punctuation',
    ruleType: 'Commas',
  },

  {
    id: 'p8_rw_q20',
    source: 'Practice 8 · R&W Q20',
    skill: 'Boundaries',
    passage: 'Over twenty years ago, in a landmark experiment in the psychology of choice, professor Sheena Iyengar set up a jam-tasting booth at a grocery store. The number of jams available for tasting ______ some shoppers had twenty-four different options, others only six. Interestingly, the shoppers with fewer jams to choose from purchased more jam.',
    question: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      'A. varied:',
      'B. varied,',
      'C. varied, while',
      'D. varied while',
    ],
    answer: 'A',
    explanation: 'Choice A is correct. Test each side of the blank. Before it: "The number of jams available for tasting varied" — a complete sentence. After it: "some shoppers had twenty-four different options, others only six" — an explanation of how it varied. A colon follows a complete sentence and introduces the explanation of it. Note that "others only six" is elliptical: the verb is understood ("others [had] only six"). That is standard, and it is not a comma splice.\n\nChoice C is the trap. "While" signals contrast, and the two groups of shoppers do differ, so "varied, while some shoppers had twenty-four different options" reads plausibly — right up until "others only six," which is then stranded with nothing to attach to. The sentence is elaborating, not contrasting: it tells you what "varied" means.\n\nChoice B joins a complete sentence to its own explanation with a comma alone, which is a comma splice. Choice D is Choice C without the comma, and strands the ending the same way.\n\nWatch for: reading the relationship as contrast when it is specification. Name the relationship before you choose the mark.',
    strategy: 'The Decision Flowchart',
    ruleType: 'Colon',
  },

  {
    id: 'p8_rw_q19b',
    source: 'Practice 8 · R&W Q19 (John Donne)',
    skill: 'Boundaries',
    passage: 'English poet and Shakespeare contemporary John Donne\'s ______ much admired during his lifetime (1572–1631) and in the decades that followed, had, at the time of their enthusiastic rediscovery by the early twentieth-century modernists, been essentially gathering dust for the intervening 250 years.',
    question: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      'A. works were',
      'B. works, were',
      'C. works,',
      'D. works had been',
    ],
    answer: 'C',
    explanation: 'Choice C is correct, and the first move is to notice that this is a punctuation question, not a verb question. The sentence already has its main verb: "had ... been essentially gathering dust." Its subject can only be "works" — note the plural "their ... rediscovery" further along. So the blank must not supply a second verb. It has to open a supplement.\n\nThe decisive clue is a comma the sentence already prints for you, just after "followed": "... and in the decades that followed, had, at the time of ...". A nonessential description is fenced by a comma on each side. The closing comma is there on the page; the blank supplies the opening one. Lift the supplement out and the skeleton stands on its own: "John Donne\'s works ... had ... been essentially gathering dust for the intervening 250 years."\n\nChoice A is the trap. "Works were much admired" is a perfectly good clause, so it feels right — but it leaves "were much admired" and "had been gathering dust" as two finite verbs with no conjunction between them. Choice D does the same thing with "had been ... had ... been." Choice B drops a comma between the subject and its verb.\n\nWatch for: supplying a verb where the sentence already has one. Find the main verb first, then decide what the blank is actually for.',
    strategy: 'Supplement Punctuation',
    ruleType: 'Commas',
  },

  // ── FORM, STRUCTURE, AND SENSE ───────────────────────────────────

  {
    id: 'p8_rw_q16',
    source: 'Practice 8 · R&W Q16',
    skill: 'Form, Structure, and Sense',
    passage: 'Formed in 1967 to foster political and economic stability within the Asia-Pacific region, the Association of Southeast Asian Nations was originally made up of five members: Thailand, the Philippines, Singapore, Malaysia, and Indonesia. By the end of the 1990s, the organization ______ its initial membership.',
    question: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      'A. has doubled',
      'B. had doubled',
      'C. doubles',
      'D. will double',
    ],
    answer: 'B',
    explanation: 'Choice B is correct. "By the end of the 1990s" signals a completed action in the past — specifically, an action completed before another past reference point. This requires the past perfect tense: "had doubled." Choice A is wrong — "has doubled" is present perfect, implying the action continues into the present, but "by the end of the 1990s" anchors it in the past. Choice C is wrong — "doubles" is simple present, which doesn\'t fit the past time frame. Choice D is wrong — "will double" is future tense, which contradicts "by the end of the 1990s" (a past event).',
    strategy: 'Tense Logic',
    ruleType: 'VTense',
  },

  {
    id: 'p8_rw_q18',
    source: 'Practice 8 · R&W Q18',
    skill: 'Form, Structure, and Sense',
    passage: 'Walt Whitman\'s Leaves of Grass first appeared in 1855 as a slim collection of twelve poems, but Whitman would revise and expand it substantially over the next four decades. These extensive ______ the addition of hundreds of new poems, the removal of some existing ones, and the insertion of prefatory material, reflected the poet\'s evolving literary perspective and experience of the US Civil War.',
    question: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      'A. changes, including',
      'B. changes would include',
      'C. changes included',
      'D. changes, include',
    ],
    answer: 'A',
    explanation: 'Choice A is correct. The sentence needs a subject ("changes") and a main verb ("reflected"). "Including the addition of...the removal of...and the insertion of..." is a participial phrase that lists examples of the changes, set off by commas on both sides. The full structure is: "These extensive changes, including [list], reflected the poet\'s evolving perspective." Choice B is wrong — "changes would include... reflected" gives two finite verbs without a conjunction, creating a grammatical conflict. Choice C is wrong — "changes included [list], reflected" also gives two finite verbs ("included" and "reflected") without a coordinating conjunction; this creates a run-on. Choice D is wrong — "changes, include" creates a comma splice, using a comma alone to join two clauses.',
    strategy: 'Agreement Check',
    ruleType: 'VForm',
  },

];
