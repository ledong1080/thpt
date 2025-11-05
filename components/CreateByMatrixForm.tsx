import React, { useState, useRef, useEffect } from 'react';
import type { ParsedExam } from '../types';
import { SparklesIcon, ChartBarIcon } from './icons';
import { generateExamFromMatrix, extractGenericTextFromPdf, extractTextFromImage } from '../services/geminiService';
import * as mammoth from 'mammoth';
import ExamResultView from './ExamResultView';
import MathText from './MathText';

interface CreateByMatrixFormProps {
    onBack: () => void;
}

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const DEFAULT_MATRIX_TEXT_1 = `MA TRẬN ĐỀ THI - MÔN GIÁO DỤC KINH TẾ VÀ PHÁP LUẬT

Chương/Chủ đề: MỘT SỐ QUYỀN TỰ DO CƠ BẢN CỦA CÔNG DÂN

1. Nội dung/Đơn vị kiến thức: Bài 14: Quyền và nghĩa vụ công dân về bầu cử và ứng cử
   - 5 câu Trắc nghiệm khách quan - Mức độ: Nhận biết
   - 5 câu Trắc nghiệm khách quan - Mức độ: Thông hiểu

2. Nội dung/Đơn vị kiến thức: Bài 16: Quyền và nghĩa vụ công dân về bảo vệ Tổ quốc
   - 5 câu Trắc nghiệm khách quan - Mức độ: Nhận biết

3. Nội dung/Đơn vị kiến thức: Bài 18: Quyền bất khả xâm phạm về chỗ ở
   - 5 câu Trắc nghiệm khách quan - Mức độ: Thông hiểu
   - 5 câu Đúng-Sai - Mức độ: Nhận biết
`;

const DEFAULT_MATRIX_TEXT_2 = `MA TRẬN TOÁN 11 GIỮA KÌ 1
PHẦN I. TRẮC NGHIỆM KHÁCH QUAN: 12 câu/ 3 điểm
Câu 1. [NB] Đổi số đo góc.
Câu 2. [NB] Tính độ dài cung tròn.
Câu 3. [NB] Nhận biết 4 công thức liên hệ giữa các giá trị lượng giác của một cung.
Câu 4. [NB] Nhận biết công thức nghiệm của 4 PTLG cơ bản.
Câu 5. [NB] Cho công thức của một dãy số. Liệt kê vài số hạng đầu của dãy.
Câu 6. [NB] Nhận biết một dãy số là CÁP SỐ CỘNG hoặc CÁP SỐ NHÂN.
Câu 7. [NB] Cho CÁP SỐ CỘNG hoặc CÁP SỐ NHÂN. Tìm số hạng thứ $k$ của cấp số.
Câu 8. [NB] Xác định nhóm chứa Mốt của MẪU SỐ LIỆU GHÉP NHÓM.
Câu 9. [TH] Tìm tập xác định của hàm số lượng giác.
Câu 10. [TH] Biểu diễn được điểm ngọn của một góc lượng giác trên đường tròn lượng giác (Cho số đo góc cụ thể).
Câu 11. [TH] Cho CÁP SỐ NHÂN. Cho 2 số hạng của cấp số. Tìm công bội.
Câu 12. [TH] Tính số trung bình của MẪU SỐ LIỆU GHÉP NHÓM.

PHẦN II. TRẮC NGHIỆM ĐÚNG/SAI: 2 câu/ 2 điểm
Câu 1. Cho hàm số $y = \\sin x$ (Hoặc $y = \\cos x;\\,\\,y = \\tan x;\\,\\,y = \\cot x$)
a) (NB) Khẳng định về: Tính chẵn, lẻ hoặc chu kỳ tuần hoàn.
b) (NB) Cho điều kiện của cung $x$. Xét dấu giá trị $y$.
c) (TH) Tập xác định hoặc đồ thị.
d) (TH) Khẳng định tập nghiệm của phương trình cơ bản.
Câu 2. Cho cấp số cộng dạng khai triển $u_1, u_2, ..., u_n$.
a) (NB) Xác định số hạng đầu
b) (NB) Xác định công sai $d$
c) (TH) Xác định công thức số hạng tổng quát.
d) (TH) Tính tổng $S_n$.

PHẦN III. TRẢ LỜI NGẮN: 2 câu/ 2 điểm
Câu 1. [VD] Bài toán có yếu tố thực tế liên quan đến độ dài cung lượng giác.
Câu 2. [VD] Bài toán có yếu tố thực tế liên quan đến tứ phân vị của MẪU SỐ LIỆU GHÉP NHÓM.

PHẦN IV. TỰ LUẬN: 3 câu/ 3 điểm
Câu 1. [TH] Giải phương trình lượng giác cơ bản.
Câu 2. [TH] Cho 2 số hạng của CÁP SỐ CỘNG. Tìm công sai và số hạng đầu của cấp số.
Câu 3. [VD] Giải phương trình lượng giác dạng quy về phương trình cơ bản.
`;


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

const CreateByMatrixForm: React.FC<CreateByMatrixFormProps> = ({ onBack }) => {
    const [view, setView] = useState<'form' | 'generating' | 'result' | 'error'>('form');
    const [generatedExam, setGeneratedExam] = useState<ParsedExam | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [matrixFileName, setMatrixFileName] = useState<string>('');
    const [matrixText, setMatrixText] = useState('');
    const [referenceFile, setReferenceFile] = useState<File | null>(null);
    
    const [isExtracting, setIsExtracting] = useState(false);
    
    const [matrixFile, setMatrixFile] = useState<File | null>(null);
    const [matrixPreviewUrl, setMatrixPreviewUrl] = useState<string>('');
    const [docxPreviewHtml, setDocxPreviewHtml] = useState<string>('');

    const matrixInputRef = useRef<HTMLInputElement>(null);
    const referenceInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      // Cleanup object URL for images when component unmounts
      return () => {
        if (matrixPreviewUrl) {
          URL.revokeObjectURL(matrixPreviewUrl);
        }
      };
    }, [matrixPreviewUrl]);

    useEffect(() => {
        if (matrixFile && matrixFile.type === 'application/pdf' && window.pdfjsLib && canvasRef.current) {
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            
            if (context) {
                context.clearRect(0, 0, canvas.width, canvas.height);
            }

            const fileReader = new FileReader();
            fileReader.onload = async function() {
                if (!this.result) return;
                const typedarray = new Uint8Array(this.result as ArrayBuffer);
                
                try {
                    const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
                    const page = await pdf.getPage(1);
                    
                    const parentWidth = canvas.parentElement?.clientWidth ? canvas.parentElement.clientWidth - 16 : 500;
                    const scale = parentWidth / page.getViewport({ scale: 1.0 }).width;
                    const viewport = page.getViewport({ scale });
                    
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    if (context) {
                        const renderContext = { canvasContext: context, viewport: viewport };
                        page.render(renderContext);
                    }
                } catch (error) {
                    console.error('Error rendering PDF with pdf.js:', error);
                    setError('Không thể hiển thị bản xem trước của tệp PDF.');
                }
            };
            fileReader.readAsArrayBuffer(matrixFile);
        }
    }, [matrixFile]);

    const handleSelectTemplate = (templateText: string, templateName: string) => {
        setMatrixText(templateText);
        setMatrixFileName(templateName);
        if (matrixPreviewUrl) URL.revokeObjectURL(matrixPreviewUrl);
        setMatrixFile(null);
        setMatrixPreviewUrl('');
        setDocxPreviewHtml('');
    };

    const handleMatrixFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (matrixPreviewUrl) URL.revokeObjectURL(matrixPreviewUrl);
        setMatrixPreviewUrl('');
        setDocxPreviewHtml('');
        
        const canvas = canvasRef.current;
        if (canvas) {
            const context = canvas.getContext('2d');
            if (context) context.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        setMatrixFile(file);
        if (file.type.startsWith('image/')) {
            setMatrixPreviewUrl(URL.createObjectURL(file));
        }

        setMatrixFileName('');
        setError(null);
        setIsExtracting(true);

        const apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey && (file.type === 'application/pdf' || file.type.startsWith('image/'))) {
            setError("Vui lòng cấu hình API Key để trích xuất tệp PDF hoặc ảnh.");
            setIsExtracting(false);
            return;
        }

        try {
            let text = '';
            if (file.type.startsWith('image/')) {
                const base64 = await fileToBase64(file);
                text = await extractTextFromImage(base64, file.type, apiKey || '');
            } else if (file.type === 'application/pdf') {
                const base64 = await fileToBase64(file);
                text = await extractGenericTextFromPdf(base64, apiKey || '');
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                const arrayBuffer = await file.arrayBuffer();
                const textResult = await mammoth.extractRawText({ arrayBuffer });
                text = textResult.value;
                const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
                setDocxPreviewHtml(htmlResult.value);
            } else if (file.type === 'text/plain') {
                text = await file.text();
            } else {
                throw new Error('Định dạng tệp không được hỗ trợ. Vui lòng sử dụng ảnh, .docx, .pdf, hoặc .txt');
            }
            setMatrixText(text);
            setMatrixFileName(file.name);
        } catch (e: any) {
            setError(e.message);
            setMatrixFileName('');
        } finally {
            setIsExtracting(false);
        }
    };
    
    const handlePaste = async (event: React.ClipboardEvent<HTMLElement>) => {
        const items = event.clipboardData?.items;
        if (!items) return;

        let imageFile: File | null = null;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                imageFile = items[i].getAsFile();
                break;
            }
        }

        if (imageFile) {
            event.preventDefault();
            if (matrixPreviewUrl) URL.revokeObjectURL(matrixPreviewUrl);
            setDocxPreviewHtml('');
            const canvas = canvasRef.current;
            if (canvas) {
                const context = canvas.getContext('2d');
                if (context) context.clearRect(0, 0, canvas.width, canvas.height);
            }

            setMatrixFile(imageFile);
            setMatrixPreviewUrl(URL.createObjectURL(imageFile));
            
            setMatrixFileName('');
            setError(null);
            setIsExtracting(true);

            const apiKey = localStorage.getItem('geminiApiKey');
            if (!apiKey) {
                setError("Vui lòng cấu hình API Key để trích xuất từ ảnh.");
                setIsExtracting(false);
                return;
            }

            try {
                const base64 = await fileToBase64(imageFile);
                const text = await extractTextFromImage(base64, imageFile.type, apiKey);
                setMatrixText(text);
                setMatrixFileName(`Pasted Image - ${new Date().toLocaleTimeString()}`);
            } catch (e: any) {
                setError(e.message);
                setMatrixFileName('');
            } finally {
                setIsExtracting(false);
            }
        }
    };

    const handleRemoveMatrixFile = () => {
        if (matrixPreviewUrl) URL.revokeObjectURL(matrixPreviewUrl);
        
        setMatrixFile(null);
        setMatrixPreviewUrl('');
        setMatrixFileName('');
        setMatrixText('');
        setDocxPreviewHtml('');
        if (matrixInputRef.current) matrixInputRef.current.value = '';
        
        const canvas = canvasRef.current;
        if (canvas) {
            const context = canvas.getContext('2d');
            if (context) context.clearRect(0, 0, canvas.width, canvas.height);
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
                // Simplified text extraction logic for supplementary file
                if (referenceFile.type.startsWith('image/') || referenceFile.type === 'application/pdf') {
                     const base64 = await fileToBase64(referenceFile);
                     supplementaryContent = referenceFile.type.startsWith('image/') ? await extractTextFromImage(base64, referenceFile.type, apiKey) : await extractGenericTextFromPdf(base64, apiKey);
                } else if (referenceFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    const arrayBuffer = await referenceFile.arrayBuffer();
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    supplementaryContent = result.value;
                } else if (referenceFile.type === 'text/plain') {
                    supplementaryContent = await referenceFile.text();
                }
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
             <div className="flex flex-col items-center justify-center p-10 bg-white rounded-2xl shadow-2xl border border-slate-200/80">
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
            <div className="p-6 bg-white rounded-2xl shadow-2xl border border-red-200/80">
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
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-6xl mx-auto">
            <input type="file" ref={matrixInputRef} onChange={handleMatrixFileChange} accept=".docx,.pdf,image/*,.txt" className="hidden" />
            <input type="file" ref={referenceInputRef} onChange={(e) => setReferenceFile(e.target.files?.[0] || null)} accept=".docx,.pdf,.txt,image/*" className="hidden" />

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
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-700">1. Cung cấp Ma trận</h3>
                         <div className="flex items-center gap-2">
                            <button onClick={() => handleSelectTemplate(DEFAULT_MATRIX_TEXT_1, 'Ma trận mẫu 1 (GDCD)')} className="px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-md shadow">Ma trận mẫu 1</button>
                            <button onClick={() => handleSelectTemplate(DEFAULT_MATRIX_TEXT_2, 'Ma trận mẫu 2 (Toán 11)')} className="px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-md shadow">Ma trận mẫu 2</button>
                        </div>
                    </div>
                    
                    <div 
                        className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
                        onClick={() => matrixInputRef.current?.click()}
                    >
                        <p className="text-indigo-600 font-semibold">↑ Tải lên tệp Ma trận (ảnh, .docx, .pdf)</p>
                        <p className="text-sm text-gray-500 mt-1">Hoặc dán ảnh/văn bản vào ô "Preview" bên dưới.</p>
                    </div>

                    { (matrixFileName || isExtracting || error) &&
                        <div className="mt-3 p-3 border rounded-lg bg-orange-50 border-orange-200">
                             <div className="flex justify-between items-center">
                                <p className="text-sm text-gray-800 font-medium">
                                    {isExtracting ? 'Đang trích xuất...' : matrixFileName ? <>
                                        <span className="font-bold text-green-700">✓</span> Đang sử dụng ma trận: <span className="font-semibold">{matrixFileName}</span>
                                    </> : error ? <span className="text-red-600 font-bold">Lỗi!</span> : '' }
                                </p>
                                { (matrixFileName || isExtracting) && <button onClick={handleRemoveMatrixFile} className="text-sm font-semibold text-red-600 hover:underline">Xóa</button> }
                            </div>
                            {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
                        </div>
                    }
                </div>
                
                {/* Step 2 */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">2. Preview</h3>
                     <div className="border border-gray-300 rounded-md shadow-sm p-4 bg-gray-50 space-y-4">
                        {/* Visual Preview (if applicable) */}
                        {matrixFile && (
                            <div>
                                <p className="text-sm font-medium text-gray-600 mb-2 text-center">Bản xem trước trực quan</p>
                                <div className="h-[400px] bg-white border rounded-md flex items-center justify-center overflow-auto p-2">
                                     {matrixFile.type === 'application/pdf' ? (
                                        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain"></canvas>
                                    ) : matrixFile.type.startsWith('image/') ? (
                                        <img src={matrixPreviewUrl} alt="Matrix Preview" className="max-w-full max-h-full object-contain" />
                                    ) : matrixFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && docxPreviewHtml ? (
                                        <div 
                                            className="prose max-w-none p-4 text-left w-full h-full bg-white"
                                            dangerouslySetInnerHTML={{ __html: docxPreviewHtml }} 
                                        />
                                    ) : (
                                        <div className="text-center text-gray-500">
                                            <p>Không có bản xem trước trực quan cho loại tệp này.</p>
                                            <p className="text-xs mt-1">Nội dung văn bản đã được trích xuất bên dưới.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Textarea for editing */}
                        <div>
                            <label htmlFor="matrix-textarea" className="block text-sm font-medium text-gray-700 mb-1">
                                {isExtracting ? 'Đang trích xuất nội dung...' : 'Nội dung ma trận (đã trích xuất và có thể chỉnh sửa)'}
                            </label>
                            <textarea
                                id="matrix-textarea"
                                value={matrixText}
                                onChange={(e) => setMatrixText(e.target.value)}
                                onPaste={handlePaste}
                                placeholder="Nội dung từ tệp ma trận sẽ xuất hiện ở đây. Bạn cũng có thể dán ma trận dạng văn bản hoặc ảnh vào đây."
                                className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                                rows={18}
                                disabled={isExtracting}
                            />
                        </div>
                    </div>
                </div>


                {/* Step 3 */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">3. Nạp tài liệu tham khảo (Tùy chọn)</h3>
                    <p className="text-sm text-gray-500 mb-3">Để AI tạo câu hỏi sát với nội dung mong muốn, hãy tải lên tài liệu tham khảo (ảnh, .pdf, .docx). Tệp PDF và ảnh sẽ được AI phân tích để có kết quả chính xác hơn.</p>
                     <button
                        onClick={() => referenceInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors"
                    >
                         <p className="font-semibold text-green-600">❐ Chọn tệp tham khảo</p>
                    </button>
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
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 font-semibold text-white bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all disabled:bg-gray-400 disabled:shadow-md disabled:transform-none disabled:cursor-not-allowed"
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