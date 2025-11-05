import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ParsedExam, ParsedQuestion } from './types';
import StudentInfoForm from './components/StudentInfoForm';
import MathText from './components/MathText';

interface ExamConfig {
    title: string;
    timeLimit: number;
    maxRetries: number;
    // ... other config properties
}

interface ExamPayload {
    config: ExamConfig;
    exam: ParsedExam;
    teacherName: string;
    examCode: string;
}

const OnlineExam: React.FC = () => {
    const [examState, setExamState] = useState<'loading' | 'login' | 'taking_exam' | 'error'>('loading');
    const [examData, setExamData] = useState<ExamPayload | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [answers, setAnswers] = useState<{ [questionId: string]: number }>({});
    const [error, setError] = useState<string | null>(null);
    const [loginError, setLoginError] = useState<string | null>(null);

    useEffect(() => {
        const fetchExamData = async () => {
            try {
                const hash = window.location.hash.substring(1);
                if (hash) {
                    // The hash is now a Gist ID
                    const gistId = hash;
                    const response = await fetch(`https://api.github.com/gists/${gistId}`);

                    if (!response.ok) {
                        throw new Error(`Could not fetch exam data. Status: ${response.status}`);
                    }

                    const gistData = await response.json();
                    const examFileContent = gistData.files['exam.json']?.content;

                    if (!examFileContent) {
                        throw new Error("Exam data not found in the provided link.");
                    }

                    const data: ExamPayload = JSON.parse(examFileContent);
                    setExamData(data);
                    setExamState('login');
                } else {
                    setError("Không tìm thấy dữ liệu bài thi. Vui lòng kiểm tra lại đường link.");
                    setExamState('error');
                }
            } catch (e: any) {
                console.error("Failed to parse exam data:", e);
                setError(`Dữ liệu bài thi không hợp lệ hoặc đã bị hỏng. Lỗi: ${e.message}`);
                setExamState('error');
            }
        };

        fetchExamData();
    }, []);

    const handleLoginSubmit = (info: { name: string; studentClass: string; code: string }) => {
        setLoginError(null);
        if (examData && info.code.toUpperCase() === examData.examCode.toUpperCase()) {
            setExamState('taking_exam');
            if (examData.config.timeLimit > 0) {
                setTimeLeft(examData.config.timeLimit * 60);
            }
        } else {
            setLoginError('Mã đề không chính xác. Vui lòng thử lại.');
        }
    };
    
    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0) {
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prevTime => (prevTime ? prevTime - 1 : 0));
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    
    const handleAnswerChange = (questionId: string, answerIndex: number) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: answerIndex,
        }));
    };

    const multipleChoiceQuestions = useMemo(() => 
        examData?.exam.questions.filter(q => q.question_type === 'multiple_choice') || [],
        [examData]
    );

    if (examState === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-indigo-600"></div>
            </div>
        );
    }

    if (examState === 'error') {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="p-8 bg-white rounded-lg shadow-md text-center">
                    <h2 className="text-xl font-bold text-red-600">Lỗi</h2>
                    <p className="mt-2 text-gray-700">{error}</p>
                </div>
            </div>
        );
    }
    
    if (examState === 'login') {
        return (
            <StudentInfoForm
                teacherName={examData?.teacherName || '...'}
                onSubmit={handleLoginSubmit}
                error={loginError}
            />
        );
    }

    if (examState === 'taking_exam' && examData) {
        const optionLabels = ['A', 'B', 'C', 'D'];
        return (
            <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 font-sans">
                <header className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 rounded-xl shadow-lg mb-8">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold">{examData.config.title || 'Bài Tập Luyện Tập'}</h1>
                            <p className="mt-2 opacity-90">Hãy hoàn thành các câu hỏi dưới đây một cách tốt nhất!</p>
                            <p className="mt-1 text-sm opacity-80">Tác giả: {examData.teacherName}</p>
                        </div>
                        {timeLeft !== null && (
                            <div className="bg-black bg-opacity-20 rounded-lg p-3 text-center shadow-inner">
                                <div className="text-4xl font-mono font-bold tracking-wider">{formatTime(timeLeft)}</div>
                                <div className="text-xs opacity-80 mt-1">Lượt làm lại còn: {examData.config.maxRetries}</div>
                            </div>
                        )}
                    </div>
                </header>

                <main className="space-y-8">
                    {multipleChoiceQuestions.length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">PHẦN I. TRẮC NGHIỆM KHÁCH QUAN</h2>
                            <p className="mt-1 text-sm text-gray-600">Chọn đáp án đúng nhất trong các lựa chọn sau.</p>
                            <div className="mt-6 space-y-6">
                                {multipleChoiceQuestions.map((q, index) => (
                                    <div key={q.id} className="bg-white rounded-xl shadow-md p-6 border border-gray-200/80">
                                        <div className="mb-5">
                                            <span className="font-bold text-indigo-700">Câu {index + 1}:</span> <MathText text={q.question_text} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {q.options?.map((option, optionIndex) => (
                                                <label 
                                                    key={optionIndex}
                                                    className={`flex items-start space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                                                        answers[q.id] === optionIndex
                                                            ? 'border-indigo-600 bg-indigo-50' 
                                                            : 'border-gray-300 bg-white hover:border-indigo-400'
                                                    }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name={q.id}
                                                        checked={answers[q.id] === optionIndex}
                                                        onChange={() => handleAnswerChange(q.id, optionIndex)}
                                                        className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <div className="flex-grow">
                                                        <span className={`font-medium ${answers[q.id] === optionIndex ? 'text-indigo-900' : 'text-gray-800'}`}>
                                                            {optionLabels[optionIndex]}. <MathText text={option} />
                                                        </span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Placeholder for other question types */}
                </main>
            </div>
        );
    }

    return null;
};

export default OnlineExam;