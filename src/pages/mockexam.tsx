import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../components/navbar";
import Footer from "../components/footer";
import { CaretLeftIcon, CaretRightIcon, PauseCircleIcon, EyeSlashIcon, SmileySadIcon } from "@phosphor-icons/react";
import {
    clearMockExamSession,
    computeMockExamResult,
    formatClockFromSeconds,
    loadMockExamSession,
    saveMockExamResult,
    saveMockExamSession,
} from "../exam/mockExamModel";

const resolveChoiceImageUrl = (imagePath: string): string => {
    const normalizedPath = imagePath.trim().replace(/\\/g, "/").replace(/^\.?\//, "");

    if (normalizedPath.startsWith("http://") || normalizedPath.startsWith("https://") || normalizedPath.startsWith("/")) {
        return normalizedPath;
    }

    return `/pipeline/outputs-all/${normalizedPath}`;
};

const normalizeLegacySymbols = (text: string): string =>
    text
        .replace(/\uF0AE|\uF0E0/g, "→")
        .replace(/\uF0DF/g, "←")
        .replace(/\uF0A3/g, "≤")
        .replace(/\uF0B3/g, "≥")
        .replace(/\uF0B8/g, "÷")
        .replace(/\uF0B4/g, "×")
        .replace(/\uF0B9/g, "≠");

export default function MockExamPage() {
    const navigate = useNavigate();
    const [session] = useState(() => loadMockExamSession());
    const [currentIndex, setCurrentIndex] = useState(session?.currentQuestionIndex ?? 0);
    const [answers, setAnswers] = useState<Record<string, string>>(session?.answers ?? {});
    const [hintsUsed, setHintsUsed] = useState(session?.hintsUsed ?? 0);
    const [hintShownByQuestion, setHintShownByQuestion] = useState<Record<string, boolean>>({});
    const [eliminatedOptionsByQuestion, setEliminatedOptionsByQuestion] = useState<Record<string, string[]>>({});
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [questionStartedAtMs, setQuestionStartedAtMs] = useState(Date.now());
    const [questionElapsedSeconds, setQuestionElapsedSeconds] = useState(0);
    const hasFinalizedRef = useRef(false);

    const questions = session?.questions ?? [];
    const totalQuestions = questions.length;
    const currentQuestion = questions[currentIndex];
    const selectedAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

    const isTimed = session?.settings.isTimed ?? false;
    const totalDurationSeconds = (session?.settings.durationMinutes ?? 0) * 60;

    const finalizeExam = (forcedElapsedSeconds?: number) => {
        if (!session || hasFinalizedRef.current) {
            return;
        }

        hasFinalizedRef.current = true;

        const totalExamSeconds = Math.max(0, Math.floor(forcedElapsedSeconds ?? elapsedSeconds));
        const result = computeMockExamResult(session, answers, totalExamSeconds, hintsUsed);

        saveMockExamResult(result);
        clearMockExamSession();
        navigate("/mockexamresults");
    };

    useEffect(() => {
        if (!session) {
            return;
        }

        const timerId = window.setInterval(() => {
            const nextElapsed = Math.floor((Date.now() - session.startedAtMs) / 1000);
            setElapsedSeconds(nextElapsed);
        }, 1000);

        return () => window.clearInterval(timerId);
    }, [session]);

    useEffect(() => {
        setQuestionStartedAtMs(Date.now());
        setQuestionElapsedSeconds(0);
    }, [currentQuestion?.id]);

    useEffect(() => {
        const timerId = window.setInterval(() => {
            setQuestionElapsedSeconds(Math.floor((Date.now() - questionStartedAtMs) / 1000));
        }, 1000);

        return () => window.clearInterval(timerId);
    }, [questionStartedAtMs]);

    useEffect(() => {
        if (!session || !isTimed || hasFinalizedRef.current || totalDurationSeconds <= 0) {
            return;
        }

        if (elapsedSeconds >= totalDurationSeconds) {
            finalizeExam(totalDurationSeconds);
        }
    }, [elapsedSeconds, isTimed, session, totalDurationSeconds]);

    useEffect(() => {
        if (!session) {
            return;
        }

        saveMockExamSession({
            ...session,
            currentQuestionIndex: currentIndex,
            answers,
            hintsUsed,
        });
    }, [session, currentIndex, answers, hintsUsed]);

    const moveToQuestion = (nextIndex: number) => {
        const boundedIndex = Math.max(0, Math.min(totalQuestions - 1, nextIndex));
        setCurrentIndex(boundedIndex);
    };

    const handleNextQuestion = () => {
        if (currentIndex >= totalQuestions - 1) {
            finalizeExam();
            return;
        }

        moveToQuestion(currentIndex + 1);
    };

    const handlePreviousQuestion = () => {
        moveToQuestion(currentIndex - 1);
    };

    const handleSelectAnswer = (optionKey: string) => {
        if (!currentQuestion) {
            return;
        }

        setAnswers((currentAnswers) => {
            const hasExistingAnswer = Boolean(currentAnswers[currentQuestion.id]);

            if (session?.settings.instantAnswers && hasExistingAnswer) {
                return currentAnswers;
            }

            return {
                ...currentAnswers,
                [currentQuestion.id]: optionKey,
            };
        });
    };

    const handleUseHint = () => {
        if (!currentQuestion) {
            return;
        }

        if (hintShownByQuestion[currentQuestion.id]) {
            return;
        }

        const removableOptionKeys = answerLetterKeys.filter((letter) => {
            const option = optionByKey.get(letter);
            const hasChoiceContent = Boolean(option && (option.text || option.imagePath));
            const isCorrectOption = letter === currentQuestion.correctOption;
            const isCurrentlySelected = selectedAnswer === letter;

            return hasChoiceContent && !isCorrectOption && !isCurrentlySelected;
        });

        const shuffledWrongOptions = [...removableOptionKeys].sort(() => Math.random() - 0.5);
        const eliminatedKeys = shuffledWrongOptions.slice(0, 2);

        setEliminatedOptionsByQuestion((currentEliminated) => ({
            ...currentEliminated,
            [currentQuestion.id]: eliminatedKeys,
        }));

        setHintsUsed((currentCount) => currentCount + 1);
        setHintShownByQuestion((currentHints) => ({
            ...currentHints,
            [currentQuestion.id]: true,
        }));
    };

    if (!session || !currentQuestion) {
        return (
            <>
                <div className="py-10 md:py-0 min-h-screen flex w-full flex-col items-center bg-white gap-6 md:gap-10 select-none">
                    <NavBar></NavBar>
                    <div className="flex-1 w-full flex items-center justify-center px-6 md:px-20">
                        <div className="border-2 border-black p-8 md:p-10 w-full max-w-xl flex flex-col items-center gap-6 text-center">
                            <SmileySadIcon className="h-16 w-auto" weight="bold"></SmileySadIcon>
                            <h1 className="text-3xl md:text-4xl font-bold">No active mock exam found</h1>
                            <p className="text-sm md:text-base opacity-75">Start from the prep page so we can build an exam from your selected settings.</p>
                            <button
                                type="button"
                                onClick={() => navigate("/mockexamprep")}
                                className="border-2 border-black px-6 py-3 font-bold hover:bg-black hover:text-white transition-colors duration-200"
                            >
                                GO TO MOCK EXAM PREP
                            </button>
                        </div>
                    </div>
                    <Footer></Footer>
                </div>
            </>
        );
    }

    const examTimerDisplay = isTimed
        ? formatClockFromSeconds(Math.max(0, totalDurationSeconds - elapsedSeconds), true)
        : formatClockFromSeconds(elapsedSeconds, true);

    const instantRevealEnabled = session.settings.instantAnswers && Boolean(selectedAnswer);
    const answerLockedForCurrentQuestion = session.settings.instantAnswers && Boolean(selectedAnswer);
    const selectedAnswerIsCorrect = selectedAnswer === currentQuestion.correctOption;
    const hintVisible = Boolean(hintShownByQuestion[currentQuestion.id]);
    const answerLetterKeys = ["A", "B", "C", "D"] as const;
    const optionByKey = new Map(currentQuestion.options.map((option) => [option.key, option]));
    const eliminatedOptionSet = new Set(eliminatedOptionsByQuestion[currentQuestion.id] ?? []);
    const allQuestionImagePaths = Array.from(
        new Set(
            [
                currentQuestion.questionImagePath,
                ...currentQuestion.options.map((choice) => choice.imagePath),
            ].filter((path): path is string => Boolean(path)),
        ),
    );
    const renderedChoices = answerLetterKeys.map((letter) => {
        const option = optionByKey.get(letter);

        return (
            option ?? {
                key: letter,
                text: "",
                imagePath: null,
            }
        );
    });

    return (
        <>
            <div className="py-10 md:py-0 md:min-h-screen flex md:w-full flex-col items-center bg-white gap-4 md:gap-10 select-none">
                <NavBar></NavBar>

                <div className="w-[79vw] md:w-full flex justify-between md:px-10 items-center">
                    <button
                        type="button"
                        onClick={handlePreviousQuestion}
                        disabled={currentIndex === 0}
                        className="disabled:opacity-30"
                    >
                        <CaretLeftIcon className="h-10 md:h-15 w-auto" weight="bold"></CaretLeftIcon>
                    </button>
                    <h1 className="text-3xl md:text-5xl font-light">{examTimerDisplay}</h1>
                    <button
                        type="button"
                        onClick={handleNextQuestion}
                        className="disabled:opacity-30"
                    >
                        <CaretRightIcon className="h-10 md:h-15 w-auto" weight="bold"></CaretRightIcon>
                    </button>
                </div>

                <div className="md:min-h-[69vh] flex-col md:flex-row w-full flex items-center justify-between gap-10 md:gap-0 px-4 lg:px-20">
                    <div className="flex flex-col md:w-1/2 md:max-w-5xl border-black md:p-6 gap-5 md:gap-6 bg-white text-black">
                        <div className="flex md:w-full justify-between items-center gap-4">
                            <div className="flex gap-1 items-center">
                                <h1 className="font-extrabold md:text-3xl text-3xl">Q{currentIndex + 1}</h1>
                                <p className="opacity-85 md:text-lg text-lg">/{totalQuestions}</p>
                            </div>
                            <h1 className="text-sm md:text-2xl opacity-55 font-extrabold text-right">{currentQuestion.subjectTopic.toUpperCase()}</h1>
                        </div>

                        <p className="md:text-base text-justify leading-relaxed whitespace-pre-line">{normalizeLegacySymbols(currentQuestion.questionText)}</p>

                        {currentQuestion.tableText ? (
                            <div className="border border-black/25 bg-black/2 p-3 md:p-4">
                                <p className="font-extrabold text-xs md:text-sm mb-2 tracking-wide">TABLE</p>
                                <pre className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto">{normalizeLegacySymbols(currentQuestion.tableText)}</pre>
                            </div>
                        ) : null}

                        {allQuestionImagePaths.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                <p className="font-extrabold text-xs md:text-sm tracking-wide">IMAGES</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {allQuestionImagePaths.map((imagePath, imageIndex) => (
                                        <img
                                            key={`${currentQuestion.id}-question-image-${imageIndex}`}
                                            src={resolveChoiceImageUrl(imagePath)}
                                            alt={`Question visual ${imageIndex + 1}`}
                                            className="max-h-56 w-auto object-contain border border-black/10 bg-white"
                                            loading="lazy"
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <div className="mt-2 flex flex-col gap-3">
                            {renderedChoices.map((choice) => (
                                <div key={`${currentQuestion.id}-choice-${choice.key}`} className="border-b border-black/25 pb-3">
                                    <p className="font-extrabold text-sm md:text-base mb-2">{choice.key}.</p>
                                    {choice.imagePath ? (
                                        <img
                                            src={resolveChoiceImageUrl(choice.imagePath)}
                                            alt={`Choice ${choice.key}`}
                                            className="max-h-48 w-auto object-contain border border-black/10"
                                            loading="lazy"
                                        />
                                    ) : null}
                                    {choice.text ? <p className="text-sm md:text-base whitespace-pre-line mt-2">{normalizeLegacySymbols(choice.text)}</p> : null}
                                </div>
                            ))}
                        </div>

                        <p className="text-xs opacity-60">Source: {currentQuestion.pdfName} · #{currentQuestion.questionNumber}</p>
                    </div>

                    <div className="md:w-1/2 w-full md:px-10 flex flex-col-reverse md:flex-col md:gap-12 gap-8">
                        <div className="flex justify-between items-center gap-4">
                            <div className="flex md:gap-5 gap-2 flex-col-reverse md:flex-row">
                                <button
                                    type="button"
                                    onClick={() => finalizeExam()}
                                    className="font-extrabold md:px-3 md:py-2 px-5 py-2 border-2 md:h-15 flex items-center md:gap-2"
                                >
                                    FORFEIT
                                </button>
                                <button
                                    type="button"
                                    onClick={handleUseHint}
                                    disabled={hintVisible}
                                    className="font-extrabold md:px-5 md:py-2 px-5 py-2 border-2 md:h-15 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    HINT
                                </button>
                            </div>

                            <div className="flex md:gap-5 gap-4">
                                <div className="md:h-36 h-24 aspect-square rounded-full flex items-center justify-center border-3 md:border-5">
                                    <h1 className="md:text-2xl text-xl font-bold">{formatClockFromSeconds(questionElapsedSeconds, false)}</h1>
                                </div>
                                <div className="flex flex-col justify-center md:gap-5 gap-2">
                                    <EyeSlashIcon className="md:h-8 w-auto h-10" weight="bold"></EyeSlashIcon>
                                    <PauseCircleIcon className="md:h-8 w-auto h-10" weight="bold"></PauseCircleIcon>
                                </div>
                            </div>
                        </div>

                        {hintVisible ? (
                            <p className="text-sm border-l-4 border-black pl-3">
                                Hint used: {eliminatedOptionSet.size} incorrect {eliminatedOptionSet.size === 1 ? "option" : "options"} removed.
                            </p>
                        ) : null}

                        {instantRevealEnabled ? (
                            <p className={`text-sm border-l-4 pl-3 ${selectedAnswerIsCorrect ? "border-green-700 text-green-700" : "border-red-700 text-red-700"}`}>
                                {selectedAnswerIsCorrect
                                    ? "Correct answer!"
                                    : `Incorrect. Correct answer is ${currentQuestion.correctOption}.`}
                            </p>
                        ) : null}

                        <div className="grid grid-cols-2 gap-2 md:gap-0">
                            {answerLetterKeys.map((letter) => {
                                const choice = optionByKey.get(letter);
                                const hasChoiceContent = Boolean(choice && (choice.text || choice.imagePath));
                                const isSelected = selectedAnswer === letter;
                                const isEliminated = eliminatedOptionSet.has(letter);
                                const isDisabled = !hasChoiceContent || answerLockedForCurrentQuestion || isEliminated;

                                return (
                                    <button
                                        key={`${currentQuestion.id}-${letter}`}
                                        type="button"
                                        onClick={() => handleSelectAnswer(letter)}
                                        disabled={isDisabled}
                                        className={`duration-300 cursor-pointer px-5 py-7 md:px-10 md:py-5 md:text-2xl border ${
                                            !hasChoiceContent
                                                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                                : answerLockedForCurrentQuestion
                                                    ? isSelected
                                                        ? "text-black bg-white border-black font-extrabold cursor-not-allowed"
                                                        : "text-black/60 bg-white border-black/30 cursor-not-allowed"
                                                    : isEliminated
                                                        ? "bg-gray-200 text-gray-500 border-black/20 cursor-not-allowed"
                                                    : isSelected
                                                        ? "text-black bg-white border-black font-extrabold"
                                                        : "text-white bg-black border-white hover:text-black hover:bg-white hover:font-extrabold"
                                        }`}
                                    >
                                        {letter}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={handleNextQuestion}
                            className="border-2 border-black py-3 font-bold hover:bg-black hover:text-white transition-colors duration-200"
                        >
                            NEXT QUESTION
                        </button>

                        <button
                            type="button"
                            onClick={() => finalizeExam()}
                            className="border-2 border-black py-3 font-bold hover:bg-black hover:text-white transition-colors duration-200"
                        >
                            SUBMIT EXAM
                        </button>
                    </div>
                </div>

                <Footer></Footer>
            </div>
        </>
    );
}
