import React, { useState, useRef } from 'react';
import type { ParsedExam } from '../types';
import { SparklesIcon, ChartBarIcon } from './icons';
import { generateExamFromMatrix, extractGenericTextFromPdf } from '../services/geminiService';
import * as mammoth from 'mammoth';
import ExamResultView from './ExamResultView';

interface CreateByMatrixFormProps {
    onBack: () => void;
}

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

const extractTextFromFile = async (file: File, apiKey: string): Promise<string> => {
    if (file.type === 'application/pdf') {
        const base64 = await fileToBase64(file);
        return extractGenericTextFromPdf(base64, apiKey);
    }
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    }
    if (file.type === 'text/plain') {
        return file.text();
    }
    throw new Error('Định dạng tệp không được hỗ trợ. Vui lòng sử dụng .docx, .pdf, hoặc .txt');
};

const CreateByMatrixForm: React.FC<CreateByMatrixFormProps> = ({ onBack }) => {
    const [view, setView] = useState<'form' | 'generating' | 'result' | 'error'>('form');
    const [generatedExam, setGeneratedExam] = useState<ParsedExam | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [matrixFile, setMatrixFile] = useState<File | null>(null);
    const [matrixText, setMatrixText] = useState('');
    const [referenceFile, setReferenceFile] = useState<File | null>(null);
    
    const [isExtracting, setIsExtracting] = useState(false);
    const [firstPageText, setFirstPageText] = useState('');
    const [secondPageText, setSecondPageText] = useState('');


    const matrixInputRef = useRef<HTMLInputElement>(null);
    const referenceInputRef = useRef<HTMLInputElement>(null);

    const handleMatrixFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setMatrixFile(file);
        setMatrixText('');
        setError(null);
        setIsExtracting(true);
        setFirstPageText('');
        setSecondPageText('');

        const apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey && file.type === 'application/pdf') {
            setError("Vui lòng cấu hình API Key để trích xuất tệp PDF.");
            setIsExtracting(false);
            setMatrixFile(null);
            return;
        }

        try {
            const text = await extractTextFromFile(file, apiKey || '');
            setMatrixText(text);

            // Split text for two-page preview
            const lines = text.split('\n');
            const halfwayLine = Math.floor(lines.length / 2);
            setFirstPageText(lines.slice(0, halfwayLine).join('\n'));
            setSecondPageText(lines.slice(halfwayLine).join('\n'));

        } catch (e: any) {
            setError(e.message);
            setMatrixFile(null);
        } finally {
            setIsExtracting(false);
        }
    };
    
    const handleRemoveMatrixFile = () => {
        setMatrixFile(null);
        setMatrixText('');
        setFirstPageText('');
        setSecondPageText('');
        if (matrixInputRef.current) {
            matrixInputRef.current.value = '';
        }
    };


    const handleGenerateExam = async () => {
        if (!matrixText.trim()) {
            setError("Nội dung ma trận không được để trống.");
            return;
        }
        
        const apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            setError("Vui lòng đặt API Key trong Cấu hình Hệ thống trước.");
            setView('error');
            return;
        }

        setView('generating');
        setError(null);

        try {
            let supplementaryContent: string | undefined = undefined;
            if (referenceFile) {
                supplementaryContent = await extractTextFromFile(referenceFile, apiKey);
            }
            
            const resultJsonString = await generateExamFromMatrix(matrixText, apiKey, supplementaryContent);
            const result = JSON.parse(resultJsonString);

            if (result.error) {
                throw new Error(result.error);
            }

            setGeneratedExam({
                questions: result.questions.map((q: any, index: number) => ({ ...q, id: `gq_matrix_${index}` }))
            });
            setView('result');
        } catch (e: any) {
            console.error("Error generating exam from matrix:", e);
            setError(e.message || "Không thể tạo đề thi từ ma trận. Vui lòng thử lại.");
            setView('error');
        }
    };
    
    const handleStartNew = () => {
        setGeneratedExam(null);
        setError(null);
        setView('form');
    };

    if (view === 'generating') {
        return (
             <div className="flex flex-col items-center justify-center p-10 bg-white rounded-lg shadow-lg">
                <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
                <h2 className="mt-6 text-2xl font-semibold text-gray-700">AI đang tạo đề theo Ma trận...</h2>
                <p className="mt-2 text-gray-500">Quá trình này có thể mất một vài phút. Vui lòng không rời khỏi trang.</p>
            </div>
        );
    }

    if (view === 'result' && generatedExam) {
        return <ExamResultView examData={generatedExam} onBackToForm={handleStartNew} onStartNew={onBack} />;
    }

    if (view === 'error') {
         return (
            <div className="p-6 bg-white rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold text-red-700 mb-4">Tạo đề thất bại</h2>
                <div className="prose max-w-none p-4 border rounded-md bg-red-50 text-red-900 whitespace-pre-wrap">{error || "Đã xảy ra lỗi không xác định."}</div>
                <div className="mt-6">
                     <button 
                        onClick={() => {
                            setView('form');
                            setError(null);
                        }}
                        className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors"
                    >
                        Quay lại Form
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-lg w-full max-w-4xl mx-auto">
            <input type="file" ref={matrixInputRef} onChange={handleMatrixFileChange} accept=".docx,.pdf" className="hidden" />
            <input type="file" ref={referenceInputRef} onChange={(e) => setReferenceFile(e.target.files?.[0] || null)} accept=".docx,.pdf,.txt" className="hidden" />

            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <ChartBarIcon className="w-8 h-8 text-orange-500" />
                    Tạo đề thi theo Ma trận
                </h2>
                <button onClick={onBack} className="text-sm text-indigo-600 hover:underline">
                    &larr; Quay lại
                </button>
            </div>
            
            <p className="text-gray-600 mb-6">Tải lên tệp ma trận hoặc nhập/chỉnh sửa trực tiếp để AI tạo một đề thi hoàn chỉnh theo đúng cấu trúc.</p>

            <div className="space-y-8">
                {/* Step 1 */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">1. Cung cấp Ma trận</h3>
                     {!matrixFile && !isExtracting ? (
                        <div 
                            onClick={() => matrixInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
                        >
                            <p className="text-indigo-600 font-semibold">↑ Tải lên Ma trận (.docx, .pdf)</p>
                            <p className="text-sm text-gray-500 mt-1">Chưa có tệp ma trận nào được tải lên.</p>
                        </div>
                    ) : (
                        <div className="p-4 border rounded-lg bg-orange-50 border-orange-200">
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-sm text-green-800 font-medium">
                                    <span className="font-bold text-lg leading-none align-middle">✓</span> Đã nạp thành công ma trận từ tệp: <span className="font-semibold">{matrixFile?.name}</span>
                                </p>
                                <button onClick={handleRemoveMatrixFile} className="text-sm font-semibold text-red-600 hover:underline">Xóa</button>
                            </div>
                            
                            {isExtracting ? (
                                <div className="h-60 flex items-center justify-center text-gray-500">
                                    <div className="w-8 h-8 border-2 border-dashed rounded-full animate-spin border-orange-500 mr-3"></div>
                                    Đang trích xuất nội dung...
                                </div>
                            ) : (
                                matrixText && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Page 1 Preview */}
                                        <div className="bg-white p-2 shadow-lg h-72 overflow-y-auto border">
                                            <pre className="text-[10px] leading-snug whitespace-pre-wrap font-sans text-gray-800">
                                                {firstPageText}
                                            </pre>
                                        </div>
                                        {/* Page 2 Preview */}
                                        <div className="bg-white p-2 shadow-lg h-72 overflow-y-auto border hidden sm:block">
                                            <pre className="text-[10px] leading-snug whitespace-pre-wrap font-sans text-gray-800">
                                                {secondPageText}
                                            </pre>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>

                {/* Step 2 */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">2. Chỉnh sửa Ma trận (nếu cần)</h3>
                    <textarea
                        rows={15}
                        value={matrixText}
                        onChange={(e) => setMatrixText(e.target.value)}
                        placeholder="Nội dung từ tệp ma trận sẽ xuất hiện ở đây, hoặc bạn có thể dán trực tiếp vào..."
                        className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                {/* Step 3 */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">3. Nạp tài liệu tham khảo (Tùy chọn)</h3>
                    <p className="text-sm text-gray-500 mb-3">Để AI tạo câu hỏi sát với nội dung mong muốn, hãy tải lên tài liệu tham khảo (.pdf, .docx). Tệp PDF sẽ được AI phân tích để có kết quả chính xác hơn.</p>
                    <div
                        onClick={() => referenceInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors"
                    >
                         <p className="font-semibold text-green-600">❐ Chọn tệp tham khảo</p>
                    </div>
                     {referenceFile ? 
                        <p className="text-sm text-gray-500 mt-2">Đã chọn tệp tham khảo: <span className="font-medium">{referenceFile.name}</span></p>
                        :
                        <p className="text-sm text-gray-500 mt-2">Chưa có tệp tham khảo nào được chọn.</p>
                     }
                </div>

                {/* Action Button */}
                <div className="pt-4 border-t">
                    <button
                        onClick={handleGenerateExam}
                        disabled={!matrixText.trim() || isExtracting}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 font-semibold text-white bg-orange-500 rounded-lg shadow-md hover:bg-orange-600 transform hover:-translate-y-1 transition-all disabled:bg-gray-400 disabled:transform-none disabled:cursor-not-allowed"
                    >
                        <SparklesIcon className="w-6 h-6" />
                        <span>Bắt đầu Tạo đề theo Ma trận</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateByMatrixForm;