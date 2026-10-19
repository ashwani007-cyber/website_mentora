import { RetiredProfessional, TrainingCourse, RehiredStory, SubscriptionTier, Booking, WalletTransaction } from '../types';

export const MOCK_PROFESSIONALS: RetiredProfessional[] = [
  {
    id: 'prof-1',
    name: 'Dr. Rameshwar Sharma',
    title: 'Ex-Chief Financial Officer & Board Advisor',
    exCompany: 'TATA Motors & L&T',
    exRole: 'CFO & Senior VP Finance',
    yearsOfExperience: 34,
    domain: 'Finance & Audit',
    location: 'Mumbai, Maharashtra',
    rating: 4.95,
    reviewCount: 48,
    hourlyRate: 799,
    projectRate: 1575,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    isVerified: true,
    isSponsored: true,
    bio: 'Over three decades guiding multi-billion rupee corporate budgets, IPO readiness, tax restructuring, and seed-to-Series B financial planning for Indian enterprises & tech startups.',
    skills: ['Financial Modeling', 'ESOP Architecture', 'Tax Compliance', 'Valuation & Pitch Review', 'Audit Preparation'],
    languages: ['English', 'Hindi', 'Marathi'],
    badges: ['Ex-TATA Leader', 'Verified CFO', '30+ Yrs Exp', 'Top Rated 2026'],
    videoIntroUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    availableDays: ['Mon', 'Wed', 'Fri', 'Sat'],
    totalSessionsCompleted: 112,
    featuredQuote: 'Retirement is simply the beginning of sharing a lifetime of financial wisdom with young Indian founders.'
  },
  {
    id: 'prof-2',
    name: 'Sunita Deshmukh',
    title: 'Ex-VP Human Resources & Talent Strategy',
    exCompany: 'HDFC Bank & Infosys',
    exRole: 'Vice President HR',
    yearsOfExperience: 28,
    domain: 'HR & Talent',
    location: 'Bengaluru, Karnataka',
    rating: 4.92,
    reviewCount: 36,
    hourlyRate: 649,
    projectRate: 1260,
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    isVerified: true,
    isSponsored: false,
    bio: 'Specialist in scaling tech teams from 10 to 500+, designing POSH compliant frameworks, appraisal structures, and executive leadership coaching.',
    skills: ['POSH Compliance', 'Performance Appraisals', 'Executive Hiring', 'HR Policy Blueprinting', 'Conflict Mediation'],
    languages: ['English', 'Hindi', 'Kannada'],
    badges: ['Ex-HDFC VP', 'Verified HR Expert', 'POSH Certified'],
    availableDays: ['Tue', 'Thu', 'Sat'],
    totalSessionsCompleted: 84,
    featuredQuote: 'A company is only as strong as its people. I help startups build empathetic, high-performance cultures.'
  },
  {
    id: 'prof-3',
    name: 'Capt. Vijay Kumar (Retd.)',
    title: 'Ex-Navy Logistics Officer & Supply Chain Director',
    exCompany: 'Indian Navy & Blue Dart',
    exRole: 'Chief Logistics Officer',
    yearsOfExperience: 31,
    domain: 'Operations & Logistics',
    location: 'Gurugram, Haryana',
    rating: 4.98,
    reviewCount: 52,
    hourlyRate: 899,
    projectRate: 1800,
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
    isVerified: true,
    isSponsored: true,
    bio: 'Precision logistics expert specializing in warehouse optimization, last-mile delivery architecture, inventory cost reduction, and defense/aerospace supply chain.',
    skills: ['Warehouse Planning', 'Inventory Cost Reduction', 'Vendor Management', 'Fleet Logistics', 'Operations Audit'],
    languages: ['English', 'Hindi', 'Punjabi'],
    badges: ['Defense Veteran', 'Supply Chain Maven', '30+ Yrs Exp'],
    availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    totalSessionsCompleted: 140,
    featuredQuote: 'Military precision applied to modern startup operations cuts waste and supercharges delivery speeds.'
  },
  {
    id: 'prof-4',
    name: 'Prof. Anand Varma',
    title: 'Ex-Head of Computer Science & Enterprise Architect',
    exCompany: 'IIT Bombay & TCS',
    exRole: 'Professor & Systems Architect',
    yearsOfExperience: 32,
    domain: 'Tech & Digital',
    location: 'Pune, Maharashtra',
    rating: 4.89,
    reviewCount: 41,
    hourlyRate: 749,
    projectRate: 1440,
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    isVerified: true,
    isSponsored: false,
    bio: 'Veterans in legacy modernizations, cloud architecture (AWS/GCP), AI/ML integration strategy, and tech stack code reviews for growing engineering teams.',
    skills: ['Cloud Architecture', 'AI System Audit', 'Database Scaling', 'Cybersecurity Basics', 'Tech Hiring Review'],
    languages: ['English', 'Hindi', 'Marathi'],
    badges: ['Ex-IIT Faculty', 'Tech Advisory Star', '30+ Yrs Exp'],
    availableDays: ['Mon', 'Wed', 'Fri'],
    totalSessionsCompleted: 95,
    featuredQuote: 'Building robust software requires rock-solid foundational principles, not just the latest trendy frameworks.'
  },
  {
    id: 'prof-5',
    name: 'Meenakshi Sundaram',
    title: 'Ex-Senior Corporate Counsel & Compliance Head',
    exCompany: 'Delhi High Court & Reliance Industries',
    exRole: 'Senior Vice President Legal',
    yearsOfExperience: 27,
    domain: 'Legal & Compliance',
    location: 'New Delhi',
    rating: 4.96,
    reviewCount: 63,
    hourlyRate: 999,
    projectRate: 2000,
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    isVerified: true,
    isSponsored: true,
    bio: 'Advising businesses on contract drafting, IP registration, shareholder agreements (SHA/SSA), regulatory filings, and dispute pre-resolution.',
    skills: ['Founders Agreements', 'IP & Trademark Law', 'Regulatory Compliance', 'Contract Vetting', 'Commercial Arbitration'],
    languages: ['English', 'Tamil', 'Hindi'],
    badges: ['High Court Advocate', 'Legal Guard', 'Top Verified Expert'],
    availableDays: ['Mon', 'Tue', 'Thu', 'Fri'],
    totalSessionsCompleted: 168,
    featuredQuote: 'Bulletproof contracts today save millions in litigation tomorrow.'
  },
  {
    id: 'prof-6',
    name: 'Gurpreet Singh Ahluwalia',
    title: 'Ex-GM Brand Marketing & Consumer Insights',
    exCompany: 'Amul & Britannia Industries',
    exRole: 'General Manager Brand Strategy',
    yearsOfExperience: 29,
    domain: 'Marketing & Growth',
    location: 'Chandigarh / Remote',
    rating: 4.91,
    reviewCount: 39,
    hourlyRate: 599,
    projectRate: 1125,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    isVerified: true,
    isSponsored: false,
    bio: 'Crafted iconic Indian FMCG brand campaigns. Expertise in positioning, rural & urban distribution marketing, D2C storytelling, and customer retention.',
    skills: ['Brand Strategy', 'FMCG Distribution', 'Go-To-Market Plan', 'Consumer Psychology', 'Packaging Design Review'],
    languages: ['English', 'Hindi', 'Punjabi'],
    badges: ['Ex-Amul Leader', 'Brand Architect', '25+ Yrs Exp'],
    availableDays: ['Tue', 'Wed', 'Fri', 'Sat'],
    totalSessionsCompleted: 78,
    featuredQuote: 'Great marketing isn’t about noise; it’s about touching human hearts with authentic Indian storytelling.'
  },
  {
    id: 'prof-7',
    name: 'Dr. K. Radhakrishnan',
    title: 'Ex-Senior Space Tech Scientist & Systems Consultant',
    exCompany: 'ISRO (Indian Space Research Organisation)',
    exRole: 'Senior Scientist Grade G',
    yearsOfExperience: 35,
    domain: 'Tech & Digital',
    location: 'Thiruvananthapuram, Kerala',
    rating: 5.0,
    reviewCount: 71,
    hourlyRate: 850,
    projectRate: 1710,
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    isVerified: true,
    isSponsored: true,
    bio: 'Distinguished scientist with deep expertise in complex system design, deep-tech research, telemetry, hardware-software integration, and quality assurance.',
    skills: ['Deep Tech Systems', 'Quality Assurance', 'Research Methodology', 'Space/Defense Tech', 'Project Governance'],
    languages: ['English', 'Malayalam', 'Hindi'],
    badges: ['Ex-ISRO Scientist', 'National Honor', '5.0★ Rated Legend'],
    availableDays: ['Mon', 'Thu', 'Sat'],
    totalSessionsCompleted: 205,
    featuredQuote: 'Precision, failure-proof design, and relentless dedication can take any Indian startup to the stars.'
  },
  {
    id: 'prof-8',
    name: 'Shanti Swaroop Saxena',
    title: 'Ex-Principal & Educational Curriculum Advisor',
    exCompany: 'Kendriya Vidyalaya Sangathan',
    exRole: 'Principal & Regional Inspector',
    yearsOfExperience: 31,
    domain: 'Teaching & Academia',
    location: 'Lucknow, Uttar Pradesh',
    rating: 4.88,
    reviewCount: 45,
    hourlyRate: 499,
    projectRate: 1999,
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    isVerified: true,
    isSponsored: false,
    bio: 'Passionate educator specializing in curriculum development, teacher training, online pedagogy, and student mentorship for EdTech platforms.',
    skills: ['Curriculum Design', 'Pedagogy Training', 'EdTech Content Review', 'Career Mentorship', 'Institutional Governance'],
    languages: ['English', 'Hindi'],
    badges: ['Ex-KV Principal', 'EdTech Mentor', 'Affordable Rate'],
    availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    totalSessionsCompleted: 130,
    featuredQuote: 'Education is the light that transforms generations. Teaching never stops with retirement.'
  }
];

export const MOCK_TRAINING_COURSES: TrainingCourse[] = [
  {
    id: 'train-1',
    title: 'Digital Workspace Mastery for Senior Consultants',
    targetAudience: 'Seniors/Pros',
    category: 'Remote Work Tools',
    duration: '2 Hours (4 Sessions)',
    level: 'Beginner',
    price: 0, // Free upsell for senior pros
    thumbnail: 'https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?auto=format&fit=crop&w=500&q=80',
    description: 'Learn how to easily host Zoom calls, share screens, manage Google Drive, and use calendar scheduling tools to run advisory sessions smoothly.',
    modulesCount: 5,
    enrolledCount: 1420,
    rating: 4.9,
    skillsLearned: ['Zoom & Google Meet Controls', 'Screen Sharing & Whiteboards', 'Digital Note-Taking', 'Calendar Slot Management']
  },
  {
    id: 'train-2',
    title: 'AI Assistants for Senior Advisory (ChatGPT & Gemini)',
    targetAudience: 'Seniors/Pros',
    category: 'AI & Productivity',
    duration: '3 Hours',
    level: 'Intermediate',
    price: 399,
    thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=500&q=80',
    description: 'Harness modern AI tools to quickly generate report outlines, analyze documents, format client proposals, and save hours of research time.',
    modulesCount: 6,
    enrolledCount: 890,
    rating: 4.95,
    skillsLearned: ['Prompt Engineering for Advisors', 'Document Summarization', 'Generating Strategy Outlines', 'AI Ethics']
  },
  {
    id: 'train-3',
    title: 'Effective Teleconsulting & Pitching for Executives',
    targetAudience: 'Seniors/Pros',
    category: 'Communication',
    duration: '1.5 Hours',
    level: 'Beginner',
    price: 299,
    thumbnail: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=500&q=80',
    description: 'How to structure a 45-minute advisory call, set expectations, provide actionable advice, and price your consulting retainer packages.',
    modulesCount: 4,
    enrolledCount: 650,
    rating: 4.88,
    skillsLearned: ['Session Structuring', 'Pricing Models', 'Client Engagement', 'Follow-up Emailing']
  }
];

export const MOCK_REHIRED_STORIES: RehiredStory[] = [
  {
    id: 'story-1',
    name: 'Dr. K. Radhakrishnan',
    age: 67,
    formerRole: 'Senior ISRO Scientist',
    newRole: 'Deep-Tech Advisor at SproutX Agritech',
    companyImpact: 'Helped startup design satellite-based soil moisture telemetry sensor, saving ₹25 Lakhs in R&D costs.',
    quote: 'After 35 years at ISRO, working with young 24-year-old founders gave me a new lease of life and purpose.',
    fullStory: 'Dr. Radhakrishnan retired in 2023 but felt his mind was as sharp as ever. Through Mentora, he matched with an early-stage agritech startup in Pune that was struggling with sensor calibration. Over weekly 2-hour virtual sessions, he guided their tech team, helping them achieve 99.4% telemetry accuracy.',
    location: 'Kerala / Maharashtra',
    imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
    domain: 'Tech & Innovation'
  },
  {
    id: 'story-2',
    name: 'Sunita Deshmukh',
    age: 62,
    formerRole: 'VP HR @ HDFC Bank',
    newRole: 'On-Demand Chief People Officer for 5 Startups',
    companyImpact: 'Structured appraisal & POSH policies for 140 employees across 3 D2C brands.',
    quote: 'Startups need senior HR wisdom but cannot afford a full-time ₹60 Lakh CFO or VP. Mentora solves this perfectly.',
    fullStory: 'When Sunita retired, she wanted flexibility to travel while continuing to work. On Mentora, she offers 5-hour weekly consulting packages to growing Indian D2C startups, earning ₹80,000/month while working just 10 hours a week from home.',
    location: 'Bengaluru',
    imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
    domain: 'HR & Management'
  },
  {
    id: 'story-3',
    name: 'Dr. Rameshwar Sharma',
    age: 69,
    formerRole: 'CFO @ TATA Motors',
    newRole: 'Strategic Finance Mentor for FinTech Founders',
    companyImpact: 'Guided a FinTech seed startup through Series A due diligence and cap table restructuring.',
    quote: 'Passing down decades of financial battle-testing to the next generation of builders is the most rewarding work of my life.',
    fullStory: 'Dr. Sharma was approached by a 3-member founding team preparing for their $1.5M seed raise. His guidance on ESOP pooling, cash runway planning, and pitch deck financial models helped them close their round in under 45 days.',
    location: 'Mumbai',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    domain: 'Finance & Advisory'
  }
];

export const MOCK_SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'sub-pro-free',
    name: 'Silver Starter',
    userType: 'professional',
    priceMonthly: 0,
    features: [
      'Standard Verified Profile Listing',
      'Receive direct booking requests',
      'Standard 15% Platform Commission',
      'Access to Free Digital Workspace Training'
    ]
  },
  {
    id: 'sub-pro-prime',
    name: 'Silver Prime Expert',
    userType: 'professional',
    priceMonthly: 499,
    badge: '₹499 / mo',
    isPopular: true,
    features: [
      'Gold Verified Badge & Top Directory Placement',
      'Reduced Platform Commission (10% instead of 15%)',
      'Featured Expert on Homepage (Sponsored Listing)',
      'Unlimited Access to All AI & Digital Upsell Courses',
      'Priority Video Call HD Room & Whiteboard'
    ]
  },
  {
    id: 'sub-client-free',
    name: 'Client Basic',
    userType: 'client',
    priceMonthly: 0,
    features: [
      'Browse all verified senior experts',
      'Pay-per-session hourly booking',
      '3 AI Matchmaker Queries / Month'
    ]
  },
  {
    id: 'sub-client-unlimited',
    name: 'Client Business Pass',
    userType: 'client',
    priceMonthly: 999,
    badge: '₹999 / mo',
    isPopular: true,
    features: [
      'Unlimited AI Matchmaker Queries',
      'Zero booking convenience fees',
      'Dedicated Account Manager for fast expert pairing',
      'Corporate GST Invoicing & Shared Team Wallet',
      'Custom RFP / Project Posting to Retired Talent Pool'
    ]
  }
];

export const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 'book-101',
    expertId: 'prof-1',
    expertName: 'Dr. Rameshwar Sharma',
    expertAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    expertTitle: 'Ex-CFO @ TATA Motors',
    clientName: 'Nexus Tech Innovations Pvt Ltd',
    serviceType: '1-on-1 Advisory',
    date: '2026-08-25',
    timeSlot: '04:00 PM - 05:00 PM',
    topic: 'Seed Stage Cap Table & ESOP Pool Structuring',
    amount: 799,
    commission: 99.87, // 12.5%
    status: 'upcoming',
    meetingRoomId: 'room-nexus-799'
  },
  {
    id: 'book-102',
    expertId: 'prof-2',
    expertName: 'Sunita Deshmukh',
    expertAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    expertTitle: 'Ex-VP HR @ HDFC Bank',
    clientName: 'GreenRoots D2C Organics',
    serviceType: 'Project Consultation',
    date: '2026-08-22',
    timeSlot: '11:00 AM - 12:00 PM',
    topic: 'POSH Policy Guidelines & Employee Handbook Review',
    amount: 2799,
    commission: 349.87,
    status: 'completed',
    meetingRoomId: 'room-green-2799',
    notes: 'POSH document finalized. Recommended appointing external committee member.'
  }
];

export const INITIAL_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'tx-1',
    date: '2026-08-23 10:15 AM',
    type: 'deposit',
    amount: 5000,
    description: 'Wallet top-up via UPI / NetBanking',
    status: 'completed'
  },
  {
    id: 'tx-2',
    date: '2026-08-23 11:00 AM',
    type: 'booking_payment',
    amount: -799,
    description: '1-hr Advisory Session with Dr. Rameshwar Sharma (Includes 12.5% platform commission)',
    status: 'completed'
  },
  {
    id: 'tx-3',
    date: '2026-08-20 03:45 PM',
    type: 'commission_cut',
    amount: 99.87,
    description: 'Mentora Platform 12.5% Commission earned on Booking #book-101',
    status: 'completed'
  }
];
