

import React, { useState, useCallback, useRef } from 'react';
import Accordion from './Accordion';
import { SparklesIcon, FolderIcon, ChartBarIcon, DownloadIcon } from './icons';
import type { ParsedExam, ParsedQuestion, TrueFalseStatement } from '../types';
import ExamResultView from './ExamResultView';
import SystemConfig from './SystemConfig';
import CreateBySelectionForm from './CreateBySelectionForm';
import CreateByMatrixForm from './CreateByMatrixForm';
import * as mammoth from 'mammoth';
import { extractTextFromPdf } from '../services/geminiService';

const parseDocxContent = (text: string): ParsedExam => {
    const questions: ParsedQuestion[] = [];
    const questionBlocks = text.split(/(?=Câu \d+:)/).filter(block => block.trim() !== '');

    for (const block of questionBlocks) {
        const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) continue;

        // Heuristic to detect question type. True/False questions use "a) ...", "b) ...", etc.
        const isTrueFalse = lines.some(line => /^\*?[a-d]\)\s/.test(line));

        if (isTrueFalse) {
            let questionEndIndex = 0;
            // Find where the question prompt ends and statements begin
            for (let i = 1; i < lines.length; i++) {
                if (/^\*?[a-d]\)\s/.test(lines[i])) {
                    break;
                }
                questionEndIndex = i;
            }
            const question_text = lines.slice(0, questionEndIndex + 1).join(' ').replace(/Câu \d+:\s*/, '').trim();
            const statementLines = lines.slice(questionEndIndex + 1);

            const statements: TrueFalseStatement[] = [];
            for (const line of statementLines) {
                if (statements.length >= 4) break;
                
                const trimmedLine = line.trim();
                const is_true = trimmedLine.startsWith('*');
                
                const match = trimmedLine.match(/^\*?[a-d]\)\s*(.*)/);

                if (match && match[1]) {
                    const text = match[1].trim();
                    statements.push({ text, is_true });
                }
            }
            if (question_text && statements.length > 0) {
                 questions.push({
                    id: `q_tf_${Date.now()}_${questions.length}`,
                    question_type: 'true_false',
                    question_text,
                    statements,
                });
            }
        } else { // Assume Multiple Choice otherwise
            let questionEndIndex = 0;
            for(let i = 1; i < lines.length; i++) {
                if (/^(\*?[A-D])\.\s/.test(lines[i])) {
                    break;
                }
                questionEndIndex = i;
            }

            const question_text = lines.slice(0, questionEndIndex + 1).join(' ').replace(/Câu \d+:\s*/, '').trim();
            const optionLines = lines.slice(questionEndIndex + 1);
            
            const options: string[] = [];
            let correct_answer_index = -1;

            for (const line of optionLines) {
                if (options.length >= 4) break;

                const correctMatch = line.match(/^\*([A-D])\.\s*(.*)/);
                const standardMatch = line.match(/^([A-D])\.\s*(.*)/);

                if (correctMatch) {
                    options.push(correctMatch[2].trim());
                    correct_answer_index = options.length - 1;
                } else if (standardMatch) {
                    options.push(standardMatch[2].trim());
                }
            }

            if (question_text && options.length === 4 && correct_answer_index !== -1) {
                questions.push({
                    id: `q_mc_${Date.now()}_${questions.length}`,
                    question_type: 'multiple_choice',
                    question_text,
                    options,
                    correct_answer_index,
                });
            }
        }
    }
    
    if (questions.length === 0) {
        throw new Error("Không thể phân tích bất kỳ câu hỏi nào từ tài liệu. Vui lòng kiểm tra lại định dạng. Định dạng hợp lệ yêu cầu mỗi câu hỏi bắt đầu bằng 'Câu X:'.\n- Câu trắc nghiệm có 4 đáp án A., B., C., D., và đáp án đúng được đánh dấu bằng dấu hoa thị (*A. ...).\n- Câu Đúng/Sai có các mệnh đề a), b), c), d), và mỗi mệnh đề đúng phải được đánh dấu bằng dấu hoa thị ở đầu (ví dụ: *b) ...).");
    }

    return { questions };
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = (reader.result as string).split(',')[1];
            if (result) {
                resolve(result);
            } else {
                reject(new Error("Failed to read file as base64."));
            }
        };
        reader.onerror = error => reject(error);
    });
};


const ExamGenerator: React.FC = () => {
    const [mode, setMode] = useState<'selection' | 'reconstruct' | 'create_by_selection' | 'matrix'>('selection');
    const [view, setView] = useState<'upload' | 'parsing' | 'result' | 'error'>('upload');
    const [parsedExam, setParsedExam] = useState<ParsedExam | null>(null);
    const [error, setError] = useState<string | null>(null);
    const docxInputRef = useRef<HTMLInputElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    const handleStartNew = useCallback(() => {
        setMode('selection');
        setView('upload'); 
        setParsedExam(null);
        setError(null);
        if (docxInputRef.current) {
            docxInputRef.current.value = '';
        }
        if (pdfInputRef.current) {
            pdfInputRef.current.value = '';
        }
    }, []);
    
    const handleUploadDocxClick = () => {
        docxInputRef.current?.click();
    };

    const handleUploadPdfClick = () => {
        pdfInputRef.current?.click();
    };

    const handleDocxFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setView('parsing');
        setError(null);
        setParsedExam(null);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            const exam = parseDocxContent(result.value);
            setParsedExam(exam);
            setView('result');
        } catch (e: any) {
            console.error("Error processing DOCX file:", e);
            setError(e.message || "Đã xảy ra lỗi khi xử lý tệp DOCX. Vui lòng thử lại.");
            setView('error');
        }
    };

    const handlePdfFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setView('parsing');
        setError(null);
        setParsedExam(null);

        const apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            setError("Vui lòng cấu hình API Key trong mục Cấu hình Hệ thống trước khi sử dụng tính năng này.");
            setView('error');
            return;
        }

        try {
            const base64Data = await fileToBase64(file);
            const extractedText = await extractTextFromPdf(base64Data, apiKey);
            const exam = parseDocxContent(extractedText);
            setParsedExam(exam);
            setView('result');
        } catch (e: any) {
            console.error("Error processing PDF file with AI:", e);
            setError(e.message || "Đã xảy ra lỗi khi xử lý tệp PDF bằng AI. Vui lòng thử lại.");
            setView('error');
        }
    };

    const UploadBox: React.FC<{ title: string; icon: React.ReactNode; onClick: () => void }> = ({ title, icon, onClick }) => (
        <button 
            onClick={onClick} 
            className="flex flex-col items-center justify-center w-full sm:w-72 h-48 p-6 space-y-4 bg-white border-2 border-dashed border-gray-300 rounded-lg shadow-sm hover:border-indigo-500 hover:bg-indigo-50 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
            {icon}
            <span className="font-semibold text-gray-700 text-center">{title}</span>
        </button>
    );

    const renderReconstructMode = () => {
        switch(view) {
            case 'parsing':
                return (
                    <div className="flex flex-col items-center justify-center p-10 bg-white rounded-lg shadow-lg">
                        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-indigo-600"></div>
                        <h2 className="mt-6 text-2xl font-semibold text-gray-700">Đang xử lý tệp...</h2>
                        <p className="mt-2 text-gray-500">Vui lòng đợi trong giây lát, đề thi của bạn đang được phân tích.</p>
                    </div>
                );
            case 'result':
                if (parsedExam) {
                    return <ExamResultView 
                        examData={parsedExam}
                        onBackToForm={() => setView('upload')}
                        onStartNew={handleStartNew}
                    />
                }
                // Fallthrough to error if parsedExam is null
            case 'error':
                 return (
                    <div className="p-6 bg-white rounded-lg shadow-lg">
                        <h2 className="text-2xl font-bold text-red-700 mb-4">Xử lý tệp thất bại</h2>
                        <div className="prose max-w-none p-4 border rounded-md bg-red-50 text-red-900 whitespace-pre-wrap">{error || "Đã xảy ra lỗi không xác định."}</div>
                        <div className="mt-6">
                             <button 
                                onClick={handleStartNew}
                                className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75L3 12m0 0l3.75-3.75M3 12h18" /></svg>
                                Bắt đầu lại
                            </button>
                        </div>
                    </div>
                );
            case 'upload':
            default:
                return (
                     <div className="p-8 bg-white rounded-lg shadow-lg">
                         <button onClick={handleStartNew} className="text-sm text-indigo-600 hover:underline mb-4 inline-flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                            Quay lại trang chủ
                        </button>
                        <input type="file" ref={docxInputRef} onChange={handleDocxFileChange} accept=".docx" className="hidden" />
                        <input type="file" ref={pdfInputRef} onChange={handlePdfFileChange} accept=".pdf" className="hidden" />
                        <div className="text-center mb-8">
                             <h2 className="text-2xl font-bold text-gray-800">Dựng lại đề gốc</h2>
                             <p className="mt-2 text-gray-500">Chọn phương thức để tải lên tệp đề thi của bạn.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
                           <UploadBox 
                                title="Tải lên File Word (.docx)"
                                icon={<DownloadIcon className="w-12 h-12 text-blue-500" />}
                                onClick={handleUploadDocxClick}
                           />
                           <UploadBox 
                                title="Tải lên File PDF (Dùng AI)"
                                icon={<DownloadIcon className="w-12 h-12 text-red-500" />}
                                onClick={handleUploadPdfClick}
                           />
                        </div>
                         <p className="text-center text-sm text-gray-500 mt-8">Chọn một phương thức, để bắt đầu.</p>
                    </div>
                );
        }
    }

    const renderSelectionMode = () => (
        <div className="p-8 bg-white rounded-lg shadow-lg text-center">
            <h2 className="text-3xl font-bold text-gray-800">Bắt đầu tạo đề thi</h2>
            <p className="mt-2 text-gray-500 mb-8">Chọn một phương thức để tạo bộ câu hỏi của bạn.</p>
            <div className="flex flex-col sm:flex-row justify-center items-stretch gap-6">
                <button 
                    onClick={() => setMode('create_by_selection')}
                    className="flex items-center justify-center gap-3 px-6 py-4 font-semibold text-white bg-indigo-500 rounded-lg shadow-md hover:bg-indigo-600 transform hover:-translate-y-1 transition-all w-full sm:w-auto"
                >
                    <SparklesIcon className="w-6 h-6" />
                    <span>Tạo đề theo lựa chọn bài</span>
                </button>
                <button 
                    onClick={() => setMode('reconstruct')}
                    className="flex items-center justify-center gap-3 px-6 py-4 font-semibold text-white bg-teal-500 rounded-lg shadow-md hover:bg-teal-600 transform hover:-translate-y-1 transition-all w-full sm:w-auto"
                >
                    <FolderIcon className="w-6 h-6" />
                    <span>Dựng lại đề gốc</span>
                </button>
                <button 
                    onClick={() => setMode('matrix')}
                    className="flex items-center justify-center gap-3 px-6 py-4 font-semibold text-white bg-orange-500 rounded-lg shadow-md hover:bg-orange-600 transform hover:-translate-y-1 transition-all w-full sm:w-auto"
                >
                    <ChartBarIcon className="w-6 h-6" />
                    <span>Tạo đề theo Ma trận</span>
                </button>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (mode) {
            case 'create_by_selection':
                return <CreateBySelectionForm onBack={handleStartNew} />;
            case 'reconstruct':
                return renderReconstructMode();
            case 'matrix':
                return <CreateByMatrixForm onBack={handleStartNew} />;
            case 'selection':
            default:
                return renderSelectionMode();
        }
    };

    return (
        <div className="space-y-6">
             <Accordion title="Cấu hình Hệ thống">
                 <p className="text-sm text-gray-600 mb-4">Vui lòng cung cấp các thông tin cần thiết để sử dụng đầy đủ các tính năng giao bài và lưu trữ.</p>
                 <SystemConfig />
            </Accordion>
            {renderContent()}
        </div>
    );
};

export default ExamGenerator;