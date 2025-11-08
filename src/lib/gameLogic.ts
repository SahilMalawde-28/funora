export const AVATARS = ['🎮', '🎯', '🎲', '🎪', '🎨', '🎭', '🎸', '🎺', '🎻', '🎬', '🚀', '⚡', '🔥', '💎', '🌟', '✨'];

export const GAMES = [
  {
    id: 'imposter',
    name: 'Guess the Imposter',
    description: 'Everyone gets a word — imposters get a different one. Discuss, lie, and vote!',
    minPlayers: 3,
    emoji: '🕵️'
  },
  {
    id: 'bluff',
    name: 'Bluff & Truth',
    description: 'A question is asked; liars get a fake one. Chaos ensues!',
    minPlayers: 3,
    emoji: '🎭'
  },
  {
    id: 'team',
    name: 'Make Your Team',
    description: 'Draft-style selection: build your dream team turn-by-turn!',
    minPlayers: 2,
    emoji: '⚔️'
  },
  {
    id: 'wavelength',
    name: 'Wavelength',
    description: 'Guess where on the scale (Hot–Cold, Funny–Serious) the hidden point is!',
    minPlayers: 3,
    emoji: '📊'
  },
  {
    id: 'wordguess',
    name: 'Word Guess',
    description: 'Get hints and guess the word! Max 15 hints before the big reveal.',
    minPlayers: 2,
    emoji: '🔤'
  },
  {
    id: 'chain',
    name: 'Chain Rapid Fire',
    description: 'Rapid-fire answers! Keep the chain going or get knocked out!',
    minPlayers: 2,
    emoji: '⚡'
  },
  {
    id: 'boilingWater',
    name: 'Boiling Water',
    description: 'Guess near the average × 0.8 — don’t let your score boil over!',
    emoji: '🔥',
    minPlayers: 3
  },
    {
    id: 'memory',
    name: 'Grid GOAT',
    description: 'Remember,manipulate and conquer',
    emoji: '🃏',
    minPlayers: 2
  },
  {
    id: 'herd',
    name: 'Herd Mentality',
    description: 'Go with the crowd or you will end up lost.',
    emoji: '🃏',
    minPlayers: 2
  }
];

export interface ImposterGameState {
  phase: 'setup' | 'discussion' | 'voting' | 'reveal';
  word: string;
  imposterWord: string;
  assignments: { [playerId: string]: 'normal' | 'imposter' };
  votes: { [playerId: string]: string };
  round: number;
  discussionTime: number;
}



export interface WordGuessGameState {
  phase: 'guessing' | 'hint' | 'reveal';
  targetWord: string;
  hints: string[];
  guesses: { [playerId: string]: string[] };
  currentGuesserIdx: number;
  hintsUsed: number;
  maxHints: number;
  round: number;
}

export interface ChainGameState {
  phase: 'waiting' | 'answering' | 'reveal';
  topic: string;
  currentPlayerIdx: number;
  activePlayers: string[];
  answers: { [playerId: string]: string };
  round: number;
  timePerAnswer: number;
}

export interface TeamGameState {
  phase: 'setup' | 'drafting' | 'reveal';
  category: string;
  players: string[];
  teams: { [playerId: string]: string[] };
  currentPicker: number;
  availableOptions: string[];
  round: number;
}

export interface WavelengthGameState {
  phase: 'clue' | 'guessing' | 'reveal';
  spectrum: { left: string; right: string };
  target: number;
  clueGiver: string;
  clue: string;
  guesses: { [playerId: string]: number };
  round: number;
}

export interface BoilingWaterState {
  phase: 'selecting' | 'revealing' | 'game_over';
  round: number;
  selections: { [playerId: string]: number | null };
  scores: { [playerId: string]: number }; // starts at 0, decreases toward -6
  eliminated: string[];
  target: number | null;
  rules: string[]; // dynamic rule log
  winner: string | null;
}

export const initBoilingWaterGame = (playerIds: string[], hostId: string) : BoilingWaterState => ({
  round: 1,
  phase: 'answer',
  answers: {},
  scores: Object.fromEntries(playerIds.map(id => [id, 0])),
  eliminated: [],
  hostId,
  commentary: '',
  lastRound: null
});


export const updateBoilingWaterGame = (state: BoilingWaterState): BoilingWaterState => {
  const alive = Object.keys(state.scores).filter(p => !state.eliminated.includes(p));
  const values = alive.map(p => state.selections[p]!).filter(v => v !== null);

  if (values.length === 0) return state;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const target = 0.8 * avg;

  // find closest to target
  let closestPlayer = alive[0];
  let closestDiff = Math.abs(state.selections[closestPlayer]! - target);
  alive.forEach(p => {
    const diff = Math.abs(state.selections[p]! - target);
    if (diff < closestDiff) {
      closestPlayer = p;
      closestDiff = diff;
    }
  });

  // start with all -1 except the winner
  const newScores = { ...state.scores };
  alive.forEach(p => {
    if (p !== closestPlayer) newScores[p] -= 1;
  });

  // rule triggers
  const ruleDescriptions: string[] = [...state.rules];

  // if exactly 3 players alive
  if (alive.length === 3) {
    const exactPlayers = alive.filter(p => state.selections[p]! === Math.round(target));
    if (exactPlayers.length > 0) {
      alive.forEach(p => {
        if (!exactPlayers.includes(p)) newScores[p] -= 2;
      });
      if (!ruleDescriptions.includes('Exact number causes -2 to others'))
        ruleDescriptions.push('Exact number causes -2 to others');
    }
  }

  // if exactly 2 players alive
  if (alive.length === 2) {
    const [p1, p2] = alive;
    const n1 = state.selections[p1]!;
    const n2 = state.selections[p2]!;

    if ((n1 === 100 && n2 === 0) || (n2 === 100 && n1 === 0)) {
      const loser = n1 === 0 ? p1 : p2;
      newScores[loser] -= 1;
    }

    if (!ruleDescriptions.includes('100 beats 0'))
      ruleDescriptions.push('100 beats 0');
  }

  // eliminate players at -6
  const newEliminated = [...state.eliminated];
  Object.entries(newScores).forEach(([player, score]) => {
    if (score <= -6 && !newEliminated.includes(player)) newEliminated.push(player);
  });

  // winner check
  const remaining = Object.keys(newScores).filter(p => !newEliminated.includes(p));
  const winner = remaining.length === 1 ? remaining[0] : null;

  return {
    ...state,
    phase: winner ? 'game_over' : 'selecting',
    round: state.round + 1,
    target,
    scores: newScores,
    eliminated: newEliminated,
    rules: ruleDescriptions,
    winner
  };
};


export const initImposterGame = (playerIds: string[]): ImposterGameState => {
  const wordPairs = [
  { normal: "Library", imposter: "Canteen" },
  { normal: "Assignment", imposter: "AI Answer" },
  { normal: "Syllabus", imposter: "YouTube Playlist" },
  { normal: "Classroom", imposter: "Hostel Bed" },
  { normal: "Internship", imposter: "Fake Offer Letter" },
  { normal: "Mentor", imposter: "ChatGPT" },
  { normal: "Research Paper", imposter: "Medium Blog" },
  { normal: "Python", imposter: "Excel Sheet" },
  { normal: "LinkedIn Post", imposter: "Instagram Story" },
  { normal: "Startup", imposter: "College Project" },
  { normal: "CGPA", imposter: "Confidence" },
  { normal: "Seminar", imposter: "Movie Break" },
  { normal: "Placement Drive", imposter: "Food Stall" },
  { normal: "Lab Manual", imposter: "PDF from Senior" },
  { normal: "Algorithm", imposter: "GPT Prompt" },
  { normal: "DBMS", imposter: "Excel Tables" },
  { normal: "Compiler", imposter: "Stack Overflow" },
  { normal: "Operating System", imposter: "Sleep Mode" },
  { normal: "Computer Network", imposter: "WiFi Password" },
  { normal: "Project Demo", imposter: "Screen Recording" },
  { normal: "Presentation", imposter: "Last-Minute Canva" },
  { normal: "Group Work", imposter: "Solo Sufferer" },
  { normal: "Teammate", imposter: "Spectator" },
  { normal: "Hackathon", imposter: "Sleepathon" },
  { normal: "Hostel Warden", imposter: "CIA Agent" },
  { normal: "Attendance", imposter: "Proxy List" },
  { normal: "Roll Call", imposter: "WhatsApp Ping" },
  { normal: "Cultural Fest", imposter: "Exam Week" },
  { normal: "Headphones", imposter: "Noise Cancellation for Life" },
  { normal: "Midsem", imposter: "Guess Paper" },
  { normal: "Endsem", imposter: "Mental Breakdown" },
  { normal: "Sports Day", imposter: "Assignment Submission" },
  { normal: "Library Card", imposter: "Zomato Gold" },
  { normal: "WiFi", imposter: "Hotspot" },
  { normal: "Java Project", imposter: "Copied Repo" },
  { normal: "Team Lead", imposter: "Google Doc Owner" },
  { normal: "Zoom Call", imposter: "Mic Off Sleep" },
  { normal: "Peer Evaluation", imposter: "Revenge Form" },
  { normal: "Canteen Queue", imposter: "Mess Stampede" },
  { normal: "Printer", imposter: "Screenshot" },
  { normal: "Whiteboard", imposter: "Phone Notes" },
  { normal: "Seniors", imposter: "Life Coaches" },
  { normal: "Freshers Party", imposter: "Ragging 2.0" },
  { normal: "Roommate", imposter: "Therapist" },
  { normal: "Hostel WiFi", imposter: "Buffer Festival" },
  { normal: "Class Rep", imposter: "Spy" },
  { normal: "Project Mentor", imposter: "Ghost" },
  { normal: "Code Debugging", imposter: "Praying" },
  { normal: "Exam Prep", imposter: "Panic Scrolling" },
  { normal: "Unit Test", imposter: "Trial by Fire" },
  { normal: "Cultural Club", imposter: "Attendance Club" },
  { normal: "Placement Brochure", imposter: "Fantasy Novel" },
  { normal: "DSA Sheet", imposter: "Instagram Reel" },
  { normal: "Laptop", imposter: "Heater" },
  { normal: "LAN Night", imposter: "Career Crisis" },
  { normal: "Submission Deadline", imposter: "Myth" },
  { normal: "Python Script", imposter: "Copy Paste Ritual" },
  { normal: "Compiler Error", imposter: "Existential Crisis" },
  { normal: "Excel Sheet", imposter: "Database" },
  { normal: "Group Discussion", imposter: "Roast Session" },
  { normal: "Project Title", imposter: "Buzzword Soup" },
  { normal: "Machine Learning", imposter: "Linear Regression + Hope" },
  { normal: "Java Lab", imposter: "Trial Version" },
  { normal: "Mini Project", imposter: "Screenshot Slideshow" },
  { normal: "AI Model", imposter: "Prompt Engineering" },
  { normal: "Campus Ambassador", imposter: "Spam Machine" },
  { normal: "Hackathon Winner", imposter: "PowerPoint God" },
  { normal: "Startup Founder", imposter: "Google Form Creator" },
  { normal: "CGPA Booster", imposter: "Teacher’s Pet" },
  { normal: "Hostel Canteen", imposter: "Wildlife Experiment" },
  { normal: "Sleep Schedule", imposter: "Quantum Superposition" },
  { normal: "Attendance Sheet", imposter: "Google Form" },
  { normal: "Exam Strategy", imposter: "Guess Game" },
  { normal: "Viva", imposter: "Lie Detector" },
  { normal: "AI Generated", imposter: "Human Effort" },
  { normal: "Research Internship", imposter: "Screenshot Internship" },
  { normal: "Plagiarism Checker", imposter: "Find and Replace" },
  { normal: "Term Paper", imposter: "ChatGPT Output" },
  { normal: "Coding Practice", imposter: "Debugging Trauma" },
  { normal: "Cultural Night", imposter: "Attendance Trap" },
  { normal: "Farewell", imposter: "Emotional Damage" },
  { normal: "Room Cleaning", imposter: "Spiritual Cleansing" },
  { normal: "Wake Up Call", imposter: "Fire Alarm" },
  { normal: "Breakfast", imposter: "Sleep" },
  { normal: "Dinner", imposter: "Maggi" },
  { normal: "Online Class", imposter: "Netflix Marathon" },
  { normal: "Proctor", imposter: "Spy Cam" },
  { normal: "Open Book Test", imposter: "Wikipedia Exam" },
  { normal: "Placement Season", imposter: "Ghost Season" },
  { normal: "Resume", imposter: "Fantasy Fiction" },
  { normal: "LinkedIn Connection", imposter: "Stranger" },
  { normal: "Internship Certificate", imposter: "Canva Design" },
  { normal: "Hostel Gossip", imposter: "Breaking News" },
  { normal: "Study Group", imposter: "Meme Exchange" },
  { normal: "Mock Interview", imposter: "Therapy Session" },
  { normal: "Portfolio Website", imposter: "Template Copy" },
  { normal: "GitHub Repo", imposter: "Zip Folder" },
  { normal: "Coding Contest", imposter: "Luck Test" },
  { normal: "Placement Offer", imposter: "Dream Letter" },
  { normal: "Elective", imposter: "Russian Roulette" },
  { normal: "Minor Project", imposter: "Major Excuse" },
  { normal: "Tech Fest", imposter: "Food Fest" },
  { normal: "Mentorship", imposter: "Ghost Mode" },
  { normal: "Result Day", imposter: "Doomsday" },
  { normal: "Lab Record", imposter: "Photoshop File" },
  { normal: "VPN", imposter: "Attendance Proxy" },
  { normal: "Late Night Study", imposter: "Instagram Scroll" },
  { normal: "Hostel Party", imposter: "Complaint Mail" },
  { normal: "Cultural Head", imposter: "Event Sponsor" },
  { normal: "Open Elective", imposter: "Closed Mind" },
  { normal: "Research Proposal", imposter: "Copied Abstract" },
  { normal: "IEEE Paper", imposter: "PDF Rename" },
  { normal: "Capstone Project", imposter: "PowerPoint Deck" },
  { normal: "Project Presentation", imposter: "Drama Rehearsal" },
  { normal: "Coding Mentor", imposter: "Cheat Sheet" },
  { normal: "Hackathon Mentor", imposter: "LinkedIn Influencer" },
  { normal: "Faculty Advisor", imposter: "Excel Sheet Manager" },
  { normal: "Library Book", imposter: "PDF Drive" },
  { normal: "Campus Drive", imposter: "Instagram Drive" },
  { normal: "Feedback Form", imposter: "Ignored Survey" },
  { normal: "Project Report", imposter: "AI Summary" },
  { normal: "Android App", imposter: "React Template" },
  { normal: "Python Project", imposter: "Colab Notebook" },
  { normal: "Hardware Lab", imposter: "Simulator" },
  { normal: "College Bus", imposter: "Zomato Rider" },
  { normal: "Seminar Hall", imposter: "Selfie Zone" },
  { normal: "Placement Talk", imposter: "Sleep Therapy" },
  { normal: "Technical Quiz", imposter: "Google Search" },
  { normal: "DSA Topic", imposter: "Error Message" },
  { normal: "Viva Voice", imposter: "Voice Crack" },
  { normal: "Project Review", imposter: "Roast Session" },
  { normal: "College Event", imposter: "Excuse to Skip Class" },
  { normal: "Open Source", imposter: "Copied Commit" },
  { normal: "Team Sync", imposter: "Blame Game" },
  { normal: "Github Commit", imposter: "Readme Update" },
  { normal: "Google Drive", imposter: "Lost Files" },
  { normal: "Cloud Storage", imposter: "Full Storage" },
  { normal: "Placement Portal", imposter: "404 Error" },
  { normal: "Quiz", imposter: "Kahoot Chaos" },
  { normal: "Typing Speed", imposter: "Copy Paste Speed" },
  { normal: "WiFi Speed", imposter: "LAN Cable" },
  { normal: "Smart Board", imposter: "Dead Projector" },
  { normal: "Online Submission", imposter: "Server Down" },
  { normal: "Offline Class", imposter: "Holiday" },
  { normal: "Exam Paper", imposter: "Mystery Novel" },
  { normal: "Peer Review", imposter: "Mutual Agreement" },
  { normal: "Lab Work", imposter: "Copy Work" },
  { normal: "Practical", imposter: "Theoretical" },
  { normal: "Clean Code", imposter: "Working Code" },
  { normal: "Coding Round", imposter: "MCQ Luck" },
  { normal: "Study Material", imposter: "Scribbled Notes" },
  { normal: "Revision", imposter: "Regret" },
  { normal: "Intern Offer", imposter: "Scam Mail" },
  { normal: "HR Round", imposter: "Lie Detector 2.0" },
  { normal: "Placement Result", imposter: "Hope Killer" },
  { normal: "Faculty Feedback", imposter: "Damage Control" },
  { normal: "Study Leave", imposter: "Netflix Binge" },
  { normal: "Quiz Winner", imposter: "Attendance Reward" },
  { normal: "Smart Student", imposter: "Smart Notes" },
  { normal: "Mentorship Meet", imposter: "Ghost Call" },
  { normal: "Class Test", imposter: "Surprise Attack" },
  { normal: "WiFi Router", imposter: "Decoration Piece" },
  { normal: "College ID", imposter: "Attendance Token" },
  { normal: "Smartwatch", imposter: "Exam Timer" },
  { normal: "Excel Project", imposter: "Math Phobia" },
  { normal: "Placement Prep", imposter: "LinkedIn Stalking" },
  { normal: "Technical Interview", imposter: "Verbal Gymnastics" },
  { normal: "ML Model", imposter: "Random Forest of Errors" },
  { normal: "AI Project", imposter: "Manual Prediction" },
  { normal: "Hackathon Idea", imposter: "Buzzword Generator" },
  { normal: "Resume Points", imposter: "Fantasy Claims" },
  { normal: "GitHub Star", imposter: "Self Fork" },
  { normal: "Teacher’s Pet", imposter: "Internal Marks Boost" },
  { normal: "Hostel WiFi Speed", imposter: "Pigeon Post" },
  { normal: "LAN Cable", imposter: "Necklace" },
  { normal: "College Mail", imposter: "Spam Box" },
  { normal: "ERP Portal", imposter: "Error 500" },
  { normal: "Event Volunteer", imposter: "Free T-Shirt Hunter" },
  { normal: "Class Notes", imposter: "Google Docs Share" },
  { normal: "Syllabus PDF", imposter: "Ancient Scroll" },
  { normal: "Assignment PDF", imposter: "Plagiarized Tome" },
  { normal: "Viva Marks", imposter: "Random Number Generator" },
  { normal: "Revaluation", imposter: "Donation Drive" },
  { normal: "Backlog", imposter: "Bonus Round" },
  { normal: "CGPA", imposter: "Mood Tracker" },
  { normal: "University Portal", imposter: "Bug Showcase" },
  { normal: "Deadline", imposter: "Suggestion" },
  { normal: "Exam Hall", imposter: "Battlefield" },
  { normal: "Calculator", imposter: "Hope Device" },
  { normal: "Brainstorm", imposter: "Blank Screen" },
  { normal: "Faculty", imposter: "NPC" },
  { normal: "Classroom AC", imposter: "Heater" },
  { normal: "Project Partner", imposter: "Excuse Partner" },
  { normal: "Toppers", imposter: "Photocopiers" },
  { normal: "Campus Placement", imposter: "LinkedIn Update" },
  { normal: "Data Structures", imposter: "Confusion Trees" },
  { normal: "Algorithms", imposter: "Trial and Error" },
  { normal: "Exam Prep Group", imposter: "Meme Group" },
  { normal: "Exam Guide", imposter: "Rumor Mill" },
  { normal: "Extra Class", imposter: "Detention" },
  { normal: "ML Dataset", imposter: "Excel Column" },
  { normal: "AI Training", imposter: "Data Copy" },
  { normal: "Placement Prep Book", imposter: "PDF Summary" },
  { normal: "Career Counseling", imposter: "Group Therapy" },
  { normal: "Cloud Computing", imposter: "Weather Forecast" },
  { normal: "Cyber Security", imposter: "Password123" },
  { normal: "Intern Task", imposter: "Status Update" },
  { normal: "Team Meet", imposter: "Gossip Hour" },
  { normal: "Sprint Planning", imposter: "Last-Minute Rush" },
  { normal: "Code Review", imposter: "Blame Review" },
  { normal: "Testing Phase", imposter: "Bug Hunting Season" },
  { normal: "Frontend", imposter: "Copy of Dribbble" },
  { normal: "Backend", imposter: "JSON Dump" },
  { normal: "API", imposter: "A Problem Instead" },
  { normal: "Database", imposter: "CSV File" },
  { normal: "UI Design", imposter: "Figma Screenshot" },
  { normal: "Deployment", imposter: "Hope Upload" },
  { normal: "Render", imposter: "Crash Simulator" },
  { normal: "Git Pull", imposter: "Code War" },
  { normal: "Docker", imposter: "Locker" },
  { normal: "Server Down", imposter: "Intern Fault" },
  { normal: "Tech Support", imposter: "Google Search" },
  { normal: "Bug Fix", imposter: "New Bug" },
  { normal: "Patch Update", imposter: "Feature Removal" },
  { normal: "Database Migration", imposter: "Disaster Recovery" },
  { normal: "Stack Overflow", imposter: "Emotional Overflow" },
  { normal: "Code Commit", imposter: "Confession" },
  { normal: "Pull Request", imposter: "Cry for Help" },
  { normal: "Merge Conflict", imposter: "Team Conflict" },
  { normal: "Version Control", imposter: "Chaos Management" },
  { normal: "Debug Mode", imposter: "Panic Mode" },
  { normal: "Production Server", imposter: "Destruction Server" },
  { normal: "Deployed App", imposter: "404 Error Page" },
  { normal: "Unit Test", imposter: "Faith Test" },
  { normal: "Code Refactor", imposter: "Code Rewrite" },
  { normal: "Documentation", imposter: "Storytelling" },
  { normal: "API Key", imposter: "Leaked Secret" },
  { normal: "Frontend Dev", imposter: "CSS Therapist" },
  { normal: "Backend Dev", imposter: "Database Magician" },
  ]



  const pair = wordPairs[Math.floor(Math.random() * wordPairs.length)];
  const imposterCount = Math.max(1, Math.floor(playerIds.length / 4));
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const imposters = shuffled.slice(0, imposterCount);

  const assignments: { [key: string]: 'normal' | 'imposter' } = {};
  playerIds.forEach(id => {
    assignments[id] = imposters.includes(id) ? 'imposter' : 'normal';
  });

  return {
    phase: 'discussion',
    word: pair.normal,
    imposterWord: pair.imposter,
    assignments,
    votes: {},
    round: 1,
    discussionTime: 90
  };
};

export interface BluffGameState {
  phase: 'answering' | 'reveal' | 'voting' | 'result';
  realQuestion: string;
  fakeQuestion: string;
  assignments: { [playerId: string]: 'truth' | 'bluff' };
  answers: { [playerId: string]: string };
  votes: { [playerId: string]: string }; // who each player voted for
  round: number;
  timer: number;
}

export const initBluffGame = (playerIds: string[]): BluffGameState => {
  const questions = [
  { real: "At what age did you have your first crush?", fake: "At what age did you learn to ride a bicycle?" },
  { real: "How many people from college have you had a thing with?", fake: "How many teachers can you name from your first year?" },
  { real: "What’s the most awkward thing that happened to you at a college party?", fake: "What’s the funniest thing that happened in class?" },
  { real: "How many unread DMs do you have from people flirting with you?", fake: "How many apps do you have on your phone?" },
  { real: "What’s the age gap of the oldest person you’ve liked?", fake: "What’s the age gap between you and your siblings?" },
  { real: "Who was your crush during your first semester?", fake: "Who was your favorite professor during your first semester?" },
  { real: "How many times have you stalked someone’s Instagram this month?", fake: "How many times have you ordered food this week?" },
  { real: "What’s the craziest DM you’ve ever received?", fake: "What’s the funniest meme you’ve seen recently?" },
  { real: "What’s the biggest lie you’ve told your parents about college?", fake: "What’s the biggest mistake you made in an exam?" },
  { real: "At what age did you first get drunk?", fake: "At what age did you first stay up all night studying?" },
  { real: "What’s your most embarrassing hangover story?", fake: "What’s your most boring lecture story?" },
  { real: "What’s the most flirty thing you’ve texted someone?", fake: "What’s the nicest message you’ve ever received?" },
  { real: "Who’s the hottest person in your class (first name only)?", fake: "Who’s the funniest person in your class?" },
  { real: "What’s your type — older, same age, or younger?", fake: "What’s your favorite type of movie?" },
  { real: "How long was your longest situationship?", fake: "How long was your longest group project?" },
  { real: "What’s something you did at a party you still regret?", fake: "What’s something you did during exams you regret?" },
  { real: "If you had to rate your flirting skills out of 10, what would it be?", fake: "If you had to rate your time management out of 10, what would it be?" },
  { real: "What’s the most unexpected place you’ve flirted with someone?", fake: "What’s the most unexpected place you’ve met a friend?" },
  { real: "How many times have you texted your ex after breakup?", fake: "How many times have you changed your phone wallpaper?" },
  { real: "What’s your go-to excuse for skipping class?", fake: "What’s your go-to excuse for being late to a meeting?" },
  { real: "What’s the most romantic thing someone has done for you?", fake: "What’s the most thoughtful gift you’ve received?" },
  { real: "At what age would you ideally want to get married?", fake: "At what age do you want to buy your first car?" },
  { real: "Who’s your current crush’s initials?", fake: "Who’s your favorite senior in college?" },
  { real: "What’s your biggest red flag when dating?", fake: "What’s your biggest pet peeve in class?" },
  { real: "How many people have you ghosted?", fake: "How many group projects have you been part of?" },
  { real: "What’s the longest time you’ve texted someone non-stop?", fake: "What’s the longest time you’ve studied non-stop?" },
  { real: "At what age did you first kiss someone?", fake: "At what age did you first get a smartphone?" },
  { real: "What’s one rumor about you that’s actually true?", fake: "What’s one fact about you most people don’t know?" },
  { real: "How many times have you had a crush on a teacher?", fake: "How many subjects did you like last semester?" },
  { real: "What’s the biggest dare you’ve done at college?", fake: "What’s the biggest assignment you’ve done?" },
  { real: "Who’s the most unexpected person who’s ever flirted with you?", fake: "Who’s the most unexpected friend you’ve made?" },
  { real: "How many people do you have saved with nicknames in your phone?", fake: "How many contacts do you have in your phone?" },
  { real: "What’s your biggest secret about your love life?", fake: "What’s your biggest secret about your study habits?" },
  { real: "Who was your first kiss with?", fake: "Who was your first lab partner?" },
  { real: "What’s the most jealous thing you’ve done?", fake: "What’s the most competitive thing you’ve done?" },
  { real: "How many people do you currently talk to in a flirty way?", fake: "How many people do you talk to daily?" },
  { real: "At what age did you first start dating?", fake: "At what age did you first start using social media?" },
  { real: "What’s the pettiest reason you’ve stopped talking to someone?", fake: "What’s the pettiest argument you’ve had in class?" },
  { real: "What’s the longest time you’ve gone without texting your crush back?", fake: "What’s the longest time you’ve gone without sleeping before exams?" },
  { real: "How many exes are still in your contact list?", fake: "How many saved contacts start with the letter A?" },
  { real: "What’s the weirdest thing you’ve done to impress someone?", fake: "What’s the weirdest thing you’ve done for a class project?" },
  { real: "If you had to pick one person from college to date, who would it be?", fake: "If you had to pick one person from college for a group project, who would it be?" },
  { real: "How old were you when you first got into trouble for dating?", fake: "How old were you when you first got into trouble for attendance?" },
  { real: "What’s your biggest relationship ick?", fake: "What’s your biggest academic struggle?" },
  { real: "How many people have you given your number to this year?", fake: "How many times have you been late to class this year?" },
  { real: "Who was the first person you ever had a crush on from your college?", fake: "Who was the first person you met from your college?" },
  { real: "What’s the most unexpected person you’ve dreamt about?", fake: "What’s the most unexpected place you’ve ever visited?" },
  { real: "At what age do you think people should stop playing around and settle?", fake: "At what age do you think people should start working full-time?" },
  { real: "Who’s the most attractive senior or junior you know?", fake: "Who’s the most hardworking senior or junior you know?" },
  { real: "How many people know your real crush?", fake: "How many people know your favorite subject?" },
    { real: "How many people’s pictures are in your hidden folder?", fake: "How many screenshots are in your gallery?" },
  { real: "Who was your first celebrity crush?", fake: "Who was your favorite cartoon character?" },
  { real: "How many people have you called at 2 a.m.?", fake: "How many times have you pulled an all-nighter?" },
  { real: "At what age did you first get into a relationship?", fake: "At what age did you first join a social media app?" },
  { real: "What’s the biggest secret your best friend knows about you?", fake: "What’s the best quality your best friend has?" },
  { real: "What’s the most ridiculous pickup line used on you?", fake: "What’s the funniest joke you’ve heard in class?" },
  { real: "How many people have you blocked for flirting?", fake: "How many apps have you uninstalled recently?" },
  { real: "What’s the wildest rumor you’ve heard about yourself?", fake: "What’s the weirdest rumor you’ve heard in college?" },
  { real: "At what age do you think you’ll have kids?", fake: "At what age do you think you’ll buy a car?" },
  { real: "How many people do you secretly find attractive in this room?", fake: "How many people in this room do you text daily?" },
  { real: "What’s the most flirty compliment you’ve ever given?", fake: "What’s the nicest compliment you’ve ever received?" },
  { real: "How many times have you lied about being busy?", fake: "How many times have you lied about finishing homework?" },
  { real: "Who’s the last person you flirted with on chat?", fake: "Who’s the last person you texted about an assignment?" },
  { real: "How many people have you been on a date with?", fake: "How many restaurants have you tried near campus?" },
  { real: "What’s the most spontaneous thing you’ve done for a crush?", fake: "What’s the most spontaneous trip you’ve taken?" },
  { real: "At what age did you realize dating isn’t always fun?", fake: "At what age did you realize studying can be fun?" },
  { real: "How many people do you lowkey stalk on social media?", fake: "How many influencers do you follow?" },
  { real: "What’s the most romantic song that reminds you of someone?", fake: "What’s your favorite road trip song?" },
  { real: "At what age do you think relationships actually mature?", fake: "At what age do you think careers actually stabilize?" },
  { real: "Who’s the first person you’d drunk text?", fake: "Who’s the first person you’d call for notes?" },

  // 81–100
  { real: "How many people’s chats have you muted?", fake: "How many notifications do you get daily?" },
  { real: "What’s your biggest college crush story?", fake: "What’s your biggest academic achievement?" },
  { real: "How long was your shortest crush?", fake: "How long was your shortest vacation?" },
  { real: "What’s the most jealous you’ve ever felt?", fake: "What’s the most excited you’ve ever felt?" },
  { real: "How many people know your secrets?", fake: "How many people know your birthday?" },
  { real: "What’s the wildest reason you’ve said no to someone?", fake: "What’s the wildest excuse you’ve given to skip class?" },
  { real: "At what age did you get your first romantic message?", fake: "At what age did you get your first smartphone?" },
  { real: "How many people’s stories do you watch but never reply to?", fake: "How many YouTube channels do you subscribe to?" },
  { real: "What’s the funniest lie you’ve told to impress someone?", fake: "What’s the funniest lie you’ve told your parents?" },
  { real: "How many people’s names have you saved with emojis?", fake: "How many playlists have you made this semester?" },
  { real: "Who’s the most confusing person you’ve talked to?", fake: "Who’s the most organized person in your class?" },
  { real: "At what age did you first go out on a date?", fake: "At what age did you first join school?" },
  { real: "How long did your first relationship last?", fake: "How long did your first internship last?" },
  { real: "How many people have you had mutual crushes with?", fake: "How many people do you share notes with?" },
  { real: "What’s your biggest dating regret?", fake: "What’s your biggest academic regret?" },
  { real: "How many people have you texted something you shouldn’t have?", fake: "How many times have you accidentally sent the wrong message?" },
  { real: "At what age do you think you’ll settle down?", fake: "At what age do you think you’ll start your own business?" },
  { real: "Who’s the most mysterious person you’ve liked?", fake: "Who’s the most quiet person in your class?" },
  { real: "How long did your first situationship last?", fake: "How long was your first semester break?" },
  { real: "How many times have you rewatched a story just for someone?", fake: "How many times have you rewatched a lecture?" },
    { real: "At what age did you first get a heartbreak?", fake: "At what age did you first travel alone?" },
  { real: "How many people have you flirted with this semester?", fake: "How many assignments do you have this semester?" },
  { real: "Who was the first person to ever call you cute?", fake: "Who was the first person to ever gift you something?" },
  { real: "How many times have you said 'I love you' and not meant it?", fake: "How many times have you said 'thank you' today?" },
  { real: "What’s the most attractive thing someone has done for you?", fake: "What’s the kindest thing someone has done for you?" },
  { real: "At what age did you stop believing in forever?", fake: "At what age did you stop believing in Santa Claus?" },
  { real: "Who’s someone you lowkey wish liked you back?", fake: "Who’s someone you admire for their talent?" },
  { real: "How many times have you said 'I miss you' and not meant it?", fake: "How many texts do you send daily?" },
  { real: "What’s the most embarrassing text you’ve ever sent while drunk?", fake: "What’s the most embarrassing text you’ve ever sent to a teacher?" },
  { real: "At what age do you think your dating life peaked?", fake: "At what age do you think your academic performance peaked?" },
  { real: "Who was your last crush that no one knows about?", fake: "Who was your last lab partner?" },
  { real: "How many people do you have a soft corner for right now?", fake: "How many clubs are you part of in college?" },
  { real: "What’s the wildest compliment you’ve ever received?", fake: "What’s the most random compliment you’ve ever received?" },
  { real: "At what age did you first say 'I love you'?", fake: "At what age did you first move to a new place?" },
  { real: "How many times have you fallen for someone in the same friend group?", fake: "How many times have you switched study groups?" },
  { real: "What’s the biggest red flag you’ve ignored?", fake: "What’s the biggest mistake you’ve learned from?" },
  { real: "At what age did you stop believing your first crush would work out?", fake: "At what age did you stop watching cartoons?" },
  { real: "How many people have you given pet names to?", fake: "How many pets have you had in your life?" },
  { real: "What’s the pettiest reason you’ve ignored someone’s message?", fake: "What’s the pettiest reason you’ve skipped a class?" },
  { real: "At what age did you first realize you’re attractive?", fake: "At what age did you first realize your favorite subject?" },

  // 121–140
  { real: "Who’s the last person you stalked on social media?", fake: "Who’s the last person you texted about college work?" },
  { real: "How many people have you given mixed signals to?", fake: "How many emails are unread in your inbox?" },
  { real: "At what age did you first go on a secret date?", fake: "At what age did you first go to a concert?" },
  { real: "Who was your first college crush?", fake: "Who was your first college teacher?" },
  { real: "How many people from your city have you dated or liked?", fake: "How many people from your city go to your college?" },
  { real: "At what age did you first cry over someone?", fake: "At what age did you first cry over grades?" },
  { real: "How many people do you think currently have a crush on you?", fake: "How many people are in your college batch?" },
  { real: "Who’s the most unexpected person you’ve ever liked?", fake: "Who’s the most unexpected person you’ve become friends with?" },
  { real: "What’s the most romantic place you’ve ever been to?", fake: "What’s the most peaceful place you’ve ever visited?" },
  { real: "At what age did you realize heartbreaks hurt?", fake: "At what age did you realize college is stressful?" },
  { real: "How many people have you avoided because you liked them?", fake: "How many subjects have you skipped because you were tired?" },
  { real: "What’s your go-to excuse after a bad date?", fake: "What’s your go-to excuse for missing class?" },
  { real: "At what age did you first go to a party alone?", fake: "At what age did you first travel by train alone?" },
  { real: "Who was your first virtual crush?", fake: "Who was your first online gaming friend?" },
  { real: "How many people have you flirted with just for fun?", fake: "How many times have you watched the same movie twice?" },
  { real: "At what age did you realize looks matter?", fake: "At what age did you realize hard work matters?" },
  { real: "How many people have you ghosted and later regretted?", fake: "How many tasks have you postponed and regretted?" },
  { real: "What’s the most random place you’ve met someone cute?", fake: "What’s the most random place you’ve made a friend?" },
  { real: "At what age did you first stay out overnight without telling home?", fake: "At what age did you first attend a sleepover?" },
  { real: "How many times have you been jealous of someone’s relationship?", fake: "How many times have you been jealous of someone’s marks?" },

  // 141–160
  { real: "What’s the most dramatic love triangle you’ve seen or been in?", fake: "What’s the most dramatic group project you’ve experienced?" },
  { real: "At what age did you start catching feelings easily?", fake: "At what age did you start getting serious about studies?" },
  { real: "How many times have you sent a risky message and deleted it?", fake: "How many times have you deleted an unfinished email?" },
  { real: "What’s your most embarrassing 'sent to the wrong person' story?", fake: "What’s your most embarrassing autocorrect moment?" },
  { real: "At what age did you stop chasing people?", fake: "At what age did you stop doing homework early?" },
  { real: "How many people have you had late-night calls with?", fake: "How many times have you pulled an all-nighter for exams?" },
  { real: "What’s your longest talking phase without dating?", fake: "What’s your longest project without submitting?" },
  { real: "Who’s the person that made you blush the most recently?", fake: "Who’s the person that made you laugh the most recently?" },
  { real: "At what age did you realize you give people too many chances?", fake: "At what age did you realize college isn’t forever?" },
  { real: "How many times have you caught feelings in DMs?", fake: "How many times have you lost marks due to silly mistakes?" },
  { real: "Who’s someone you flirted with but never liked?", fake: "Who’s someone you studied with but never talked again?" },
  { real: "At what age did you start lying about being busy?", fake: "At what age did you start drinking coffee daily?" },
  { real: "How many times have you looked at old chats just to feel something?", fake: "How many times have you read old notes before exams?" },
  { real: "Who was your crush during your school-to-college transition?", fake: "Who was your friend during your school-to-college transition?" },
  { real: "At what age did you get your first compliment from someone you liked?", fake: "At what age did you get your first academic award?" },
  { real: "How many times have you gone back to an ex or almost-ex?", fake: "How many times have you rewatched your favorite show?" },
  { real: "What’s your go-to flirting line?", fake: "What’s your go-to way to make someone laugh?" },
  { real: "At what age did you first attend a date you regretted?", fake: "At what age did you first attend a boring seminar?" },
  { real: "How many people’s numbers do you have saved just in case?", fake: "How many notes do you have saved for later?" },
  { real: "Who was your most random crush?", fake: "Who was your most random classmate?" },

  // 161–180
  { real: "What’s the most spontaneous thing you’ve done to impress someone?", fake: "What’s the most spontaneous thing you’ve done on a trip?" },
  { real: "At what age did you first realize relationships can be tiring?", fake: "At what age did you first realize college is hectic?" },
  { real: "How many times have you said 'I’m fine' when you weren’t?", fake: "How many times have you said 'I’m ready' when you weren’t?" },
  { real: "Who’s the person you’ve liked for the longest time?", fake: "Who’s the teacher you’ve known the longest?" },
  { real: "At what age did you start hiding things from your parents?", fake: "At what age did you start using social media secretly?" },
  { real: "How many unread chats do you have from people you once liked?", fake: "How many unread emails do you have?" },
  { real: "What’s the most romantic thing you’ve done for someone?", fake: "What’s the nicest surprise you’ve done for a friend?" },
  { real: "At what age did you have your first relationship argument?", fake: "At what age did you have your first major exam?" },
  { real: "How many people have you promised something and not kept it?", fake: "How many promises have you made this year?" },
  { real: "Who’s the person you’d never confess your feelings to?", fake: "Who’s the person you’d never ask for notes?" },
  { real: "At what age did you get your first crush text?", fake: "At what age did you send your first email?" },
  { real: "How many people have you flirted with online but not met?", fake: "How many people from online have you met offline?" },
  { real: "Who’s the last person you’d go on a trip with?", fake: "Who’s the last person you’d study with?" },
  { real: "At what age did you last cry over someone?", fake: "At what age did you last cry from laughter?" },
  { real: "How many times have you almost confessed but backed out?", fake: "How many times have you almost submitted but edited again?" },
  { real: "Who’s your favorite person to flirt with just for fun?", fake: "Who’s your favorite person to gossip with?" },
  { real: "At what age did you first fall for someone’s voice?", fake: "At what age did you first fall in love with a subject?" },
  { real: "How many people do you think you’ve led on unintentionally?", fake: "How many people do you think follow your advice?" },
  { real: "Who’s someone you still think about even after moving on?", fake: "Who’s someone you still text after graduating?" },
  { real: "At what age did you realize love isn’t enough?", fake: "At what age did you realize sleep is precious?" },

  // 181–200
  { real: "How many people’s chats do you reread when bored?", fake: "How many group chats are you part of?" },
  { real: "What’s your biggest turn-on during a conversation?", fake: "What’s your biggest interest in a discussion?" },
  { real: "At what age did you last catch feelings unexpectedly?", fake: "At what age did you last change your hobby?" },
  { real: "How many people have you blocked out of anger?", fake: "How many apps have you deleted recently?" },
  { real: "Who’s the most confusing ex-crush you’ve ever had?", fake: "Who’s the most confusing teacher you’ve ever had?" },
  { real: "At what age did you first start using dating apps?", fake: "At what age did you first start using YouTube?" },
  { real: "How many times have you been friendzoned?", fake: "How many times have you been waitlisted for a class?" },
  { real: "What’s the most emotional message you’ve ever received?", fake: "What’s the most surprising email you’ve ever received?" },
  { real: "At what age did you realize your type changed?", fake: "At what age did you realize your goals changed?" },
  { real: "How many people have you had a secret crush on at once?", fake: "How many subjects are you studying right now?" },
  { real: "Who’s the one person who can ruin your mood instantly?", fake: "Who’s the one professor who scares you the most?" },
  { real: "At what age did you first realize someone liked you?", fake: "At what age did you first realize you’re good at something?" },
  { real: "How many times have you flirted without realizing it?", fake: "How many times have you zoned out in class?" },
  { real: "Who’s the person you’d never say no to?", fake: "Who’s the person you’d always sit next to in class?" },
  { real: "At what age did you stop believing in 'the one'?", fake: "At what age did you stop believing in fairy tales?" },
  { real: "How many people’s stories do you check the most?", fake: "How many social media platforms do you use daily?" },
  { real: "Who’s someone you’d like to flirt with but shouldn’t?", fake: "Who’s someone you’d like to collaborate with academically?" },
  { real: "At what age did you first feel butterflies?", fake: "At what age did you first feel confident speaking on stage?" },
  { real: "How many people have you accidentally led on?", fake: "How many times have you given wrong directions?" },
  { real: "Who’s the one person you’d never admit you liked?", fake: "Who’s the one classmate you’d never forget?" },
  { real: "Who’s someone you pretend you’re over but still think about?", fake: "Who’s someone you pretend to ignore in class but still talk to?" },
  { real: "How many times have you stalked someone just to feel close again?", fake: "How many times have you checked someone’s LinkedIn out of curiosity?" },
  { real: "What’s something you wish you could say to your ex but never did?", fake: "What’s something you wish you could tell your professor but never did?" },
  { real: "Who’s the one person whose texts can still ruin your mood instantly?", fake: "Who’s the one person whose messages you always forget to reply to?" },
  { real: "At what age did you stop believing in ‘forever’?", fake: "At what age did you stop believing in Santa?" },
  { real: "Who’s the person you wish had fought harder for you?", fake: "Who’s the person you wish had invited you to their party?" },
  { real: "How many times have you typed a long message and deleted it?", fake: "How many times have you typed a long caption and deleted it?" },
  { real: "Who’s the one person you can’t unlove no matter what?", fake: "Who’s the one person you can’t unfollow no matter what?" },
  { real: "What’s a song that still reminds you of someone you lost?", fake: "What’s a song that still reminds you of your college days?" },
  { real: "Who’s the person you wish would text you right now?", fake: "Who’s the person you wish would call you right now?" },
  { real: "When was the last time you pretended to be okay?", fake: "When was the last time you pretended to understand the topic?" },
  { real: "Who’s the one person you’d forgive even if they don’t apologize?", fake: "Who’s the one teacher you’d forgive for giving you low marks?" },
  { real: "What’s a secret that could ruin a friendship if revealed?", fake: "What’s a secret recipe you’d never share?" },
  { real: "Who’s the one person who knows too much about you?", fake: "Who’s the one person who knows all your assignments?" },
  { real: "At what age did you stop believing love fixes everything?", fake: "At what age did you stop believing marks fix everything?" },
  { real: "What’s something you regret doing for someone you liked?", fake: "What’s something you regret doing for a group project?" },
  { real: "Who’s the person you’d never let see you cry?", fake: "Who’s the person you’d never let see your marks?" },
  { real: "What’s a text you wish you never sent?", fake: "What’s an email you wish you never sent?" },
  { real: "Who’s someone you ghosted but still miss?", fake: "Who’s someone you blocked but still check their story?" },
  { real: "What’s something that instantly reminds you of your ex?", fake: "What’s something that instantly reminds you of exams?" },
  { real: "When was the last time you lied about being busy?", fake: "When was the last time you lied about finishing your homework?" },
  { real: "Who’s the person you used to talk to daily but not anymore?", fake: "Who’s the person you used to sit with but not anymore?" },
  { real: "What’s a message you wish you’d replied to?", fake: "What’s a message you forgot to reply to?" },
  { real: "Who’s the first person you think of when you’re sad?", fake: "Who’s the first person you text when you need notes?" },
  { real: "At what age did you realize you were someone's backup plan?", fake: "At what age did you realize college politics exist?" },
  { real: "What’s something you’d tell your younger self about love?", fake: "What’s something you’d tell your younger self about school?" },
  { real: "Who’s someone you’d take back if they apologized?", fake: "Who’s someone you’d add back if they said sorry?" },
  { real: "What’s a secret you’ve kept just to protect someone else?", fake: "What’s a secret you’ve kept from your project group?" },
  { real: "When was the last time you missed someone you shouldn’t?", fake: "When was the last time you missed a deadline?" },
  { real: "Who’s the person you’d text first if you got drunk?", fake: "Who’s the person you’d text first if you topped the exam?" },
  { real: "What’s a lie you tell yourself every day?", fake: "What’s an excuse you tell yourself every morning?" },
  { real: "Who’s someone you talk about but never to?", fake: "Who’s someone you see every day but never talk to?" },
  { real: "What’s a memory you replay when you can’t sleep?", fake: "What’s a show you rewatch when you can’t sleep?" },
  { real: "Who’s the person that hurt you without realizing it?", fake: "Who’s the person that roasted you without realizing it?" },
  { real: "What’s something you wish someone had said to you earlier?", fake: "What’s something you wish your teacher had told you earlier?" },
  { real: "Who’s someone you act cold toward but secretly care about?", fake: "Who’s someone you act smart around but secretly admire?" },
  { real: "At what age did you realize love doesn’t always last?", fake: "At what age did you realize college doesn’t last forever?" },
  { real: "Who’s someone you can’t hate no matter what they do?", fake: "Who’s someone you can’t say no to for group work?" },
  { real: "What’s something you did just to get someone’s attention?", fake: "What’s something you did just to get bonus marks?" },
  { real: "Who’s the first person you’d call if you felt lonely?", fake: "Who’s the first person you’d call if your laptop crashed?" },
  { real: "What’s a habit you picked up because of someone you liked?", fake: "What’s a habit you picked up because of your roommate?" },
  { real: "Who’s the person whose opinion matters too much to you?", fake: "Who’s the person whose attendance matters too much to you?" },
  { real: "When was the last time you said 'I’m fine' and meant it?", fake: "When was the last time you said 'I’m done' and meant it?" },
  { real: "Who’s someone you still remember even after deleting everything?", fake: "Who’s someone you still remember from your first year?" },
  { real: "What’s something you wish they’d never found out?", fake: "What’s something your teacher found out accidentally?" },
  { real: "Who’s the one person who changed you without trying?", fake: "Who’s the one senior who helped you without asking?" },
  { real: "What’s a photo you can’t delete no matter how hard you try?", fake: "What’s a meme you can’t delete from your gallery?" },
  { real: "Who’s someone you want to see again just once?", fake: "Who’s someone you want to meet again after graduation?" },
  { real: "What’s something you still overthink about?", fake: "What’s something you still overanalyze before an exam?" },
  { real: "At what age did you realize heartbreak isn’t dramatic?", fake: "At what age did you realize college isn’t like the movies?" },
  { real: "Who’s someone you lost because of your ego?", fake: "Who’s someone you lost because of a silly fight?" },
  { real: "What’s something you wish you had the courage to say?", fake: "What’s something you wish you had the confidence to present?" },
  { real: "Who’s the person who almost became your everything?", fake: "Who’s the person who almost became your best friend?" },
  { real: "What’s a random thing that still reminds you of them?", fake: "What’s a random thing that still reminds you of your school days?" },
  { real: "Who’s someone you’d never introduce to your parents?", fake: "Who’s someone you’d never add to the class group?" },
  { real: "What’s the last thing you overthought before sleeping?", fake: "What’s the last thing you scrolled before sleeping?" },
  { real: "Who’s the first person you’d text if you won the lottery?", fake: "Who’s the first person you’d text if you failed a test?" },
  { real: "At what age did you realize love doesn’t fix loneliness?", fake: "At what age did you realize sleep doesn’t fix exhaustion?" },
  { real: "Who’s someone you wish you could forget but can’t?", fake: "Who’s someone you wish you could unfollow but can’t?" },
  { real: "What’s something you’ve never told anyone about your breakup?", fake: "What’s something you’ve never told anyone about your last exam?" },
  { real: "Who’s someone you miss even though they hurt you?", fake: "Who’s someone you still hang out with even after fights?" },
  { real: "At what age did you stop chasing people?", fake: "At what age did you stop collecting attendance?" },
  { real: "Who’s someone who texts you only when they need something?", fake: "Who’s someone who messages you only for notes?" },
  { real: "What’s something you’d say to your past self before a heartbreak?", fake: "What’s something you’d say to your past self before the finals?" },
  { real: "Who’s the person who changed how you see relationships?", fake: "Who’s the person who changed how you see teamwork?" },
  { real: "What’s a decision you regret in love?", fake: "What’s a decision you regret in college?" },
  { real: "Who’s the person you compare everyone to?", fake: "Who’s the person you compare your marks to?" },
  { real: "At what age did you realize love isn’t always mutual?", fake: "At what age did you realize teachers aren’t always fair?" },
  { real: "Who’s someone you wish would apologize first?", fake: "Who’s someone you wish would message first?" },
  { real: "What’s something you wish you’d never found out?", fake: "What’s something you wish you’d never seen online?" },
  { real: "Who’s the one that got away?", fake: "Who’s the one that left the group project?" },
  { real: "What’s a song lyric that describes your love life?", fake: "What’s a meme that describes your college life?" },
  { real: "Who’s someone you’d never lie to?", fake: "Who’s someone you’d never copy from?" },
  { real: "At what age did you realize love can fade?", fake: "At what age did you realize friendships can fade?" },
  { real: "What’s something you did out of jealousy?", fake: "What’s something you did out of boredom?" },
  { real: "Who’s the person you secretly envy?", fake: "Who’s the person you secretly admire?" },
  { real: "What’s a name you can’t hear without feeling something?", fake: "What’s a place you can’t visit without remembering something?" },
  { real: "Who’s the last person you’d want to see your messages?", fake: "Who’s the last person you’d want to see your search history?" },
  { real: "What’s something you wish they knew about you?", fake: "What’s something you wish your professor knew about you?" },
  { real: "At what age did you realize some people are temporary?", fake: "At what age did you realize semesters go too fast?" },
  { real: "Who’s someone you used to love talking to but now avoid?", fake: "Who’s someone you used to study with but now avoid?" },
  { real: "What’s something that felt right but ended wrong?", fake: "What’s something that started well but ended late?" },
  { real: "Who’s someone you’d text if you knew they’d reply?", fake: "Who’s someone you’d email if you knew they’d respond?" },
  { real: "When was the last time you missed someone silently?", fake: "When was the last time you missed your alarm silently?" },
  { real: "Who’s someone you think of but never message?", fake: "Who’s someone you follow but never message?" },
  { real: "What’s a truth you’re scared to admit?", fake: "What’s a task you’re scared to start?" },
  { real: "Who’s someone you wish you could talk to again?", fake: "Who’s someone you wish you could work with again?" },
  { real: "At what age did you stop chasing closure?", fake: "At what age did you stop chasing grades?" },
  { real: "Who’s someone you’ve outgrown emotionally?", fake: "Who’s someone you’ve outgrown academically?" },
  { real: "What’s a mistake you’d repeat just for the same person?", fake: "What’s a project you’d redo just for better marks?" },
  { real: "Who’s the one person you wish hadn’t moved on?", fake: "Who’s the one person who switched colleges you miss?" },
  { real: "What’s something you hide from everyone?", fake: "What’s a habit you hide from your roommates?" },
  { real: "Who’s someone you can’t look in the eye anymore?", fake: "Who’s someone you can’t talk to without laughing?" },
  { real: "What’s the last thing you wished ended differently?", fake: "What’s the last match you wished ended differently?" },
  { real: "Who’s the person who ruined ‘forever’ for you?", fake: "Who’s the person who ruined group projects for you?" }


];


  // pick random question set
  const question = questions[Math.floor(Math.random() * questions.length)];

  // assign one bluffer
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const bluffPlayer = shuffled[0];

  const assignments: { [key: string]: 'truth' | 'bluff' } = {};
  playerIds.forEach(id => {
    assignments[id] = id === bluffPlayer ? 'bluff' : 'truth';
  });

  return {
    phase: 'answering',
    realQuestion: question.real,
    fakeQuestion: question.fake,
    assignments,
    answers: {},
    votes: {},
    round: 1,
    timer: 60 // 60 seconds for voting
  };
};


export interface PlayerOption {
  name: string;
  role: string; // specialization or position
}

export interface TeamGameState {
  phase: 'drafting' | 'complete';
  category: string;
  players: string[];
  teams: { [key: string]: PlayerOption[] };
  currentPicker: number;
  availableOptions: PlayerOption[];
  round: number;
  teamSize: number;
}

export const initTeamGame = (playerIds: string[]): TeamGameState => {
  const categories = [
    {
      name: 'Cricket Dream Team',
      options: [
        { name: 'Sachin Tendulkar', role: 'Batsman' },
        { name: 'Virat Kohli', role: 'Batsman' },
        { name: 'MS Dhoni', role: 'Wicketkeeper-Batsman' },
        { name: 'Rohit Sharma', role: 'Batsman' },
        { name: 'Rahul Dravid', role: 'Batsman' },
        { name: 'Sourav Ganguly', role: 'Batsman' },
        { name: 'Yuvraj Singh', role: 'All-Rounder' },
        { name: 'Kapil Dev', role: 'All-Rounder' },
        { name: 'Hardik Pandya', role: 'All-Rounder' },
        { name: 'Ravindra Jadeja', role: 'All-Rounder' },
        { name: 'Anil Kumble', role: 'Bowler' },
        { name: 'Zaheer Khan', role: 'Bowler' },
        { name: 'Jasprit Bumrah', role: 'Bowler' },
        { name: 'Mohammed Shami', role: 'Bowler' },
        { name: 'Ashwin', role: 'Bowler' },
        { name: 'Rishabh Pant', role: 'Wicketkeeper-Batsman' },
        { name: 'VVS Laxman', role: 'Batsman' },
        { name: 'Bhuvneshwar Kumar', role: 'Bowler' },
        { name: 'KL Rahul', role: 'Batsman' },
        { name: 'Shikhar Dhawan', role: 'Batsman' },
        { name: 'AB de Villiers', role: 'Wicketkeeper-Batsman' },
        { name: 'Jacques Kallis', role: 'All-Rounder' },
        { name: 'Brian Lara', role: 'Batsman' },
        { name: 'Ricky Ponting', role: 'Batsman' },
        { name: 'Glenn McGrath', role: 'Bowler' },
        { name: 'Shane Warne', role: 'Bowler' },
        { name: 'Adam Gilchrist', role: 'Wicketkeeper-Batsman' },
        { name: 'Steve Smith', role: 'Batsman' },
        { name: 'Ben Stokes', role: 'All-Rounder' },
        { name: 'Joe Root', role: 'Batsman' },
        { name: 'James Anderson', role: 'Bowler' },
        { name: 'Stuart Broad', role: 'Bowler' },
        { name: 'Kane Williamson', role: 'Batsman' },
        { name: 'Ross Taylor', role: 'Batsman' },
        { name: 'Brendon McCullum', role: 'Wicketkeeper-Batsman' },
        { name: 'Trent Boult', role: 'Bowler' },
        { name: 'Tim Southee', role: 'Bowler' },
        { name: 'Daniel Vettori', role: 'Bowler' },
        { name: 'Shaun Pollock', role: 'All-Rounder' },
        { name: 'Graeme Smith', role: 'Batsman' },
        { name: 'Dale Steyn', role: 'Bowler' },
        { name: 'Hashim Amla', role: 'Batsman' },
        { name: 'Faf du Plessis', role: 'Batsman' },
        { name: 'Wasim Akram', role: 'Bowler' },
        { name: 'Waqar Younis', role: 'Bowler' },
        { name: 'Shahid Afridi', role: 'All-Rounder' },
        { name: 'Inzamam-ul-Haq', role: 'Batsman' },
        { name: 'Imran Khan', role: 'All-Rounder' },
        { name: 'Chris Gayle', role: 'Batsman' },
        { name: 'Curtly Ambrose', role: 'Bowler' },
        { name: 'Brian Lara', role: 'Batsman' },
        { name: 'Kieron Pollard', role: 'All-Rounder' },
        { name: 'Andre Russell', role: 'All-Rounder' },
        { name: 'Muttiah Muralitharan', role: 'Bowler' },
        { name: 'Kumar Sangakkara', role: 'Wicketkeeper-Batsman' },
        { name: 'Mahela Jayawardene', role: 'Batsman' },
        { name: 'Lasith Malinga', role: 'Bowler' },
        { name: 'Sanath Jayasuriya', role: 'All-Rounder' },
        { name: 'David Warner', role: 'Batsman' },
        { name: 'Mitchell Starc', role: 'Bowler' },
        { name: 'Michael Clarke', role: 'Batsman' },
        { name: 'Matthew Hayden', role: 'Batsman' },
        { name: 'Justin Langer', role: 'Batsman' },
        { name: 'Usman Khawaja', role: 'Batsman' },
        { name: 'Aaron Finch', role: 'Batsman' },
        { name: 'Adam Zampa', role: 'Bowler' },
        { name: 'Travis Head', role: 'Batsman' },
        { name: 'Alex Carey', role: 'Wicketkeeper' }
      ],
      teamSize: 11
    },
    {
      name: 'Football Legends',
      options: [
        { name: 'Lionel Messi', role: 'Forward' },
        { name: 'Cristiano Ronaldo', role: 'Forward' },
        { name: 'Neymar Jr', role: 'Forward' },
        { name: 'Kylian Mbappé', role: 'Forward' },
        { name: 'Erling Haaland', role: 'Striker' },
        { name: 'Luka Modrić', role: 'Midfielder' },
        { name: 'Toni Kroos', role: 'Midfielder' },
        { name: 'Sergio Ramos', role: 'Defender' },
        { name: 'Marcelo', role: 'Defender' },
        { name: 'Casemiro', role: 'Midfielder' },
        { name: 'Ronaldinho', role: 'Attacking Midfielder' },
        { name: 'Ronaldo Nazário', role: 'Striker' },
        { name: 'Kaká', role: 'Midfielder' },
        { name: 'Roberto Carlos', role: 'Defender' },
        { name: 'Pelé', role: 'Forward' },
        { name: 'Diego Maradona', role: 'Attacking Midfielder' },
        { name: 'Thierry Henry', role: 'Forward' },
        { name: 'Wayne Rooney', role: 'Forward' },
        { name: 'David Beckham', role: 'Midfielder' },
        { name: 'Zinedine Zidane', role: 'Midfielder' },
        { name: 'Xavi', role: 'Midfielder' },
        { name: 'Andrés Iniesta', role: 'Midfielder' },
        { name: 'Carles Puyol', role: 'Defender' },
        { name: 'Gerard Piqué', role: 'Defender' },
        { name: 'Sergio Busquets', role: 'Defensive Midfielder' },
        { name: 'Luis Suárez', role: 'Striker' },
        { name: 'Edinson Cavani', role: 'Forward' },
        { name: 'Robert Lewandowski', role: 'Striker' },
        { name: 'Manuel Neuer', role: 'Goalkeeper' },
        { name: 'Philipp Lahm', role: 'Defender' },
        { name: 'Thomas Müller', role: 'Forward' },
        { name: 'Franck Ribéry', role: 'Winger' },
        { name: 'Arjen Robben', role: 'Winger' },
        { name: 'Paul Pogba', role: 'Midfielder' },
        { name: 'N\'Golo Kanté', role: 'Midfielder' },
        { name: 'Karim Benzema', role: 'Forward' },
        { name: 'Gareth Bale', role: 'Winger' },
        { name: 'Marc-André ter Stegen', role: 'Goalkeeper' },
        { name: 'Alisson Becker', role: 'Goalkeeper' },
        { name: 'Virgil van Dijk', role: 'Defender' },
        { name: 'Mohamed Salah', role: 'Forward' },
        { name: 'Kevin De Bruyne', role: 'Midfielder' },
        { name: 'Harry Kane', role: 'Striker' },
        { name: 'Heung-Min Son', role: 'Winger' },
        { name: 'Jack Grealish', role: 'Midfielder' },
        { name: 'Erik ten Hag', role: 'Coach' },
        { name: 'Pep Guardiola', role: 'Coach' },
        { name: 'José Mourinho', role: 'Coach' },
        { name: 'Didier Drogba', role: 'Striker' },
        { name: 'Frank Lampard', role: 'Midfielder' },
        { name: 'Steven Gerrard', role: 'Midfielder' },
        { name: 'Rio Ferdinand', role: 'Defender' },
        { name: 'Nemanja Vidić', role: 'Defender' },
        { name: 'Peter Schmeichel', role: 'Goalkeeper' },
        { name: 'Gianluigi Buffon', role: 'Goalkeeper' },
        { name: 'Andrea Pirlo', role: 'Midfielder' },
        { name: 'Del Piero', role: 'Forward' },
        { name: 'Francesco Totti', role: 'Forward' },
        { name: 'Paolo Maldini', role: 'Defender' },
        { name: 'Franco Baresi', role: 'Defender' },
        { name: 'George Best', role: 'Winger' },
        { name: 'Bobby Charlton', role: 'Midfielder' },
        { name: 'Eric Cantona', role: 'Forward' },
        { name: 'Ryan Giggs', role: 'Winger' },
        { name: 'Roy Keane', role: 'Midfielder' },
        { name: 'Wayne Rooney', role: 'Forward' }
      ],
      teamSize: 11
    },
    {
      name: 'Anime Squad',
      options: [
        { name: 'Naruto Uzumaki', role: 'Ninja' },
        { name: 'Sasuke Uchiha', role: 'Ninja' },
        { name: 'Kakashi Hatake', role: 'Sensei' },
        { name: 'Luffy', role: 'Pirate Captain' },
        { name: 'Zoro', role: 'Swordsman' },
        { name: 'Goku', role: 'Saiyan Fighter' },
        { name: 'Vegeta', role: 'Prince of Saiyans' },
        { name: 'Levi Ackerman', role: 'Soldier' },
        { name: 'Eren Yeager', role: 'Titan Shifter' },
        { name: 'Tanjiro Kamado', role: 'Demon Slayer' }
      ],
      teamSize: 3
    },
    {
      name: 'Superhero Team',
      options: [
        { name: 'Iron Man', role: 'Tech Genius' },
        { name: 'Captain America', role: 'Super Soldier' },
        { name: 'Thor', role: 'God of Thunder' },
        { name: 'Hulk', role: 'Scientist/Powerhouse' },
        { name: 'Black Widow', role: 'Spy' },
        { name: 'Spider-Man', role: 'Web-Slinger' },
        { name: 'Doctor Strange', role: 'Sorcerer Supreme' },
        { name: 'Batman', role: 'Strategist' },
        { name: 'Superman', role: 'Alien Powerhouse' },
        { name: 'Wonder Woman', role: 'Warrior Princess' }
      ],
      teamSize: 3
    }
  ];

  const category = categories[Math.floor(Math.random() * categories.length)];
  const teams: { [key: string]: PlayerOption[] } = {};
  playerIds.forEach(id => (teams[id] = []));

  return {
    phase: 'drafting',
    category: category.name,
    players: playerIds,
    teams,
    currentPicker: 0,
    availableOptions: [...category.options],
    round: 1,
    teamSize: category.teamSize
  };
};


export const initWavelengthGame = (playerIds: string[]): WavelengthGameState => {
  const spectrums = [
    { left: '❄️ Freezing Cold', right: '🔥 Burning Hot' },
    { left: '😐 Boring', right: '🤣 Hilarious' },
    { left: '😇 Innocent', right: '😈 Evil' },
    { left: '🐌 Slow', right: '⚡ Fast' },
    { left: '🤓 Nerdy', right: '😎 Cool' },
    { left: '💤 Lazy', right: '💪 Hardworking' }
  ];

  const spectrum = spectrums[Math.floor(Math.random() * spectrums.length)];
  const target = Math.floor(Math.random() * 100);
  const clueGiver = playerIds[Math.floor(Math.random() * playerIds.length)];

  return {
    phase: 'clue',
    spectrum,
    target,
    clueGiver,
    clue: '',
    guesses: {},
    round: 1
  };
};

// gameLogic/wordGuess.ts

export interface WordGuessGameState {
  phase: 'guessing' | 'ended';
  targetWord: string;
  hints: string[];
  guesses: Record<string, string>;
  hintsUsed: number;
  maxHints: number;
  round: number;
}

export const initWordGuessGame = (playerIds: string[]): WordGuessGameState => {
  const personalities = Object.keys(personalityHints);
  const targetWord = personalities[Math.floor(Math.random() * personalities.length)];

  return {
    phase: 'guessing',
    targetWord,
    hints: [],
    guesses: {},
    hintsUsed: 0,
    maxHints: 10,
    round: 1
  };
};

// ✅ Generate hints progressively
export const generateWordHint = (word: string, hintsUsed: number): string => {
  const allHints = personalityHints[word] || [];
  return allHints[Math.min(hintsUsed, allHints.length - 1)] || "No more hints!";
};

// ✅ Guess checker (accepts first name OR surname)
export const isGuessCorrect = (word: string, guess: string): boolean => {
  const normalizedGuess = guess.trim().toLowerCase();
  const parts = word.toLowerCase().split(" ");
  return parts.some(p => normalizedGuess === p);
};

// 🏆 Master list of 100 rare personalities with 10 hints each
export const personalityHints: Record<string, string[]> = {
  // ⚽ FOOTBALL LEGENDS
  "Lionel Messi": [
  "Footballer",
  "Male athlete",
  "From South America",
  "Short and left-footed",
  "Played most of career in Spain",
  "Nicknamed ‘La Pulga’",
  "Won 2022 World Cup",
  "Has 8 Ballon d'Ors",
  "Played for Barcelona and PSG",
  "Argentinian GOAT"
],

"Cristiano Ronaldo": [
  "Footballer",
  "Male athlete",
  "European superstar",
  "Fitness icon",
  "Known for headers and goals",
  "Celebration goes 'Siuuu!'",
  "Played for Man United, Real Madrid, Juventus",
  "Portugal captain",
  "Has over 850 career goals",
  "CR7 legend"
],

"Kylian Mbappe": [
  "Footballer",
  "French player",
  "Fast as lightning",
  "World Cup winner as a teen",
  "Played for PSG",
  "Wears number 10 for France",
  "Hat-trick in 2022 final",
  "Linked with Real Madrid for years",
  "Born in 1998",
  "Face of new generation"
],

"Erling Haaland": [
  "Footballer",
  "European striker",
  "From Norway",
  "Tall and powerful",
  "Plays for Manchester City",
  "Robotic finisher",
  "Son of a footballer",
  "Meditation goal celebration",
  "Scored 36 EPL goals in a season",
  "Blonde beast"
],

"Neymar Jr": [
  "Footballer",
  "Brazilian",
  "Skillful and flashy",
  "Known for dribbling and flair",
  "Played for Barcelona and PSG",
  "Wears number 10",
  "Star of 2014 and 2018 World Cups",
  "Huge on social media",
  "Friend of Messi",
  "Brazilian magician"
],

"Robert Lewandowski": [
  "Footballer",
  "European striker",
  "From Poland",
  "Goal-scoring machine",
  "Played for Bayern Munich",
  "Now at Barcelona",
  "Known for consistency",
  "Scored 5 goals in 9 minutes",
  "Ballon d’Or contender",
  "Polish legend"
],

"Luka Modric": [
  "Footballer",
  "From Croatia",
  "Midfield maestro",
  "Plays for Real Madrid",
  "Golden Ball 2018 WC",
  "Known for outside-foot passes",
  "Small but brilliant",
  "Led Croatia to WC final",
  "Wears number 10",
  "Classy playmaker"
],

"Sergio Ramos": [
  "Footballer",
  "Spanish defender",
  "Tough and aggressive",
  "Captain material",
  "Played for Real Madrid",
  "Known for headers and penalties",
  "Won multiple UCLs",
  "From Sevilla",
  "Has red card record",
  "Spain’s warrior"
],

"Harry Kane": [
  "Footballer",
  "From England",
  "Captain of his national team",
  "Known for shooting accuracy",
  "Played for Tottenham",
  "Moved to Bayern Munich",
  "Golden Boot winner",
  "Calm finisher",
  "Married to childhood sweetheart",
  "England’s striker"
],

"Vinicius Jr": [
  "Footballer",
  "Brazilian winger",
  "Fast and tricky",
  "Plays for Real Madrid",
  "Known for celebrations",
  "Young superstar",
  "La Liga champion",
  "Scored in UCL final 2022",
  "Has rivalry with Barca fans",
  "Next-gen Brazilian"
],

// 🏏 Cricket Stars

"Sachin Tendulkar": [
  "Cricketer",
  "Male athlete",
  "From India",
  "Started young",
  "Wore number 10 jersey",
  "Called ‘God of Cricket’",
  "Played for Mumbai Indians",
  "Scored 100 centuries",
  "Won 2011 World Cup",
  "Little Master"
],

"Virat Kohli": [
  "Cricketer",
  "Indian batsman",
  "Known for aggression",
  "Fitness icon",
  "Married to a Bollywood actress",
  "Plays for RCB",
  "Called ‘King’",
  "Chased 183 vs Pakistan",
  "Delhi-born",
  "Modern legend"
],

"MS Dhoni": [
  "Cricketer",
  "Indian captain",
  "Wicketkeeper",
  "Known as Captain Cool",
  "Finished 2011 final with a six",
  "Led India to all ICC titles",
  "CSK icon",
  "From Ranchi",
  "Served in Indian Army",
  "Best finisher"
],

"AB de Villiers": [
  "Cricketer",
  "South African",
  "Mr. 360",
  "Played for RCB",
  "Inventive batsman",
  "Fastest ODI century",
  "Electric fielder",
  "Retired early",
  "Loved by Indian fans",
  "Cricket’s Superman"
],

"Ben Stokes": [
  "Cricketer",
  "English all-rounder",
  "Born in New Zealand",
  "Known for comebacks",
  "2019 WC hero",
  "Played for Rajasthan Royals",
  "Aggressive leader",
  "Ashes fighter",
  "Hits sixes under pressure",
  "England’s warrior"
],

"Rohit Sharma": [
  "Cricketer",
  "Indian opener",
  "Known for elegance",
  "Captain of India (2023)",
  "Hit double centuries",
  "Plays for Mumbai Indians",
  "Nicknamed Hitman",
  "Loves sixes",
  "Calm personality",
  "World Cup giant"
],

"Babar Azam": [
  "Cricketer",
  "Pakistani batsman",
  "Stylish stroke player",
  "Captain of Pakistan",
  "Compared to Kohli",
  "Plays for Peshawar Zalmi",
  "Consistent performer",
  "Calm under pressure",
  "From Lahore",
  "Pakistan’s best"
],

// 🎬 Bollywood Icons

"Shah Rukh Khan": [
  "Actor",
  "Indian superstar",
  "Known for romantic roles",
  "Started from TV",
  "Owns a cricket team",
  "Famous pose with open arms",
  "Lives in Mannat",
  "Called King Khan",
  "Worked with Kajol",
  "SRK forever"
],

"Salman Khan": [
  "Actor",
  "Bollywood Bhai",
  "Action hero",
  "Host of Bigg Boss",
  "Owns 'Being Human'",
  "Never married",
  "Has loyal fanbase",
  "Famous for shirtless scenes",
  "Starred in Wanted, Sultan",
  "Eid release king"
],

"Deepika Padukone": [
  "Actress",
  "Indian film star",
  "From Bangalore",
  "Married to Ranveer Singh",
  "Started as model",
  "Debut opposite SRK",
  "Starred in Padmaavat",
  "Known for dimples",
  "One of India’s top actresses",
  "Queen of Bollywood"
],

"Ranbir Kapoor": [
  "Actor",
  "From Bollywood family",
  "Charming personality",
  "Married to Alia Bhatt",
  "Starred in Rockstar",
  "Played Sanjay Dutt in biopic",
  "Known for romantic films",
  "Son of Rishi Kapoor",
  "Loved by youth",
  "Bollywood prince"
],

"Alia Bhatt": [
  "Actress",
  "Bollywood star",
  "Started young",
  "Daughter of Mahesh Bhatt",
  "Married to Ranbir Kapoor",
  "Starred in Raazi and Gully Boy",
  "Won multiple Filmfares",
  "Singer as well",
  "Has British roots",
  "Modern queen"
],

// 🎤 Pop & Hollywood

"Taylor Swift": [
  "Singer",
  "American female artist",
  "Writes her own songs",
  "Known for breakup lyrics",
  "Started in country music",
  "Massive world tours",
  "Won multiple Grammys",
  "Famous for ‘Eras Tour’",
  "Swifties adore her",
  "Pop icon"
],

"Justin Bieber": [
  "Singer",
  "Canadian male artist",
  "Discovered on YouTube",
  "Started as teen idol",
  "Married to Hailey",
  "Known for ‘Baby’",
  "Collaborated with Ed Sheeran",
  "Has tattoos",
  "Changed musical style",
  "Pop phenomenon"
],

"Selena Gomez": [
  "Singer and actress",
  "From America",
  "Disney fame",
  "Best friends with Taylor Swift",
  "Starred in ‘Wizards of Waverly Place’",
  "Launched Rare Beauty",
  "Singer of ‘Calm Down’ collab",
  "Ex of Justin Bieber",
  "Mental health advocate",
  "Pop sweetheart"
],

"The Weeknd": [
  "Singer",
  "Canadian male artist",
  "Known for unique voice",
  "Created ‘Blinding Lights’",
  "Real name Abel Tesfaye",
  "Dark R&B style",
  "Performs with red jacket look",
  "Super Bowl performer",
  "Massive fanbase",
  "XO legend"
],

"Billie Eilish": [
  "Singer",
  "American artist",
  "Known for whisper singing",
  "Won Grammy for Album of the Year",
  "Brother is Finneas",
  "Famous for ‘Bad Guy’",
  "Unique green hair phase",
  "Loves baggy clothes",
  "Pop rebel",
  "Youngest major Grammy winner"
],

"Harry Styles": [
  "Singer",
  "British male artist",
  "Ex-member of One Direction",
  "Solo hit ‘As It Was’",
  "Known for gender-fluid fashion",
  "Actor too",
  "Won Grammy for Album of the Year",
  "From England",
  "Massive fan following",
  "Stylish icon"
],

"Beyonce": [
  "Singer",
  "American superstar",
  "Known for stage presence",
  "Former Destiny’s Child member",
  "Married to Jay-Z",
  "Performer of ‘Halo’",
  "Multiple Grammy winner",
  "Queen Bey",
  "One of most powerful women",
  "Cultural icon"
],

// 🏆 Global Sports + Rare Ones

"Usain Bolt": [
  "Athlete",
  "Jamaican sprinter",
  "Fastest man alive",
  "World record 9.58s",
  "Known for lightning pose",
  "Won multiple Olympic golds",
  "Retired as legend",
  "Dominated from 2008–2016",
  "Nickname Lightning Bolt",
  "Track GOAT"
],

"Roger Federer": [
  "Tennis player",
  "Swiss legend",
  "Graceful player",
  "20 Grand Slams",
  "Known for one-handed backhand",
  "Rival of Nadal and Djokovic",
  "Wimbledon hero",
  "Retired 2022",
  "Calm personality",
  "Tennis artist"
],

"Michael Phelps": [
  "Swimmer",
  "American athlete",
  "Most decorated Olympian",
  "Won 23 gold medals",
  "Dominated Beijing 2008",
  "Specialist in butterfly stroke",
  "Tall swimmer",
  "Mental health advocate",
  "Nicknamed The Fish",
  "Olympic legend"
],

"Novak Djokovic": [
  "Tennis player",
  "From Serbia",
  "World No.1 many times",
  "Rival to Nadal and Federer",
  "Vegan and flexible",
  "Known for mental strength",
  "20+ Grand Slam titles",
  "Australian Open king",
  "Perfectionist athlete",
  "Tennis machine"
],

"Serena Williams": [
  "Tennis player",
  "American female athlete",
  "23 Grand Slam titles",
  "Powerful serve",
  "Sister of Venus",
  "Known for comebacks",
  "Mother and champion",
  "Fought for equality",
  "GOAT of women’s tennis",
  "Icon of dominance"
],
"Lewis Hamilton": [
  "F1 driver",
  "British racing legend",
  "Drives for Mercedes",
  "Seven-time world champion",
  "Car number 44",
  "Known for fashion and activism",
  "Vegan athlete",
  "Owns bulldog named Roscoe",
  "Rivalry with Verstappen",
  "Speed and style icon"
],

"Max Verstappen": [
  "F1 driver",
  "From the Netherlands",
  "Red Bull Racing star",
  "Won three consecutive world titles",
  "Aggressive driver",
  "Son of former F1 racer",
  "Famous number 1 car",
  "Known for bold overtakes",
  "Youngest GP winner",
  "F1’s new king"
],

"David Beckham": [
  "Footballer",
  "English icon",
  "Played for Manchester United",
  "Known for free kicks",
  "Married to Victoria",
  "Fashion trendsetter",
  "Golden right foot",
  "Part owner of Inter Miami",
  "England captain for years",
  "Global superstar"
],

"Karim Benzema": [
  "Footballer",
  "French striker",
  "Played for Real Madrid",
  "Ballon d’Or 2022 winner",
  "Known for technical skill",
  "Converted to Islam",
  "Played with Ronaldo",
  "Moved to Saudi Arabia",
  "Wears number 9",
  "Calm and composed finisher"
],

"Zlatan Ibrahimovic": [
  "Footballer",
  "Swedish striker",
  "Known for arrogance and skills",
  "Played for multiple clubs",
  "Taekwondo-style goals",
  "Nicknamed ‘Ibra’",
  "Famous for one-liners",
  "Retired in 2023",
  "Scored 500+ career goals",
  "Lion mentality"
],

"Antoine Griezmann": [
  "Footballer",
  "French attacker",
  "Played for Atletico Madrid",
  "Known for pink hair phase",
  "Won 2018 World Cup",
  "Loves Fortnite dances",
  "Nicknamed Grizi",
  "Stylish celebrations",
  "La Liga star",
  "Versatile forward"
],

"Son Heung-Min": [
  "Footballer",
  "South Korean",
  "Captain of national team",
  "Plays for Tottenham",
  "Premier League Golden Boot winner",
  "Known for humility",
  "Military service completed",
  "Fast and two-footed",
  "Asian superstar",
  "Smile assassin"
],

"Kevin De Bruyne": [
  "Footballer",
  "Belgian midfielder",
  "Plays for Manchester City",
  "Known for perfect passes",
  "Ginger-haired playmaker",
  "Won UCL 2023",
  "Calm and clinical",
  "Called ‘KDB’",
  "Crossing genius",
  "Brains of Pep’s system"
],

"Paulo Dybala": [
  "Footballer",
  "From Argentina",
  "Played for Juventus and Roma",
  "Left-footed attacker",
  "Nicknamed ‘La Joya’ (The Jewel)",
  "Known for mask celebration",
  "Close friend of Messi",
  "In 2022 World Cup squad",
  "Stylish dribbler",
  "Argentinian star"
],

"Marcus Rashford": [
  "Footballer",
  "From England",
  "Plays for Manchester United",
  "Campaigns against child hunger",
  "Known for free kicks",
  "Fast and technical",
  "Wears number 10",
  "Scored in Europa finals",
  "Humble background",
  "Hero on and off pitch"
],

"Virender Sehwag": [
  "Cricketer",
  "Indian opener",
  "Known for fearless batting",
  "Scored 300+ twice in Tests",
  "Started every innings with boundary",
  "From Delhi",
  "Retired early",
  "Nicknamed ‘Viru’",
  "Now a witty commentator",
  "Sultan of Multan"
],

"Ravindra Jadeja": [
  "Cricketer",
  "Indian all-rounder",
  "Known for sword celebration",
  "Plays for CSK",
  "Brilliant fielder",
  "From Gujarat",
  "Nicknamed ‘Sir Jadeja’",
  "Left-arm spinner",
  "Match-winner in Tests",
  "India’s Rockstar"
],

"Hardik Pandya": [
  "Cricketer",
  "Indian all-rounder",
  "Known for tattoos and bling",
  "From Gujarat",
  "Captain of GT in IPL",
  "Married to model Natasa",
  "Fast-bowling all-rounder",
  "Dynamic finisher",
  "Swag on and off field",
  "Next-gen star"
],

"Glenn Maxwell": [
  "Cricketer",
  "Australian all-rounder",
  "Nicknamed ‘The Big Show’",
  "Explosive hitter",
  "Played for RCB",
  "Mental health advocate",
  "Known for reverse sweeps",
  "Part-time spinner",
  "World Cup winner",
  "Entertainment machine"
],

"Pat Cummins": [
  "Cricketer",
  "Australian captain",
  "Fast bowler",
  "Known for pace and line",
  "Calm leader",
  "Won WTC 2023",
  "IPL player for KKR",
  "Top-ranked bowler",
  "Economics degree holder",
  "Silent destroyer"
],

"Shubman Gill": [
  "Cricketer",
  "Indian opener",
  "From Punjab",
  "Next-gen superstar",
  "Elegant strokeplay",
  "Scored double century in ODIs",
  "Plays for Gujarat Titans",
  "Stylish personality",
  "Nicknamed ‘Prince’",
  "Future captain material"
],

"Ricky Ponting": [
  "Cricketer",
  "Australian legend",
  "Former captain",
  "Aggressive batsman",
  "Won 3 World Cups",
  "Fielding master",
  "Coach post-retirement",
  "Nicknamed ‘Punter’",
  "From Tasmania",
  "Aussie great"
],

"Chris Gayle": [
  "Cricketer",
  "West Indian",
  "Known as ‘Universe Boss’",
  "Explosive opener",
  "Played for RCB and KXIP",
  "Loved dancing on field",
  "Six-hitting machine",
  "Party animal",
  "Jamaican entertainer",
  "T20 king"
],

"Kane Williamson": [
  "Cricketer",
  "New Zealand captain",
  "Known for calmness",
  "Technically perfect batsman",
  "Won WTC 2021",
  "Soft-spoken leader",
  "Respected globally",
  "From Tauranga",
  "Gentleman cricketer",
  "Steady and solid"
],

"Yuvraj Singh": [
  "Cricketer",
  "Indian legend",
  "Hit 6 sixes in an over",
  "2007 and 2011 hero",
  "Beat cancer",
  "Stylish left-hander",
  "From Punjab",
  "Nicknamed ‘Yuvi’",
  "Played for multiple IPL teams",
  "Champion spirit"
],

"Rafael Nadal": [
  "Tennis player",
  "Spanish left-hander",
  "King of Clay",
  "22 Grand Slams",
  "Rival of Federer and Djokovic",
  "Known for intensity",
  "From Mallorca",
  "Olympic gold medalist",
  "Famous sleeveless shirts",
  "Fighting spirit"
],

"Cristiano Ronaldo Jr": [
  "Footballer",
  "Son of CR7",
  "Young talent",
  "Plays in academy teams",
  "Already scoring goals",
  "Mini version of his dad",
  "Has same celebration",
  "Seen training with Ronaldo",
  "Next-gen prodigy",
  "Future star"
],

"Tom Cruise": [
  "Actor",
  "Hollywood superstar",
  "Known for Mission Impossible",
  "Does his own stunts",
  "Scientology member",
  "Top Gun hero",
  "Multiple box-office hits",
  "Known for smile",
  "Started in the 1980s",
  "Action legend"
],

"Keanu Reeves": [
  "Actor",
  "Canadian superstar",
  "Known for Matrix and John Wick",
  "Calm and humble personality",
  "Loves motorcycles",
  "Fans call him wholesome",
  "Tragic past",
  "Nicknamed ‘The Internet’s Boyfriend’",
  "Lives simply",
  "Hollywood nice guy"
],

"Margot Robbie": [
  "Actress",
  "Australian",
  "Played Harley Quinn",
  "Starred in Barbie",
  "Blonde and confident",
  "Known for Wolf of Wall Street",
  "Producer too",
  "Married to Tom Ackerley",
  "Stylish on red carpet",
  "Hollywood sensation"
],

"Ryan Reynolds": [
  "Actor",
  "Canadian comedian",
  "Plays Deadpool",
  "Married to Blake Lively",
  "Witty humor",
  "Owns a football club",
  "Business ventures in gin",
  "Self-deprecating jokes",
  "Fan-favorite online",
  "Hollywood’s funny guy"
],

"Zendaya": [
  "Actress and singer",
  "From the US",
  "Starred in Euphoria",
  "Plays MJ in Spider-Man",
  "Dated co-star Tom Holland",
  "Former Disney star",
  "Known for elegance",
  "Fashion icon",
  "Multiple Emmy winner",
  "Gen-Z queen"
],

"Tom Holland": [
  "Actor",
  "British",
  "Plays Spider-Man",
  "Dated Zendaya",
  "Started in Billy Elliot musical",
  "Marvel superstar",
  "Acrobatic and fit",
  "Young and energetic",
  "Fan favorite",
  "Web-slinging hero"
],

"Dwayne Johnson": [
  "Actor",
  "Former wrestler",
  "Known as ‘The Rock’",
  "Massive physique",
  "Starred in Jumanji, Fast & Furious",
  "Motivational speaker",
  "Bald and bold",
  "Fitness enthusiast",
  "Samoan roots",
  "Global megastar"
],

"Johnny Depp": [
  "Actor",
  "Hollywood legend",
  "Played Jack Sparrow",
  "Known for eccentric roles",
  "Involved in famous trial",
  "Musician as well",
  "Fans adore his charm",
  "Worked with Tim Burton",
  "Rebel personality",
  "Pirates of the Caribbean icon"
],

"Emma Watson": [
  "Actress",
  "British",
  "Known for playing Hermione",
  "UN Women Ambassador",
  "Graduated from Brown",
  "Feminist icon",
  "Starred in Beauty and the Beast",
  "Activist for equality",
  "Elegant personality",
  "Intelligent star"
],

"Priyanka Chopra": [
  "Actress",
  "Indian global star",
  "Miss World 2000",
  "Married to Nick Jonas",
  "Worked in Hollywood and Bollywood",
  "Singer as well",
  "From Bareilly",
  "Starred in Quantico",
  "Mother and producer",
  "Desi girl"
],

"Nick Jonas": [
  "Singer and actor",
  "Member of Jonas Brothers",
  "Married to Priyanka Chopra",
  "Started as Disney teen star",
  "Has diabetes awareness foundation",
  "Pop-rock performer",
  "American artist",
  "Actor in Jumanji",
  "Youngest Jonas brother",
  "Charming performer"
],

"Bill Gates": [
  "Entrepreneur",
  "American billionaire",
  "Co-founder of Microsoft",
  "Philanthropist",
  "Divorced in 2021",
  "Known for glasses and sweaters",
  "Runs charitable foundation",
  "Once world’s richest",
  "Tech visionary",
  "Microsoft pioneer"
],

"Elon Musk": [
  "Entrepreneur",
  "CEO of multiple companies",
  "Runs Tesla and SpaceX",
  "From South Africa",
  "Known for controversial tweets",
  "Bought Twitter",
  "Inventive yet chaotic",
  "Father of many kids",
  "Owns X and Neuralink",
  "Future-focused billionaire"
],

"Mark Zuckerberg": [
  "Entrepreneur",
  "Co-founder of Facebook",
  "Created it from Harvard dorm",
  "Now owns Meta",
  "Robot-like persona meme",
  "Married to Priscilla Chan",
  "Loves jiu-jitsu",
  "Young billionaire",
  "VR enthusiast",
  "Tech empire builder"
],

"Lionel Messi Jr": [
  "Child celebrity",
  "Son of Messi",
  "Argentine origin",
  "Born in Spain",
  "Seen at World Cup celebrations",
  "Football-loving kid",
  "Plays in Inter Miami academy",
  "Cute football prodigy",
  "Mini Messi",
  "Future legend in making"
],

"Cillian Murphy": [
  "Actor",
  "Irish",
  "Known for Peaky Blinders",
  "Played Oppenheimer",
  "Sharp blue eyes",
  "Prefers privacy",
  "Calm and intense",
  "Stage background",
  "BAFTA winner",
  "Serious performer"
],

"Robert Downey Jr": [
  "Actor",
  "Hollywood icon",
  "Played Iron Man",
  "Comeback king",
  "Known for wit and confidence",
  "Faced addiction early",
  "Marvel’s pioneer",
  "Oscar winner 2024",
  "Sharp humor",
  "Genius Billionaire Playboy"
],

"Chris Evans": [
  "Actor",
  "Plays Captain America",
  "From Boston",
  "Known for kindness",
  "Marvel heartthrob",
  "Dog lover",
  "Hollywood nice guy",
  "Retired from MCU",
  "Worked with RDJ and Hemsworth",
  "Patriotic hero"
],

"Michael Jordan": [
  "Basketball player",
  "American legend",
  "6x NBA champion",
  "Chicago Bulls hero",
  "Air Jordan brand founder",
  "Known for tongue-out dunk",
  "Space Jam actor",
  "GOAT of basketball",
  "Number 23",
  "Sports business mogul"
],

"Kobe Bryant": [
  "Basketball player",
  "Late NBA legend",
  "Played for Lakers",
  "Known as ‘Mamba’",
  "5x NBA Champion",
  "Famous work ethic",
  "Oscar winner post-retirement",
  "Died in helicopter crash",
  "Inspired millions",
  "Mamba Mentality"
],

"Stephen Curry": [
  "Basketball player",
  "Golden State Warriors star",
  "Changed NBA with 3-pointers",
  "Two-time MVP",
  "Known for smile",
  "Married to Ayesha",
  "Devout Christian",
  "Undersized but dominant",
  "Revolutionized modern basketball",
  "Splash Brother"
],

"Lionel Scaloni": [
  "Football coach",
  "Argentinian manager",
  "Won 2022 World Cup",
  "Young tactician",
  "Guided Messi’s glory",
  "Calm and composed",
  "Loved by fans",
  "Started as interim coach",
  "Master of team unity",
  "Coach of Champions"
],

"Pep Guardiola": [
  "Football coach",
  "Spanish genius",
  "Manager of Manchester City",
  "Known for tiki-taka style",
  "Won UCL with Barca & City",
  "Former midfielder",
  "Philosopher of football",
  "Passionately animated on sidelines",
  "Perfectionist tactician",
  "Modern football mastermind"
]


};

// 🔁 Add more personalities similarly up to 100


export const initChainGame = (playerIds: string[]): ChainGameState => {
  const topics = [
    'Bollywood Actors', 'IPL Teams', 'Cricket Players', 'Anime Characters',
    'Fruits', 'Countries', 'Sports', 'Movies', 'Books', 'Superheroes',
    'Football Players', 'Indian States', 'Tech Companies', 'Animals', 'Colors'
  ];

  const topic = topics[Math.floor(Math.random() * topics.length)];

  return {
    phase: 'answering',
    topic,
    currentPlayerIdx: 0,
    activePlayers: playerIds,
    answers: {},
    round: 1,
    timePerAnswer: 5
  };
};

// --- UNO GAME LOGIC ---
export type UNOColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';
export type UNOValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | '+2' | 'wild' | '+4';

export interface UNOCard {
  color: UNOColor;
  value: UNOValue;
  id: string;
}

export interface UNOGameState {
  deck: UNOCard[];
  discardPile: UNOCard[];
  hands: Record<string, UNOCard[]>;
  currentPlayer: string;
  direction: 1 | -1;
  drawStack: number; // for stacking draw 2/4
  chosenColor?: UNOColor;
  phase: 'playing' | 'color-select';
  winner?: string;
}

// ✅ Generate deck
export function createUNODeck(): UNOCard[] {
  const colors: UNOColor[] = ['red', 'blue', 'green', 'yellow'];
  const values: UNOValue[] = ['0','1','2','3','4','5','6','7','8','9','skip','reverse','+2'];

  const deck: UNOCard[] = [];
  colors.forEach(color => {
    values.forEach(value => {
      deck.push({ color, value, id: `${color}-${value}-${Math.random()}` });
      if (value !== '0') deck.push({ color, value, id: `${color}-${value}-2-${Math.random()}` });
    });
  });
  // Wilds
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', value: 'wild', id: `wild-${i}-${Math.random()}` });
    deck.push({ color: 'wild', value: '+4', id: `wild+4-${i}-${Math.random()}` });
  }
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ✅ Check valid play
export function canPlayCard(card: UNOCard, top: UNOCard, chosenColor?: UNOColor) {
  if (card.color === 'wild') return true;
  return (
    card.color === top.color ||
    card.value === top.value ||
    (chosenColor && card.color === chosenColor)
  );
}

// ✅ Initialize UNO game
export function initUnoGame(players: string[]): UNOGameState {
  let deck = createUNODeck();
  const hands: Record<string, UNOCard[]> = {};

  players.forEach(id => {
    hands[id] = deck.splice(0, 7);
  });

  const discardPile = [deck.pop() as UNOCard];
  return {
    deck,
    discardPile,
    hands,
    currentPlayer: players[0],
    direction: 1,
    drawStack: 0,
    phase: 'playing'
  };
}

// ✅ Draw cards
export function drawCards(state: UNOGameState, playerId: string, count: number): UNOGameState {
  let deck = [...state.deck];
  let hands = { ...state.hands };

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      const newDeck = shuffle(state.discardPile.slice(0, -1));
      deck = newDeck;
      state.discardPile = [state.discardPile[state.discardPile.length - 1]];
    }
    hands[playerId].push(deck.pop() as UNOCard);
  }

  return { ...state, deck, hands };
}

// ✅ Play card
export function playCard(state: UNOGameState, playerId: string, card: UNOCard, chosenColor?: UNOColor): UNOGameState {
  const hands = { ...state.hands };
  hands[playerId] = hands[playerId].filter(c => c.id !== card.id);
  const discardPile = [...state.discardPile, card];

  let { direction, drawStack } = state;
  let nextPlayer = getNextPlayer(state, playerId);
  let phase: 'playing' | 'color-select' = 'playing';

  switch (card.value) {
    case 'reverse':
      direction *= -1;
      if (Object.keys(hands).length === 2) nextPlayer = playerId; // another turn
      break;
    case 'skip':
      nextPlayer = getNextPlayer(state, nextPlayer);
      break;
    case '+2':
      drawStack += 2;
      nextPlayer = getNextPlayer(state, playerId);
      break;
    case '+4':
      drawStack += 4;
      nextPlayer = getNextPlayer(state, playerId);
      phase = 'color-select';
      break;
    case 'wild':
      phase = 'color-select';
      break;
  }

  let winner: string | undefined = undefined;
  if (hands[playerId].length === 0) winner = playerId;

  return {
    ...state,
    hands,
    discardPile,
    currentPlayer: nextPlayer,
    direction,
    drawStack,
    chosenColor: chosenColor || state.chosenColor,
    phase,
    winner
  };
}

// ✅ Get next player
export function getNextPlayer(state: UNOGameState, current: string): string {
  const ids = Object.keys(state.hands);
  const idx = ids.indexOf(current);
  let nextIdx = (idx + state.direction + ids.length) % ids.length;
  return ids[nextIdx];
}

// ✅ Handle forced draw if no defense card
export function handleDrawStack(state: UNOGameState): UNOGameState {
  if (state.drawStack > 0) {
    const newState = drawCards(state, state.currentPlayer, state.drawStack);
    newState.drawStack = 0;
    newState.currentPlayer = getNextPlayer(state, state.currentPlayer);
    return newState;
  }
  return state;
}

// gameLogic.ts

// lib/gameLogic.ts
export type Tile = {
  id: string;
  ownerId: string | null; // which player owns it (assigned at init) or null = colorless
  color: string | null;
  revealed: boolean; // permanently revealed (clicked)
  tempRevealed?: boolean; // used for VIEW ability visual reveal (transient)
};

export type PlayerState = {
  id: string;
  name: string;
  color: string;
  revealedCount: number; // tiles revealed that belong to this player
  ownedCount: number; // how many tiles were assigned to this player initially
  abilities: { paint: number; stake: number; view: number }; // uses left
};

export type MemoryGameState = {
  started: boolean;
  grid: Tile[][];
  players: PlayerState[];
  turnOrder: string[]; // player ids in order
  turnIndex: number; // index into turnOrder for current player's turn
  stake?: { stakerId: string; active: boolean }; // active stake
  viewTiles?: string[]; // tile ids currently temporarily revealed (for view ability)
  config: {
    gridSize: number;
    minPerPlayer: number;
    maxPerPlayer: number;
  };
  // meta:
  createdAt: number;
};

const COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#84cc16", // lime
  "#10b981", // emerald
  "#f97316", // orange
  "#06b6d4", // teal
  "#374151",  // slate (10th)
  "#8b5cf6", // purple
  "#ec4899", // pink
  
];

const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const shuffleArray = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const uid = (prefix = "") =>
  prefix + Math.random().toString(36).slice(2, 9);

// Choose grid size based on number of players
const chooseGridSize = (numPlayers: number) => {
  if (numPlayers <= 2) return 7;
  if (numPlayers <= 4) return 8;
  return 9;
};

/**
 * Initialize MemoryGameState
 * players input: array of { id: string, name: string }
 */
export const initMemoryGameState = (playersInput: { id: string; name: string }[]): MemoryGameState => {
  if (!playersInput || playersInput.length === 0) throw new Error("Need players to init game");
  const gridSize = chooseGridSize(playersInput.length);
  const totalCells = gridSize * gridSize;

  // assign colors to players (up to 10)
  const playersShuffled = shuffleArray(playersInput);
  const usePlayers = playersShuffled.slice(0, Math.min(playersShuffled.length, COLORS.length));

  // build initial PlayerState array
  const playerStates: PlayerState[] = usePlayers.map((p, idx) => ({
    id: p.id,
    name: p.name,
    color: COLORS[idx % COLORS.length],
    revealedCount: 0,
    ownedCount: 0, // set below
    abilities: { paint: 1, stake: 1, view: 1 },
  }));

  // Assign initial owned tile counts per player: random between 8 and 15, but ensure sum <= totalCells
const minPer = 8;
const maxPer = 15;



// pick one random per-player count for all players
let perPlayer = randInt(minPer, maxPer);

// calculate total assigned
let totalAssigned = perPlayer * playerStates.length;

// ensure at least 10 tiles are left uncolored
if (totalAssigned > totalCells - 10) {
  // reduce perPlayer so that 10 colorless remain minimum
  perPlayer = Math.floor((totalCells - 10) / playerStates.length);
}

// now everyone gets equal number of tiles
const desiredCounts = playerStates.map(() => perPlayer);
  

  // create flat array of owners (playerId or null) length totalCells
  const ownerPool: (string | null)[] = [];
  playerStates.forEach((ps, idx) => {
    for (let k = 0; k < desiredCounts[idx]; k++) ownerPool.push(ps.id);
    ps.ownedCount = desiredCounts[idx];
  });
  // remaining cells are colorless
  while (ownerPool.length < totalCells) ownerPool.push(null);

  // shuffle owner pool and fill grid
  const shuffledOwners = shuffleArray(ownerPool);
  const grid: Tile[][] = [];
  let ptr = 0;
  for (let r = 0; r < gridSize; r++) {
    const row: Tile[] = [];
    for (let c = 0; c < gridSize; c++) {
      const ownerId = shuffledOwners[ptr] === null ? null : (shuffledOwners[ptr] as string);
      const color = ownerId ? playerStates.find(p => p.id === ownerId)!.color : null;
      row.push({
        id: uid("t_"),
        ownerId,
        color,
        revealed: true // initial preview: all shown for 5s; later component will hide them
      });
      ptr++;
    }
    grid.push(row);
  }

  const turnOrder = shuffleArray(playerStates.map(p => p.id));

  return {
    started: false,
    grid,
    players: playerStates,
    turnOrder,
    turnIndex: 0,
    stake: { stakerId: "", active: false },
    viewTiles: [],
    config: { gridSize, minPerPlayer: minPer, maxPerPlayer: maxPer },
    createdAt: Date.now()
  };
};

/**
 * Reveal a tile (player tap). Returns new state copy.
 *
 * Rules implemented:
 * - Only allow tap if it's the tapping player's turn
 * - If tile already revealed -> no op
 * - If tile.ownerId === tapping player => increment that player's revealedCount and award 1 point
 * - If tile has a different owner => that owner gets their tile revealed (counts towards their score)
 * - If stake.active and the clicked tile belongs to the clicking player (i.e., they found their own tile),
 *   then find staker and reveal one random unrevealed tile belonging to the staker (stake reward).
 * - Advance turnIndex (wrap-around)
 */
export const handleTileTap = (state: MemoryGameState, playerId: string, tileId: string): MemoryGameState => {
  // shallow clone top-level
  const next: MemoryGameState = { ...state, grid: state.grid.map(row => row.map(t => ({ ...t }))), players: state.players.map(p => ({ ...p })) };

  const { turnOrder, turnIndex } = next;
  const currentPlayerId = turnOrder[turnIndex];
  if (playerId !== currentPlayerId) return next; // not your turn, ignore

  // find tile
  let found = false;
  outer: for (let r = 0; r < next.grid.length; r++) {
    for (let c = 0; c < next.grid[r].length; c++) {
      const t = next.grid[r][c];
      if (t.id === tileId) {
        if (t.revealed) break outer; // already permanently revealed -> ignore
        // reveal it permanently
        t.revealed = true;
        found = true;
        const ownerId = t.ownerId;
        if (ownerId) {
          // owner receives the reveal (point)
          const owner = next.players.find(p => p.id === ownerId);
          if (owner) owner.revealedCount = (owner.revealedCount || 0) + 1;
        }
        // stake handling: if someone has stake active and tapped tile belongs to tapping player (they found own tile),
        // reveal one random unrevealed tile belonging to staker
        if (next.stake && next.stake.active && next.stake.stakerId) {
          // if the clicked tile belongs to the clicking player (i.e., ownerId === playerId)
          if (ownerId === playerId) {
            const staker = next.players.find(p => p.id === next.stake!.stakerId);
            if (staker) {
              // find random unrevealed tile belonging to staker
              const stakerTiles: Tile[] = [];
              for (const row of next.grid) for (const tt of row) if (tt.ownerId === staker.id && !tt.revealed) stakerTiles.push(tt);
              if (stakerTiles.length > 0) {
                const pick = stakerTiles[Math.floor(Math.random() * stakerTiles.length)];
                pick.revealed = true;
                staker.revealedCount = (staker.revealedCount || 0) + 1;
              }
            }
          }
          // clear stake (one time)
          next.stake = { stakerId: "", active: false };
        }
        break outer;
      }
    }
  }

  if (!found) return next;

  // advance turn
  const nextIndex = (turnIndex + 1) % turnOrder.length;
  next.turnIndex = nextIndex;

  return next;
};

/**
 * Paint ability:
 * - Choose one random colorless (ownerId === null && !revealed) tile and assign it to player
 * - Choose one random tile owned by player that is not revealed and make it colorless (ownerId = null)
 * - Decrement ability use
 */
export const activatePaint = (state: MemoryGameState, playerId: string): MemoryGameState => {
  const next: MemoryGameState = { ...state, grid: state.grid.map(r => r.map(t => ({ ...t }))), players: state.players.map(p => ({ ...p })) };
  const me = next.players.find(p => p.id === playerId);
  if (!me || me.abilities.paint <= 0) return next;

  // find available colorless unrevealed tiles
  const colorless: Tile[] = [];
  for (const row of next.grid) for (const t of row) if (!t.revealed && !t.ownerId) colorless.push(t);
  if (colorless.length > 0) {
    const pick = colorless[Math.floor(Math.random() * colorless.length)];
    pick.ownerId = me.id;
    pick.color = me.color;
    me.ownedCount = (me.ownedCount || 0) + 1;
  }

  // now remove one random unrevealed tile of the player (if any)
  const ownUnrevealed: Tile[] = [];
  for (const row of next.grid) for (const t of row) if (!t.revealed && t.ownerId === me.id) ownUnrevealed.push(t);
  if (ownUnrevealed.length > 0) {
    const toRemove = ownUnrevealed[Math.floor(Math.random() * ownUnrevealed.length)];
    toRemove.ownerId = null;
    toRemove.color = null;
    me.ownedCount = Math.max(0, (me.ownedCount || 1) - 1);
  }

  me.abilities.paint = Math.max(0, me.abilities.paint - 1);
  return next;
};

/**
 * Stake ability:
 * - Marks stake active for the staker. If during someone else's turn that player reveals their OWN tile,
 *   the staker gets one of their unrevealed tiles revealed (done in handleTileTap).
 * - Decrement ability use
 */
export const activateStake = (state: MemoryGameState, playerId: string): MemoryGameState => {
  const next: MemoryGameState = { ...state, grid: state.grid.map(r => r.map(t => ({ ...t }))), players: state.players.map(p => ({ ...p })) };
  const me = next.players.find(p => p.id === playerId);
  if (!me || me.abilities.stake <= 0) return next;

  next.stake = { stakerId: me.id, active: true };
  me.abilities.stake = Math.max(0, me.abilities.stake - 1);
  return next;
};

/**
 * View part ability:
 * - pick ~25% tiles at random (or up to 15) and return state with viewTiles set
 * - component should present them for 3s and then call onUpdateState to clear them
 */
export const activateViewPart = (state: MemoryGameState, playerId?: string): MemoryGameState => {
  const next: MemoryGameState = { ...state, grid: state.grid.map(r => r.map(t => ({ ...t }))), players: state.players.map(p => ({ ...p })) };
  const me = playerId ? next.players.find(p => p.id === playerId) : undefined;
  if (me && me.abilities.view <= 0) return next;

  // build flat list of unrevealed tile ids (also include revealed? spec said show some tiles - show random tiles irrespective)
  const allTiles: Tile[] = [];
  for (const row of next.grid) for (const t of row) if (!t.revealed) allTiles.push(t);

  const count = Math.min(15, Math.max(3, Math.floor(next.grid.length * next.grid.length * 0.25)));
  const shuffled = shuffleArray(allTiles);
  const selected = shuffled.slice(0, count).map(t => t.id);
  next.viewTiles = selected;

  if (me) me.abilities.view = Math.max(0, me.abilities.view - 1);
  return next;
};

// lib/gameLogic (append these exports)

export type HerdPlayer = {
  id: string;
  name: string;
  score: number;       // starts at 0, goes down to -6
  answer?: string;     // last submitted answer (cleared on evaluate)
};

export type HerdGameState = {
  roomId?: string;
  phase: "waiting" | "answering" | "reveal" | "ended";
  round: number;
  category: string;
  players: HerdPlayer[];        // ordered list of players
  computerActive?: boolean;
  computerAnswer?: string | null;
  lastResult?: {
    majorityAnswers?: string[]; // canonical majority answers (lowercased)
    penalties?: { [id: string]: number };
  } | null;
};

const HERD_CATEGORIES: Record<string, string[]> = {
  "Fast Food Chains": ["McDonalds","KFC","Subway","Burger King","Dominos","Taco Bell","Pizza Hut","Wendys","Five Guys","Starbucks","Shake Shack","In-N-Out","Chipotle","Panera","Dunkin"],
  "Cartoon Characters": ["Mickey Mouse","SpongeBob","Tom","Jerry","Scooby-Doo","Donald Duck","Bugs Bunny","Popeye","Patrick","Shinchan","Doraemon","Pikachu","Charlie Brown","Garfield","Winnie the Pooh"],
  "Fruits": ["Apple","Banana","Orange","Mango","Grapes","Pineapple","Watermelon","Cherry","Guava","Peach","Pear","Kiwi","Papaya","Lychee","Strawberry"],
  "Animals": ["Dog","Cat","Lion","Tiger","Elephant","Giraffe","Monkey","Zebra","Rabbit","Horse","Fox","Bear","Deer","Kangaroo","Penguin"],
  "Colors": ["Red","Blue","Green","Yellow","Purple","Pink","Orange","White","Black","Brown","Cyan","Magenta","Teal","Olive","Maroon"],
  "Sports": ["Football","Cricket","Tennis","Hockey","Basketball","Baseball","Volleyball","Badminton","Rugby","Golf","Table Tennis","Boxing","Wrestling","Skating","Surfing"],
  "Movie Genres": ["Action","Comedy","Drama","Horror","Sci-Fi","Romance","Thriller","Animation","Documentary","Fantasy","Mystery","Musical","Western","Noir","Biopic"],
  "Car Brands": ["Tesla","BMW","Mercedes","Audi","Toyota","Honda","Ford","Hyundai","Nissan","Ferrari","Lamborghini","Kia","Volvo","Jaguar","Porsche"],
  "School Subjects": ["Maths","Science","English","History","Geography","Physics","Chemistry","Biology","Computer","Economics","Philosophy","Art","Music","PE","Sociology"],
  "Ice Cream Flavours": ["Chocolate","Vanilla","Strawberry","Mango","Butterscotch","Mint","Coffee","Cookies","Pistachio","Caramel","Rum Raisin","Neapolitan","Lemon","Blueberry","Coconut"],
  // ... add more categories as you want (50+) — kept 10 here for brevity
};

function getRandomCategory(): string {
  const keys = Object.keys(HERD_CATEGORIES);
  return keys[Math.floor(Math.random() * keys.length)];
}

function getRandomFromCategory(category: string): string {
  const list = HERD_CATEGORIES[category] || [];
  if (!list.length) return "";
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Initialize a HerdGameState for lobby -> active game.
 * playersInput: array of {id, name}
 */
export function initHerdGame(playersInput: { id: string; name: string }[], roomId?: string): HerdGameState {
  const players = playersInput.map(p => ({ id: p.id, name: p.name, score: 0 }));
  return {
    roomId,
    phase: "answering",
    round: 1,
    category: getRandomCategory(),
    players,
    computerActive: false,
    computerAnswer: null,
    lastResult: null,
  };
}

/**
 * Player submits an answer (string). Case-insensitive stored.
 */
export function herdSubmitAnswer(state: HerdGameState, playerId: string, answer: string): HerdGameState {
  const next = { ...state, players: state.players.map(p => p.id === playerId ? { ...p, answer: (answer || "").trim() } : p) };
  return next;
}

/**
 * Evaluate the current round:
 * - If more than 2 active players: majority wins; minority get -1
 * - If <=2 active players and computer not active: computer answer is chosen and activated
 * - If <=2 players and computer active: compare players to computer answer; mismatch => -1
 * - If any player reaches score <= -6, set phase to 'ended'
 */
export function herdEvaluateRound(state: HerdGameState): HerdGameState {
  const active = state.players.filter(p => p.score > -6);
  const activeIds = active.map(p => p.id);
  const nextPlayers = state.players.map(p => ({ ...p })); // copy
  const penalties: { [id: string]: number } = {};
  let lastResult: HerdGameState["lastResult"] = null;
  let nextCategory = getRandomCategory();
  let nextPhase: HerdGameState["phase"] = "answering";
  let nextRound = state.round + 1;
  let nextComputerActive = !!state.computerActive;
  let nextComputerAnswer = state.computerAnswer ?? null;

  // if 0 or 1 active players, game ends
  if (active.length <= 1) {
    nextPhase = "ended";
    return { ...state, players: nextPlayers, phase: nextPhase, lastResult: { majorityAnswers: [], penalties }, computerActive: nextComputerActive, computerAnswer: nextComputerAnswer };
  }

  // if <=2 and computer not active, activate computer and choose an answer (don't evaluate this tick)
  if (active.length <= 2 && !state.computerActive) {
    nextComputerActive = true;
    nextComputerAnswer = getRandomFromCategory(state.category);
    // keep players' answers for one more round so players get to compare to computer on evaluate call
    return { ...state, computerActive: nextComputerActive, computerAnswer: nextComputerAnswer };
  }

  // Build answer groups (lowercased)
  const groups: Record<string, string[]> = {};
  for (const p of active) {
    const ans = (p.answer ?? "").trim().toLowerCase() || "__BLANK__";
    if (!groups[ans]) groups[ans] = [];
    groups[ans].push(p.id);
  }

  if (active.length > 2) {
    // find max group size
    let max = 0;
    for (const k of Object.keys(groups)) {
      if (groups[k].length > max) max = groups[k].length;
    }

    // majority answers (could be multiple answers tied)
    const majority = Object.keys(groups).filter(k => groups[k].length === max && k !== "__blank__");

    // apply penalties: players who answered and whose answer is not in majority get -1
    for (const p of nextPlayers) {
      if (!activeIds.includes(p.id)) continue;
      const myAns = (p.answer ?? "").trim().toLowerCase() || "__blank__";
      if (myAns === "__blank__") {
        // optional: blank answer could be considered minority => -1 (we'll treat blank as minority)
        penalties[p.id] = (penalties[p.id] || 0) - 1;
        p.score -= 1;
      } else if (majority.length === 0) {
        // nobody answered meaningfully -> no change
      } else {
        const matchedMajority = majority.includes(myAns);
        if (!matchedMajority) {
          penalties[p.id] = (penalties[p.id] || 0) - 1;
          p.score -= 1;
        }
      }
      // clear answer
      p.answer = undefined;
    }
    lastResult = { majorityAnswers: majority, penalties };
  } else {
    // 2-player mode with computer active: players must match computerAnswer
    for (const p of nextPlayers) {
      if (!activeIds.includes(p.id)) continue;
      const myAns = (p.answer ?? "").trim().toLowerCase() || "__blank__";
      const comp = (state.computerAnswer ?? "").trim().toLowerCase() || "__blank__";
      if (myAns !== comp) {
        penalties[p.id] = (penalties[p.id] || 0) - 1;
        p.score -= 1;
      }
      p.answer = undefined;
    }
    lastResult = { majorityAnswers: [state.computerAnswer ?? ""], penalties };
  }

  // end check
  const someoneDead = nextPlayers.some(p => p.score <= -6);
  if (someoneDead) {
    nextPhase = "ended";
  }

  // prepare next state
  return {
    ...state,
    players: nextPlayers,
    phase: nextPhase,
    category: nextCategory,
    round: nextRound,
    computerActive: nextComputerActive,
    computerAnswer: nextComputerAnswer,
    lastResult,
  };
}
