import React, { useEffect, useRef } from "react";

// Khai báo global để tránh lỗi TypeScript
declare global {
  interface Window {
    MathJax?: any;
  }
}

interface MathTextProps {
  text?: string;
  className?: string;
}

/**
 * ✅ Component hiển thị công thức Toán học (LaTeX) bằng MathJax.
 * - Hỗ trợ nhiều công thức trong cùng một chuỗi.
 * - Tự động render lại khi React cập nhật text.
 * - Không crash nếu dữ liệu null hoặc lỗi cú pháp.
 */
const MathText: React.FC<MathTextProps> = ({ text = "", className }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current && window.MathJax?.typesetPromise) {
      // Gán nội dung text (có thể chứa $...$ hoặc $$...$$)
      ref.current.innerHTML = text;

      // Gọi MathJax render lại vùng này
      window.MathJax.typesetPromise([ref.current]).catch((err: any) => {
        console.error("Lỗi render MathJax:", err);
      });
    }
  }, [text]);

  return <span ref={ref} className={className} />;
};

export default MathText;