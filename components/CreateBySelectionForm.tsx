
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SUBJECTS, GRADES, DEFAULT_CURRICULUM, QUESTION_LEVELS, QUESTION_TYPES } from '../constants';
// FIX: Import TopicDetails to correctly type curriculum data.
import type { Chapter, Topic, LearningObjective, QuestionRequest, ParsedExam, FullCurriculum, GradeCurriculum, TopicDetails } from '../types';
import { SparklesIcon, PlusIcon, TrashIcon } from './icons';
import { generateExam } from '../services/geminiService';
import ExamResultView from './ExamResultView';

interface CreateBySelectionFormProps {
    onBack: () => void;
}

const Section: React.FC<{ title: string; number: number; children: React.ReactNode; className?: string }> = ({ title, number, children, className = '' }) => (
    <div className={`bg-white p-4 sm:p-6 rounded-lg shadow-md ${className}`}>
        <div className="flex items-center mb-4">
            <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 flex-shrink-0">{number}</div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-800">{title}</h3>
        </div>
        <div className="pl-0 sm:pl-11">
            {children}
        </div>
    </div>
);

const CustomSelect: React.FC<{ value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: string[]; label: string; }> = ({ value, onChange, options, label }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select value={value} onChange={onChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
    </div>
);


const CreateBySelectionForm: React.FC<CreateBySelectionFormProps> = ({ onBack }) => {
    const [view, setView] = useState<'form' | 'generating' | 'result' | 'error'>('form');
    const [generatedExam, setGeneratedExam] = useState<ParsedExam | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Curriculum state
    const [curriculumData, setCurriculumData] = useState<FullCurriculum>(DEFAULT_CURRICULUM);
    const [isUsingCustomData, setIsUsingCustomData] = useState(false);

    // Form state
    const [subject, setSubject] = useState(SUBJECTS[0]);
    const [grade, setGrade] = useState(GRADES[6]); // Default to Lớp 12
    const [selectedChapterNames, setSelectedChapterNames] = useState<string[]>([]);
    const [selectedTopicNames, setSelectedTopicNames] = useState<string[]>([]);
    const [learningObjectives, setLearningObjectives] = useState<LearningObjective[]>([]);
    const [newObjectiveText, setNewObjectiveText] = useState('');
    const [questionRequests, setQuestionRequests] = useState<QuestionRequest[]>([]);
    const [supplementaryFile, setSupplementaryFile] = useState<File | null>(null);

    // Question request form state
    const [reqCount, setReqCount] = useState(5);
    const [reqType, setReqType] = useState(QUESTION_TYPES[0]);
    const [reqLevel, setReqLevel] = useState(QUESTION_LEVELS[0]);
    const [reqDetails, setReqDetails] = useState('');

    useEffect(() => {
        try {
            const savedCurriculum = localStorage.getItem('customCurriculum');
            if (savedCurriculum) {
                setCurriculumData(JSON.parse(savedCurriculum));
                setIsUsingCustomData(true);
            } else {
                setCurriculumData(DEFAULT_CURRICULUM);
                setIsUsingCustomData(false);
            }
        } catch (e) {
            console.error("Failed to load curriculum from localStorage", e);
            setCurriculumData(DEFAULT_CURRICULUM);
            setIsUsingCustomData(false);
        }
    }, []);
    
    const gradeNumber = useMemo(() => grade.match(/\d+/)?.[0] || '12', [grade]);
    const currentGradeData = useMemo(() => curriculumData[gradeNumber] || {}, [curriculumData, gradeNumber]);

    const memoizedChapters = useMemo((): Chapter[] => {
        const chaptersMap = new Map<string, Topic[]>();
        Object.entries(currentGradeData).forEach(([topicName, topicDetails]) => {
            // FIX: Cast topicDetails to TopicDetails to resolve type error.
            const chapterName = (topicDetails as TopicDetails).chapter;
            if (!chaptersMap.has(chapterName)) {
                chaptersMap.set(chapterName, []);
            }
            chaptersMap.get(chapterName)!.push({ id: topicName, name: topicName });
        });
        return Array.from(chaptersMap.entries()).map(([name, topics], index) => ({
            id: `ch_${gradeNumber}_${index}`,
            name,
            topics,
        }));
    }, [currentGradeData, gradeNumber]);

    useEffect(() => {
        setSelectedChapterNames([]);
        setSelectedTopicNames([]);
    }, [grade, curriculumData]);

    useEffect(() => {
        if (!currentGradeData) return;
        const newObjectives = selectedTopicNames.flatMap(topicName => {
            const topicDetails = currentGradeData[topicName];
            return topicDetails?.objectives.map((text, index) => ({
                id: `lo_${topicName}_${index}`,
                text
            })) || [];
        });
        setLearningObjectives(newObjectives);
    }, [selectedTopicNames, currentGradeData]);


    const availableTopics = useMemo(() => {
        if (selectedChapterNames.length === 0) return [];
        return memoizedChapters
            .filter(c => selectedChapterNames.includes(c.name))
            .flatMap(c => c.topics);
    }, [selectedChapterNames, memoizedChapters]);
    
    const handleChapterToggle = (chapterName: string) => {
        const isSelected = selectedChapterNames.includes(chapterName);
        const newSelectedChapters = isSelected
            ? selectedChapterNames.filter(name => name !== chapterName)
            : [...selectedChapterNames, chapterName];
        setSelectedChapterNames(newSelectedChapters);

        const chapterTopics = memoizedChapters.find(c => c.name === chapterName)?.topics.map(t => t.name) || [];
        const newSelectedTopics = isSelected
            ? selectedTopicNames.filter(name => !chapterTopics.includes(name))
            : [...new Set([...selectedTopicNames, ...chapterTopics])];
        setSelectedTopicNames(newSelectedTopics);
    };
    
    const handleTopicToggle = (topicName: string) => {
        setSelectedTopicNames(prev => prev.includes(topicName) ? prev.filter(name => name !== topicName) : [...prev, topicName]);
    };

    const handleAddObjective = () => {
        if (newObjectiveText.trim()) {
            setLearningObjectives(prev => [...prev, { id: `lo_manual_${Date.now()}`, text: newObjectiveText.trim() }]);
            setNewObjectiveText('');
        }
    };
    
    const handleDeleteObjective = (id: string) => {
        setLearningObjectives(prev => prev.filter(obj => obj.id !== id));
    };

    const handleAddRequest = () => {
        const newRequest: QuestionRequest = {
            id: `req_${Date.now()}`,
            count: reqCount,
            type: reqType,
            level: reqLevel,
            details: reqDetails
        };
        setQuestionRequests(prev => [...prev, newRequest]);
    };
    
    const handleDeleteRequest = (id: string) => {
        setQuestionRequests(prev => prev.filter(req => req.id !== id));
    };
    
    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);
                // Basic validation
                if (typeof data === 'object' && data !== null && Object.keys(data).length > 0) {
                     setCurriculumData(data);
                     setIsUsingCustomData(true);
                     localStorage.setItem('customCurriculum', text);
                     alert('Tải lên chương trình học thành công!');
                } else {
                    throw new Error("Invalid JSON structure.");
                }
            } catch (error) {
                alert('Tệp JSON không hợp lệ hoặc có lỗi khi đọc tệp.');
                console.error(error);
            }
        };
        reader.readAsText(file);
    };

    const handleRestoreDefault = () => {
        if (window.confirm("Bạn có chắc chắn muốn khôi phục chương trình học mặc định không? Mọi dữ liệu đã tải lên sẽ bị xóa.")) {
            localStorage.removeItem('customCurriculum');
            setCurriculumData(DEFAULT_CURRICULUM);
            setIsUsingCustomData(false);
            alert('Đã khôi phục chương trình học mặc định.');
        }
    };


    const handleGenerateExam = async () => {
        const apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            setError("Vui lòng đặt API Key trong Cấu hình Hệ thống trước.");
            setView('error');
            return;
        }

        setView('generating');
        setError(null);

        const params = {
            subject,
            grade,
            chapters: selectedChapterNames,
            topics: selectedTopicNames,
            objectives: learningObjectives.map(o => o.text),
            questionRequests,
        };
        
        try {
            const resultJsonString = await generateExam(params, apiKey);
            const result = JSON.parse(resultJsonString);
            if (result.error) {
                throw new Error(result.error);
            }
            setGeneratedExam({
                questions: result.questions.map((q: any, index: number) => ({ ...q, id: `gq_${index}` }))
            });
            setView('result');
        } catch (e: any) {
            console.error("Error generating exam:", e);
            setError(e.message || "Không thể tạo đề thi. Vui lòng thử lại.");
            setView('error');
        }
    };

    const handleStartNew = () => {
        setGeneratedExam(null);
        setError(null);
        setView('form');
        setQuestionRequests([]);
    };

    if (view === 'generating') {
        return (
             <div className="flex flex-col items-center justify-center p-10 bg-white rounded-lg shadow-lg">
                <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-indigo-600"></div>
                <h2 className="mt-6 text-2xl font-semibold text-gray-700">AI đang tạo đề...</h2>
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
                <div className="prose max-w-none p-4 border rounded-md bg-red-50 text-red-900">{error || "Đã xảy ra lỗi không xác định."}</div>
                <div className="mt-6">
                     <button 
                        onClick={() => setView('form')}
                        className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors"
                    >
                        Quay lại Form
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="w-full">
            <button onClick={onBack} className="text-sm text-indigo-600 hover:underline mb-4 inline-flex items-center gap-1">
                &larr; Quay lại trang chủ
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Section number={1} title="Chọn Môn học & Lớp">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <CustomSelect label="Môn học" value={subject} onChange={(e) => setSubject(e.target.value)} options={SUBJECTS} />
                            <CustomSelect label="Lớp / Khối" value={grade} onChange={(e) => setGrade(e.target.value)} options={GRADES} />
                        </div>
                    </Section>

                    <Section number={2} title="Tùy chỉnh Nội dung & Thêm yêu cầu">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-semibold text-gray-700 mb-2">Chương (Chọn nhiều)</h4>
                                <div className="h-40 overflow-y-auto border p-3 rounded-md bg-gray-50 space-y-2">
                                    {memoizedChapters.map(c => (
                                        <label key={c.id} className="flex items-center space-x-2 cursor-pointer">
                                            <input type="checkbox" checked={selectedChapterNames.includes(c.name)} onChange={() => handleChapterToggle(c.name)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                            <span>{c.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                             <div>
                                <h4 className="font-semibold text-gray-700 mb-2">Chủ đề (Chọn nhiều)</h4>
                                <div className="h-40 overflow-y-auto border p-3 rounded-md bg-gray-50 space-y-2">
                                     {availableTopics.length > 0 ? availableTopics.map(t => (
                                        <label key={t.id} className="flex items-center space-x-2 cursor-pointer">
                                            <input type="checkbox" checked={selectedTopicNames.includes(t.name)} onChange={() => handleTopicToggle(t.name)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                                            <span>{t.name}</span>
                                        </label>
                                    )) : <p className="text-gray-500 text-sm">Vui lòng chọn một chương.</p>}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 border-t pt-6">
                             <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                     <div>
                                        <label className="font-semibold text-gray-700">Thêm yêu cầu cần đạt mới (hoặc để AI gợi ý)</label>
                                        <div className="flex gap-2 mt-1">
                                            <input type="text" value={newObjectiveText} onChange={e => setNewObjectiveText(e.target.value)} placeholder="Nhập một yêu cầu cần đạt..." className="flex-grow p-2 border rounded-md" />
                                            <button onClick={handleAddObjective} className="px-4 py-2 bg-indigo-500 text-white rounded-md font-semibold hover:bg-indigo-600">Thêm</button>
                                        </div>
                                     </div>
                                      <div>
                                        <label className="font-semibold text-gray-700">Mục tiêu học tập (Có thể chọn/sửa/xóa/kéo-thả)</label>
                                         <div className="h-48 overflow-y-auto border p-3 rounded-md bg-gray-50 space-y-2 mt-1">
                                            {learningObjectives.map(obj => (
                                                <div key={obj.id} className="flex items-center justify-between bg-white p-2 rounded shadow-sm">
                                                    <span className="text-sm pr-2">{obj.text}</span>
                                                    <button onClick={() => handleDeleteObjective(obj.id)} className="text-red-500 hover:text-red-700 flex-shrink-0">
                                                        <TrashIcon className="w-4 h-4"/>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                                            <button onClick={handleUploadClick} className="px-3 py-1.5 text-sm bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md shadow">Tải File</button>
                                            <button className="px-3 py-1.5 text-sm bg-purple-500 text-white font-semibold rounded-md shadow disabled:opacity-60" disabled>Tải lên File</button>
                                            <button onClick={handleRestoreDefault} className="px-3 py-1.5 text-sm bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold rounded-md shadow">Khôi phục gốc</button>
                                            {isUsingCustomData && <span className="text-xs text-gray-500">Đang dùng dữ liệu đã lưu.</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-lg border space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                         <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Số câu và Mức độ</label>
                                            <div className="flex gap-2">
                                                <select value={reqType} onChange={e => setReqType(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm">
                                                    {QUESTION_TYPES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                                <input type="number" value={reqCount} onChange={e => setReqCount(parseInt(e.target.value, 10))} min="1" className="w-20 p-2 border rounded-md"/>
                                            </div>
                                        </div>
                                        <CustomSelect label="Nhận biết" value={reqLevel} onChange={e => setReqLevel(e.target.value)} options={QUESTION_LEVELS} />
                                    </div>
                                     <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Yêu cầu bổ sung (nếu có)</label>
                                        <textarea value={reqDetails} onChange={e => setReqDetails(e.target.value)} rows={4} placeholder="Ví dụ: Câu hỏi cần có hình vẽ, hoặc bối cảnh thực tế..." className="w-full p-2 border rounded-md"></textarea>
                                    </div>
                                    <button onClick={handleAddRequest} className="w-full px-4 py-2 bg-blue-500 text-white rounded-md font-semibold hover:bg-blue-600">Thêm vào đề</button>
                                </div>
                            </div>
                        </div>

                    </Section>
                    
                    <Section number={3} title="Nạp tài liệu bổ sung (Tùy chọn)">
                        <p className="text-sm text-gray-600 mb-2">Tải lên file .txt, .pdf, .docx... hoặc dán nội dung để AI tham khảo khi tạo câu hỏi.</p>
                         <div className="flex items-center justify-center w-full">
                            <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/></svg>
                                    <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Nhấn để tải lên</span> hoặc kéo thả</p>
                                    <p className="text-xs text-gray-500">DOCX, PDF, TXT (MAX. 5MB)</p>
                                </div>
                                <input id="dropzone-file" type="file" className="hidden" onChange={e => setSupplementaryFile(e.target.files?.[0] || null)} />
                            </label>
                        </div> 
                        {supplementaryFile && <p className="text-sm text-gray-600 mt-2">Đã chọn tệp: {supplementaryFile.name}</p>}
                    </Section>
                </div>

                <div className="lg:col-span-1">
                     <div className="bg-white p-6 rounded-lg shadow-md sticky top-6">
                        <div className="flex items-center mb-4">
                            <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 flex-shrink-0">4</div>
                            <h3 className="text-xl font-bold text-gray-800">Tổng hợp và Tạo đề</h3>
                        </div>
                        <div className="pl-0 sm:pl-11">
                            <div className="h-64 overflow-y-auto border p-3 rounded-md bg-gray-50 space-y-2">
                                {questionRequests.length > 0 ? questionRequests.map(req => (
                                    <div key={req.id} className="bg-white p-2 rounded shadow-sm text-sm relative">
                                        <button onClick={() => handleDeleteRequest(req.id)} className="absolute top-1 right-1 text-red-400 hover:text-red-600">
                                            <TrashIcon className="w-3.5 h-3.5" />
                                        </button>
                                        <p><b>{req.count} câu {req.type}</b> - {req.level}</p>
                                        {req.details && <p className="text-xs text-gray-500 mt-1 truncate">YC: {req.details}</p>}
                                    </div>
                                )) : <p className="text-gray-500 text-sm text-center mt-4">Chưa có yêu cầu nào.</p>}
                            </div>
                            <button 
                                onClick={handleGenerateExam}
                                disabled={questionRequests.length === 0}
                                className="w-full mt-4 px-4 py-3 bg-indigo-600 text-white rounded-md font-bold text-lg flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                                <SparklesIcon className="w-6 h-6" />
                                TẠO ĐỀ THI
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateBySelectionForm;