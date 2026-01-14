import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useTranslation } from 'react-i18next'; // Giữ nguyên thư viện gốc
import { Link } from 'react-router-dom';

const Contact = () => {
  const { t, i18n } = useTranslation(); // Giữ nguyên hook gốc
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    captchaInput: ''
  });
  const [loading, setLoading] = useState(false);
  const [mathProblem, setMathProblem] = useState({ text: '', result: 0 });
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // ... (Giữ nguyên logic Captcha và useEffect) ...
  const generateMathCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    setMathProblem({ text: `${num1} + ${num2} = ?`, result: num1 + num2 });
  };

  useEffect(() => {
    generateMathCaptcha();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setFormData(prev => ({
          ...prev,
          name: session.user.user_metadata?.full_name || '',
          email: session.user.email || ''
        }));
        fetchHistory(session.user.id);
        setShowHistory(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
         fetchHistory(session.user.id);
         setShowHistory(true);
      } else {
         setHistory([]);
         setShowHistory(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchHistory = async (userId) => {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error && data) setHistory(data);
  };

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (parseInt(formData.captchaInput) !== mathProblem.result) {
        return alert(t("Kết quả phép tính sai!", "Incorrect captcha answer!"));
    }

    setLoading(true);
    try {
        // [QUAN TRỌNG] Chỉ thêm dòng language vào đây
        const { data, error } = await supabase.functions.invoke('contact-handler', {
            body: { 
                name: formData.name, 
                email: formData.email, 
                phone: formData.phone, 
                message: formData.message,
                user_id: session?.user?.id || null,
                language: i18n.language // Lấy ngôn ngữ hiện tại của user (ví dụ: 'en', 'vi')
            }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        alert(t("Gửi thành công! Chúng tôi sẽ liên hệ sớm.", "Sent successfully! We will contact you soon."));
        
        if (session) {
            setFormData(prev => ({ ...prev, message: '', phone: '', captchaInput: '' }));
            fetchHistory(session.user.id);
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

  // ... (Giữ nguyên phần return JSX bên dưới không thay đổi 1 byte nào) ...
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center text-blue-600 uppercase">
        {t("Liên hệ & Hỗ trợ", "Contact & Support")}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 shadow rounded-lg">
          <h2 className="text-xl font-semibold mb-4">{t("Gửi yêu cầu", "Submit Request")}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700">{t("Họ tên", "Full Name")}</label>
              <input type="text" name="name" required 
                value={formData.name} onChange={handleChange}
                className="w-full border p-2 rounded focus:ring focus:ring-blue-200" />
            </div>
            
            <div>
              <label className="block text-gray-700">Email</label>
              <input type="email" name="email" required 
                value={formData.email} onChange={handleChange}
                disabled={!!session}
                className="w-full border p-2 rounded focus:ring focus:ring-blue-200 disabled:bg-gray-100" />
            </div>

            <div>
              <label className="block text-gray-700">{t("Số điện thoại", "Phone Number")}</label>
              <input type="tel" name="phone" required 
                value={formData.phone} onChange={handleChange}
                className="w-full border p-2 rounded focus:ring focus:ring-blue-200" />
            </div>

            <div>
              <label className="block text-gray-700">{t("Nội dung cần hỗ trợ", "Message")}</label>
              <textarea name="message" required rows="4"
                value={formData.message} onChange={handleChange}
                className="w-full border p-2 rounded focus:ring focus:ring-blue-200"></textarea>
            </div>

            <div>
               <label className="block text-gray-700 font-medium">
                 {t("Phép tính xác thực", "Security Question")}: {mathProblem.text}
               </label>
               <input type="number" name="captchaInput" required
                 value={formData.captchaInput} onChange={handleChange}
                 className="w-full border p-2 rounded focus:ring focus:ring-blue-200" 
                 placeholder="?" />
            </div>

            <button type="submit" disabled={loading}
              className={`w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {loading ? t("Đang gửi...", "Sending...") : t("Gửi yêu cầu", "Submit")}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
            <h2 className="text-lg font-bold text-blue-800 mb-2">{t("Thông tin liên hệ", "Contact Info")}</h2>
            <ul className="space-y-2 text-gray-700">
              <li>📍 <b>Address:</b> 123 Street, Hanoi, Vietnam</li>
              <li>📧 <b>Email:</b> support@autoshop.pro</li>
              <li>📞 <b>Hotline:</b> 0901.234.567</li>
              <li>⏰ <b>Work time:</b> 8:00 - 22:00 (Daily)</li>
            </ul>
          </div>

          {showHistory && (
             <div className="bg-white p-6 shadow rounded-lg">
                <h2 className="text-xl font-semibold mb-4">{t("Lịch sử hỗ trợ của bạn", "Your Support History")}</h2>
                {history.length === 0 ? (
                    <p className="text-gray-500">{t("Bạn chưa gửi yêu cầu nào.", "No requests found.")}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm text-left">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="py-2 px-3 border-b text-center w-12">#ID</th>
                                    <th className="py-2 px-3 border-b">{t("Ngày", "Date")}</th>
                                    <th className="py-2 px-3 border-b">{t("Nội dung", "Message")}</th>
                                    <th className="py-2 px-3 border-b">{t("Trạng thái", "Status")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((item) => (
                                    <tr key={item.id} className="border-b hover:bg-gray-50">
                                        <td className="py-2 px-3 text-center font-bold text-gray-600">
                                            #{item.id}
                                        </td>
                                        <td className="py-2 px-3">
                                            {new Date(item.created_at).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="py-2 px-3">
                                            <div className="truncate w-32" title={item.message}>{item.message}</div>
                                            {(item.status === 'replied' || item.status === 'processed') ? (
                                                <Link to={`/contact?ticketId=${item.id}`} className="text-xs text-blue-600 hover:underline block mt-1">
                                                    {t("Xem trả lời", "View Reply")}
                                                </Link>
                                            ) : null}
                                        </td>
                                        <td className="py-2 px-3">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold
                                                ${item.status === 'new' ? 'bg-yellow-100 text-yellow-800' : 
                                                  item.status === 'replied' || item.status === 'processed' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                                                {item.status === 'new' ? t("Đang chờ", "Pending") : 
                                                 item.status === 'processed' ? t("Đã xử lý", "Replied") : item.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Contact;
