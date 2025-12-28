import { createContext, useContext, useState, useEffect } from 'react';

const LangContext = createContext();

export function LangProvider({ children }) {
  // YÊU CẦU: Mặc định là Tiếng Anh ('en')
  const [lang, setLang] = useState('en'); 

  // Hàm dịch nhanh: t('Xin chào', 'Hello') -> Trả về text tương ứng
  const t = (vi, en) => (lang === 'vi' ? vi : en);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);