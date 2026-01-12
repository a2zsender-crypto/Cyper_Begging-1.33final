import { useState, useEffect, useRef } from 'react';
import { useLang } from '../context/LangContext';
import { supabase } from '../supabaseClient';
import { Mail, Phone, MapPin, Send, Loader2, MessageSquare, AlertCircle, User } from 'lucide-react';
import { toast } from 'react-toastify';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function Contact() {
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [settings, setSettings] = useState({});
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Chat Ticket State
  const [ticketId, setTicketId] = useState(null);
  const [ticketMessages, setTicketMessages] = useState([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [ticketDetails, setTicketDetails] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
      // 1. Load Settings
      supabase.from('site_settings').select('*').eq('is_public', true)
        .then(({ data }) => {
            const conf = {}; data?.forEach(i => conf[i.key] = i.value);
            setSettings(conf);
        });

      // 2. Check Ticket ID from URL
      const tid = searchParams.get('ticketId');
      if (tid) {
          setTicketId(tid);
          fetchTicketData(tid);
          
          // Realtime Subscription for Chat
          const channel = supabase.channel(`ticket-${tid}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact_replies', filter: `contact_id=eq.${tid}` }, 
          (payload) => {
              setTicketMessages(prev => [...prev, payload.new]);
              scrollToBottom();
          })
          .subscribe();

          return () => supabase.removeChannel(channel);
      }
  }, [searchParams]);

  const fetchTicketData = async (tid) => {
      const { data: ticket } = await supabase.from('contacts').select('*').eq('id', tid).single();
      if (ticket) setTicketDetails(ticket);

      const { data: msgs } = await supabase.from('contact_replies').select('*').eq('contact_id', tid).order('created_at', {ascending: true});
      if (msgs) {
          setTicketMessages(msgs);
          scrollToBottom();
      }
  };

  const scrollToBottom = () => {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
        // [ĐÃ SỬA] Lấy User ID hiện tại để gán stick cho user
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id || null;

        const response = await fetch('https://csxuarismehewgiedoeg.supabase.co/functions/v1/contact-handler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                message: formData.message,
                user_id: currentUserId // Gửi kèm User ID
            })
        });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Failed');

        toast.success(t("Đã gửi liên hệ thành công!", "Contact sent successfully!"));
        setFormData({ name: '', email: '', phone: '', message: '' });
        
        // Nếu đã đăng nhập, reload lại trang hoặc điều hướng để user thấy ticket vừa tạo (nếu có danh sách ticket)
        if (currentUserId) {
            // Tùy chọn: Bạn có thể navigate tới trang quản lý ticket nếu có
            // navigate('/account/tickets');
        }

    } catch (err) {
        toast.error(err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleSendReply = async () => {
      if (!replyMessage.trim()) return;
      try {
          const { error } = await supabase.from('contact_replies').insert({
              contact_id: ticketId,
              sender_role: 'user',
              message: replyMessage
          });
          if (error) throw error;
          setReplyMessage('');
      } catch (err) { toast.error(err.message); }
  };

  // --- VIEW: CHAT TICKET ---
  if (ticketId && ticketDetails) {
      return (
          <div className="max-w-4xl mx-auto py-12 px-4 animate-fade-in">
              <button onClick={() => navigate('/contact')} className="mb-4 text-slate-500 hover:text-blue-600 text-sm flex items-center gap-1">← {t('Quay lại', 'Back')}</button>
              
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[70vh]">
                  {/* Header */}
                  <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                      <div>
                          <h2 className="font-bold text-slate-800 flex items-center gap-2">
                              Ticket #{ticketId} 
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${ticketDetails.status === 'new' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                  {ticketDetails.status.toUpperCase()}
                              </span>
                          </h2>
                          <p className="text-sm text-slate-500">{ticketDetails.email}</p>
                      </div>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                      {/* Original Message */}
                      <div className="flex justify-end">
                          <div className="bg-blue-600 text-white p-3 rounded-l-xl rounded-tr-xl max-w-[80%] text-sm shadow-sm">
                              <p className="font-bold text-xs mb-1 opacity-80">{t('Bạn', 'You')}</p>
                              {ticketDetails.message}
                          </div>
                      </div>

                      {/* Replies */}
                      {ticketMessages.map((msg) => (
                          <div key={msg.id} className={`flex ${msg.sender_role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`p-3 max-w-[80%] text-sm shadow-sm ${
                                  msg.sender_role === 'user' 
                                  ? 'bg-blue-600 text-white rounded-l-xl rounded-tr-xl' 
                                  : 'bg-white border border-slate-200 text-slate-700 rounded-r-xl rounded-tl-xl'
                              }`}>
                                  <p className="font-bold text-xs mb-1 opacity-80 uppercase">
                                      {msg.sender_role === 'user' ? t('Bạn', 'You') : 'Support Team'}
                                  </p>
                                  {msg.message}
                                  <p className={`text-[10px] mt-1 text-right ${msg.sender_role==='user'?'text-blue-100':'text-slate-400'}`}>
                                      {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </p>
                              </div>
                          </div>
                      ))}
                      <div ref={chatEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
                      <input 
                          className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={t("Nhập tin nhắn...", "Type a message...")}
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                      />
                      <button onClick={handleSendReply} className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 transition">
                          <Send size={18} />
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // --- VIEW: DEFAULT CONTACT FORM ---
  return (
    <div className="max-w-6xl mx-auto py-12 px-4 md:px-8">
      <div className="grid md:grid-cols-2 gap-12 items-start">
        
        {/* INFO SECTION */}
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-4">{t('Liên hệ với chúng tôi', 'Contact Us')}</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">
            {t('Chúng tôi luôn sẵn sàng lắng nghe và hỗ trợ bạn. Vui lòng điền vào biểu mẫu hoặc liên hệ trực tiếp qua các kênh bên dưới.', 
               'We are always ready to listen and support you. Please fill out the form or contact us directly via the channels below.')}
          </p>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="bg-blue-100 p-3 rounded-lg text-blue-600"><Mail size={24} /></div>
              <div>
                <h3 className="font-bold text-slate-800">Email</h3>
                <p className="text-slate-600">{settings.contact_email || 'support@crypto.com'}</p>
                <p className="text-sm text-slate-400">{t('Phản hồi trong 24h', 'Response within 24h')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-green-100 p-3 rounded-lg text-green-600"><Phone size={24} /></div>
              <div>
                <h3 className="font-bold text-slate-800">Hotline / Zalo</h3>
                <p className="text-slate-600">{settings.contact_phone || '0988.xxx.xxx'}</p>
                <p className="text-sm text-slate-400">{t('8:00 - 22:00 Hàng ngày', '8:00 AM - 10:00 PM Daily')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-indigo-100 p-3 rounded-lg text-indigo-600"><MessageSquare size={24} /></div>
              <div>
                <h3 className="font-bold text-slate-800">Telegram Live Chat</h3>
                <a href={`https://t.me/${settings.contact_telegram?.replace('@','')}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium">
                  {settings.contact_telegram || '@SupportBot'}
                </a>
                <p className="text-sm text-slate-400">{t('Hỗ trợ tức thì', 'Instant Support')}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="bg-orange-100 p-3 rounded-lg text-orange-600"><MapPin size={24} /></div>
              <div>
                <h3 className="font-bold text-slate-800">{t('Địa chỉ', 'Address')}</h3>
                <p className="text-slate-600">{settings.contact_address || 'Vietnam'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* FORM SECTION */}
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{t('Họ và Tên', 'Full Name')}</label>
              <input 
                required
                className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="John Doe"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
                <input 
                  type="email"
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">{t('Số điện thoại', 'Phone Number')}</label>
                <input 
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="0912xxxxxx"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">{t('Nội dung cần hỗ trợ', 'Message')}</label>
              <textarea 
                required
                rows="4"
                className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none"
                placeholder={t("Vui lòng mô tả chi tiết vấn đề của bạn...", "Please describe your issue in detail...")}
                value={formData.message}
                onChange={e => setFormData({...formData, message: e.target.value})}
              ></textarea>
            </div>

            <button 
              disabled={loading}
              className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin"/> : <Send size={20}/>}
              {t('Gửi Yêu Cầu', 'Send Request')}
            </button>
            
            <p className="text-xs text-center text-slate-400 mt-4">
              {t('Bằng việc gửi biểu mẫu này, bạn đồng ý để chúng tôi liên hệ lại qua Email hoặc SĐT.', 'By sending this form, you agree to let us contact you via Email or Phone.')}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
