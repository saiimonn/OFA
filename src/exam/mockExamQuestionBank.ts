import pipelineResultsRaw from "../../pipeline/outputs-all/pipeline_results.json?raw";
import questionAnswerMappingRaw from "../../pipeline/outputs-all/question_answer_mapping.json?raw";
import {
  allTopics,
  categoryTopics,
  type CategoryName,
  type MockExamQuestion,
  type MockExamSession,
  type MockExamSettings,
} from "./mockExamModel";

type RawPipelineQuestion = {
  pdf_name?: string;
  page_start?: string | number;
  question_number?: string | number;
  question_text?: string;
  options?: unknown;
  region_image_path?: string | null;
  option_image_paths?: unknown;
  category?: string;
  mapped_answer?: string | null;
  subject_category?: string;
  subject_topic?: string;
};

type RawPipelineEntry = {
  pdf_path?: string;
  questions?: RawPipelineQuestion[];
};

type AnswerMapping = Record<string, Record<string, string>>;

const isString = (value: unknown): value is string => typeof value === "string";

const normalizeLegacySymbols = (text: string): string =>
  text
    .replace(/\uF0AE|\uF0E0/g, "→")
    .replace(/\uF0DF/g, "←")
    .replace(/\uF0A3/g, "≤")
    .replace(/\uF0B3/g, "≥")
    .replace(/\uF0B8/g, "÷")
    .replace(/\uF0B4/g, "×")
    .replace(/\uF0B9/g, "≠");

const safeParsePipelineResults = (): RawPipelineEntry[] => {
  try {
    const parsed = JSON.parse(pipelineResultsRaw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as RawPipelineEntry[];
  } catch {
    return [];
  }
};

const safeParseAnswerMapping = (): AnswerMapping => {
  try {
    const parsed = JSON.parse(questionAnswerMappingRaw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed as AnswerMapping;
  } catch {
    return {};
  }
};

const pipelineEntries = safeParsePipelineResults();
const answerMapping = safeParseAnswerMapping();

const getFileNameFromPath = (pathValue: string | undefined): string => {
  if (!pathValue) {
    return "";
  }

  const parts = pathValue.split(/[/\\]/);
  return parts[parts.length - 1] ?? "";
};

const normalizeAnswer = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const matched = value.toUpperCase().match(/[A-I]/);
  return matched ? matched[0] : null;
};

const deriveCategoryFromTopic = (topic: string): CategoryName | "Uncategorized" => {
  const foundCategory = (Object.keys(categoryTopics) as CategoryName[]).find((categoryName) =>
    categoryTopics[categoryName].some((knownTopic) => knownTopic === topic),
  );

  return foundCategory ?? "Uncategorized";
};

const matchesExamType = (pdfName: string, examType: MockExamSettings["examType"]): boolean => {
  const normalized = pdfName.toLowerCase();

  if (examType === "AM EXAM") {
    return normalized.includes("_am.pdf") || normalized.includes("_a.pdf");
  }

  return normalized.includes("_pm.pdf") || normalized.includes("_b.pdf");
};

const extractOptionsFromLines = (optionLines: string[]): { key: string; text: string }[] => {
  const normalizedText = optionLines.join(" ").replace(/\s+/g, " ").trim();
  const optionRegex = /([A-I])[.)]\s*([\s\S]*?)(?=(?:\s+[A-I][.)]\s)|$)/g;

  const regexMatches = [...normalizedText.matchAll(optionRegex)].map((match) => ({
    key: match[1]?.toUpperCase() ?? "",
    text: (match[2] ?? "").trim(),
  }));

  const fallbackMatches = optionLines.map((line, index) => {
    const cleaned = line.trim();
    const prefixedMatch = cleaned.match(/^([A-I])[.)]\s*(.*)$/i);

    if (prefixedMatch) {
      return {
        key: prefixedMatch[1].toUpperCase(),
        text: (prefixedMatch[2] ?? "").trim(),
      };
    }

    return {
      key: String.fromCharCode(65 + index),
      text: cleaned,
    };
  });

  const source = regexMatches.length >= 2 ? regexMatches : fallbackMatches;
  const seen = new Set<string>();

  return source.filter((option) => {
    if (!option.key || !option.text || seen.has(option.key)) {
      return false;
    }

    seen.add(option.key);
    return true;
  });
};

const parseOptionPrefix = (line: string): { key: string; text: string } | null => {
  const prefixedMatch = line.trim().match(/^([A-I])[.)]\s*(.*)$/i);
  if (!prefixedMatch) {
    return null;
  }

  return {
    key: prefixedMatch[1].toUpperCase(),
    text: (prefixedMatch[2] ?? "").trim(),
  };
};

const normalizeQuestionStemAndOptions = (
  questionText: string,
  optionLines: string[],
): { normalizedQuestionText: string; normalizedOptionLines: string[] } => {
  if (optionLines.length === 0) {
    return {
      normalizedQuestionText: questionText,
      normalizedOptionLines: optionLines,
    };
  }

  const canonicalOptionKeys = new Set(["A", "B", "C", "D"]);
  const parsedLines = optionLines.map((line) => ({ line, parsed: parseOptionPrefix(line) }));

  const keyCounts = new Map<string, number>();
  parsedLines.forEach(({ parsed }) => {
    if (!parsed) {
      return;
    }

    keyCounts.set(parsed.key, (keyCounts.get(parsed.key) ?? 0) + 1);
  });

  const firstCanonicalAIndex = parsedLines.findIndex(({ parsed }) => parsed?.key === "A");
  const questionAdditions: string[] = [];
  const normalizedOptionLines: string[] = [];

  parsedLines.forEach(({ line, parsed }, lineIndex) => {
    if (!parsed) {
      normalizedOptionLines.push(line);
      return;
    }

    const keyCount = keyCounts.get(parsed.key) ?? 0;
    const isBeforeFirstCanonicalA = firstCanonicalAIndex !== -1 && lineIndex < firstCanonicalAIndex;
    const isOutsideCanonicalOptions = !canonicalOptionKeys.has(parsed.key);
    const looksLikeNarrative =
      parsed.text.length >= 80 ||
      /\?|\b(what|which|when|where|how|percentage|probability)\b/i.test(parsed.text);

    const shouldPromoteToQuestionStem =
      looksLikeNarrative && (keyCount > 1 || isOutsideCanonicalOptions || isBeforeFirstCanonicalA);

    if (shouldPromoteToQuestionStem) {
      questionAdditions.push(parsed.text);
      return;
    }

    normalizedOptionLines.push(line);
  });

  const normalizedQuestionText = [questionText, ...questionAdditions].join(" ").replace(/\s+/g, " ").trim();

  return {
    normalizedQuestionText,
    normalizedOptionLines,
  };
};

const parseOptionImagePathMap = (rawOptionImagePaths: unknown): Map<string, string> => {
  const imagePathMap = new Map<string, string>();

  if (!rawOptionImagePaths || typeof rawOptionImagePaths !== "object") {
    return imagePathMap;
  }

  for (const [rawKey, rawValue] of Object.entries(rawOptionImagePaths as Record<string, unknown>)) {
    if (!isString(rawValue)) {
      continue;
    }

    const normalizedKey = rawKey.toUpperCase().match(/[A-I]/)?.[0];
    const normalizedPath = rawValue.trim().replace(/\\/g, "/");

    if (!normalizedKey || !normalizedPath) {
      continue;
    }

    imagePathMap.set(normalizedKey, normalizedPath);
  }

  return imagePathMap;
};

const normalizeImagePath = (rawPath: unknown): string | null => {
  if (!isString(rawPath)) {
    return null;
  }

  const normalized = rawPath.trim().replace(/\\/g, "/");
  return normalized || null;
};

const extractNumericSegment = (value: string | number | undefined): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const matched = String(value).match(/\d+/);
  return matched ? matched[0] : null;
};

const buildQuestionRegionFallbackPath = (
  pdfName: string,
  questionNumber: string,
  pageStart: string | number | undefined,
): string | null => {
  const baseName = pdfName.replace(/\.pdf$/i, "");
  const questionNumberDigits = extractNumericSegment(questionNumber);
  const pageDigits = extractNumericSegment(pageStart);

  if (!baseName || !questionNumberDigits || !pageDigits) {
    return null;
  }

  return `images/${baseName}/question_regions/${baseName}_q${questionNumberDigits.padStart(3, "0")}_p${pageDigits.padStart(3, "0")}.png`;
};

const buildOptionRegionFallbackPath = (
  pdfName: string,
  questionNumber: string,
  pageStart: string | number | undefined,
  optionKey: string,
): string | null => {
  const baseName = pdfName.replace(/\.pdf$/i, "");
  const questionNumberDigits = extractNumericSegment(questionNumber);
  const pageDigits = extractNumericSegment(pageStart);
  const normalizedOptionKey = optionKey.toUpperCase().match(/[A-I]/)?.[0];

  if (!baseName || !questionNumberDigits || !pageDigits || !normalizedOptionKey) {
    return null;
  }

  return `images/${baseName}/option_regions/${baseName}_q${questionNumberDigits.padStart(3, "0")}_p${pageDigits.padStart(3, "0")}_opt_${normalizedOptionKey}.png`;
};

const extractTableText = (
  questionText: string,
  optionLines: string[],
  categoryValue: string | undefined,
): string | null => {
  const isTableQuestion = categoryValue?.toLowerCase() === "table" || /\btable\b/i.test(questionText);
  if (!isTableQuestion) {
    return null;
  }

  const supplementalOptionLines = optionLines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^[A-D][.)]\s+/i.test(line))
    .map((line) => line.replace(/^[A-I][.)]\s*/i, "").trim());

  let tableSegment = [questionText, ...supplementalOptionLines].join(" ").replace(/\s+/g, " ").trim();
  if (!tableSegment) {
    return null;
  }

  const focusedMarkers = [
    /Type of coin\s+Number of coins[\s\S]*$/i,
    /Item\s+Volume\s+Price[\s\S]*$/i,
    /CPU\s+Table[\s\S]*$/i,
    /Process\s+Length of execution time\s+Time of arrival[\s\S]*$/i,
    /Product_code\s+Product_name\s+Unit_price[\s\S]*$/i,
    /Employee_ID\s+Project_ID[\s\S]*$/i,
  ];

  for (const marker of focusedMarkers) {
    const markerMatch = tableSegment.match(marker);
    if (markerMatch) {
      tableSegment = markerMatch[0];
      break;
    }
  }

  tableSegment = tableSegment
    .replace(/\s+[-–]\s*\d+\s*[-–]\s*$/g, "")
    .replace(/\b([A-Z])\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, "\n$1 $2 $3")
    .replace(/\b(\d+(?:-cent|-dollar))\s+(-?\d+(?:\.\d+)?)/gi, "\n$1 $2")
    .replace(
      /\b(Cache memory|Main memory|Type of coin|Number of coins|Product_code|Product_name|Unit_price|Employee_ID|Project_ID|Process|Length of execution time|Time of arrival)\b/g,
      "\n$1",
    )
    .replace(/\n{2,}/g, "\n")
    .trim();

  const lineCount = tableSegment.split("\n").map((line) => line.trim()).filter(Boolean).length;
  return lineCount >= 2 ? tableSegment : null;
};

const trimVisualQuestionStem = (questionText: string): string => {
  const lines = questionText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return questionText.trim();
  }

  const visualMarkerRegex = /^(Table|Figure|Legend|Constraint:?|Account|Transfer|Transaction|Type of coin|Product|Employee|JobID|SQL|The Internet|DMZ|LAN)\b/i;
  const repeatedTokenRegex = /\b([A-Za-z]{3,})\1\b/;

  const cutoffIndex = lines.findIndex(
    (line, index) =>
      index > 0 &&
      (visualMarkerRegex.test(line) || repeatedTokenRegex.test(line) || /^\d{3,}(\s+\d{2,})+/.test(line)),
  );

  if (cutoffIndex === -1) {
    return questionText.trim();
  }

  const trimmed = lines.slice(0, cutoffIndex).join(" ").trim();
  return trimmed.length >= 40 ? trimmed : questionText.trim();
};

const buildQuestionPool = (settings: MockExamSettings): MockExamQuestion[] => {
  const selectedTopics = new Set(settings.selectedTopics);
  const questionPool: MockExamQuestion[] = [];

  pipelineEntries.forEach((entry, entryIndex) => {
    const fallbackPdfName = getFileNameFromPath(entry.pdf_path);
    const questions = Array.isArray(entry.questions) ? entry.questions : [];

    questions.forEach((question, questionIndex) => {
      const pdfName = isString(question.pdf_name) ? question.pdf_name : fallbackPdfName;
      if (!pdfName || !matchesExamType(pdfName, settings.examType)) {
        return;
      }

      const questionNumber = String(question.question_number ?? "").trim();
      if (!questionNumber) {
        return;
      }

      const subjectTopic = isString(question.subject_topic) ? question.subject_topic.trim() : "";
      if (!subjectTopic || !selectedTopics.has(subjectTopic)) {
        return;
      }

      const questionText = isString(question.question_text) ? question.question_text.trim() : "";
      if (!questionText) {
        return;
      }

      const normalizedSourceQuestionText = normalizeLegacySymbols(questionText);

      const optionLines = Array.isArray(question.options)
        ? question.options
            .filter(isString)
            .map((option) => normalizeLegacySymbols(option.trim()))
            .filter(Boolean)
        : [];

      const { normalizedQuestionText, normalizedOptionLines } = normalizeQuestionStemAndOptions(
        normalizedSourceQuestionText,
        optionLines,
      );

      if (!normalizedQuestionText) {
        return;
      }

      if (normalizedOptionLines.length === 0) {
        return;
      }

      const options = extractOptionsFromLines(normalizedOptionLines);
      if (options.length < 2) {
        return;
      }

      const shouldUseVisualFallback =
        question.category?.toLowerCase() === "table" || /\b(figure|diagram|uml)\b/i.test(normalizedQuestionText);

      const optionImagePathMap = parseOptionImagePathMap(question.option_image_paths);

      if (shouldUseVisualFallback && optionImagePathMap.size === 0) {
        ["A", "B", "C", "D"].forEach((optionKey) => {
          const fallbackOptionImagePath = buildOptionRegionFallbackPath(pdfName, questionNumber, question.page_start, optionKey);
          if (fallbackOptionImagePath) {
            optionImagePathMap.set(optionKey, fallbackOptionImagePath);
          }
        });
      }

      const mergedOptionMap = new Map<string, { key: string; text: string; imagePath: string | null }>();

      options.forEach((option) => {
        mergedOptionMap.set(option.key, {
          key: option.key,
          text: option.text,
          imagePath: optionImagePathMap.get(option.key) ?? null,
        });
      });

      optionImagePathMap.forEach((imagePath, key) => {
        if (mergedOptionMap.has(key)) {
          return;
        }

        mergedOptionMap.set(key, {
          key,
          text: "",
          imagePath,
        });
      });

      const canonicalOptionKeys = ["A", "B", "C", "D"];
      const canonicalOptions = canonicalOptionKeys
        .map((key) => mergedOptionMap.get(key))
        .filter((option): option is { key: string; text: string; imagePath: string | null } =>
          Boolean(option && (option.text || option.imagePath)),
        );

      if (canonicalOptions.length !== 4) {
        return;
      }

      const mappedFromQuestion = normalizeAnswer(question.mapped_answer ?? null);
      const mappedFromLookup = normalizeAnswer(answerMapping[pdfName]?.[questionNumber]);
      const correctOption = mappedFromQuestion ?? mappedFromLookup;

      if (!correctOption || !canonicalOptionKeys.includes(correctOption)) {
        return;
      }

      const category = isString(question.subject_category)
        ? question.subject_category
        : deriveCategoryFromTopic(subjectTopic);
      const tableText = extractTableText(normalizedQuestionText, normalizedOptionLines, question.category);
      const displayQuestionText = shouldUseVisualFallback
        ? trimVisualQuestionStem(normalizedQuestionText)
        : normalizedQuestionText;

      const questionImagePath =
        normalizeImagePath(question.region_image_path) ??
        (shouldUseVisualFallback
          ? buildQuestionRegionFallbackPath(pdfName, questionNumber, question.page_start)
          : null);

      questionPool.push({
        id: `${pdfName}::${questionNumber}::${entryIndex}-${questionIndex}`,
        pdfName,
        questionNumber,
        questionText: displayQuestionText,
        tableText,
        questionImagePath,
        options: canonicalOptions,
        correctOption,
        subjectCategory: category,
        subjectTopic,
      });
    });
  });

  return questionPool;
};

const shuffleQuestions = <T>(items: T[]): T[] => {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temporary = result[index];
    result[index] = result[swapIndex];
    result[swapIndex] = temporary;
  }

  return result;
};

export const buildMockExamSession = (settings: MockExamSettings): MockExamSession => {
  const pool = buildQuestionPool(settings);
  const selectedQuestions = shuffleQuestions(pool).slice(0, Math.min(pool.length, settings.questionCount));

  return {
    sessionId: `mock-session-${Date.now()}`,
    createdAtMs: Date.now(),
    startedAtMs: Date.now(),
    settings,
    questions: selectedQuestions,
    currentQuestionIndex: 0,
    answers: {},
    hintsUsed: 0,
  };
};

export const getEligibleQuestionCount = (settings: MockExamSettings): number => buildQuestionPool(settings).length;

export const getAllAvailableTopics = (): string[] => [...allTopics];
