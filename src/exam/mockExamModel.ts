export const categoryTopics = {
  Technology: [
    "Number Systems & Data Representation",
    "Applied Mathematics",
    "Discrete Math & Algorithms",
    "Computer Architecture & Hardware",
    "Operating Systems",
    "Digital Logic",
    "Computer Graphics",
    "Databases",
    "Networking",
    "Cybersecurity",
    "Software Engineering & Design",
    "Software Testing",
    "Emerging Technologies",
  ],
  Management: [
    "Project Management",
    "IT Service Management (ITSM)",
    "System Auditing",
    "Quality Management",
    "Corporate Finance",
  ],
  Strategy: [
    "Business Strategy",
    "System Strategy",
    "Law & Intellectual Property",
    "Digital Trends",
  ],
} as const;

export type CategoryName = keyof typeof categoryTopics;
export type ExamType = "AM EXAM" | "PM EXAM";

export const allTopics: string[] = Object.values(categoryTopics).flat();

export type MockExamSettings = {
  examType: ExamType;
  isTimed: boolean;
  durationMinutes: number;
  questionCount: number;
  instantAnswers: boolean;
  selectedTopics: string[];
};

export type MockExamOption = {
  key: string;
  text: string;
  imagePath: string | null;
};

export type MockExamQuestion = {
  id: string;
  pdfName: string;
  questionNumber: string;
  questionText: string;
  tableText: string | null;
  questionImagePath: string | null;
  options: MockExamOption[];
  correctOption: string;
  subjectCategory: string;
  subjectTopic: string;
};

export type MockExamSession = {
  sessionId: string;
  createdAtMs: number;
  startedAtMs: number;
  settings: MockExamSettings;
  questions: MockExamQuestion[];
  currentQuestionIndex: number;
  answers: Record<string, string>;
  hintsUsed: number;
};

export type TopicBreakdown = {
  name: string;
  correct: number;
  total: number;
};

export type CategoryBreakdown = {
  name: string;
  correct: number;
  total: number;
  topics: TopicBreakdown[];
};

export type MockExamResult = {
  completedAtMs: number;
  settings: MockExamSettings;
  totalQuestions: number;
  correctAnswers: number;
  totalTimeSeconds: number;
  averageTimePerQuestionSeconds: number;
  hintsUsed: number;
  selectedCategories: string[];
  selectedTopicCount: number;
  categoryBreakdown: CategoryBreakdown[];
};

const SESSION_STORAGE_KEY = "ofa.mockExam.currentSession";
const RESULT_STORAGE_KEY = "ofa.mockExam.latestResult";

const safeSave = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore localStorage failures and keep app functional.
  }
};

const safeLoad = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const saveMockExamSession = (session: MockExamSession) => {
  safeSave(SESSION_STORAGE_KEY, session);
};

export const loadMockExamSession = (): MockExamSession | null => safeLoad<MockExamSession>(SESSION_STORAGE_KEY);

export const clearMockExamSession = () => {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore localStorage failures and keep app functional.
  }
};

export const saveMockExamResult = (result: MockExamResult) => {
  safeSave(RESULT_STORAGE_KEY, result);
};

export const loadMockExamResult = (): MockExamResult | null => safeLoad<MockExamResult>(RESULT_STORAGE_KEY);

export const clearMockExamResult = () => {
  try {
    localStorage.removeItem(RESULT_STORAGE_KEY);
  } catch {
    // Ignore localStorage failures and keep app functional.
  }
};

export const deriveSelectedCategories = (selectedTopics: string[]): string[] => {
  const selectedSet = new Set(selectedTopics);

  return (Object.keys(categoryTopics) as CategoryName[]).filter((categoryName) =>
    categoryTopics[categoryName].some((topic) => selectedSet.has(topic)),
  );
};

export const formatClockFromSeconds = (seconds: number, alwaysShowHours = true): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const remainingSeconds = clamped % 60;

  if (!alwaysShowHours && hours === 0) {
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};

const topicOrderMap = new Map<string, number>(allTopics.map((topic, index) => [topic, index]));

export const computeMockExamResult = (
  session: MockExamSession,
  answers: Record<string, string>,
  totalTimeSeconds: number,
  hintsUsed: number,
): MockExamResult => {
  const totalQuestions = session.questions.length;

  let correctAnswers = 0;

  const categoryStats = new Map<
    string,
    {
      name: string;
      total: number;
      correct: number;
      topics: Map<string, TopicBreakdown>;
    }
  >();

  for (const question of session.questions) {
    const selectedAnswer = answers[question.id];
    const isCorrect = selectedAnswer === question.correctOption;

    if (isCorrect) {
      correctAnswers += 1;
    }

    const categoryName = question.subjectCategory;

    if (!categoryStats.has(categoryName)) {
      categoryStats.set(categoryName, {
        name: categoryName,
        total: 0,
        correct: 0,
        topics: new Map<string, TopicBreakdown>(),
      });
    }

    const category = categoryStats.get(categoryName);
    if (!category) {
      continue;
    }

    category.total += 1;
    if (isCorrect) {
      category.correct += 1;
    }

    const existingTopic = category.topics.get(question.subjectTopic) ?? {
      name: question.subjectTopic,
      total: 0,
      correct: 0,
    };

    existingTopic.total += 1;
    if (isCorrect) {
      existingTopic.correct += 1;
    }

    category.topics.set(question.subjectTopic, existingTopic);
  }

  const categoryBreakdown = [...categoryStats.values()]
    .sort((a, b) => {
      const aOrder = (Object.keys(categoryTopics) as string[]).indexOf(a.name);
      const bOrder = (Object.keys(categoryTopics) as string[]).indexOf(b.name);
      if (aOrder === -1 || bOrder === -1) {
        return a.name.localeCompare(b.name);
      }
      return aOrder - bOrder;
    })
    .map((category) => ({
      name: category.name,
      total: category.total,
      correct: category.correct,
      topics: [...category.topics.values()].sort((a, b) => {
        const aOrder = topicOrderMap.get(a.name) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = topicOrderMap.get(b.name) ?? Number.MAX_SAFE_INTEGER;
        if (aOrder === bOrder) {
          return a.name.localeCompare(b.name);
        }
        return aOrder - bOrder;
      }),
    }));

  const averageTimePerQuestionSeconds =
    totalQuestions === 0 ? 0 : Math.max(0, Math.round(totalTimeSeconds / totalQuestions));

  return {
    completedAtMs: Date.now(),
    settings: session.settings,
    totalQuestions,
    correctAnswers,
    totalTimeSeconds,
    averageTimePerQuestionSeconds,
    hintsUsed,
    selectedCategories: deriveSelectedCategories(session.settings.selectedTopics),
    selectedTopicCount: session.settings.selectedTopics.length,
    categoryBreakdown,
  };
};
