import React, { useState, useCallback } from 'react';
import type { ParsedExam, ParsedQuestion } from '../types';
import { PlusIcon, DuplicateIcon, GameIcon, ReviewIcon, ExportIcon, AssignIcon, DownloadIcon, InfoIcon, SimilarIcon, LatexIcon, ChangeTypeIcon, TrashIcon } from './icons';
import { Packer, Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, PageBreak } from 'docx';
import EditQuestionModal from './EditQuestionModal';
import { generateExplanation, generateSimilarQuestion } from '../services/geminiService';

interface ExamResultViewProps {
  examData: ParsedExam;
  onBackToForm: () => void;
  onStartNew: () => void;
}

const HeaderAction: React.FC<{ label: string; color: string; icon: React.ReactNode, onClick?: () => void }> = ({ label, color, icon, onClick }) => (
    <button onClick={onClick} className={`flex items-center space-x-2 px-3 py-2 text-sm font-semibold text-white ${color} rounded-md shadow-sm hover:opacity-90 transition-opacity`}>
        {icon}
        <span>{label}</span>
    </button>
);

const QuestionAction: React.FC<{ label: string; color: string; icon: React.ReactNode }> = ({ label, color, icon }) => (
     <button className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium ${color} rounded-md shadow-sm hover:opacity-90 transition-opacity`}>
        {icon}
        <span>{label}</span>
    </button>
);

const ExamResultView: React.FC<ExamResultViewProps> = ({ examData, onStartNew }) => {
    const [activeTab, setActiveTab] = useState('exam');
    const [currentExam, setCurrentExam] = useState<ParsedExam>(examData);
    const [editingQuestion, setEditingQuestion] = useState<ParsedQuestion | null>(null);
    const [processingState, setProcessingState] = useState<{ id: string; action: 'similar' | 'explain' } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mismatchedQuestion, setMismatchedQuestion] = useState<{ original: ParsedQuestion; generated: ParsedQuestion } | null>(null);
    const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);


    const multipleChoiceQuestions = currentExam.questions.filter(q => q.question_type === 'multiple_choice');
    const trueFalseQuestions = currentExam.questions.filter(q => q.question_type === 'true_false');

    const handleExportToWord = useCallback(() => {
        const optionLabels = ['A', 'B', 'C', 'D'];
        const trueFalseLabels = ['a', 'b', 'c', 'd'];
        
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ text: "ĐỀ THI", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
                    
                    ...(multipleChoiceQuestions.length > 0 ? [
                        new Paragraph({ children: [new TextRun({ text: "PHẦN I. TRẮC NGHIỆM KHÁCH QUAN", bold: true })], heading: HeadingLevel.HEADING_2, spacing: { after: 200 } }),
                        ...multipleChoiceQuestions.flatMap((q, index) => [
                            new Paragraph({
                                children: [new TextRun({ text: `Câu ${index + 1}: `, bold: true }), new TextRun(q.question_text)],
                                spacing: { after: 200 },
                            }),
                            ...(q.options?.map((option, optionIndex) => {
                                const prefix = optionIndex === q.correct_answer_index ? `*${optionLabels[optionIndex]}` : optionLabels[optionIndex];
                                return new Paragraph({
                                    children: [new TextRun(`${prefix}. ${option}`)],
                                    indent: { left: 720 },
                                });
                            }) || []),
                            new Paragraph({ text: "" })
                        ])
                    ] : []),

                    ...(trueFalseQuestions.length > 0 ? [
                        new Paragraph({ 
                            children: [new TextRun({ text: "PHẦN II. CÂU HỎI ĐÚNG - SAI", bold: true })], 
                            heading: HeadingLevel.HEADING_2, 
                            spacing: { after: 200, before: multipleChoiceQuestions.length > 0 ? 400 : 0 } 
                        }),
                        ...trueFalseQuestions.flatMap((q, index) => [
                            new Paragraph({
                                children: [new TextRun({ text: `Câu ${index + 1}: `, bold: true }), new TextRun(q.question_text)],
                                spacing: { after: 200 },
                            }),
                            ...(q.statements?.map((statement, stmtIndex) => {
                                const prefix = statement.is_true ? `*${trueFalseLabels[stmtIndex]})` : `${trueFalseLabels[stmtIndex]})`;
                                return new Paragraph({
                                    children: [new TextRun(`${prefix} ${statement.text}`)],
                                    indent: { left: 720 },
                                });
                            }) || []),
                            new Paragraph({ text: "" })
                        ])
                    ] : []),
                ],
            }],
        });

        Packer.toBlob(doc).then(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'de-thi.docx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        });
    }, [currentExam, multipleChoiceQuestions, trueFalseQuestions]);


    const handleExportWithAnswerKey = useCallback(() => {
        // --- 1. Use Original Questions (No Shuffling) ---
        const allQuestions = currentExam.questions;

        const mcQuestions = allQuestions.filter(q => q.question_type === 'multiple_choice');
        const tfQuestions = allQuestions.filter(q => q.question_type === 'true_false');

        const optionLabels = ['A', 'B', 'C', 'D'];
        const trueFalseLabels = ['a', 'b', 'c', 'd'];

        // --- 2. Build the Document ---
        const docChildren: (Paragraph | Table)[] = [];

        // --- Part 1: Exam Paper ---
        docChildren.push(new Paragraph({ text: "ĐỀ THI", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 400 } }));
        
        if (mcQuestions.length > 0) {
            docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN I. TRẮC NGHIỆM KHÁCH QUAN", bold: true })], heading: HeadingLevel.HEADING_2, spacing: { after: 200 } }));
            mcQuestions.forEach((q, index) => {
                docChildren.push(new Paragraph({
                    children: [new TextRun({ text: `Câu ${index + 1}: `, bold: true }), new TextRun(q.question_text)],
                    spacing: { after: 200 },
                }));
                q.options?.forEach((option, optionIndex) => {
                    docChildren.push(new Paragraph({
                        children: [new TextRun(`${optionLabels[optionIndex]}. ${option}`)],
                        indent: { left: 720 },
                    }));
                });
                docChildren.push(new Paragraph({ text: "" }));
            });
        }

        if (tfQuestions.length > 0) {
            docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN II. CÂU HỎI ĐÚNG - SAI", bold: true })], heading: HeadingLevel.HEADING_2, spacing: { after: 200, before: mcQuestions.length > 0 ? 400 : 0 } }));
            tfQuestions.forEach((q, index) => {
                docChildren.push(new Paragraph({
                    children: [new TextRun({ text: `Câu ${index + 1 + mcQuestions.length}: `, bold: true }), new TextRun(q.question_text)],
                    spacing: { after: 200 },
                }));
                q.statements?.forEach((statement, stmtIndex) => {
                    docChildren.push(new Paragraph({
                        children: [new TextRun(`${trueFalseLabels[stmtIndex]}) ${statement.text}`)],
                        indent: { left: 720 },
                    }));
                });
                docChildren.push(new Paragraph({ text: "" }));
            });
        }

        // --- Part 2: Answer Key ---
        docChildren.push(new Paragraph({ children: [new PageBreak()] }));
        docChildren.push(new Paragraph({ text: "ĐÁP ÁN", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 400 } }));

        if (mcQuestions.length > 0) {
            docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN I.", bold: true })], spacing: { after: 100 } }));
            docChildren.push(new Paragraph({ children: [new TextRun({ text: "(Mỗi câu trả lời đúng thí sinh được 0,25 điểm)", italics: true })], spacing: { after: 200 } }));
            
            const midPoint = Math.ceil(mcQuestions.length / 2);
            const mcTableRows: TableRow[] = [];
            for (let i = 0; i < midPoint; i++) {
                const q1 = mcQuestions[i];
                const q2 = mcQuestions[i + midPoint];
                mcTableRows.push(new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph(`${i + 1}`)] }),
                        new TableCell({ children: [new Paragraph(optionLabels[q1.correct_answer_index ?? 0])] }),
                        new TableCell({ children: [new Paragraph(q2 ? `${i + 1 + midPoint}` : '')] }),
                        new TableCell({ children: [new Paragraph(q2 ? optionLabels[q2.correct_answer_index ?? 0] : '')] }),
                    ]
                }));
            }
            const mcTable = new Table({
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Câu", bold: true })] })] }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Đáp án", bold: true })] })] }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Câu", bold: true })] })] }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Đáp án", bold: true })] })] }),
                        ], tableHeader: true
                    }),
                    ...mcTableRows
                ],
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1 }, insideVertical: { style: BorderStyle.SINGLE, size: 1 } },
            });
            docChildren.push(mcTable);
        }
        
        if (tfQuestions.length > 0) {
            docChildren.push(new Paragraph({ text: "", spacing: { before: 400 } }));
            docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN II.", bold: true })], spacing: { after: 200 } }));
             
            const tfTableRows: TableRow[] = [];
            tfQuestions.forEach((q, index) => {
                const questionNumber = index + 1 + mcQuestions.length;
                q.statements?.forEach((stmt, stmtIndex) => {
                    if (stmtIndex === 0) {
                        tfTableRows.push(new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ text: `${questionNumber}`, alignment: AlignmentType.CENTER })], rowSpan: 4, verticalAlign: VerticalAlign.CENTER }),
                                new TableCell({ children: [new Paragraph({ text: trueFalseLabels[stmtIndex] })] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: stmt.is_true ? 'Đ' : 'S', bold: true })] })] }),
                            ]
                        }));
                    } else {
                         tfTableRows.push(new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ text: trueFalseLabels[stmtIndex] })] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: stmt.is_true ? 'Đ' : 'S', bold: true })] })] }),
                            ]
                        }));
                    }
                });
            });

            const tfTable = new Table({
                rows: [
                     new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Câu", bold: true })] })] }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Lệnh hỏi", bold: true })] })] }),
                            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Đáp án (Đ/S)", bold: true })] })] }),
                        ], tableHeader: true
                    }),
                    ...tfTableRows
                ],
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1 }, insideVertical: { style: BorderStyle.SINGLE, size: 1 } },
            });
            docChildren.push(tfTable);
        }

        // --- 3. Generate and Download ---
        const doc = new Document({ sections: [{ children: docChildren }] });
        Packer.toBlob(doc).then(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'de-thi-kem-dap-an.docx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        });

    }, [currentExam]);


    const requestDeleteQuestion = (questionId: string) => {
        setDeletingQuestionId(questionId);
    };

    const confirmDeleteQuestion = () => {
        if (!deletingQuestionId) return;
        setCurrentExam(prev => ({
            ...prev,
            questions: prev.questions.filter(q => q.id !== deletingQuestionId)
        }));
        setDeletingQuestionId(null);
    };

    const cancelDeleteQuestion = () => {
        setDeletingQuestionId(null);
    };

    const handleSaveQuestion = (updatedQuestion: ParsedQuestion) => {
        setCurrentExam(prev => ({
            ...prev,
            questions: prev.questions.map(q => q.id === updatedQuestion.id ? updatedQuestion : q)
        }));
        setEditingQuestion(null);
    };

    const handleGenerateExplanation = async (question: ParsedQuestion) => {
        const apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            alert("Vui lòng cấu hình API Key trong mục Cấu hình Hệ thống.");
            return;
        }
        setProcessingState({ id: question.id, action: 'explain' });
        setError(null);
        try {
            const explanationText = await generateExplanation(question, apiKey);
            setCurrentExam(prev => ({
                ...prev,
                questions: prev.questions.map(q => 
                    q.id === question.id ? { ...q, explanation: explanationText } : q
                )
            }));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setProcessingState(null);
        }
    };
    
    const addQuestionToExam = (newQuestion: ParsedQuestion, originalQuestionId: string) => {
        setCurrentExam(prev => {
            const originalIndex = prev.questions.findIndex(q => q.id === originalQuestionId);
            if (originalIndex === -1) return prev;
            
            const newQuestions = [...prev.questions];
            newQuestions.splice(originalIndex + 1, 0, newQuestion);

            return { ...prev, questions: newQuestions };
        });
    };

    const handleGenerateSimilar = async (originalQuestion: ParsedQuestion) => {
        const apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            alert("Vui lòng cấu hình API Key trong mục Cấu hình Hệ thống.");
            return;
        }
        setProcessingState({ id: originalQuestion.id, action: 'similar' });
        setError(null);

        const MAX_RETRIES = 1; // Attempt the generation a total of 2 times
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const newQuestion = await generateSimilarQuestion(originalQuestion, apiKey);

                const isValidMc = newQuestion.question_type === 'multiple_choice' && 
                                  Array.isArray(newQuestion.options) && 
                                  newQuestion.options.length === 4 && 
                                  typeof newQuestion.correct_answer_index === 'number';
                
                const isValidTf = newQuestion.question_type === 'true_false' && 
                                  Array.isArray(newQuestion.statements) && 
                                  newQuestion.statements.length === 4 &&
                                  newQuestion.statements.every(s => s && typeof s.text === 'string' && typeof s.is_true === 'boolean');

                if (!isValidMc && !isValidTf) {
                    throw new Error("AI generated an invalid question structure.");
                }

                // --- SUCCESS ---
                if (newQuestion.question_type !== originalQuestion.question_type) {
                    setMismatchedQuestion({ original: originalQuestion, generated: newQuestion });
                } else {
                    addQuestionToExam(newQuestion, originalQuestion.id);
                }
                setProcessingState(null);
                return; // Exit on success

            } catch (e: any) {
                console.warn(`Attempt ${attempt + 1} to generate similar question failed:`, e.message);
                if (attempt >= MAX_RETRIES) {
                    // --- FINAL FAILURE ---
                    setError("AI đã tạo ra một câu hỏi có cấu trúc không hợp lệ. Vui lòng thử lại.");
                    setProcessingState(null);
                }
            }
        }
    };

    const handleAcceptMismatchedQuestion = () => {
        if (mismatchedQuestion) {
            addQuestionToExam(mismatchedQuestion.generated, mismatchedQuestion.original.id);
            setMismatchedQuestion(null);
        }
    };

    const handleRetryMismatchedQuestion = () => {
        if (mismatchedQuestion) {
            const original = mismatchedQuestion.original;
            setMismatchedQuestion(null);
            setTimeout(() => handleGenerateSimilar(original), 100);
        }
    };
    
    const handleCancelMismatch = () => {
        setMismatchedQuestion(null);
    };


    const headerActions = [
        { label: 'Tạo đề mới', color: 'bg-blue-600', icon: <PlusIcon className="w-4 h-4" />, onClick: onStartNew },
        { label: 'Nhân bản đề (AI)', color: 'bg-cyan-500', icon: <DuplicateIcon className="w-4 h-4" /> },
        { label: 'Chơi Game', color: 'bg-green-500', icon: <GameIcon className="w-4 h-4" /> },
        { label: 'Tạo Ôn Tập', color: 'bg-purple-500', icon: <ReviewIcon className="w-4 h-4" /> },
        { label: 'Xuất Đề & Đáp án', color: 'bg-teal-500', icon: <ExportIcon className="w-4 h-4" />, onClick: handleExportWithAnswerKey },
        { label: 'Xuất ra Word (1 đề)', color: 'bg-blue-500', icon: <ExportIcon className="w-4 h-4" />, onClick: handleExportToWord },
        { label: 'Giao bài tập', color: 'bg-green-600', icon: <AssignIcon className="w-4 h-4" /> },
        { label: 'Tải kết quả làm bài', color: 'bg-lime-600', icon: <DownloadIcon className="w-4 h-4" /> },
    ];
    
    const optionLabels = ['A', 'B', 'C', 'D'];

    const renderQuestion = (q: ParsedQuestion, questionNumber: number) => {
        const isProcessingSimilar = processingState?.id === q.id && processingState?.action === 'similar';
        const isProcessingExplain = processingState?.id === q.id && processingState?.action === 'explain';

        return (
             <div key={q.id} className="bg-slate-50 border border-slate-200 rounded-xl p-6 relative">
                <div className="absolute top-4 right-4 flex space-x-2">
                    <button onClick={() => setEditingQuestion(q)} className="px-3 py-1 text-xs font-semibold text-yellow-800 bg-yellow-300 rounded-md hover:bg-yellow-400">Sửa</button>
                    <button onClick={() => requestDeleteQuestion(q.id)} className="px-3 py-1 text-xs font-semibold text-white bg-red-500 rounded-md hover:bg-red-600">Xóa</button>
                </div>

                <p className="mb-5 pr-20">
                    <span className="font-bold text-gray-800">Câu {questionNumber}:</span> {q.question_text}
                </p>

                {q.question_type === 'true_false' ? (
                    <div className="space-y-3">
                        {q.statements?.map((statement, stmtIndex) => (
                            <div 
                                key={stmtIndex} 
                                className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                                    statement.is_true ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'
                                }`}
                            >
                                <p className={`flex-grow pr-4 ${statement.is_true ? 'text-green-900' : 'text-red-900'}`}>
                                    <span className="font-bold mr-2">{String.fromCharCode(97 + stmtIndex)})</span>
                                    {statement.text}
                                </p>
                                <span 
                                    className={`flex-shrink-0 font-bold text-sm px-2.5 py-1 rounded ${
                                        statement.is_true ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                                    }`}
                                >
                                    {statement.is_true ? 'ĐÚNG' : 'SAI'}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options?.map((option, optionIndex) => (
                            <div 
                                key={optionIndex} 
                                className={`flex items-start space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                                    optionIndex === q.correct_answer_index 
                                        ? 'border-green-500 bg-green-50' 
                                        : 'border-gray-200 bg-white hover:border-indigo-400'
                                }`}
                            >
                                <div className={`flex-shrink-0 font-bold ${optionIndex === q.correct_answer_index ? 'text-green-700' : 'text-gray-700'}`}>
                                    {optionLabels[optionIndex]}.
                                </div>
                                <div className={`${optionIndex === q.correct_answer_index ? 'text-green-800' : 'text-gray-800'}`}>
                                    {option}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {q.explanation && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-bold text-blue-800">Giải thích đáp án:</h4>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap prose prose-sm max-w-none">{q.explanation}</div>
                    </div>
                )}


                <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-2">
                         <button 
                            onClick={() => handleGenerateExplanation(q)} 
                            disabled={isProcessingExplain || !!q.explanation}
                            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-md shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={q.explanation ? "Đáp án đã được giải thích" : ""}
                         >
                            <InfoIcon className={`w-4 h-4 ${isProcessingExplain ? 'animate-spin' : ''}`} />
                            <span>{isProcessingExplain ? 'Đang giải thích...' : 'Giải thích đáp án'}</span>
                        </button>
                         <button 
                            onClick={() => handleGenerateSimilar(q)}
                            disabled={isProcessingSimilar}
                            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-md shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-wait`}
                         >
                            <SimilarIcon className={`w-4 h-4 ${isProcessingSimilar ? 'animate-spin' : ''}`} />
                            <span>{isProcessingSimilar ? 'Đang tạo...' : 'Tạo câu hỏi tương tự'}</span>
                        </button>
                         <QuestionAction label="Sửa mã latex" color="bg-teal-100 text-teal-800" icon={<LatexIcon className="w-4 h-4" />} />
                         <QuestionAction label="Đổi dạng" color="bg-gray-200 text-gray-800" icon={<ChangeTypeIcon className="w-4 h-4" />} />
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>Tùy chọn trộn:</span>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            <span>Câu dẫn</span>
                        </label>
                         <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            <span>{q.question_type === 'true_false' ? 'Mệnh đề' : 'Đáp án'}</span>
                        </label>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
        {editingQuestion && (
            <EditQuestionModal
                question={editingQuestion}
                onSave={handleSaveQuestion}
                onCancel={() => setEditingQuestion(null)}
            />
        )}
        {mismatchedQuestion && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
                    <div className="p-5 border-b">
                        <h2 className="text-xl font-bold text-yellow-800">Loại câu hỏi không khớp</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-gray-700">
                            AI đã tạo ra một câu hỏi tương tự, nhưng nó thuộc loại <strong>"{mismatchedQuestion.generated.question_type === 'multiple_choice' ? 'Trắc nghiệm' : 'Đúng/Sai'}"</strong> 
                            &nbsp;thay vì loại gốc là <strong>"{mismatchedQuestion.original.question_type === 'multiple_choice' ? 'Trắc nghiệm' : 'Đúng/Sai'}"</strong>.
                        </p>
                        <p className="text-gray-700">Bạn muốn làm gì?</p>
                    </div>
                    <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
                        <button
                            onClick={handleCancelMismatch}
                            className="px-4 py-2 text-sm font-semibold bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleRetryMismatchedQuestion}
                            className="px-4 py-2 text-sm font-semibold text-white bg-orange-500 rounded-md shadow-sm hover:bg-orange-600"
                        >
                            Thử lại
                        </button>
                        <button
                            onClick={handleAcceptMismatchedQuestion}
                            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700"
                        >
                            Vẫn thêm câu hỏi
                        </button>
                    </div>
                </div>
            </div>
        )}
        {deletingQuestionId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm">
                    <div className="p-5 border-b flex justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-800">Xác nhận xóa</h2>
                        <button onClick={cancelDeleteQuestion} className="text-gray-400 hover:text-gray-600">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="p-6">
                        <p className="text-gray-700">Bạn có chắc chắn muốn xóa câu hỏi này không? Hành động này không thể hoàn tác.</p>
                    </div>
                    <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
                        <button
                            onClick={cancelDeleteQuestion}
                            className="px-4 py-2 text-sm font-semibold bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={confirmDeleteQuestion}
                            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-md shadow-sm hover:bg-red-700"
                        >
                            Xóa
                        </button>
                    </div>
                </div>
            </div>
        )}
        {error && (
            <div className="fixed top-5 right-5 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50" role="alert">
                <strong className="font-bold">Lỗi! </strong>
                <span className="block sm:inline">{error}</span>
                <button className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}>
                    <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                </button>
            </div>
        )}
        <div className="bg-slate-100 p-4 sm:p-6 lg:p-8 rounded-lg shadow-inner min-h-screen">
            <div className="mb-4">
                <button 
                    onClick={onStartNew} 
                    className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75L3 12m0 0l3.75-3.75M3 12h18" /></svg>
                    Quay lại trang tải lên
                </button>
            </div>
            <div className="bg-white p-4 rounded-t-lg shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">Nội Dung Đề Thi</h2>
                    <div className="flex flex-wrap gap-2">
                        {headerActions.map(action => <HeaderAction key={action.label} {...action} />)}
                    </div>
                </div>
                <div className="mt-4 border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6">
                        <button 
                            onClick={() => setActiveTab('exam')}
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'exam' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                            Đề thi & Đáp án
                        </button>
                        <button 
                             onClick={() => setActiveTab('matrix')}
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'matrix' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                            Ma trận đề thi
                        </button>
                        <button 
                             onClick={() => setActiveTab('transcript')}
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'transcript' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                            Bản độc tả
                        </button>
                    </nav>
                </div>
            </div>

            <div className="bg-white p-6 rounded-b-lg shadow-md">
                {multipleChoiceQuestions.length > 0 && (
                     <>
                        <div className="mb-8">
                            <h3 className="text-xl font-bold text-gray-900">PHẦN I. TRẮC NGHIỆM KHÁCH QUAN</h3>
                            <p className="mt-1 text-sm text-gray-600">Chọn đáp án đúng nhất trong các lựa chọn sau.</p>
                        </div>

                        <div className="space-y-6">
                            {multipleChoiceQuestions.map((q, index) => renderQuestion(q, index + 1))}
                        </div>
                    </>
                )}

                {trueFalseQuestions.length > 0 && (
                    <div className={`${multipleChoiceQuestions.length > 0 ? 'mt-10 pt-6 border-t border-gray-200' : ''}`}>
                         <div className="mb-8">
                            <h3 className="text-xl font-bold text-gray-900">PHẦN II. CÂU HỎI ĐÚNG - SAI</h3>
                            <p className="mt-1 text-sm text-gray-600">Xác định tính đúng hoặc sai cho mỗi mệnh đề dưới đây.</p>
                        </div>
                        <div className="space-y-6">
                            {trueFalseQuestions.map((q, index) => renderQuestion(q, index + 1 + multipleChoiceQuestions.length))}
                        </div>
                    </div>
                )}
            </div>
        </div>
        </>
    );
};

export default ExamResultView;