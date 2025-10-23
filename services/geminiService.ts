import { GoogleGenAI, Type } from "@google/genai";
import type { ParsedQuestion, QuestionRequest } from '../types';

interface ExamParams {
  subject: string;
  grade: string;
  chapters: string[];
  topics: string[];
  objectives: string[];
  questionRequests: QuestionRequest[];
  supplementaryContent?: string;
}

const examSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            description: 'A list of questions for the exam.',
            items: {
                type: Type.OBJECT,
                properties: {
                    question_type: {
                        type: Type.STRING,
                        description: "The type of question. Must be either 'multiple_choice' or 'true_false'."
                    },
                    question_text: { 
                        type: Type.STRING,
                        description: 'The main text of the question or the main prompt for a true/false question.' 
                    },
                    options: {
                        type: Type.ARRAY,
                        description: "For 'multiple_choice' questions only. An array of exactly 4 possible answer strings.",
                        minItems: 4,
                        maxItems: 4,
                        items: { type: Type.STRING }
                    },
                    correct_answer_index: { 
                        type: Type.INTEGER,
                        description: "For 'multiple_choice' questions only. The 0-based index of the correct answer in the options array."
                    },
                    statements: {
                        type: Type.ARRAY,
                        description: "For 'true_false' questions only. An array of exactly 4 statements to be evaluated.",
                        minItems: 4,
                        maxItems: 4,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING, description: 'The statement text.' },
                                is_true: { type: Type.BOOLEAN, description: 'Whether the statement is true or false.' }
                            },
                            required: ['text', 'is_true']
                        }
                    },
                    explanation: { 
                        type: Type.STRING,
                        description: 'A brief explanation for the correct answer(s).'
                    }
                },
                required: ['question_type', 'question_text']
            }
        }
    },
    required: ['questions']
};

const singleQuestionSchema = examSchema.properties.questions.items;

export const extractTextFromPdf = async (pdfBase64: string, apiKey: string): Promise<string> => {
    if (!apiKey) {
        throw new Error("API Key is not configured. Please set your API key in the System Configuration.");
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = "Trích xuất văn bản từ tệp PDF này. Đây là một đề thi trắc nghiệm. Vui lòng định dạng đầu ra một cách chính xác. Mỗi câu hỏi phải bắt đầu bằng 'Câu X:' (ví dụ: 'Câu 1:', 'Câu 2:'). Theo sau đó là 4 đáp án, mỗi đáp án bắt đầu bằng một chữ cái (A., B., C., D.). Đánh dấu câu trả lời đúng bằng cách thêm dấu hoa thị (*) vào trước chữ cái của nó (ví dụ: '*A. ...'). Chỉ trả về văn bản đã được định dạng, không có lời giải thích hay bất kỳ văn bản nào khác. Đảm bảo cấu trúc này được tuân thủ nghiêm ngặt.";

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: 'application/pdf',
                            data: pdfBase64,
                        },
                    },
                ],
            },
        });
        
        return response.text;
    } catch (error) {
        console.error("Error extracting text from PDF with AI:", error);
        throw new Error("Đã xảy ra lỗi khi AI xử lý tệp PDF. Vui lòng kiểm tra lại API key và định dạng tệp.");
    }
};


export const generateExam = async (params: ExamParams, apiKey: string): Promise<string> => {
  if (!apiKey) {
      return `{"error": "API Key is not configured. Please set your API key in the System Configuration."}`;
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      Bạn là một trợ lý AI chuyên tạo đề thi cho giáo viên Việt Nam.
      Hãy tạo một đề kiểm tra chi tiết dựa trên các yêu cầu sau, và trả về kết quả dưới dạng một chuỗi JSON hợp lệ theo cấu trúc đã định nghĩa.

      **Môn học:** ${params.subject}
      **Lớp:** ${params.grade}

      **Nội dung kiến thức cần kiểm tra:**
      - Các chương: ${params.chapters.join(', ')}
      - Các chủ đề/bài học cụ thể: ${params.topics.join(', ')}

      **Mục tiêu học tập cần đạt:**
      ${params.objectives.map(obj => `- ${obj}`).join('\n')}

      **Cấu trúc đề thi (số lượng và loại câu hỏi):**
      ${params.questionRequests.map(req => `- ${req.count} câu ${req.level} - ${req.type}: ${req.details || 'Không có yêu cầu thêm.'}`).join('\n')}
      
      ${params.supplementaryContent ? `**Tài liệu bổ sung:**\n${params.supplementaryContent}` : ''}

      **Yêu cầu đầu ra:**
      - Tạo một JSON object chứa một key là "questions".
      - "questions" là một mảng các object, mỗi object đại diện cho một câu hỏi.
      - Mỗi câu hỏi phải có trường "question_type".
      - Nếu loại câu hỏi là "Trắc nghiệm", hãy đặt "question_type" là "multiple_choice". Câu hỏi phải có "question_text", một mảng "options" chứa chính xác 4 lựa chọn, và "correct_answer_index" (chỉ số của đáp án đúng, từ 0 đến 3).
      - Nếu loại câu hỏi là "Đúng/Sai", hãy đặt "question_type" là "true_false". Câu hỏi phải có "question_text" (là câu dẫn chung) và một mảng "statements" chứa chính xác 4 mệnh đề. Mỗi phần tử trong "statements" là một object có trường "text" (nội dung mệnh đề) và "is_true" (giá trị boolean).
      - Toàn bộ nội dung phải bằng tiếng Việt.
    `;

    console.log("Generating exam with params:", params);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: examSchema,
        },
    });
    
    return response.text;
  } catch (error) {
    console.error("Error generating exam:", error);
    return `{"error": "Đã xảy ra lỗi khi tạo đề thi. Vui lòng kiểm tra lại API key và thử lại."}`;
  }
};

export const generateExamFromMatrix = async (matrixText: string, apiKey: string, supplementaryContent?: string): Promise<string> => {
    if (!apiKey) {
        return `{"error": "API Key is not configured. Please set your API key in the System Configuration."}`;
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
            Bạn là một trợ lý AI chuyên tạo đề thi cho giáo viên Việt Nam.
            Hãy tạo một đề kiểm tra chi tiết dựa trên MA TRẬN ĐỀ THI được cung cấp dưới đây.
            Kết quả phải là một chuỗi JSON hợp lệ theo cấu trúc đã định nghĩa.

            **MA TRẬN ĐỀ THI:**
            ---
            ${matrixText}
            ---

            ${supplementaryContent ? `**TÀI LIỆU THAM KHẢO (Sử dụng nội dung từ tài liệu này để tạo câu hỏi cho phù hợp):**\n${supplementaryContent}` : ''}

            **YÊU CẦU CỤ THỂ:**
            - Dựa vào TỪNG DÒNG trong ma trận để tạo ra một câu hỏi tương ứng. Ví dụ, nếu ma trận có 12 dòng trong phần trắc nghiệm, bạn phải tạo ra chính xác 12 câu hỏi trắc nghiệm.
            - Tôn trọng MỨC ĐỘ yêu cầu ở đầu mỗi dòng: [NB] là Nhận biết, [TH] là Thông hiểu, [VD] là Vận dụng, [VDC] là Vận dụng cao.
            - Tôn trọng DẠNG CÂU HỎI được nêu trong tiêu đề các phần của ma trận (ví dụ: PHẦN I. TRẮC NGHIỆM KHÁCH QUAN, PHẦN II. TRẮC NGHIỆM ĐÚNG/SAI, v.v.).

            **QUY TẮC CHUYỂN ĐỔI SANG JSON:**
            - "TRẮC NGHIỆM KHÁCH QUAN": Chuyển thành các câu hỏi có "question_type" là "multiple_choice". Mỗi câu phải có "question_text", mảng "options" (4 lựa chọn), và "correct_answer_index".
            - "TRẮC NGHIỆM ĐÚNG/SAI": Chuyển thành các câu hỏi có "question_type" là "true_false". Mỗi câu hỏi phải có "question_text" (là câu dẫn chung) và một mảng "statements" (4 mệnh đề), mỗi mệnh đề có "text" và "is_true".
            - "TRẢ LỜI NGẮN" và "TỰ LUẬN": Với những dạng này, hãy tạo câu hỏi có "question_type" là "multiple_choice" nhưng câu hỏi mang tính tự luận/trả lời ngắn, và các đáp án là những lựa chọn hợp lý nhất.
            - Toàn bộ nội dung phải bằng tiếng Việt.
            - Tuyệt đối tuân thủ định dạng JSON đầu ra.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: examSchema,
            },
        });

        return response.text;
    } catch (error) {
        console.error("Error generating exam from matrix:", error);
        return `{"error": "Đã xảy ra lỗi khi tạo đề thi từ ma trận. Vui lòng kiểm tra lại API key, định dạng ma trận và thử lại."}`;
    }
};

export const extractGenericTextFromPdf = async (pdfBase64: string, apiKey: string): Promise<string> => {
    if (!apiKey) {
        throw new Error("API Key is not configured. Please set your API key in the System Configuration.");
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = "Trích xuất toàn bộ văn bản từ tệp PDF này. Giữ nguyên định dạng và cấu trúc văn bản gốc càng nhiều càng tốt. Chỉ trả về văn bản đã trích xuất, không thêm bất kỳ lời giải thích hay bình luận nào.";

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: 'application/pdf',
                            data: pdfBase64,
                        },
                    },
                ],
            },
        });
        
        return response.text;
    } catch (error) {
        console.error("Error extracting generic text from PDF with AI:", error);
        throw new Error("Đã xảy ra lỗi khi AI xử lý tệp PDF. Vui lòng kiểm tra lại API key và định dạng tệp.");
    }
};


export const generateExplanation = async (question: ParsedQuestion, apiKey: string): Promise<string> => {
    if (!apiKey) {
        throw new Error("API Key is not configured.");
    }
    try {
        const ai = new GoogleGenAI({ apiKey });

        let questionContent = `Câu hỏi: ${question.question_text}\n`;
        if (question.question_type === 'multiple_choice' && question.options && question.correct_answer_index !== undefined) {
            questionContent += `Các lựa chọn:\n${question.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n')}\n`;
            questionContent += `Đáp án đúng: ${String.fromCharCode(65 + question.correct_answer_index)}. ${question.options[question.correct_answer_index]}`;
        } else if (question.question_type === 'true_false' && question.statements) {
            questionContent += `Các mệnh đề:\n${question.statements.map((stmt, i) => `${String.fromCharCode(97 + i)}) ${stmt.text} -> ${stmt.is_true ? 'ĐÚNG' : 'SAI'}`).join('\n')}`;
        }

        const prompt = `
            Bạn là một trợ lý AI chuyên môn cho giáo viên Việt Nam. 
            Hãy giải thích đáp án cho câu hỏi sau một cách ngắn gọn, rõ ràng và dễ hiểu. 
            Đối với câu trắc nghiệm, hãy giải thích tại sao đáp án đúng là chính xác và tại sao các đáp án còn lại là sai.
            Đối với câu Đúng/Sai, hãy giải thích ngắn gọn cho từng mệnh đề.
            Chỉ trả về phần giải thích bằng tiếng Việt.

            Câu hỏi như sau:
            ${questionContent}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        console.error("Error generating explanation:", error);
        throw new Error("AI không thể tạo giải thích. Vui lòng thử lại.");
    }
};

export const generateSimilarQuestion = async (question: ParsedQuestion, apiKey: string): Promise<ParsedQuestion> => {
     if (!apiKey) {
        throw new Error("API Key is not configured.");
    }
    try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
            Bạn là một trợ lý AI chuyên tạo đề thi cho giáo viên Việt Nam.
            Dựa trên câu hỏi JSON sau đây, hãy tạo ra một câu hỏi MỚI TƯƠNG TỰ.
            - Giữ nguyên loại câu hỏi ('question_type'). Nếu câu hỏi gốc là 'multiple_choice', câu hỏi mới cũng phải là 'multiple_choice'. Nếu là 'true_false', câu hỏi mới cũng phải là 'true_false'.
            - Diễn đạt lại câu hỏi và các lựa chọn/mệnh đề bằng từ ngữ khác.
            - Giữ nguyên chủ đề, độ khó, và logic của câu trả lời đúng.
            - **YÊU CẦU CẤU TRÚC JSON BẮT BUỘC:** Trả về kết quả dưới dạng một object JSON duy nhất, tuân thủ nghiêm ngặt cấu trúc đã cho.
              - Với 'multiple_choice', mảng 'options' PHẢI có chính xác 4 phần tử.
              - Với 'true_false', mảng 'statements' PHẢI có chính xác 4 phần tử.
            - Không bao bọc nó trong một mảng hay một key "questions".

            Câu hỏi gốc:
            ${JSON.stringify(question, null, 2)}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: singleQuestionSchema,
            },
        });
        
        const generatedQuestion = JSON.parse(response.text);
        
        return { ...generatedQuestion, id: `gq_similar_${Date.now()}` };

    } catch (error) {
        console.error("Error generating similar question:", error);
        throw new Error("AI không thể tạo câu hỏi tương tự. Vui lòng thử lại.");
    }
};