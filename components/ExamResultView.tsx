import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ParsedExam, ParsedQuestion } from '../types';
import { PlusIcon, DuplicateIcon, GameIcon, ReviewIcon, ExportIcon, AssignIcon, DownloadIcon, InfoIcon, SimilarIcon, LatexIcon, ChangeTypeIcon, TrashIcon, PencilIcon, MixIcon } from './icons';
import { Packer, Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, PageBreak, VerticalMergeType, PageOrientation, UnderlineType, TabStopType, TableLayoutType, ImageRun } from 'docx';
import EditQuestionModal from './EditQuestionModal';
import AssignExamModal from './AssignExamModal';
import AssignmentSuccessView from './AssignmentSuccessView';
import { generateExplanation, generateSimilarQuestion, convertQuestionType } from '../services/geminiService';
import ExamMatrixView from './ExamMatrixView';
import LatexEditModal from './LatexEditModal';
import ChangeTypeModal from './ChangeTypeModal';
import ShuffleExamsModal from './ShuffleExamsModal';
import MathText from './MathText';

interface ExamResultViewProps {
  examData: ParsedExam;
  onBackToForm: () => void;
  onStartNew: () => void;
}

const HeaderAction: React.FC<{ label: string; color: string; icon: React.ReactNode, onClick?: () => void }> = ({ label, color, icon, onClick }) => (
    <button onClick={onClick} className={`flex items-center space-x-2 px-3 py-2 text-base font-semibold text-white ${color} rounded-md shadow-sm transition-all duration-200`}>
        {icon}
        <span>{label}</span>
    </button>
);

const QuestionAction: React.FC<{ label: string; color: string; icon: React.ReactNode; onClick?: () => void; disabled?: boolean; }> = ({ label, color, icon, onClick, disabled }) => (
     <button onClick={onClick} disabled={disabled} className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium ${color} rounded-md shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}>
        {icon}
        <span>{label}</span>
    </button>
);

const LEVELS = ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao'];
const LEVEL_HEADERS = ['Nhận', 'Thông', 'Vận', 'Vận.C'];
const TYPES = ['multiple_choice', 'true_false', 'short_answer', 'essay'];
const TYPE_HEADERS = ['TNKQ', 'Đúng-Sai', 'Trả lời ngắn', 'Tự luận'];

interface MatrixRow {
    chapter: string;
    topic: string;
    counts: { [type: string]: { [level: string]: number } };
    topicTotal: number;
}


// Helper function to convert data URL to an ImageRun for DOCX export
async function dataUrlToImageRun(dataUrl: string | null | undefined, maxWidth: number = 450): Promise<ImageRun | null> {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
    try {
        const base64Data = dataUrl.split(',')[1];
        if (!base64Data) return null;

        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataUrl;
        });

        const aspectRatio = image.width / image.height;
        let width = image.width;
        let height = image.height;

        if (width > maxWidth) {
            width = maxWidth;
            height = width / aspectRatio;
        }
        
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        // FIX: Using bytes.buffer (ArrayBuffer) instead of the Uint8Array to work around a TypeScript type inference issue with the 'docx' library.
        return new ImageRun({
            data: bytes.buffer,
            transformation: {
                width: width,
                height: height,
            },
        });
    } catch (error) {
        console.error("Error converting data URL to ImageRun:", error);
        return null;
    }
}


// Helper function to convert LaTeX to an image for DOCX export
async function latexToImageRun(latex: string, isDisplay: boolean): Promise<ImageRun | null> {
    if (!window.MathJax || !window.MathJax.tex2svgPromise) return null;

    try {
        const svgWrapper = await window.MathJax.tex2svgPromise(latex, { display: isDisplay });
        const svgElement = svgWrapper.querySelector('svg');
        if (!svgElement) return null;

        svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        const svgString = svgElement.outerHTML;

        const imageBase64 = await new Promise<string>((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Không thể tạo canvas context"));
                return;
            }

            const viewBox = svgElement.getAttribute('viewBox');
            let svgWidth = 200;
            let svgHeight = 50;

            if (viewBox) {
                const parts = viewBox.split(' ');
                svgWidth = parseFloat(parts[2]);
                svgHeight = parseFloat(parts[3]);
            }
            
            const desiredHeight = isDisplay ? 32 : 18;
            const scale = desiredHeight / svgHeight;
            const desiredWidth = svgWidth * scale;

            canvas.width = desiredWidth * 2; // Tăng độ phân giải
            canvas.height = desiredHeight * 2;

            img.onload = () => {
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const pngDataUrl = canvas.toDataURL('image/png');
                resolve(pngDataUrl.split(',')[1]); 
                URL.revokeObjectURL(img.src);
            };

            img.onerror = (e) => {
                reject(e);
                URL.revokeObjectURL(img.src);
            };

            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            img.src = URL.createObjectURL(svgBlob);
        });

        if (imageBase64) {
            const desiredHeight = isDisplay ? 32 : 18;
            const viewBox = svgElement.getAttribute('viewBox');
            let svgWidth = 200;
            let svgHeight = 50;
             if (viewBox) {
                const parts = viewBox.split(' ');
                svgWidth = parseFloat(parts[2]);
                svgHeight = parseFloat(parts[3]);
            }
            const desiredWidth = svgWidth * (desiredHeight / svgHeight);
            
            const binaryString = atob(imageBase64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            // FIX: Using bytes.buffer (ArrayBuffer) instead of the Uint8Array to work around a TypeScript type inference issue with the 'docx' library.
            return new ImageRun({
                data: bytes.buffer,
                transformation: {
                    width: desiredWidth,
                    height: desiredHeight,
                },
            });
        }
    } catch (error) {
        console.error("Lỗi chuyển đổi LaTeX sang ảnh:", error);
    }
    return null;
}

// Helper function to parse text and convert LaTeX parts to images
async function createRunsFromText(text: string | undefined): Promise<(TextRun | ImageRun)[]> {
    if (!text) return [];

    const runs: (TextRun | ImageRun)[] = [];
    const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
    const parts = text.split(regex).filter(p => p);

    for (const part of parts) {
        if (part.startsWith('$$') && part.endsWith('$$')) {
            const latex = part.substring(2, part.length - 2);
            const imageRun = await latexToImageRun(latex, true);
            if (imageRun) runs.push(imageRun);
            else runs.push(new TextRun(part)); // Fallback
        } else if (part.startsWith('$') && part.endsWith('$')) {
            const latex = part.substring(1, part.length - 1);
            const imageRun = await latexToImageRun(latex, false);
            if (imageRun) runs.push(imageRun);
            else runs.push(new TextRun(part));
        } else if (part) {
            runs.push(new TextRun(part));
        }
    }
    return runs;
}


const ExamResultView: React.FC<ExamResultViewProps> = ({ examData, onStartNew }) => {
    const [activeTab, setActiveTab] = useState('exam');
    const [currentExam, setCurrentExam] = useState<ParsedExam>(examData);
    const [editingQuestion, setEditingQuestion] = useState<ParsedQuestion | null>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isShuffleModalOpen, setIsShuffleModalOpen] = useState(false);
    
    // Assignment flow state
    const [assignmentStatus, setAssignmentStatus] = useState<'idle' | 'assigning' | 'success'>('idle');
    const [assignmentLink, setAssignmentLink] = useState('');
    const [assignmentCode, setAssignmentCode] = useState('');

    const [processingState, setProcessingState] = useState<{ id: string; action: 'similar' | 'explain' | 'convert' } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mismatchedQuestion, setMismatchedQuestion] = useState<{ original: ParsedQuestion; generated: ParsedQuestion } | null>(null);
    const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
    const [editingLatex, setEditingLatex] = useState<ParsedQuestion | null>(null);
    const [convertingQuestion, setConvertingQuestion] = useState<ParsedQuestion | null>(null);


    const multipleChoiceQuestions = currentExam.questions.filter(q => q.question_type === 'multiple_choice');
    const trueFalseQuestions = currentExam.questions.filter(q => q.question_type === 'true_false');
    const shortAnswerQuestions = currentExam.questions.filter(q => q.question_type === 'short_answer');
    const essayQuestions = currentExam.questions.filter(q => q.question_type === 'essay');

    const handleAssignExam = async (config: any) => {
        console.log("Assigning exam with config:", config);
        setIsAssignModalOpen(false);
        setAssignmentStatus('assigning');
        setError(null);

        const githubToken = localStorage.getItem('githubToken');
        if (!githubToken) {
            setError('Vui lòng cấu hình GitHub Token trong mục "Cấu hình Hệ thống" để sử dụng chức năng Giao bài tập.');
            setAssignmentStatus('idle');
            return;
        }

        try {
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            const examPayload = {
                config,
                exam: currentExam,
                teacherName: localStorage.getItem('teacherName') || 'LÊ VĂN ĐÔNG',
                examCode: code,
            };

            const jsonString = JSON.stringify(examPayload);
            
            // POST to GitHub Gist API to store the exam data
            const response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json',
                },
                body: JSON.stringify({
                    description: `AI Teacher Assistant Exam Data - Code: ${code}`,
                    public: true,
                    files: {
                        'exam.json': {
                            content: jsonString,
                        },
                    },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`GitHub Gist API error: ${errorData.message || response.statusText}`);
            }

            const gistData = await response.json();
            const gistId = gistData.id;
            
            // The URL for the online exam page, with the Gist ID in the hash
            const baseUrl = 'https://ledong1080.github.io/thpt/online/index.html';
            const link = `${baseUrl}#${gistId}`;
            
            setAssignmentCode(code);
            setAssignmentLink(link);
            setAssignmentStatus('success');
        
        } catch (e: any) {
            console.error("Error assigning exam:", e);
            setError(`Không thể tạo link bài tập. Lỗi: ${e.message}. Vui lòng thử lại.`);
            setAssignmentStatus('idle');
        }
    };
    
    const handleReturnToExam = () => {
        setAssignmentStatus('idle');
    };


    const handleExportToWord = useCallback(async () => {
        const docChildren: Paragraph[] = [];
        let questionCounter = 0;
        const singleSpacing = { line: 240, before: 0, after: 0 };

        docChildren.push(new Paragraph({ text: "ĐỀ THI", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 300 } }));
        
        // --- Multiple Choice ---
        if (multipleChoiceQuestions.length > 0) {
            docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN I. TRẮC NGHIỆM KHÁCH QUAN", bold: true })], heading: HeadingLevel.HEADING_2, spacing: { after: 150, before: 150 } }));
            for (const q of multipleChoiceQuestions) {
                questionCounter++;
                const questionRuns = await createRunsFromText(q.question_text);
                docChildren.push(new Paragraph({ children: [new TextRun({ text: `Câu ${questionCounter}: `, bold: true }), ...questionRuns], spacing: singleSpacing }));
                
                if (q.question_image) {
                    const imageRun = await dataUrlToImageRun(q.question_image);
                    if (imageRun) {
                        docChildren.push(new Paragraph({ children: [imageRun], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } }));
                    }
                }

                if (q.options) {
                    for (let optionIndex = 0; optionIndex < q.options.length; optionIndex++) {
                        const option = q.options[optionIndex];
                        const isCorrect = optionIndex === q.correct_answer_index;
                        const prefix = `${isCorrect ? '*' : ''}${['A', 'B', 'C', 'D'][optionIndex]}`;
                        const optionRuns = await createRunsFromText(option);
                        docChildren.push(new Paragraph({ children: [new TextRun(`${prefix}. `), ...optionRuns], indent: { left: 720 }, spacing: singleSpacing }));

                        const optionImage = q.option_images?.[optionIndex];
                        if (optionImage) {
                            const imageRun = await dataUrlToImageRun(optionImage, 200);
                            if (imageRun) {
                                docChildren.push(new Paragraph({ children: [imageRun], indent: { left: 720 }, spacing: { before: 50, after: 50 } }));
                            }
                        }
                    }
                }
            }
        }

        // --- True/False ---
        if (trueFalseQuestions.length > 0) {
            docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN II. CÂU HỎI ĐÚNG - SAI", bold: true })], heading: HeadingLevel.HEADING_2, spacing: { after: 150, before: docChildren.length > 1 ? 300 : 0 } }));
            for (const q of trueFalseQuestions) {
                questionCounter++;
                const questionRuns = await createRunsFromText(q.question_text);
                docChildren.push(new Paragraph({ children: [new TextRun({ text: `Câu ${questionCounter}: `, bold: true }), ...questionRuns], spacing: singleSpacing }));

                if (q.question_image) {
                    const imageRun = await dataUrlToImageRun(q.question_image);
                    if (imageRun) {
                        docChildren.push(new Paragraph({ children: [imageRun], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } }));
                    }
                }

                if(q.statements) {
                    for(let stmtIndex = 0; stmtIndex < q.statements.length; stmtIndex++) {
                        const statement = q.statements[stmtIndex];
                        const isCorrect = statement.is_true;
                        const prefix = `${isCorrect ? '*' : ''}${['a', 'b', 'c', 'd'][stmtIndex]}`;
                        const statementRuns = await createRunsFromText(statement.text);
                        docChildren.push(new Paragraph({ children: [new TextRun(`${prefix}) `), ...statementRuns], indent: { left: 720 }, spacing: singleSpacing }));
                    }
                }
            }
        }
        
        // --- Short Answer ---
        if (shortAnswerQuestions.length > 0) {
            docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN III. CÂU HỎI TRẢ LỜI NGẮN", bold: true })], heading: HeadingLevel.HEADING_2, spacing: { after: 150, before: docChildren.length > 1 ? 300 : 0 } }));
            for (const q of shortAnswerQuestions) {
                questionCounter++;
                const questionRuns = await createRunsFromText(q.question_text);
                docChildren.push(new Paragraph({ children: [new TextRun({ text: `Câu ${questionCounter}: `, bold: true }), ...questionRuns], spacing: singleSpacing }));

                if (q.question_image) {
                    const imageRun = await dataUrlToImageRun(q.question_image);
                    if (imageRun) {
                        docChildren.push(new Paragraph({ children: [imageRun], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } }));
                    }
                }

                docChildren.push(new Paragraph({ children: [new TextRun({ text: "Đáp án/Gợi ý:", italics: true })], spacing: singleSpacing }));
                const answerRuns = await createRunsFromText(q.suggested_answer);
                (answerRuns.length > 0 ? answerRuns : [new TextRun("")]) .forEach(run => {
                    docChildren.push(new Paragraph({ children: [run], indent: { left: 720 }, spacing: singleSpacing }));
                });
            }
        }
        
        // --- Essay ---
        if (essayQuestions.length > 0) {
            docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN IV. CÂU HỎI TỰ LUẬN", bold: true })], heading: HeadingLevel.HEADING_2, spacing: { after: 150, before: docChildren.length > 1 ? 300 : 0 } }));
            for (const q of essayQuestions) {
                questionCounter++;
                const questionRuns = await createRunsFromText(q.question_text);
                docChildren.push(new Paragraph({ children: [new TextRun({ text: `Câu ${questionCounter}: `, bold: true }), ...questionRuns], spacing: singleSpacing }));
                
                if (q.question_image) {
                    const imageRun = await dataUrlToImageRun(q.question_image);
                    if (imageRun) {
                        docChildren.push(new Paragraph({ children: [imageRun], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } }));
                    }
                }

                docChildren.push(new Paragraph({ children: [new TextRun({ text: "Đáp án/Gợi ý:", italics: true })], spacing: singleSpacing }));
                const answerRuns = await createRunsFromText(q.suggested_answer);
                (answerRuns.length > 0 ? answerRuns : [new TextRun("")]) .forEach(run => {
                    docChildren.push(new Paragraph({ children: [run], indent: { left: 720 }, spacing: singleSpacing }));
                });
            }
        }

        const doc = new Document({ sections: [{ children: docChildren }] });

        Packer.toBlob(doc).then(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'de-thi.docx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        });
    }, [currentExam, multipleChoiceQuestions, trueFalseQuestions, shortAnswerQuestions, essayQuestions]);


    const handleExportWithAnswerKey = useCallback(async () => {
        const optionLabels = ['A', 'B', 'C', 'D'];
        const trueFalseLabels = ['a', 'b', 'c', 'd'];
        const singleSpacing = { line: 240, before: 0, after: 0 };
        const docChildren: (Paragraph | Table)[] = [];

        const noBorders = {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        };

        // --- Part 1: Exam Paper Header ---
        const headerTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({ 
                                    children: [new TextRun({ text: "SỞ GIÁO DỤC & ĐÀO TẠO ĐÀ NẴNG", bold: true })], 
                                    alignment: AlignmentType.CENTER
                                }),
                                new Paragraph({ 
                                    children: [new TextRun({ text: "TRƯỜNG THPT CHUYÊN LÊ THÁNH TÔNG", bold: true, underline: { type: UnderlineType.SINGLE } })], 
                                    alignment: AlignmentType.CENTER 
                                }),
                            ],
                            borders: noBorders,
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({ 
                                    children: [new TextRun({ text: "ĐỀ THI KIỂM TRA .................", bold: true })],
                                    alignment: AlignmentType.CENTER 
                                }),
                                new Paragraph({ 
                                    children: [new TextRun({ text: "MÔN: .............................", bold: true })],
                                    alignment: AlignmentType.CENTER 
                                }),
                            ],
                            borders: noBorders,
                        }),
                    ],
                }),
            ],
            borders: noBorders,
        });
        docChildren.push(headerTable);
        docChildren.push(new Paragraph({ text: "Họ tên: ...........................................................", spacing: { after: 300, before: 200 } }));

        
        // --- Part 2: Exam Paper Body ---
        let questionCounter = 0;
        
        if (multipleChoiceQuestions.length > 0) {
            docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN I. TRẮC NGHIỆM KHÁCH QUAN", bold: true })], spacing: { after: 150, before: 150 } }));
            for (const q of multipleChoiceQuestions) {
                questionCounter++;
                const questionRuns = await createRunsFromText(q.question_text);
                docChildren.push(new Paragraph({ children: [new TextRun({ text: `Câu ${questionCounter}. `, bold: true }), ...questionRuns] }));

                if (q.question_image) {
                    const imageRun = await dataUrlToImageRun(q.question_image);
                    if (imageRun) {
                        docChildren.push(new Paragraph({ children: [imageRun], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } }));
                    }
                }

                const options = q.options || [];
                if (options.length > 0) {
                    const optionParagraphs = [];
                     for (let i = 0; i < options.length; i++) {
                        const optionRuns = await createRunsFromText(options[i]);
                        optionParagraphs.push(new Paragraph({
                            children: [new TextRun(`${optionLabels[i]}. `), ...optionRuns],
                            indent: { left: 720 }
                        }));

                        const optionImage = q.option_images?.[i];
                        if (optionImage) {
                            const imageRun = await dataUrlToImageRun(optionImage, 200);
                            if (imageRun) {
                                optionParagraphs.push(new Paragraph({
                                    children: [imageRun],
                                    indent: { left: 720 },
                                    spacing: { before: 50, after: 50 }
                                }));
                            }
                        }
                    }
                    docChildren.push(...optionParagraphs);
                }
            }
        }

        if (trueFalseQuestions.length > 0) {
            docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN II. CÂU HỎI ĐÚNG - SAI", bold: true })], spacing: { after: 150, before: 300 } }));
            for (const q of trueFalseQuestions) {
                questionCounter++;
                const questionRuns = await createRunsFromText(q.question_text);
                docChildren.push(new Paragraph({ children: [new TextRun({ text: `Câu ${questionCounter}. `, bold: true }), ...questionRuns] }));
                
                if (q.question_image) {
                    const imageRun = await dataUrlToImageRun(q.question_image);
                    if (imageRun) {
                        docChildren.push(new Paragraph({ children: [imageRun], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } }));
                    }
                }
                
                if (q.statements) {
                    for (let stmtIndex = 0; stmtIndex < q.statements.length; stmtIndex++) {
                        const statement = q.statements[stmtIndex];
                        const statementRuns = await createRunsFromText(statement.text);
                        docChildren.push(new Paragraph({ children: [new TextRun(`${trueFalseLabels[stmtIndex]}) `), ...statementRuns], indent: { left: 720 } }));
                    }
                }
            }
        }
        
        if (shortAnswerQuestions.length > 0) {
            docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN III. CÂU HỎI TRẢ LỜI NGẮN", bold: true })], spacing: { after: 150, before: 300 } }));
            for (const q of shortAnswerQuestions) {
                questionCounter++;
                const questionRuns = await createRunsFromText(q.question_text);
                docChildren.push(new Paragraph({ children: [new TextRun({ text: `Câu ${questionCounter}. `, bold: true }), ...questionRuns] }));

                if (q.question_image) {
                    const imageRun = await dataUrlToImageRun(q.question_image);
                    if (imageRun) {
                        docChildren.push(new Paragraph({ children: [imageRun], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } }));
                    }
                }
            }
        }
        
        if (essayQuestions.length > 0) {
            docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN IV. CÂU HỎI TỰ LUẬN", bold: true })], spacing: { after: 150, before: 300 } }));
            for (const q of essayQuestions) {
                questionCounter++;
                const questionRuns = await createRunsFromText(q.question_text);
                docChildren.push(new Paragraph({ children: [new TextRun({ text: `Câu ${questionCounter}. `, bold: true }), ...questionRuns] }));

                if (q.question_image) {
                    const imageRun = await dataUrlToImageRun(q.question_image);
                    if (imageRun) {
                        docChildren.push(new Paragraph({ children: [imageRun], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } }));
                    }
                }
            }
        }

        // --- Part 3: Answer Key ---
        docChildren.push(new Paragraph({ children: [new PageBreak()] }));
        docChildren.push(new Paragraph({ text: "ĐÁP ÁN", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 300 } }));

        let answerCounter = 0;
        if (multipleChoiceQuestions.length > 0) {
             docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN I. TRẮC NGHIỆM KHÁCH QUAN", bold: true })], heading: HeadingLevel.HEADING_3, spacing: { after: 150 } }));
            const midPoint = Math.ceil(multipleChoiceQuestions.length / 2);
            const mcTableRows = Array.from({ length: midPoint }, (_, i) => {
                answerCounter = i + 1;
                const q1 = multipleChoiceQuestions[i];
                const q2 = multipleChoiceQuestions[i + midPoint];
                return new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ text: `${answerCounter}`, spacing: singleSpacing })] }),
                        new TableCell({ children: [new Paragraph({ text: optionLabels[q1.correct_answer_index ?? 0], spacing: singleSpacing })] }),
                        new TableCell({ children: [new Paragraph({ text: q2 ? `${answerCounter + midPoint}` : '', spacing: singleSpacing })] }),
                        new TableCell({ children: [new Paragraph({ text: q2 ? optionLabels[q2.correct_answer_index ?? 0] : '', spacing: singleSpacing })] }),
                    ]
                });
            });
            const mcTableHeader = new TableRow({ 
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Câu", bold: true })], spacing: singleSpacing })] }), 
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Đáp án", bold: true })], spacing: singleSpacing })] }), 
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Câu", bold: true })], spacing: singleSpacing })] }), 
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Đáp án", bold: true })], spacing: singleSpacing })] })
                ], 
                tableHeader: true 
            });
            const mcTable = new Table({ rows: [mcTableHeader, ...mcTableRows], width: { size: 100, type: WidthType.PERCENTAGE } });
            docChildren.push(mcTable);
        }
        
        answerCounter = multipleChoiceQuestions.length;

        if (trueFalseQuestions.length > 0) {
            docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN II. CÂU HỎI ĐÚNG - SAI", bold: true })], heading: HeadingLevel.HEADING_3, spacing: { after: 150, before: docChildren.length > 1 ? 300 : 0 } }));
            
            const tfTableHeader = new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Câu", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Lệnh hỏi", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Đáp án (Đ/S)", bold: true })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
                ],
                tableHeader: true,
            });

            const tfTableRows: TableRow[] = [tfTableHeader];

            trueFalseQuestions.forEach(q => {
                answerCounter++;
                q.statements?.forEach((statement, index) => {
                    const isFirstRowForQuestion = index === 0;
                    
                    tfTableRows.push(new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ text: `${answerCounter}`, alignment: AlignmentType.CENTER })],
                                verticalAlign: VerticalAlign.CENTER,
                                verticalMerge: isFirstRowForQuestion ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE,
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: trueFalseLabels[index], alignment: AlignmentType.CENTER })],
                                verticalAlign: VerticalAlign.CENTER,
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: statement.is_true ? 'Đ' : 'S', alignment: AlignmentType.CENTER })],
                                verticalAlign: VerticalAlign.CENTER,
                            }),
                        ],
                    }));
                });
            });

            const tfTable = new Table({
                rows: tfTableRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
                columnWidths: [2000, 2000, 5000],
            });

            docChildren.push(tfTable);
        }
        
        if (shortAnswerQuestions.length > 0) {
             docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN III. CÂU HỎI TRẢ LỜI NGẮN", bold: true })], heading: HeadingLevel.HEADING_3, spacing: { after: 150, before: docChildren.length > 1 ? 300 : 0 } }));
            for (const q of shortAnswerQuestions) {
                answerCounter++;
                const answerRuns = await createRunsFromText(q.suggested_answer);
                docChildren.push(new Paragraph({ children: [new TextRun({ text: `Câu ${answerCounter}: `, bold: true }), ...answerRuns] }));
            }
        }

        if (essayQuestions.length > 0) {
             docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN IV. CÂU HỎI TỰ LUẬN", bold: true })], heading: HeadingLevel.HEADING_3, spacing: { after: 150, before: docChildren.length > 1 ? 300 : 0 } }));
             for (const q of essayQuestions) {
                answerCounter++;
                const answerRuns = await createRunsFromText(q.suggested_answer);
                docChildren.push(new Paragraph({ children: [new TextRun({ text: `Câu ${answerCounter}: `, bold: true }), ...answerRuns] }));
            }
        }

        const doc = new Document({
            styles: {
                default: {
                    document: {
                        run: {
                            font: "Times New Roman",
                            size: 26, // 13pt
                        },
                        paragraph: {
                            spacing: { line: 300 } // 1.25 line spacing
                        }
                    },
                },
            },
            sections: [{ children: docChildren }]
        });

        Packer.toBlob(doc).then(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'de-thi-kem-dap-an.docx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        });

    }, [currentExam, multipleChoiceQuestions, trueFalseQuestions, shortAnswerQuestions, essayQuestions]);
    
    const handleExportMatrixToWord = useCallback(() => {
        const matrixData = (() => {
    
            const rowsByTopic: { [key: string]: MatrixRow } = {};
    
            currentExam.questions.forEach(q => {
                const topicKey = `${q.chapter || 'Không xác định'} - ${q.topic || 'Không xác định'}`;
                if (!rowsByTopic[topicKey]) {
                    rowsByTopic[topicKey] = {
                        chapter: q.chapter || 'Không xác định',
                        topic: q.topic || 'Không xác định',
                        counts: {},
                        topicTotal: 0,
                    };
                    TYPES.forEach(type => {
                        rowsByTopic[topicKey].counts[type] = {};
                        LEVELS.forEach(level => {
                            rowsByTopic[topicKey].counts[type][level] = 0;
                        });
                    });
                }
    
                const row = rowsByTopic[topicKey];
                if (q.question_type && q.level) {
                     if (row.counts[q.question_type] && typeof row.counts[q.question_type][q.level] === 'number') {
                        row.counts[q.question_type][q.level]++;
                        row.topicTotal++;
                    }
                }
            });
    
            const groupedByChapter: { [chapter: string]: MatrixRow[] } = {};
            Object.values(rowsByTopic).forEach(row => {
                if (!groupedByChapter[row.chapter]) {
                    groupedByChapter[row.chapter] = [];
                }
                groupedByChapter[row.chapter].push(row);
            });
    
            return groupedByChapter;
        })();
    
        const totals = (() => {
            const levelTotals: { [level: string]: number } = {};
            const typeTotals: { [type: string]: { [level: string]: number } } = {};
            let grandTotal = 0;
            
            LEVELS.forEach(l => levelTotals[l] = 0);
            TYPES.forEach(t => {
                typeTotals[t] = {};
                LEVELS.forEach(l => typeTotals[t][l] = 0);
            });
            
            currentExam.questions.forEach(q => {
                if (q.question_type && q.level) {
                    typeTotals[q.question_type][q.level]++;
                    levelTotals[q.level]++;
                    grandTotal++;
                }
            });
    
            return { levelTotals, typeTotals, grandTotal };
        })();
    
        const createCenterParagraph = (text: string, bold = false) => new Paragraph({ 
            children: [new TextRun({ text, bold })],
            alignment: AlignmentType.CENTER 
        });
    
        const headerRow1 = new TableRow({
            children: [
                new TableCell({ children: [createCenterParagraph("TT", true)], verticalAlign: VerticalAlign.CENTER, verticalMerge: VerticalMergeType.RESTART }),
                new TableCell({ children: [createCenterParagraph("Chương/Chủ đề", true)], verticalAlign: VerticalAlign.CENTER, verticalMerge: VerticalMergeType.RESTART }),
                new TableCell({ children: [createCenterParagraph("Nội dung/Đơn vị kiến thức", true)], verticalAlign: VerticalAlign.CENTER, verticalMerge: VerticalMergeType.RESTART }),
                new TableCell({ children: [createCenterParagraph("Mức độ nhận thức", true)], columnSpan: TYPES.length * LEVELS.length }),
                new TableCell({ children: [createCenterParagraph("Tổng cộng", true)], verticalAlign: VerticalAlign.CENTER, verticalMerge: VerticalMergeType.RESTART }),
            ],
            tableHeader: true,
        });
    
        const headerRow2Cells = [
            new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE }),
            new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE }),
            new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE }),
        ];
        TYPE_HEADERS.forEach(header => {
            headerRow2Cells.push(new TableCell({ children: [createCenterParagraph(header, true)], columnSpan: LEVELS.length, verticalAlign: VerticalAlign.CENTER }));
        });
        headerRow2Cells.push(new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE }));
        const headerRow2 = new TableRow({ children: headerRow2Cells, tableHeader: true });
    
        const headerRow3Cells = [
            new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE }),
            new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE }),
            new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE }),
        ];
        TYPE_HEADERS.forEach(() => {
            LEVEL_HEADERS.forEach(levelHeader => {
                headerRow3Cells.push(new TableCell({ children: [createCenterParagraph(levelHeader)], verticalAlign: VerticalAlign.CENTER }));
            });
        });
        headerRow3Cells.push(new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE }));
        const headerRow3 = new TableRow({ children: headerRow3Cells, tableHeader: true });
    
        const bodyRows: TableRow[] = [];
        Object.keys(matrixData).forEach((chapter, chapterIndex) => {
            const topics = matrixData[chapter];
            topics.forEach((row, topicIndex) => {
                const cells: TableCell[] = [];
                
                if (topicIndex === 0) {
                    cells.push(new TableCell({ children: [createCenterParagraph(String(chapterIndex + 1))], verticalAlign: VerticalAlign.TOP, verticalMerge: VerticalMergeType.RESTART }));
                    cells.push(new TableCell({ children: [new Paragraph(chapter)], verticalAlign: VerticalAlign.TOP, verticalMerge: VerticalMergeType.RESTART }));
                } else {
                    cells.push(new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE }));
                    cells.push(new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE }));
                }
    
                cells.push(new TableCell({ children: [new Paragraph(row.topic)], verticalAlign: VerticalAlign.CENTER }));
    
                TYPES.forEach(type => {
                    LEVELS.forEach(level => {
                        const count = row.counts[type]?.[level];
                        cells.push(new TableCell({ children: [createCenterParagraph(count > 0 ? String(count) : '')], verticalAlign: VerticalAlign.CENTER }));
                    });
                });
                
                cells.push(new TableCell({ children: [createCenterParagraph(String(row.topicTotal), true)], verticalAlign: VerticalAlign.CENTER }));
    
                bodyRows.push(new TableRow({ children: cells }));
            });
        });
    
        const totalRowCells = [
            new TableCell({ children: [createCenterParagraph("Tổng", true)], columnSpan: 3 }),
        ];
        TYPES.forEach(type => {
            LEVELS.forEach(level => {
                const count = totals.typeTotals[type]?.[level];
                totalRowCells.push(new TableCell({ children: [createCenterParagraph(count > 0 ? String(count) : '', true)], verticalAlign: VerticalAlign.CENTER }));
            });
        });
        totalRowCells.push(new TableCell({ children: [createCenterParagraph(String(totals.grandTotal), true)], verticalAlign: VerticalAlign.CENTER }));
        const totalRow = new TableRow({ children: totalRowCells });
    
        const table = new Table({
            rows: [headerRow1, headerRow2, headerRow3, ...bodyRows, totalRow],
            width: { size: 100, type: WidthType.PERCENTAGE }
        });
    
        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        size: {
                            orientation: PageOrientation.LANDSCAPE,
                        },
                    },
                },
                children: [
                    new Paragraph({ text: "MA TRẬN ĐỀ THI", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    table
                ]
            }]
        });
    
        Packer.toBlob(doc).then(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'ma-tran-de-thi.docx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        });
    
    }, [currentExam]);

    // Shuffle helper function
    const shuffleArray = <T,>(array: T[]): T[] => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    };

    const handleShuffleAndExport = useCallback(async (options: { title: string; count: number; codes: string[] }) => {
        setIsShuffleModalOpen(false);
        const { title, count, codes } = options;

        const allShuffledExamsData: { code: string; questions: ParsedQuestion[] }[] = [];

        // Generate shuffled exams data
        for (let i = 0; i < count; i++) {
            const code = codes[i];

            // Deep copy and group questions by type
            const originalQuestions = JSON.parse(JSON.stringify(currentExam.questions)) as ParsedQuestion[];
            const mcQuestions = originalQuestions.filter(q => q.question_type === 'multiple_choice');
            const tfQuestions = originalQuestions.filter(q => q.question_type === 'true_false');
            const saQuestions = originalQuestions.filter(q => q.question_type === 'short_answer');
            const essayQuestions = originalQuestions.filter(q => q.question_type === 'essay');

            // Shuffle each group and shuffle options for MCQs
            const shuffledMc = shuffleArray(mcQuestions).map(q => {
                if (q.options && q.correct_answer_index !== undefined) {
                    const correctAnswerText = q.options[q.correct_answer_index];
                    const shuffledOptions = shuffleArray(q.options);
                    q.options = shuffledOptions;
                    q.correct_answer_index = shuffledOptions.findIndex(opt => opt === correctAnswerText);
                }
                return q;
            });

            const shuffledTf = shuffleArray(tfQuestions);
            const shuffledSa = shuffleArray(saQuestions);
            const shuffledEssay = shuffleArray(essayQuestions);
            
            const shuffledQuestions = [...shuffledMc, ...shuffledTf, ...shuffledSa, ...shuffledEssay];
            allShuffledExamsData.push({ code, questions: shuffledQuestions });
        }
        
        // Generate DOCX
        const docChildren: (Paragraph | Table)[] = [];
        const answerKeys: { [code: string]: { mc: string[], tf: string[] } } = {};

        for (const [examIndex, exam] of allShuffledExamsData.entries()) {
            const { code, questions } = exam;
            answerKeys[code] = { mc: [], tf: [] };

            docChildren.push(new Paragraph({ text: title.toUpperCase(), heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }));
            docChildren.push(new Paragraph({ children: [new TextRun({ text: `MÃ ĐỀ: ${code}`, bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }));

            const mc = questions.filter(q => q.question_type === 'multiple_choice');
            const tf = questions.filter(q => q.question_type === 'true_false');
            const sa = questions.filter(q => q.question_type === 'short_answer');
            const essay = questions.filter(q => q.question_type === 'essay');

            let questionCounter = 0;
            const optionLabels = ['A', 'B', 'C', 'D'];
            const trueFalseLabels = ['a', 'b', 'c', 'd'];
            
            if (mc.length > 0) {
                docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN I. TRẮC NGHIỆM", bold: true })], spacing: { after: 150, before: 150 } }));
                for (const q of mc) {
                    questionCounter++;
                    const questionRuns = await createRunsFromText(q.question_text);
                    docChildren.push(new Paragraph({ children: [new TextRun({ text: `Câu ${questionCounter}. `, bold: true }), ...questionRuns], alignment: AlignmentType.JUSTIFIED }));

                    if (q.question_image) {
                        const imageRun = await dataUrlToImageRun(q.question_image);
                        if (imageRun) {
                            docChildren.push(new Paragraph({ children: [imageRun], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } }));
                        }
                    }

                    if (q.options) {
                        for (let i = 0; i < q.options.length; i++) {
                            const optionRuns = await createRunsFromText(q.options[i]);
                            docChildren.push(new Paragraph({
                                children: [new TextRun(`${optionLabels[i]}. `), ...optionRuns],
                                indent: { left: 720 },
                                alignment: AlignmentType.JUSTIFIED,
                            }));

                            const optionImage = q.option_images?.[i];
                            if (optionImage) {
                                const imageRun = await dataUrlToImageRun(optionImage, 200);
                                if(imageRun) {
                                    docChildren.push(new Paragraph({
                                        children: [imageRun],
                                        indent: { left: 720 },
                                        spacing: { before: 50, after: 50 }
                                    }));
                                }
                            }
                        }
                    }
                    answerKeys[code].mc.push(`${questionCounter}-${optionLabels[q.correct_answer_index!]}`);
                }
            }
            
            if (tf.length > 0) {
                docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN II. ĐÚNG/SAI", bold: true })], spacing: { after: 150, before: 150 } }));
                for (const q of tf) {
                    questionCounter++;
                    const questionRuns = await createRunsFromText(q.question_text);
                    docChildren.push(new Paragraph({ children: [new TextRun({ text: `Câu ${questionCounter}. `, bold: true }), ...questionRuns], alignment: AlignmentType.JUSTIFIED }));
                    
                    if (q.question_image) {
                        const imageRun = await dataUrlToImageRun(q.question_image);
                        if (imageRun) {
                            docChildren.push(new Paragraph({ children: [imageRun], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } }));
                        }
                    }

                    if(q.statements) {
                        for(let stmtIndex = 0; stmtIndex < q.statements.length; stmtIndex++) {
                            const statementRuns = await createRunsFromText(q.statements[stmtIndex].text);
                            docChildren.push(new Paragraph({ children: [new TextRun(`${trueFalseLabels[stmtIndex]}) `), ...statementRuns], indent: { left: 720 }, alignment: AlignmentType.JUSTIFIED }));
                        }
                        const tfAnswers = q.statements.map(s => s.is_true ? 'Đ' : 'S').join('-');
                        answerKeys[code].tf.push(`${questionCounter}: ${tfAnswers}`);
                    }
                }
            }

            if (sa.length > 0) {
                docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN III. TRẢ LỜI NGẮN", bold: true })], spacing: { after: 150, before: 150 } }));
                for (const q of sa) {
                    questionCounter++;
                    const questionRuns = await createRunsFromText(q.question_text);
                    docChildren.push(new Paragraph({ children: [new TextRun({ text: `Câu ${questionCounter}. `, bold: true }), ...questionRuns], alignment: AlignmentType.JUSTIFIED }));
                    
                    if (q.question_image) {
                        const imageRun = await dataUrlToImageRun(q.question_image);
                        if (imageRun) {
                            docChildren.push(new Paragraph({ children: [imageRun], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } }));
                        }
                    }
                }
            }

            if (essay.length > 0) {
                docChildren.push(new Paragraph({ children: [new TextRun({ text: "PHẦN IV. TỰ LUẬN", bold: true })], spacing: { after: 150, before: 150 } }));
                for (const q of essay) {
                    questionCounter++;
                    const questionRuns = await createRunsFromText(q.question_text);
                    docChildren.push(new Paragraph({ children: [new TextRun({ text: `Câu ${questionCounter}. `, bold: true }), ...questionRuns], alignment: AlignmentType.JUSTIFIED }));

                    if (q.question_image) {
                        const imageRun = await dataUrlToImageRun(q.question_image);
                        if (imageRun) {
                            docChildren.push(new Paragraph({ children: [imageRun], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } }));
                        }
                    }
                }
            }


            if (examIndex < allShuffledExamsData.length - 1) {
                docChildren.push(new Paragraph({ children: [new PageBreak()] }));
            }
        }
        
        docChildren.push(new Paragraph({ children: [new PageBreak()] }));
        docChildren.push(new Paragraph({ text: "ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 300 } }));
        
        const noBorders = { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } };

        Object.keys(answerKeys).forEach(code => {
            docChildren.push(new Paragraph({
                children: [new TextRun({ text: `MÃ ĐỀ: ${code}`, bold: true, underline: { type: UnderlineType.SINGLE }})],
                spacing: { before: 300, after: 150 }
            }));
            
            const mcAnswers = answerKeys[code].mc;
            if (mcAnswers.length > 0) {
                const numColumns = 4;
                const numRows = Math.ceil(mcAnswers.length / numColumns);
                const tableRows: TableRow[] = [];
                for (let i = 0; i < numRows; i++) {
                    const cells: TableCell[] = [];
                    for (let j = 0; j < numColumns; j++) {
                        const index = i + j * numRows;
                        cells.push(new TableCell({ children: [new Paragraph(index < mcAnswers.length ? mcAnswers[index] : "")], borders: noBorders }));
                    }
                    tableRows.push(new TableRow({ children: cells, cantSplit: true }));
                }
                const table = new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED });
                docChildren.push(table);
            }
        });

        const doc = new Document({
            styles: { default: { document: { run: { font: "Times New Roman", size: 26 }, paragraph: { spacing: { line: 300 } } } } },
            sections: [{ children: docChildren }]
        });

        Packer.toBlob(doc).then(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${title || 'de-thi-tron'}.docx`;
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

    const handleSaveLatex = (updatedQuestion: ParsedQuestion) => {
        setCurrentExam(prev => ({
            ...prev,
            questions: prev.questions.map(q => q.id === updatedQuestion.id ? updatedQuestion : q)
        }));
        setEditingLatex(null);
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
                
                // Validate if the generated question type matches the original
                if (newQuestion.question_type !== originalQuestion.question_type) {
                     console.warn(`Attempt ${attempt + 1}: Mismatched question type. Original: ${originalQuestion.question_type}, Generated: ${newQuestion.question_type}`);
                    if (attempt === MAX_RETRIES) {
                        // On the last attempt, show the mismatch modal
                        setMismatchedQuestion({ original: originalQuestion, generated: newQuestion });
                        setProcessingState(null);
                        return; // Exit the function
                    }
                    // If not the last attempt, continue to the next iteration to retry
                    continue; 
                }

                // Replace the original question in the exam state
                setCurrentExam(prev => ({
                    ...prev,
                    questions: prev.questions.map(q => 
                        q.id === originalQuestion.id 
                        ? { ...newQuestion, id: originalQuestion.id } // Replace with new content, keep old ID
                        : q
                    )
                }));

                setProcessingState(null);
                return; // Success, exit the loop
            } catch (e: any) {
                 console.error(`Attempt ${attempt + 1} failed:`, e);
                if (attempt === MAX_RETRIES) {
                    setError(e.message || "Không thể tạo câu hỏi tương tự sau nhiều lần thử.");
                    setProcessingState(null);
                }
            }
        }
    };

    const handleConvertQuestionType = async (originalQuestion: ParsedQuestion, newType: string) => {
        const apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            alert("Vui lòng cấu hình API Key trong mục Cấu hình Hệ thống.");
            return;
        }

        setConvertingQuestion(null);
        setProcessingState({ id: originalQuestion.id, action: 'convert' });
        setError(null);
        try {
            const newQuestion = await convertQuestionType(originalQuestion, newType, apiKey);
            
            setCurrentExam(prev => ({
                ...prev,
                questions: prev.questions.map(q => 
                    q.id === originalQuestion.id 
                    ? { ...newQuestion, id: originalQuestion.id } // Replace with new content, keep old ID
                    : q
                )
            }));

        } catch (e: any) {
            setError(e.message || "Không thể đổi dạng câu hỏi. Vui lòng thử lại.");
        } finally {
            setProcessingState(null);
        }
    };

    const renderQuestion = (q: ParsedQuestion, index: number) => {
        const isProcessing = processingState?.id === q.id;
        const optionLabels = ['A', 'B', 'C', 'D'];
        const statementLabels = ['a', 'b', 'c', 'd'];

        return (
            <div key={q.id} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200/80">
                <div className="flex justify-between items-start mb-4">
                    <div className="text-xl text-gray-800 flex-1 pr-4">
                        <strong className="font-bold">Câu {index}: </strong>
                        <MathText text={q.question_text} />
                        {q.question_image && (
                            <div className="mt-4 flex justify-center">
                                <img src={q.question_image} alt="Hình ảnh câu hỏi" className="max-w-lg h-auto rounded-lg border shadow-sm" />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                       <button onClick={() => setEditingQuestion(q)} className="px-4 py-1 text-base font-semibold text-gray-800 bg-yellow-400 rounded-md shadow-sm hover:bg-yellow-500 transition-colors">Sửa</button>
                       <button onClick={() => requestDeleteQuestion(q.id)} className="px-4 py-1 text-base font-semibold text-white bg-red-500 rounded-md shadow-sm hover:bg-red-600 transition-colors">Xóa</button>
                    </div>
                </div>


                {q.question_type === 'multiple_choice' && q.options && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options.map((opt, i) => (
                            <div key={i} className={`flex items-start p-4 rounded-xl border-2 transition-all text-lg ${
                                i === q.correct_answer_index 
                                ? 'border-green-500' 
                                : 'border-gray-300 hover:border-purple-500 hover:bg-purple-50'
                            }`}>
                                <span className="font-semibold mr-3">{optionLabels[i]}.</span>
                                <div className="flex-1">
                                    <MathText text={opt} />
                                    {q.option_images && q.option_images[i] && (
                                        <div className="mt-2">
                                            <img src={q.option_images[i]!} alt={`Hình ảnh đáp án ${optionLabels[i]}`} className="max-w-xs h-auto rounded-lg border shadow-sm" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {q.question_type === 'true_false' && q.statements && (
                     <div className="mt-4 space-y-3">
                        {q.statements.map((stmt, i) => (
                             <div key={i} className={`flex items-start p-4 rounded-xl border-2 transition-all hover:bg-slate-50 text-lg ${
                                stmt.is_true ? 'border-green-500' : 'border-purple-500'
                             }`}>
                                <span className="font-semibold mr-3">{statementLabels[i]})</span>
                                <MathText text={stmt.text} className="flex-1" />
                                <span className={`font-bold ml-4 ${stmt.is_true ? 'text-green-700' : 'text-purple-700'}`}>{stmt.is_true ? 'ĐÚNG' : 'SAI'}</span>
                            </div>
                        ))}
                    </div>
                )}
                 {(q.question_type === 'short_answer' || q.question_type === 'essay') && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="font-semibold text-blue-800 text-base">Đáp án/Gợi ý:</p>
                        <div className="prose prose-base max-w-none mt-1">
                             <MathText text={q.suggested_answer} />
                        </div>
                    </div>
                )}

                {q.explanation && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="font-semibold text-blue-800 text-base">Giải thích đáp án:</p>
                         <div className="prose prose-base max-w-none mt-1 text-blue-900">
                             <MathText text={q.explanation} />
                        </div>
                    </div>
                )}

                <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-x-2">
                        <p className="text-sm text-gray-500">Tùy chọn trộn:</p>
                        <label className="flex items-center gap-1.5 text-sm text-gray-600">
                            <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" defaultChecked />
                            <span>Câu dẫn</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-sm text-gray-600">
                            <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" defaultChecked />
                            <span>Đáp án</span>
                        </label>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <QuestionAction 
                            label={isProcessing && processingState?.action === 'explain' ? 'Đang tạo...' : 'Giải thích đáp án'}
                            color="text-indigo-600 bg-indigo-100" 
                            icon={<InfoIcon className={`w-4 h-4 ${isProcessing && processingState.action === 'explain' ? 'animate-spin' : ''}`} />}
                            onClick={() => handleGenerateExplanation(q)}
                            disabled={isProcessing}
                        />
                        <QuestionAction 
                            label={isProcessing && processingState?.action === 'similar' ? 'Đang tạo...' : 'Tạo câu hỏi tương tự'}
                            color="text-purple-600 bg-purple-100" 
                            icon={<SimilarIcon className={`w-4 h-4 ${isProcessing && processingState.action === 'similar' ? 'animate-spin' : ''}`} />} 
                            onClick={() => handleGenerateSimilar(q)}
                            disabled={isProcessing}
                        />
                        <QuestionAction 
                            label={'Sửa mã latex'}
                            color="text-teal-600 bg-teal-100" 
                            icon={<LatexIcon className={`w-4 h-4`} />}
                            onClick={() => setEditingLatex(q)}
                            disabled={isProcessing}
                        />
                         <QuestionAction 
                            label={isProcessing && processingState?.action === 'convert' ? 'Đang đổi...' : 'Đổi dạng'}
                            color="text-gray-600 bg-gray-200" 
                            icon={<ChangeTypeIcon className={`w-4 h-4 ${isProcessing && processingState.action === 'convert' ? 'animate-spin' : ''}`} />}
                            onClick={() => setConvertingQuestion(q)}
                            disabled={isProcessing}
                        />
                    </div>
                </div>
            </div>
        );
    }
    
    if (assignmentStatus === 'assigning') {
        return (
            <div className="flex flex-col items-center justify-center p-10 bg-white rounded-2xl shadow-2xl border border-slate-200/80">
                <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-green-600"></div>
                <h2 className="mt-6 text-3xl font-semibold text-gray-700">Đang tạo link giao bài...</h2>
                <p className="mt-2 text-gray-500">Vui lòng đợi trong giây lát.</p>
            </div>
        );
    }

    if (assignmentStatus === 'success') {
        return (
            <AssignmentSuccessView
                link={assignmentLink}
                code={assignmentCode}
                onReturn={handleReturnToExam}
                onStartNew={onStartNew}
            />
        );
    }
    
    let questionCounter = 0;

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-[#EEE9E9] min-h-screen">
            <header className="bg-white p-4 rounded-xl shadow-lg border border-slate-200/80 mb-6 sticky top-4 z-40">
                <div className="flex flex-col items-center gap-4">
                    <h2 className="text-2xl md:text-3xl font-bold text-green-900 uppercase text-center [text-shadow:2px_2px_4px_rgba(0,0,0,0.4)]">
                        Kết quả tạo đề
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                        <HeaderAction label="Tạo đề mới" color="bg-blue-600 hover:bg-blue-700" icon={<PlusIcon className="w-5 h-5"/>} onClick={onStartNew} />
                        <HeaderAction label="Trộn & Xuất Word" color="bg-teal-500 hover:bg-teal-600" icon={<MixIcon className="w-5 h-5"/>} onClick={() => setIsShuffleModalOpen(true)} />
                        <HeaderAction label="Giao bài tập" color="bg-green-600 hover:bg-green-700" icon={<AssignIcon className="w-5 h-5"/>} onClick={() => setIsAssignModalOpen(true)} />
                        <HeaderAction label="Xuất file Word" color="bg-[#FF7F00] hover:bg-orange-600" icon={<DownloadIcon className="w-5 h-5"/>} onClick={handleExportToWord} />
                        <HeaderAction label="Xuất file kèm đáp án" color="bg-[#FF7F00] hover:bg-orange-600" icon={<DownloadIcon className="w-5 h-5"/>} onClick={handleExportWithAnswerKey} />
                        <HeaderAction label="Xuất Ma trận Word" color="bg-[#FF7F00] hover:bg-orange-600" icon={<DownloadIcon className="w-5 h-5"/>} onClick={handleExportMatrixToWord} />
                    </div>
                </div>
                {error && <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-md text-sm border border-red-200">{error}</div>}
                 <div className="mt-4 border-t pt-3">
                    <div className="flex justify-center space-x-4">
                        <button onClick={() => setActiveTab('exam')} className={`px-4 py-2 text-base font-semibold rounded-md ${activeTab === 'exam' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}>Nội dung đề thi</button>
                        <button onClick={() => setActiveTab('matrix')} className={`px-4 py-2 text-base font-semibold rounded-md ${activeTab === 'matrix' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}>Ma trận đề thi</button>
                    </div>
                </div>
            </header>
            
            <main>
                {activeTab === 'exam' ? (
                     <div className="space-y-6">
                        {multipleChoiceQuestions.length > 0 && (
                            <div id="multiple-choice">
                                <h3 className="text-xl font-bold text-gray-800 mb-3 p-3 bg-[#FFC1C1] rounded-lg">PHẦN I. TRẮC NGHIỆM KHÁCH QUAN</h3>
                                <div className="space-y-4">
                                    {multipleChoiceQuestions.map(q => renderQuestion(q, ++questionCounter))}
                                </div>
                            </div>
                        )}
                         {trueFalseQuestions.length > 0 && (
                            <div id="true-false">
                                <h3 className="text-xl font-bold text-gray-800 mb-3 p-3 bg-[#FFC1C1] rounded-lg">PHẦN II. CÂU HỎI ĐÚNG - SAI</h3>
                                <div className="space-y-4">
                                    {trueFalseQuestions.map(q => renderQuestion(q, ++questionCounter))}
                                </div>
                            </div>
                        )}
                        {shortAnswerQuestions.length > 0 && (
                            <div id="short-answer">
                                <h3 className="text-xl font-bold text-gray-800 mb-3 p-3 bg-[#FFC1C1] rounded-lg">PHẦN III. CÂU HỎI TRẢ LỜI NGẮN</h3>
                                <div className="space-y-4">
                                    {shortAnswerQuestions.map(q => renderQuestion(q, ++questionCounter))}
                                </div>
                            </div>
                        )}
                        {essayQuestions.length > 0 && (
                            <div id="essay">
                                <h3 className="text-xl font-bold text-gray-800 mb-3 p-3 bg-[#FFC1C1] rounded-lg">PHẦN IV. CÂU HỎI TỰ LUẬN</h3>
                                <div className="space-y-4">
                                    {essayQuestions.map(q => renderQuestion(q, ++questionCounter))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <ExamMatrixView questions={currentExam.questions} />
                )}
            </main>

            {editingQuestion && (
                <EditQuestionModal 
                    question={editingQuestion}
                    onSave={handleSaveQuestion}
                    onCancel={() => setEditingQuestion(null)}
                />
            )}
            {isAssignModalOpen && (
                 <AssignExamModal 
                    onClose={() => setIsAssignModalOpen(false)}
                    onAssign={handleAssignExam}
                />
            )}
            {isShuffleModalOpen && (
                <ShuffleExamsModal
                    onClose={() => setIsShuffleModalOpen(false)}
                    onShuffle={handleShuffleAndExport}
                />
            )}
             {deletingQuestionId && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 shadow-xl">
                        <h3 className="text-xl font-bold">Xác nhận xóa</h3>
                        <p className="mt-2 text-lg text-gray-600">Bạn có chắc chắn muốn xóa câu hỏi này không?</p>
                        <div className="mt-4 flex justify-end space-x-3">
                            <button onClick={cancelDeleteQuestion} className="px-4 py-2 bg-gray-200 rounded-md">Hủy</button>
                            <button onClick={confirmDeleteQuestion} className="px-4 py-2 bg-red-600 text-white rounded-md">Xóa</button>
                        </div>
                    </div>
                </div>
            )}
            {editingLatex && (
                <LatexEditModal 
                    question={editingLatex}
                    onSave={handleSaveLatex}
                    onCancel={() => setEditingLatex(null)}
                />
            )}
            {convertingQuestion && (
                <ChangeTypeModal
                    question={convertingQuestion}
                    onCancel={() => setConvertingQuestion(null)}
                    onConvert={(newType) => handleConvertQuestionType(convertingQuestion, newType)}
                />
            )}
        </div>
    );
};

export default ExamResultView;