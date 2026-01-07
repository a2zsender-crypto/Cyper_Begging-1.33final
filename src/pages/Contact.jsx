import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLang } from '../context/LangContext';
import { Mail, Phone, MapPin, Send, MessageSquare } from 'lucide-react';
import { toast } from 'react-toastify';
import AdminContacts from '../components/admin/AdminContacts';
import { useSearchParams } from 'react-router-dom';

export default function Contact() {
  const { t } = useLang();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  // States để kiểm tra session và chuyển view
  const [session, setSession] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [searchParams] = useSearchParams();

  // 1. Kiểm tra session
  useEffect(() => {
      supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  }, []);

  // 2. Logic TỰ ĐỘNG chuyển sang Tab Lịch sử nếu URL có ticketId
  useEffect(() => {
      if (searchParams.get('ticketId') && session) {
          setShowHistory(true);
      }
  }, [searchParams, session]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !message) {
        toast.error(t("Vui lòng điền đầy đủ thông tin!", "Please fill in all fields!"));
        return;
    }

    setLoading(true);
    try {
        const { error } = await supabase.from('contacts').insert({
            user_id: session?.user?.id || null,
            name,
            email,
            phone,
            message,
            status: 'new'
        });

        if (error) throw error;
        toast.success(t("Gửi yêu cầu thành công!", "Request sent successfully!"));
        setName(''); setEmail(''); setPhone(''); setMessage('');
        
        // Gửi xong chuyển sang tab lịch sử để xem
        if (session) setShowHistory(true);
    } catch (error) {
        toast.error("Lỗi: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="py-12 bg-slate-50 min-h-[80vh]">
      <div className="container mx-auto px-4">
        
        {/* HEADER & SWITCHER */}
        <div className="text-center max-w-2xl mx-auto mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">{t('Liên hệ & Hỗ trợ', 'Contact & Support')}</h1>
            <p className="text-slate-500 mb-6">{t('Chúng tôi luôn sẵn sàng hỗ trợ bạn 24/7.', 'We are here to help you 24/7.')}</p>
            
            {/* Nút chuyển đổi giữa Form và Lịch sử */}
            {session && (
                <div className="flex justify-center gap-4 bg-white p-1 rounded-xl shadow-sm inline-flex border border-gray-200">
                    <button 
                        onClick={() => setShowHistory(false)}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition ${!showHistory ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        {t('Gửi yêu cầu mới', 'New Request')}
                    </button>
                    <button 
                        onClick={() => setShowHistory(true)}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition ${showHistory ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        {t('Lịch sử hỗ trợ', 'Support History')}
                    </button>
                </div>
            )}
        </div>

        {/* CONTENT AREA */}
        <div className="max-w-5xl mx-auto">
            {showHistory && session ? (
                // VIEW 1: LỊCH SỬ HỖ TRỢ (AdminContacts)
                <AdminContacts session={session} role="user" />
            ) : (
                // VIEW 2: FORM LIÊN HỆ
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="bg-blue-600 text-white p-8 rounded-2xl shadow-xl h-fit">
                        <h3 className="text-xl font-bold mb-6">{t('Thông tin liên hệ', 'Contact Info')}</h3>
                        <div className="space-y-6">
                            <div className="flex items-start gap-4">
                                <MapPin className="opacity-80 mt-1" />
                                <div>
                                    <h4 className="font-bold text-sm opacity-80 uppercase mb-1">{t('Địa chỉ', 'Address')}</h4>
                                    <p className="text-sm">Vietnam</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <Phone className="opacity-80 mt-1" />
                                <div>
                                    <h4 className="font-bold text-sm opacity-80 uppercase mb-1">{t('Điện thoại', 'Phone')}</h4>
                                    <p className="text-sm">+84 000 000 000</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <Mail className="opacity-80 mt-1" />
                                <div>
                                    <h4 className="font-bold text-sm opacity-80 uppercase mb-1">Email</h4>
                                    <p className="text-sm">support@cryptoshop.com</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('Họ tên', 'Full Name')}</label>
                                    <input required type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition" placeholder="John Doe" value={name} onChange={e=>setName(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                                    <input required type="email" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition" placeholder="john@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">{t('Số điện thoại', 'Phone Number')}</label>
                                <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition" placeholder="+84..." value={phone} onChange={e=>setPhone(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">{t('Nội dung', 'Message')}</label>
                                <textarea required rows="4" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition" placeholder={t("Bạn cần hỗ trợ gì...", "How can we help you?")} value={message} onChange={e=>setMessage(e.target.value)}></textarea>
                            </div>
                            <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition flex items-center justify-center gap-2 disabled:opacity-50">
                                {loading ? 'Sending...' : <><Send size={20}/> {t('Gửi yêu cầu', 'Send Message')}</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
