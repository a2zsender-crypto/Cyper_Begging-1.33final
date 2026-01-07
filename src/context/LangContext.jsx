import { createContext, useContext, useState, useEffect } from 'react';

const LangContext = createContext();

export const LangProvider = ({ children }) => {
  // [ĐÃ SỬA] Thiết lập mặc định là 'en' (Tiếng Anh)
  // Logic: Khi vào web, kiểm tra xem trước đó khách có chọn ngôn ngữ nào chưa (trong localStorage).
  // Nếu chưa (khách mới) -> Lấy 'en'.
  const [lang, setLang] = useState(() => {
    const savedLang = localStorage.getItem('site_lang');
    return savedLang ? savedLang : 'en'; 
  });

  // Khi lang thay đổi, lưu lại vào bộ nhớ trình duyệt để lần sau vào không bị mất
  useEffect(() => {
    localStorage.setItem('site_lang', lang);
  }, [lang]);

  // Hàm hỗ trợ dịch nhanh: t('Tiếng Việt', 'English')
  // Nếu đang là tiếng Việt thì hiện tham số đầu, ngược lại hiện tham số sau
  const t = (vi, en) => {
    if (lang === 'vi') return vi;
    return en || vi; // Nếu không có tiếng Anh thì fallback về tiếng Việt
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => useContext(LangContext);
