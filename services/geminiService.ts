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
                    chapter: {
                        type: Type.STRING,
                        description: "The chapter the question belongs to. For example: 'MÁY TÍNH VÀ XÃ HỘI TRI THỨC'."
                    },
                    topic: {
                        type: Type.STRING,
                        description: "The specific topic or lesson the question belongs to. For example: 'Bài 1. Làm quen với Trí tuệ nhân tạo'."
                    },
                    level: {
                        type: Type.STRING,
                        description: "The cognitive level of the question. Must be one of 'Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao'."
                    },
                    question_type: {
                        type: Type.STRING,
                        description: "The type of question. Must be one of 'multiple_choice', 'true_false', 'short_answer', or 'essay'."
                    },
                    question_text: { 
                        type: Type.STRING,
                        description: 'The main text of the question or the main prompt.' 
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
                    suggested_answer: {
                        type: Type.STRING,
                        description: "For 'short_answer' and 'essay' questions only. A suggested answer or key points for the answer."
                    },
                    explanation: { 
                        type: Type.STRING,
                        description: 'A brief explanation for the correct answer(s).'
                    }
                },
                required: ['question_type', 'question_text', 'chapter', 'topic', 'level']
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

        const prompt = "Trích xuất văn bản từ tệp PDF này. Đây là một đề thi. Vui lòng định dạng đầu ra một cách chính xác. Mỗi câu hỏi phải bắt đầu bằng 'Câu X:' (ví dụ: 'Câu 1:', 'Câu 2:'). Đối với câu trắc nghiệm, các đáp án bắt đầu bằng A., B., C., D. và đáp án đúng có dấu hoa thị (*). Đối với câu Đúng/Sai, các mệnh đề bắt đầu bằng a), b), c), d) và mệnh đề đúng có dấu hoa thị (*). Đối với câu tự luận hoặc trả lời ngắn, câu trả lời bắt đầu bằng 'Đáp án/Gợi ý:'. Chỉ trả về văn bản đã được định dạng, không có lời giải thích hay bất kỳ văn bản nào khác.";

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
    
    const requestsByTopic = params.questionRequests.reduce((acc, req) => {
        if (!acc[req.topic]) {
            acc[req.topic] = [];
        }
        acc[req.topic].push(req);
        return acc;
    }, {} as { [topic: string]: QuestionRequest[] });

    const structuredRequests = Object.entries(requestsByTopic).map(([topic, requests]) => {
        const topicRequests = requests.map(req => `- ${req.count} câu ${req.level} - ${req.type}: ${req.details || 'Không có yêu cầu thêm.'}`).join('\n');
        return `Cho Chủ đề/Bài học: "${topic}"\n${topicRequests}`;
    }).join('\n\n');


    const prompt = `
      Bạn là một trợ lý AI chuyên tạo đề thi cho giáo viên Việt Nam.
      Hãy tạo một đề kiểm tra chi tiết dựa trên các yêu cầu sau, và trả về kết quả dưới dạng một chuỗi JSON hợp lệ theo cấu trúc đã định nghĩa.

      **Môn học:** ${params.subject}
      **Lớp:** ${params.grade}

      **Nội dung kiến thức cần kiểm tra (tổng thể):**
      - Các chương: ${params.chapters.join(', ')}
      - Các chủ đề/bài học cụ thể: ${params.topics.join(', ')}

      **Mục tiêu học tập cần đạt:**
      ${params.objectives.map(obj => `- ${obj}`).join('\n')}

      **Cấu trúc đề thi chi tiết theo từng chủ đề:**
      ${structuredRequests}
      
      ${params.supplementaryContent ? `**Tài liệu bổ sung (ưu tiên sử dụng nội dung từ đây để tạo câu hỏi phù hợp với chủ đề và mục tiêu đã chọn):**\n${params.supplementaryContent}` : ''}

      **YÊU CẦU CỰC KỲ QUAN TRỌNG:**
      - Bạn PHẢI tạo ra số lượng câu hỏi chính xác cho mỗi loại, mỗi cấp độ, và **đúng cho từng Chủ đề/Bài học** như đã nêu trong phần **Cấu trúc đề thi chi tiết**.
      - Với mỗi câu hỏi được tạo, bạn PHẢI điền chính xác thông tin "chapter", "topic", và "level" trong đối tượng JSON.
      - Thông tin "topic" phải khớp chính xác với chủ đề mà câu hỏi đó được yêu cầu tạo.
      - Thông tin "level" phải khớp chính xác với yêu cầu trong **Cấu trúc đề thi chi tiết** cho câu hỏi đó.

      **QUAN TRỌG VỀ ĐỊNH DẠNG TOÁN HỌC (NẾU LÀ MÔN TOÁN):**
      - BẮT BUỘC sử dụng cú pháp LaTeX cho TẤT CẢ các công thức toán học, kí hiệu, và các hình vẽ (ví dụ: bảng biến thiên, đồ thị, hình học không gian).
      - Dùng $...$ cho công thức toán học inline (nằm trong dòng văn bản). Ví dụ: Cho hàm số $y = x^3 - 3x + 1$.
      - Dùng $$...$$ cho các công thức, phương trình, hoặc hình vẽ cần hiển thị trên một dòng riêng biệt. Ví dụ:
      $$
      \\begin{array}{c|ccccccc}
      x & -\\infty & & 0 & & 2 & & +\\infty \\\\
      \\hline
      f'(x) & & + & 0 & - & 0 & + & \\\\
      \\hline
      & & & 2 & & & & +\\infty \\\\
      f(x) & & \\nearrow & & \\searrow & & \\nearrow & \\\\
      & -\\infty & & & & -2 & &
      \\end{array}
      $$

      **Yêu cầu đầu ra:**
      - Tạo một JSON object chứa một key là "questions".
      - "questions" là một mảng các object, mỗi object đại diện cho một câu hỏi.
      - Mỗi câu hỏi phải có trường "question_type".
      - Mỗi câu hỏi phải có các trường "chapter", "topic", và "level". "chapter" là tên chương, "topic" là tên bài học cụ thể mà câu hỏi đó thuộc về, và "level" phải là một trong các giá trị: 'Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao', tương ứng với yêu cầu.
      - Nếu loại câu hỏi là "Trắc nghiệm", hãy đặt "question_type" là "multiple_choice". Câu hỏi phải có "question_text", một mảng "options" chứa chính xác 4 lựa chọn, và "correct_answer_index" (chỉ số của đáp án đúng, từ 0 đến 3).
      - Nếu loại câu hỏi là "Đúng/Sai", hãy đặt "question_type" là "true_false". Câu hỏi phải có "question_text" (là câu dẫn chung) và một mảng "statements" chứa chính xác 4 mệnh đề. Mỗi phần tử trong "statements" là một object có trường "text" (nội dung mệnh đề) và "is_true" (giá trị boolean).
      - Nếu loại câu hỏi là "Trả lời ngắn", hãy đặt "question_type" là "short_answer". Câu hỏi phải có "question_text" và một "suggested_answer" (đáp án gợi ý).
      - Nếu loại câu hỏi là "Tự luận", hãy đặt "question_type" là "essay". Câu hỏi phải có "question_text" và một "suggested_answer" (đáp án gợi ý hoặc dàn ý).
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
            Hãy tạo một đề kiểm tra chi tiết dựa trên MA TRẬN ĐỀ THI được cung cấp dưới đây. Ma trận có thể ở dạng danh sách mô tả chi tiết, hoặc ở dạng bảng.
            Kết quả phải là một chuỗi JSON hợp lệ theo cấu trúc đã định nghĩa.

            **MA TRẬN ĐỀ THI:**
            ---
            ${matrixText}
            ---

            ${supplementaryContent ? `**TÀI LIỆU THAM KHẢO (Sử dụng nội dung từ tài liệu này để tạo câu hỏi cho phù hợp):**\n${supplementaryContent}` : ''}

            **QUAN TRỌNG VỀ ĐỊNH DẠNG TOÁN HỌC (NẾU LÀ MÔN TOÁN):**
            - BẮT BUỘC sử dụng cú pháp LaTeX cho TẤT CẢ các công thức toán học, kí hiệu, và các hình vẽ (ví dụ: bảng biến thiên, đồ thị, hình học không gian).
            - Dùng $...$ cho công thức toán học inline (nằm trong dòng văn bản). Ví dụ: Cho hàm số $y = x^3 - 3x + 1$.
            - Dùng $$...$$ cho các công thức, phương trình, hoặc hình vẽ cần hiển thị trên một dòng riêng biệt.

            **YÊU CẦU CỤ THỂ KHI XỬ LÝ MA TRẬN:**

            1.  **Nếu ma trận là dạng danh sách mô tả (ví dụ: ma trận môn Toán):**
                *   Dựa vào TỪNG DÒNG mô tả câu hỏi (ví dụ: 'Câu 1. [NB] Đổi số đo góc.') để tạo ra MỘT câu hỏi tương ứng.
                *   Mức độ câu hỏi (NB: Nhận biết, TH: Thông hiểu, VD: Vận dụng, VDC: Vận dụng cao) phải được xác định từ kí hiệu trong ngoặc vuông và điền vào trường "level" trong JSON.
                *   Tôn trọng DẠNG CÂU HỎI được nêu trong tiêu đề các phần của ma trận (ví dụ: PHẦN I. TRẮC NGHIỆM KHÁCH QUAN, PHẦN II. TỰ LUẬN, v.v.).

            2.  **Nếu ma trận là dạng bảng (ví dụ: ma trận môn GDCD):**
                *   Mỗi hàng trong bảng tương ứng với một "Nội dung/Đơn vị kiến thức".
                *   Các cột dưới "Mức độ nhận thức" chỉ định SỐ LƯỢỢNG câu hỏi cần tạo.
                *   Các loại câu hỏi là: TNKQ (Trắc nghiệm khách quan), Đúng-Sai, Trả lời ngắn, Tự luận.
                *   Các mức độ là: Nhận (Nhận biết), Thông (Thông hiểu), Vận (Vận dụng), Vận.C (Vận dụng cao).
                *   Với mỗi ô trong bảng có chứa một con số N > 0, bạn PHẢI tạo ra chính xác N câu hỏi thuộc loại câu hỏi và mức độ tương ứng của cột đó, cho chủ đề ở hàng đó. Ví dụ: Nếu hàng "Bài 14" có số 5 ở cột "TNKQ - Nhận biết", bạn phải tạo đúng 5 câu hỏi Trắc nghiệm, mức độ Nhận biết cho bài đó.

            3.  **Yêu cầu chung cho cả hai dạng:**
                *   Bạn PHẢI trích xuất và đưa thông tin "Chương/Chủ đề" và "Nội dung/Đơn vị kiến thức" từ ma trận vào các trường "chapter" và "topic" tương ứng trong JSON.
                *   Tổng số lượng câu hỏi tạo ra phải khớp chính xác với tổng số lượng yêu cầu trong ma trận.

            **QUY TẮC CHUYỂN ĐỔI SANG JSON:**
            - "TRẮC NGHIỆM KHÁCH QUAN" hoặc "TNKQ": Chuyển thành các câu hỏi có "question_type" là "multiple_choice". Mỗi câu phải có "question_text", mảng "options" (4 lựa chọn), và "correct_answer_index".
            - "TRẮC NGHIỆM ĐÚNG/SAI" hoặc "Đúng-Sai": Chuyển thành các câu hỏi có "question_type" là "true_false". Mỗi câu hỏi phải có "question_text" (là câu dẫn chung) và một mảng "statements" (4 mệnh đề), mỗi mệnh đề có "text" và "is_true".
            - "TRẢ LỜI NGẮN": Chuyển thành các câu hỏi có "question_type" là "short_answer". Mỗi câu hỏi phải có "question_text" và một "suggested_answer" (đáp án gợi ý).
            - "TỰ LUẬN": Chuyển thành các câu hỏi có "question_type" là "essay". Mỗi câu hỏi phải có "question_text" và một "suggested_answer" (đáp án gợi ý hoặc dàn ý chi tiết).
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

        const prompt = `Bạn là một chuyên gia OCR và trích xuất dữ liệu chính xác. Nhiệm vụ của bạn là trích xuất toàn bộ văn bản từ tài liệu này, đây là một MA TRẬN ĐỀ THI. Hãy tái tạo lại cấu trúc của ma trận một cách chính xác tuyệt đối.

**YÊU CẦU QUAN TRỌNG:**
1.  **Nếu ma trận ở dạng bảng:**
    *   Hãy tái tạo lại cấu trúc bảng bằng định dạng Markdown.
    *   Đảm bảo giữ nguyên tất cả các hàng (Nội dung/Đơn vị kiến thức) và các cột (Mức độ nhận thức, Loại câu hỏi).
    *   Tất cả các con số trong các ô phải được giữ lại chính xác.
    *   Ví dụ một hàng trong bảng Markdown có thể trông như sau: \`| Bài 1: Mệnh đề | 2 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 4 |\`
2.  **Nếu ma trận ở dạng danh sách (liệt kê các câu hỏi):**
    *   Hãy giữ nguyên cấu trúc danh sách, bao gồm các số thứ tự câu, các kí hiệu mức độ như \`[NB]\`, \`[TH]\`, \`[VD]\`, và toàn bộ nội dung mô tả của từng câu.
    *   Ví dụ: \`Câu 1. [NB] Đổi số đo góc.\`
3.  **Yêu cầu chung:**
    *   Giữ nguyên tất cả văn bản, kí hiệu, và định dạng gốc nhiều nhất có thể.
    *   Chỉ trả về văn bản đã được định dạng, tuyệt đối không thêm bất kỳ lời giải thích, bình luận hay văn bản giới thiệu nào.`;

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

export const extractTextFromImage = async (imageBase64: string, mimeType: string, apiKey: string): Promise<string> => {
    if (!apiKey) {
        throw new Error("API Key is not configured. Please set your API key in the System Configuration.");
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `Bạn là một chuyên gia OCR và trích xuất dữ liệu chính xác. Nhiệm vụ của bạn là trích xuất toàn bộ văn bản từ tài liệu này, đây là một MA TRẬN ĐỀ THI. Hãy tái tạo lại cấu trúc của ma trận một cách chính xác tuyệt đối.

**YÊU CẦU QUAN TRỌNG:**
1.  **Nếu ma trận ở dạng bảng:**
    *   Hãy tái tạo lại cấu trúc bảng bằng định dạng Markdown.
    *   Đảm bảo giữ nguyên tất cả các hàng (Nội dung/Đơn vị kiến thức) và các cột (Mức độ nhận thức, Loại câu hỏi).
    *   Tất cả các con số trong các ô phải được giữ lại chính xác.
    *   Ví dụ một hàng trong bảng Markdown có thể trông như sau: \`| Bài 1: Mệnh đề | 2 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 4 |\`
2.  **Nếu ma trận ở dạng danh sách (liệt kê các câu hỏi):**
    *   Hãy giữ nguyên cấu trúc danh sách, bao gồm các số thứ tự câu, các kí hiệu mức độ như \`[NB]\`, \`[TH]\`, \`[VD]\`, và toàn bộ nội dung mô tả của từng câu.
    *   Ví dụ: \`Câu 1. [NB] Đổi số đo góc.\`
3.  **Yêu cầu chung:**
    *   Giữ nguyên tất cả văn bản, kí hiệu, và định dạng gốc nhiều nhất có thể.
    *   Chỉ trả về văn bản đã được định dạng, tuyệt đối không thêm bất kỳ lời giải thích, bình luận hay văn bản giới thiệu nào.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: imageBase64,
                        },
                    },
                ],
            },
        });
        
        return response.text;
    } catch (error) {
        console.error("Error extracting text from image with AI:", error);
        throw new Error("Đã xảy ra lỗi khi AI xử lý tệp ảnh. Vui lòng kiểm tra lại API key và định dạng tệp.");
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
        } else if ((question.question_type === 'short_answer' || question.question_type === 'essay') && question.suggested_answer) {
            questionContent += `Đáp án gợi ý: ${question.suggested_answer}`;
        }


        const prompt = `
            Bạn là một trợ lý AI chuyên môn cho giáo viên Việt Nam. 
            Hãy giải thích đáp án cho câu hỏi sau một cách ngắn gọn, rõ ràng và dễ hiểu. 
            - Nếu câu hỏi có công thức toán, hãy dùng cú pháp LaTeX ($...$ hoặc $$...$$) để hiển thị.
            - Đối với câu trắc nghiệm, hãy giải thích tại sao đáp án đúng là chính xác và tại sao các đáp án còn lại là sai.
            - Đối với câu Đúng/Sai, hãy giải thích ngắn gọn cho từng mệnh đề.
            - Đối với câu Trả lời ngắn/Tự luận, hãy giải thích và làm rõ hơn đáp án gợi ý, cung cấp thêm thông tin liên quan nếu cần.
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
            - Giữ nguyên loại câu hỏi ('question_type'), chương ('chapter'), chủ đề ('topic'), và độ khó ('level').
            - Diễn đạt lại câu hỏi và các lựa chọn/mệnh đề/đáp án gợi ý bằng từ ngữ khác.
            - Giữ nguyên logic của câu trả lời đúng.
            - **ĐỊNH DẠNG TOÁN HỌC:** BẮT BUỘC sử dụng cú pháp LaTeX ($...$ và $$...$$) cho tất cả các công thức và kí hiệu toán học.
            - **YÊU CẦU CẤU TRÚC JSON BẮT BUỘC:** Trả về kết quả dưới dạng một object JSON duy nhất, tuân thủ nghiêm ngặt cấu trúc đã cho.
              - Với 'multiple_choice', mảng 'options' PHẢI có chính xác 4 phần tử.
              - Với 'true_false', mảng 'statements' PHẢI có chính xác 4 phần tử.
              - Với 'short_answer' hoặc 'essay', PHẢI có trường 'suggested_answer'.
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

export const convertQuestionType = async (question: ParsedQuestion, newType: string, apiKey: string): Promise<ParsedQuestion> => {
    if (!apiKey) {
        throw new Error("API Key is not configured.");
    }

    const questionTypeMap: { [key: string]: string } = {
      'Trắc nghiệm': 'multiple_choice',
      'Đúng/Sai': 'true_false',
      'Trả lời ngắn': 'short_answer',
      'Tự luận': 'essay',
    };
    const newQuestionTypeInternal = questionTypeMap[newType] || 'multiple_choice';

    try {
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
            Bạn là một trợ lý AI chuyên tạo đề thi cho giáo viên Việt Nam.
            Dựa trên câu hỏi JSON sau đây, hãy chuyển đổi nó sang một dạng câu hỏi MỚI.
            - **YÊU CẦU QUAN TRỌNG:** Giữ nguyên nội dung cốt lõi, ý nghĩa, chương ('chapter'), chủ đề ('topic'), và độ khó ('level') của câu hỏi gốc.
            - **Dạng câu hỏi mới mong muốn:** "${newType}" (tương ứng với question_type: "${newQuestionTypeInternal}").
            - **ĐỊNH DẠNG TOÁN HỌC:** BẮT BUỘC sử dụng cú pháp LaTeX ($...$ và $$...$$) cho tất cả các công thức và kí hiệu toán học.
            - **YÊU CẦU CẤU TRÚC JSON BẮT BUỘC:** Trả về kết quả dưới dạng một object JSON duy nhất, tuân thủ nghiêm ngặt cấu trúc đã cho.
              - Nếu dạng mới là 'multiple_choice', mảng 'options' PHẢI có chính xác 4 phần tử.
              - Nếu dạng mới là 'true_false', mảng 'statements' PHẢI có chính xác 4 mệnh đề.
              - Nếu dạng mới là 'short_answer' hoặc 'essay', PHẢI có trường 'suggested_answer'.
            - Đảm bảo câu trả lời đúng của câu hỏi mới phải nhất quán về mặt logic với câu trả lời đúng của câu hỏi gốc.
            - Không bao bọc JSON trong một mảng hay một key "questions". Chỉ trả về object câu hỏi duy nhất.

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
        
        if (generatedQuestion.question_type !== newQuestionTypeInternal) {
            console.warn(`AI returned a different type. Requested: ${newQuestionTypeInternal}, Got: ${generatedQuestion.question_type}. Forcing type.`);
            generatedQuestion.question_type = newQuestionTypeInternal as any;
        }

        return { ...generatedQuestion, id: `gq_converted_${Date.now()}` };

    } catch (error) {
        console.error("Error converting question type:", error);
        throw new Error("AI không thể đổi dạng câu hỏi. Vui lòng thử lại.");
    }
};