import { createContext, useState, useContext, useEffect } from 'react';

const LangContext = createContext();

export function LangProvider({ children }) {
  // 1. Khởi tạo state từ localStorage (nếu có), mặc định là 'vi'
  const [lang, setLang] = useState(() => {
      const savedLang = localStorage.getItem('app_lang');
      return savedLang || 'vi';
  });

  // 2. Mỗi khi lang thay đổi, lưu lại vào localStorage
  useEffect(() => {
      localStorage.setItem('app_lang', lang);
  }, [lang]);

  const t = (vi, en) => {
    return lang === 'vi' ? vi : en;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);