import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { MessageSquare, Plus, X, Send } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useQuery } from '@tanstack/react-query';

export default function AdminContacts({ session, role, activeTicketId, onNewTicket }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [showTicketModal, setShowTicketModal] = useState(null);
  const [ticketReplies, setTicketReplies] = useState([]);
  const [replyMessage, setReplyMessage] = useState('');
  const chatEndRef = useRef(null);

  // Lấy tên shop
  const { data: siteSettings = {} } = useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('site_settings').select('*').eq('is_public', true);
      const conf = {}; 
      data?.forEach(i => conf[i.key] = i.value);
      return conf;
    },
    staleTime: 1000 * 60 * 30
  });

  const shopName = siteSettings.site_name || 'Admin';

  useEffect(() => {
    if (session) fetchContacts();
  }, [role, session]);

  // LOGIC MỞ TICKET TỰ ĐỘNG
  useEffect(() => {
      if (activeTicketId && contacts.length > 0) {
          const ticket = contacts.find(c => c.id.toString() === activeTicketId.toString());
          if (ticket && (!showTicketModal || showTicketModal.id !== ticket.id)) {
              openTicketChat(ticket);
          }
      }
  }, [activeTicketId, contacts]);

  // REALTIME & FORCE OPEN LOGIC
  useEffect(() => {
      const handleForceOpen = (e) => {
          const ticketId = e.detail;
          const ticket = contacts.find(c => c.id.toString() === ticketId.toString());
          if (ticket) openTicketChat(ticket);
          else fetchContacts().then(d => {
              const newT = d?.find(c => c.id.toString() === ticketId.toString());
              if(newT) openTicketChat(newT);
          });
      };
      window.addEventListener('FORCE_OPEN_TICKET', handleForceOpen);
      return () => window.removeEventListener('FORCE_OPEN_TICKET', handleForceOpen);
  }, [contacts]);

  // REALTIME DB (Danh sách ticket)
  useEffect(() => {
      if (!session) return;
      const channel = supabase.channel('realtime-contacts')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, payload => {
              if(payload.eventType === 'INSERT') {
                 if (role === 'admin' || (role === 'user' && payload.new.email === session.user.email)) {
                    setContacts(prev => [payload.new, ...prev]);
                    if(role === 'admin') toast.info(t("Có yêu cầu hỗ trợ mới!", "New support request!"));
                 }
              } else if (payload.eventType === 'UPDATE') {
                 setContacts(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
              }
          })
          .subscribe();
      return () => supabase.removeChannel(channel);
  }, [session, role]);

  // REALTIME CHAT (Sửa lại logic ID và check duplicate)
  useEffect(() => {
      if (!showTicketModal) return;
      const channel = supabase.channel(`chat-${showTicketModal.id}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact_replies' }, payload => {
              // Chỉ thêm nếu tin nhắn chưa tồn tại (tránh hiển thị 2 lần do mình đã add tay trước đó)
              if (payload.new.contact_id.toString() === showTicketModal.id.toString()) {
                  setTicketReplies(prev => {
                      if (prev.some(r => r.id === payload.new.id)) return prev;
                      return [...prev, payload.new];
                  });
              }
          })
          .subscribe();
      return () => supabase.removeChannel(channel);
  }, [showTicketModal]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [ticketReplies, showTicketModal]);

  const fetchContacts = async () => {
      let q = supabase.from('contacts').select('*').order('created_at', {ascending: false});
      if (role === 'user' && session?.user?.email) q = q.eq('email', session.user.email);
      const { data } = await q;
      setContacts(data || []);
      return data;
  };

  const openTicketChat = async (ticket) => {
      setShowTicketModal(ticket);
      const { data } = await supabase.from('contact_replies').select('*').eq('contact_id', ticket.id).order('created_at', { ascending: true });
      setTicketReplies(data || []);
      if (role === 'admin' && ticket.status === 'new') {
          await supabase.from('contacts').update({ status: 'processed' }).eq('id', ticket.id);
      }
  };

  // FIX: Hiển thị ngay lập tức khi gửi (Optimistic UI)
  const handleSendReply = async (e) => {
      e.preventDefault();
      if (!replyMessage.trim()) return;
      
      const messageToSend = replyMessage;
      setReplyMessage(''); // Xóa ô nhập liệu ngay cho mượt

      try {
          const { data, error } = await supabase.from('contact_replies').insert({
              contact_id: showTicketModal.id, 
              sender_role: role, 
              message: messageToSend
          }).select().single();

          if (error) throw error;

          // Cập nhật ngay vào danh sách chat (Không chờ Realtime)
          if (data) {
              setTicketReplies(prev => [...prev, data]);
          }
      } catch (err) { 
          toast.error(err.message);
          setReplyMessage(messageToSend); // Hoàn lại tin nhắn nếu lỗi
      }
  };

  const handleNewTicketClick = () => {
      if (onNewTicket) {
          onNewTicket(); 
      } else {
          navigate('/contact');
      }
  };

  return (
    <div className="animate-fade-in h-full flex flex-col">
       <div className="flex justify-between items-center mb-6 shrink-0">
           <h2 className="text-2xl font-bold text-slate-800">
               {role === 'admin' ? t('Yêu cầu hỗ trợ', 'Support Requests') : t('Vé hỗ trợ của tôi', 'My Support Tickets')}
           </h2>
           {role !== 'admin' && (
               <button onClick={handleNewTicketClick} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow font-bold flex items-center gap-2 hover:bg-blue-700 transition">
                   <Plus size={18}/> {t('Tạo Ticket Mới', 'New Ticket')}
               </button>
           )}
       </div>

       <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200 flex-1 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase font-bold tracking-wider sticky top-0">
                <tr>
                    <th className="p-4">{t('Ngày', 'Date')}</th>
                    <th className="p-4">{role==='admin' ? t('Khách hàng', 'Customer') : t('Chủ đề', 'Subject')}</th>
                    <th className="p-4">{t('Trạng thái', 'Status')}</th>
                    <th className="p-4">{t('Hành động', 'Action')}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.length > 0 ? contacts.map(c => (
                <tr key={c.id} className={`hover:bg-slate-50 transition cursor-pointer ${c.status === 'new' ? 'bg-blue-50/30' : ''}`} onClick={() => openTicketChat(c)}>
                    <td className="p-4 text-sm text-slate-500 whitespace-nowrap">{new Date(c.created_at).toLocaleString()}</td>
                    <td className="p-4">
                        {role === 'admin' ? (
                            <div><span className="font-bold text-slate-700">{c.name}</span><div className="text-xs text-slate-400">{c.email}</div></div>
                        ) : (
                            <div className="font-medium text-slate-700 truncate max-w-xs">{c.message}</div>
                        )}
                    </td>
                    <td className="p-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${c.status==='new'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>
                            {c.status === 'new' ? t('Chưa đọc', 'Unread') : t('Đã xem', 'Read')}
                        </span>
                    </td>
                    <td className="p-4"><button className="text-blue-600 bg-blue-50 p-2 rounded-lg hover:bg-blue-100 transition"><MessageSquare size={18}/></button></td>
                </tr>
              )) : (
                  <tr><td colSpan="4" className="p-8 text-center text-slate-400">{t('Chưa có yêu cầu hỗ trợ nào.', 'No support tickets found.')}</td></tr>
              )}
            </tbody>
          </table>
       </div>

       {/* CHAT MODAL */}
       {showTicketModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999] p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden animate-scale-in">
                  <div className="p-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
                      <div><h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><MessageSquare size={18} className="text-blue-600"/> Ticket #{showTicketModal.id}</h3><p className="text-xs text-slate-500">{new Date(showTicketModal.created_at).toLocaleString()}</p></div>
                      <button onClick={() => setShowTicketModal(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition"><X size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                      <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`p-3 rounded-2xl max-w-[85%] shadow-sm text-sm leading-relaxed ${role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none text-slate-800'}`}>
                             <p className="text-[10px] font-bold opacity-70 mb-1 uppercase">{role === 'user' ? t('Bạn', 'You') : showTicketModal.name}</p>
                             <p className="whitespace-pre-wrap">{showTicketModal.message}</p>
                          </div>
                      </div>

                      {ticketReplies.map(r => {
                          const isMe = (role === 'admin' && r.sender_role === 'admin') || (role === 'user' && r.sender_role === 'user');
                          const displayName = r.sender_role === 'admin' ? shopName : (role === 'admin' ? showTicketModal.name : t('Bạn', 'You'));

                          return (
                              <div key={r.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`p-3 rounded-2xl max-w-[85%] shadow-sm text-sm leading-relaxed ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none text-slate-800'}`}>
                                      {!isMe && <p className="text-[10px] font-bold opacity-70 mb-1 uppercase">{displayName}</p>}
                                      <p className="whitespace-pre-wrap">{r.message}</p>
                                      <p className={`text-[10px] mt-1 text-right ${isMe?'text-blue-200':'text-slate-400'}`}>{new Date(r.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                  </div>
                              </div>
                          );
                      })}
                      <div ref={chatEndRef} />
                  </div>
                  
                  <form onSubmit={handleSendReply} className="p-4 bg-white border-t flex gap-3 shrink-0">
                      <input className="flex-1 border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition" placeholder={t("Nhập tin nhắn...", "Type a message...")} value={replyMessage} onChange={e => setReplyMessage(e.target.value)}/>
                      <button type="submit" disabled={!replyMessage.trim()} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"><Send size={20}/></button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
