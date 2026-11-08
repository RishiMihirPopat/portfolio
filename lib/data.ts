// ============================================================================
// PORTFOLIO DATA & SEED CONTENT
// Edit the blocks below to update your profile, projects, skills, and history.
// ============================================================================

export interface Repo {
  id: number;
  name: string;
  title?: string;
  description: string;
  details?: string;
  html_url: string;
  language: string;
  tags?: string[];
  updated_at: string;
  stargazers_count?: number;
  forks_count?: number;
}

export interface Photo {
  id: string;
  url: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
  imageUrl?: string;
}

export interface Skill {
  label: string;
  category: string;
}

// --- 1. PROFILE SUMMARY ---
export const profileData = {
  name: 'Rishi Mihir Popat',
  shortName: 'Rishi',
  role: 'MSc Data Science Student',
  institution: 'Manipal Academy of Higher Education',
  location: 'India',
  email: 'rishipopat@outlook.com',
  github: 'https://github.com/RishiMihirPopat',
  resumeUrl: '/resume.pdf',
  intro:
    'Graduate student in Data Science at Manipal Academy of Higher Education. My work focuses on statistical modeling, Bayesian computation, experimental design, deep active learning, and text mining.',
  secondaryNote:
    'Interested in sample-efficient machine learning, biostatistics, and clean, reproducible tools that turn messy real-world records into structured data.',
};

// --- 2. SEEDED PROJECTS ---
export const mockRepos: Repo[] = [
  {
    id: 1,
    name: 'chest-xray-active-learning',
    title: 'Deep Active Learning — Chest X-Ray Paper Reproduction',
    description:
      'Reproduction of deep active learning acquisition strategies for thoracic radiograph classification under limited annotation budgets.',
    details:
      'Implemented Monte Carlo Dropout, maximum entropy, and BALD acquisition functions over a DenseNet-121 backbone in PyTorch. Evaluated label efficiency curves against random sampling baselines on chest X-ray datasets, demonstrating substantial reductions in required radiologist annotations to reach target AUROC.',
    html_url: 'https://github.com/RishiMihirPopat',
    language: 'Python',
    tags: ['PyTorch', 'Deep Learning', 'Active Learning', 'Bayesian Computation', 'Medical Imaging'],
    updated_at: '2026-10-15T00:00:00.000Z',
    stargazers_count: 12,
    forks_count: 2,
  },
  {
    id: 2,
    name: 'expense-statement-parser',
    title: 'Expense Tracker with Automated Bank Statement Parsing',
    description:
      'Personal finance ledger and ingestion pipeline that parses heterogeneous PDF and CSV bank statements into structured categories.',
    details:
      'Built deterministic and rule-assisted parsers for multi-bank PDF/CSV account statements, normalizing date formats, debit/credit columns, and UPI/merchant strings. Includes automated transaction deduplication, category classification, and monthly regression trend summaries.',
    html_url: 'https://github.com/RishiMihirPopat',
    language: 'Python',
    tags: ['Python', 'Text Mining', 'Data Parsing', 'SQL', 'Regression'],
    updated_at: '2026-09-28T00:00:00.000Z',
    stargazers_count: 9,
    forks_count: 1,
  },
  {
    id: 3,
    name: 'autonomous-drone-nav',
    title: 'Autonomous Quadcopter Navigation & Tracking',
    description:
      'Deep learning and computer vision pipeline for autonomous quadcopter waypoint navigation and aerial object tracking.',
    details:
      'Combined YOLOv8 detection and ByteTrack multi-object tracking with ROS2 control nodes for real-time obstacle avoidance and target following at 30 FPS.',
    html_url: 'https://github.com/RishiMihirPopat',
    language: 'Python',
    tags: ['PyTorch', 'ROS2', 'OpenCV', 'Computer Vision', 'C++'],
    updated_at: '2026-06-12T00:00:00.000Z',
    stargazers_count: 14,
    forks_count: 3,
  },
  {
    id: 4,
    name: 'bio-stat-predictor',
    title: 'Clinical Outcome & Survival Modeling',
    description:
      'Statistical and machine learning models for predicting patient outcomes from longitudinal clinical trial variables.',
    details:
      'Applied generalized linear models, survival analysis, and Bayesian hierarchical modeling in R and Python to quantify treatment effects and uncertainty intervals.',
    html_url: 'https://github.com/RishiMihirPopat',
    language: 'R',
    tags: ['R', 'SAS', 'Bayesian Computation', 'Regression', 'Experimental Design'],
    updated_at: '2026-05-20T00:00:00.000Z',
    stargazers_count: 8,
    forks_count: 2,
  },
];

// --- 3. SEEDED SKILLS ---
export const cvSkills: Skill[] = [
  // Statistical & Core Languages
  { label: 'SAS', category: 'Languages & Stats' },
  { label: 'R', category: 'Languages & Stats' },
  { label: 'Python', category: 'Languages & Stats' },
  { label: 'SQL', category: 'Languages & Stats' },
  { label: 'C++', category: 'Languages & Stats' },
  { label: 'TypeScript', category: 'Languages & Stats' },
  { label: 'Bash', category: 'Languages & Stats' },

  // Statistical Methods & Machine Learning
  { label: 'Regression', category: 'Methods & Modeling' },
  { label: 'Experimental Design', category: 'Methods & Modeling' },
  { label: 'Bayesian Computation', category: 'Methods & Modeling' },
  { label: 'Deep Learning', category: 'Methods & Modeling' },
  { label: 'Text Mining', category: 'Methods & Modeling' },
  { label: 'Active Learning', category: 'Methods & Modeling' },
  { label: 'Computer Vision', category: 'Methods & Modeling' },
  { label: 'Time-Series Analysis', category: 'Methods & Modeling' },

  // Libraries & Tools
  { label: 'PyTorch', category: 'Libraries & Tools' },
  { label: 'scikit-learn', category: 'Libraries & Tools' },
  { label: 'OpenCV', category: 'Libraries & Tools' },
  { label: 'HuggingFace', category: 'Libraries & Tools' },
  { label: 'PostgreSQL', category: 'Libraries & Tools' },
  { label: 'Git', category: 'Libraries & Tools' },
  { label: 'Linux', category: 'Libraries & Tools' },
  { label: 'Next.js', category: 'Libraries & Tools' },
  { label: 'Docker', category: 'Libraries & Tools' },
];

// --- 4. ACADEMIC HISTORY ---
export const education = [
  {
    degree: 'M.Sc. in Data Science',
    specialization: 'Applied Statistics, Bayesian Modeling & Machine Learning',
    school: 'Manipal Academy of Higher Education',
    location: 'Manipal, India',
    status: 'In Progress',
    duration: '2025 — Present',
    highlights: [
      'Core focus on statistical regression, experimental design, Bayesian computation, text mining, and deep learning.',
      'Reproducing deep active learning methods for medical imaging under constrained annotation budgets.',
      'Statistical programming and clinical/tabular data analysis in SAS, R, and Python.',
    ],
    color: '',
  },
  {
    degree: 'B.Tech. in Computer Science & Engineering',
    specialization: 'Artificial Intelligence & Machine Learning',
    school: 'NorthCap University',
    location: 'Gurgaon, Haryana',
    status: 'Completed',
    duration: '2021 — 2025',
    highlights: [
      'Coursework in Deep Learning, Natural Language Processing, Computer Vision, and Reinforcement Learning.',
      'Capstone project: Autonomous drone navigation and obstacle avoidance using deep reinforcement learning and ROS2.',
      'Researched quantized convolutional neural network architectures for edge microcontrollers.',
    ],
    color: '',
  },
];

// --- 5. PROFESSIONAL HISTORY ---
export const experiences = [
  {
    role: 'SDE Intern',
    company: 'Stratbeans',
    duration: 'Jul 2024 — Dec 2024',
    location: 'Gurgaon, India',
    summary: 'Full-stack engineering on an enterprise learning management platform serving 10,000+ active users.',
    highlights: [
      'Built and shipped 12+ backend and reporting modules for course analytics, progress tracking, and user onboarding.',
      'Optimized database queries and frontend rendering paths, reducing average page load latency by 35%.',
      'Designed RESTful endpoints backed by PostgreSQL for real-time learner telemetry.',
    ],
    stack: ['Python', 'PHP', 'Laravel', 'PostgreSQL', 'REST API'],
    color: '',
  },
  {
    role: 'Senior Intern — Computer Vision R&D',
    company: 'HopDrones',
    duration: 'Jul 2023 — Nov 2023',
    location: 'Remote',
    summary: 'Computer vision research and development for autonomous aerial surveillance and multi-object tracking.',
    highlights: [
      'Led a 4-person intern team building an aerial motion detection and tracking pipeline with YOLOv8 and ByteTrack.',
      'Reached 94% mAP on a custom aerial dataset while sustaining 30 FPS real-time inference.',
      'Integrated ROS2 navigation nodes for autonomous waypoint following on quadcopter hardware.',
    ],
    stack: ['Python', 'PyTorch', 'YOLOv8', 'ROS2', 'OpenCV'],
    color: '',
  },
  {
    role: 'Campus Ambassador',
    company: 'Gemini Solutions',
    duration: '2022 — May 2025',
    location: 'NorthCap University',
    summary: 'Technical community liaison coordinating workshops, hackathons, and engineering recruitment.',
    highlights: [
      'Organized 5+ technical workshops and coding sessions for 200+ undergraduate students.',
      'Coordinated between university departments and engineering teams during campus hiring drives.',
    ],
    stack: ['Technical Workshops', 'Community', 'Outreach'],
    color: '',
  },
];

// --- 6. SEEDED BLOG POSTS ---
export const mockPosts: Post[] = [
  {
    id: '1',
    title: 'Notes on Reproducing Deep Active Learning for Chest X-Rays',
    content: `Active learning asks a practical question: when labeling medical scans is expensive, which unlabeled examples should a model request next?

While reproducing deep active learning experiments on thoracic radiographs, the biggest takeaways were not just about acquisition functions (entropy, BALD, or Monte Carlo Dropout variance), but about calibration and batch diversity.

### Key Observations

1. **Uncertainty vs. Redundancy**: Pure uncertainty sampling often selects near-duplicate borderline radiographs in a single batch. Adding feature-space diversity prevents wasted annotations.
2. **MC Dropout Warmup**: Early-epoch epistemic uncertainty estimates are noisy; warm-starting on a small stratified seed set stabilizes acquisition curves significantly.
3. **Evaluation Rigor**: Comparing active learning strategies requires fixed validation splits and multiple random seeds to separate genuine sample efficiency from luck in the initial pool.`,
    createdAt: '2026-10-18T12:00:00.000Z',
  },
  {
    id: '2',
    title: 'Parsing Messy Bank Statements into Structured Data',
    content: `Bank statements are ostensibly tabular, yet every institution formats dates, multi-line narration strings, and debit/credit columns differently.

To build a reliable local expense tracker, I structured the ingestion pipeline around three stages:

- **Layout Normalization**: Extracting raw rows from PDFs and CSVs into a canonical \`(timestamp, raw_narration, amount, direction, balance)\` tuple.
- **Token & Regex Cleaning**: Stripping transaction reference numbers and UPI routing prefixes to isolate the merchant token.
- **Statistical Summaries**: Running rolling monthly regressions and category breakdowns to spot recurring charges and anomalies without sending financial data to third-party servers.`,
    createdAt: '2026-09-22T12:00:00.000Z',
  },
  {
    id: '3',
    title: 'Why Bayesian Computation Matters in Small-Sample Experiments',
    content: `In many experimental design and biostatistical settings, sample sizes are constrained by physical or clinical limits. Point estimates alone rarely tell the full story.

Bayesian hierarchical models allow us to share statistical strength across subgroups while keeping full posterior distributions over parameters—making uncertainty explicit rather than an afterthought.`,
    createdAt: '2026-08-10T12:00:00.000Z',
  },
];

// --- 7. SEEDED PHOTOGRAPHY (Minimal Placeholders) ---
export const mockPhotos: Photo[] = [
  {
    id: '1',
    url: 'https://picsum.photos/seed/coast-dusk/900/600?grayscale',
    title: 'Low Tide, Late Afternoon',
    description: 'Flat water and wet sand reflection after the swell.',
    createdAt: '2026-09-14T12:00:00.000Z',
  },
  {
    id: '2',
    url: 'https://picsum.photos/seed/monsoon-sky/900/600?grayscale',
    title: 'Overcast Horizon',
    description: 'Monsoon cloud deck over the coast.',
    createdAt: '2026-08-29T12:00:00.000Z',
  },
  {
    id: '3',
    url: 'https://picsum.photos/seed/concrete-rain/600/800?grayscale',
    title: 'Campus Walkway in Rain',
    description: 'Quiet geometry and wet stone.',
    createdAt: '2026-07-19T12:00:00.000Z',
  },
  {
    id: '4',
    url: 'https://picsum.photos/seed/night-lamp/900/600?grayscale',
    title: 'Sodium Vapor Study',
    description: 'Late evening stillness.',
    createdAt: '2026-06-04T12:00:00.000Z',
  },
];

// Compatibility exports for admin/legacy views
export const JOURNAL_CARD_COLORS = ['', '', ''];
export const PHOTO_STAMP_COLORS = ['', '', '', ''];
export const PHOTO_CARD_COLORS = ['', '', '', ''];
