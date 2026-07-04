export interface OnboardingOption {
  id: string;
  label: string;
  icon?: string;
}

export const IDENTITY_OPTIONS: OnboardingOption[] = [
  { id: "school", label: "School Student", icon: "🎓" },
  { id: "college", label: "College Student", icon: "🎓" },
  { id: "professional", label: "Working Professional", icon: "💼" },
  { id: "founder", label: "Founder / Entrepreneur", icon: "🚀" },
  { id: "creator", label: "Content Creator", icon: "🎥" },
  { id: "aspirant", label: "Competitive Exam Aspirant", icon: "📚" },
  { id: "something_else", label: "Something Else", icon: "➕" },
];

export const MOTIVATION_OPTIONS: OnboardingOption[] = [
  { id: "organized", label: "I want my life organized" },
  { id: "procrastinate", label: "I procrastinate" },
  { id: "discipline", label: "I want discipline" },
  { id: "goals", label: "I have too many goals" },
  { id: "remembers", label: "I want an AI that actually remembers me" },
  { id: "exams", label: "I'm preparing for exams" },
  { id: "building", label: "I'm building something big" },
  { id: "other", label: "Other" },
];

export const GOAL_PRESETS: OnboardingOption[] = [
  { id: "build_discipline", label: "Build Discipline", icon: "🎯" },
  { id: "score_higher", label: "Score Higher", icon: "📚" },
  { id: "grow_youtube", label: "Grow YouTube", icon: "🎥" },
  { id: "earn_online", label: "Earn Online", icon: "💰" },
  { id: "become_fit", label: "Become Fit", icon: "💪" },
  { id: "learn_faster", label: "Learn Faster", icon: "🧠" },
  { id: "crack_placements", label: "Crack Placements", icon: "🎓" },
  { id: "build_startup", label: "Build Startup", icon: "🚀" },
  { id: "learn_ai", label: "Learn AI", icon: "🤖" },
  { id: "read_more", label: "Read More", icon: "📖" },
];

export const CHALLENGE_OPTIONS: OnboardingOption[] = [
  { id: "phone", label: "Phone distraction", icon: "📱" },
  { id: "energy", label: "Low energy", icon: "😴" },
  { id: "overthinking", label: "Overthinking", icon: "😵" },
  { id: "distractions", label: "Too many distractions", icon: "📺" },
  { id: "planning", label: "Poor planning", icon: "⏰" },
  { id: "burnout", label: "Burnout", icon: "😩" },
  { id: "gaming", label: "Gaming", icon: "🎮" },
];

export const FOCUS_AREA_OPTIONS: OnboardingOption[] = [
  { id: "placements", label: "Crack Placements" },
  { id: "youtube", label: "Build YouTube" },
  { id: "ai", label: "Learn AI" },
  { id: "freelancing", label: "Freelancing" },
  { id: "startup", label: "Startup" },
  { id: "fitness", label: "Fitness" },
  { id: "relationships", label: "Relationships" },
  { id: "financial_freedom", label: "Financial Freedom" },
  { id: "higher_studies", label: "Higher Studies" },
  { id: "gate", label: "GATE" },
  { id: "upsc", label: "UPSC" },
  { id: "cat", label: "CAT" },
  { id: "gre", label: "GRE" },
  { id: "ielts", label: "IELTS" },
];
