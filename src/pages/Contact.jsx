import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLang } from '../context/LangContext';
import { Send, RefreshCw, MapPin, Phone, Mail, Calculator, Lock } from 'lucide-react';

export default function Contact() {
  const { t, lang } = useLang(); 
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '', captchaInput: '' });
  const [settings, setSettings] = useState({}); 
  const [mathProblem, setMathProblem] = useState({ a: 0, b: 0, result: 0 });
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
      // 1. Lấy thông tin cấu hình
      supabase.from('site_settings').select('*').eq('is_public', true)
        .then(({ data }) => {
            const conf = {}; data?.forEach(i => conf[i.key] = i.value);
            setSettings(conf);
        });
      
      // 2. Tạo Math Captcha
      generateMathCaptcha();

      // 3. KIỂM TRA ĐĂNG NHẬP & AUTO-FILL
      const checkUser = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
              setIsLoggedIn(true);
              setFormData(prev => ({
                  ...prev,
                  email: user.email, // Tự điền email
                  name: user.user_metadata?.full_name || prev.name // Tự điền tên nếu có
              }));
          }
      };
      checkUser();
  }, []);

  const generateMathCaptcha = () => {
    const a = Math.floor(Math.random() * 10) + 1; 
    const b = Math.floor(Math.random() * 10) + 1;
    setMathProblem({ a, b, result: a + b });
    setFormData(prev => ({ ...prev, captchaInput: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (parseInt(formData.captchaInput) !== mathProblem.result) {
        return alert(t("Kết quả phép tính sai!", "Incorrect answer!"));
    }

    setLoading(true);
    try {
        const { data, error } = await supabase.functions.invoke('contact-handler', {
            body: { 
                name: formData.name, 
                email: formData.email, 
                phone: formData.phone, 
                message: formData.message 
            }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        alert(t("Gửi thành công! Chúng tôi sẽ liên hệ sớm.", "Sent successfully! We will contact you soon."));
        
        // Nếu đã đăng nhập thì giữ lại tên/email, chỉ xóa nội dung
        if (isLoggedIn) {
            setFormData(prev => ({ ...prev, message: '', phone: '', captchaInput: '' }));
        } else {
            setFormData({ name: '', email: '', phone: '', message: '', captchaInput: '' });
        }
        generateMathCaptcha();
    } catch (err) {
        alert(t("Lỗi gửi tin: ", "Error sending: ") + err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-lg overflow-hidden md:flex my-10 border border-gray-100">
        {/* === CỘT TRÁI === */}
        <div className="bg-blue-600 text-white p-8 md:w-1/3 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500 rounded-full opacity-50 blur-2xl pointer-events-none"></div>
            
            <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
                    <Mail className="opacity-80"/> {t('Liên hệ', 'Contact Us')}
                </h2>
                
                <div className="space-y-6 text-sm">
                    <div className="flex gap-4 items-start group">
                        <div className="p-2 bg-blue-500 rounded-xl group-hover:bg-blue-400 transition"><MapPin size={18} className="text-white"/></div>
                        <div>
                            <p className="opacity-70 text-xs uppercase font-bold mb-1">{t('Địa chỉ', 'Address')}</p>
                            <p className="font-medium leading-relaxed">{settings.contact_address || 'Hà Nội, Việt Nam'}</p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-center group">
                        <div className="p-2 bg-blue-500 rounded-xl group-hover:bg-blue-400 transition"><Send size={18} className="text-white"/></div>
                        <div>
                            <p className="opacity-70 text-xs uppercase font-bold mb-1">Telegram</p>
                            <a href={`https://t.me/${settings.contact_telegram?.replace('@','')}`} target="_blank" rel="noreferrer" className="font-medium hover:text-blue-100 transition">
                                {settings.contact_telegram || '@support'}
                            </a>
                        </div>
                    </div>

                    <div className="flex gap-4 items-center group">
                        <div className="p-2 bg-blue-500 rounded-xl group-hover:bg-blue-400 transition"><Phone size={18} className="text-white"/></div>
                        <div>
                            <p className="opacity-70 text-xs uppercase font-bold mb-1">{t('Hotline', 'Phone')}</p>
                            <a href={`tel:${settings.contact_phone}`} className="font-medium hover:text-blue-100 transition">{settings.contact_phone || '0988.888.888'}</a>
                        </div>
                    </div>

                    <div className="flex gap-4 items-center group">
                        <div className="p-2 bg-blue-500 rounded-xl group-hover:bg-blue-400 transition"><Mail size={18} className="text-white"/></div>
                        <div>
                            <p className="opacity-70 text-xs uppercase font-bold mb-1">Email</p>
                            <a href={`mailto:${settings.contact_email}`} className="font-medium hover:text-blue-100 transition">{settings.contact_email || 'support@anvu.vn'}</a>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-10 pt-6 border-t border-blue-500 text-xs text-blue-100 text-center relative z-10">
                <p>{t('Hỗ trợ 24/7 qua Telegram', '24/7 Support via Telegram')}</p>
            </div>
        </div>

        {/* === CỘT PHẢI === */}
        <div className="p-8 md:w-2/3">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">{t('Gửi yêu cầu hỗ trợ', 'Send Request')}</h2>
            <p className="text-slate-500 text-sm mb-6">{t('Vui lòng điền thông tin bên dưới, chúng tôi sẽ phản hồi sớm nhất.', 'Please fill out the form below, we will reply shortly.')}</p>
            
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t('Họ và tên', 'Full Name')}</label>
                        <input required className="w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50 focus:bg-white" 
                            placeholder={t("Nhập tên của bạn...", "Enter your name...")} 
                            value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})}/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t('Số điện thoại', 'Phone Number')}</label>
                        <input required className="w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-slate-50 focus:bg-white" 
                            placeholder={t("Nhập số điện thoại...", "Enter phone number...")} 
                            value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})}/>
                    </div>
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Email</label>
                    <div className="relative">
                        <input type="email" required 
                            className={`w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${isLoggedIn ? 'bg-gray-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50 focus:bg-white'}`}
                            placeholder="example@gmail.com" 
                            value={formData.email} 
                            onChange={e=>!isLoggedIn && setFormData({...formData, email: e.target.value})}
                            readOnly={isLoggedIn} 
                        />
                        {isLoggedIn && <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />}
                    </div>
                    {/* --- ĐÃ SỬA TEXT SONG NGỮ --- */}
                    {isLoggedIn && <p className="text-[10px] text-blue-600 mt-1 italic">
                        {t(
                            "Vì tài khoản đăng nhập sử dụng địa chỉ email là duy nhất, nếu muốn thay đổi email, vui lòng tạo tài khoản mới.",
                            "Since the login account uses a unique email address, if you want to change the email, please create a new account."
                        )}
                    </p>}
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t('Nội dung', 'Message')}</label>
                    <textarea required className="w-full border border-gray-200 p-3 rounded-xl h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none bg-slate-50 focus:bg-white" 
                        placeholder={t("Bạn cần hỗ trợ vấn đề gì?", "How can we help you?")} 
                        value={formData.message} onChange={e=>setFormData({...formData, message: e.target.value})}></textarea>
                </div>
                
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3 font-bold text-blue-700 bg-white px-4 py-2 rounded-lg border shadow-sm select-none">
                        <Calculator size={20} className="text-blue-600"/> 
                        <span className="text-lg tracking-wide">{mathProblem.a} + {mathProblem.b} = ?</span>
                    </div>
                    <button type="button" onClick={generateMathCaptcha} className="p-2 text-gray-400 hover:text-blue-600 bg-white rounded-full border hover:border-blue-400 transition" title={t('Đổi câu hỏi', 'Refresh')}>
                        <RefreshCw size={18}/>
                    </button>
                    <input required type="number" className="border border-gray-300 p-2 rounded-lg w-32 text-center font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder={t('Kết quả', 'Result')} 
                        value={formData.captchaInput} onChange={e=>setFormData({...formData, captchaInput: e.target.value})}/>
                </div>

                <button disabled={loading} className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex justify-center items-center gap-2 transform active:scale-[0.99]">
                    {loading ? t('Đang gửi...', 'Sending...') : <><Send size={18}/> {t('Gửi Yêu Cầu', 'Send Message')}</>}
                </button>
            </form>
        </div>
    </div>
  );
}
