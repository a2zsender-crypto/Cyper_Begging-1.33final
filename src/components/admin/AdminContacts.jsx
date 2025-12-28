import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { MessageSquare, Plus, X, Send } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

export default function AdminContacts({ session, role, activeTicketId }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [showTicketModal, setShowTicketModal] = useState(null);
  const [ticketReplies, setTicketReplies] = useState([]);
  const [replyMessage, setReplyMessage] = useState('');
  const chatEndRef = useRef(null);

  // Fetch danh sách khi component load
  useEffect(() => {
    fetchContacts();
  }, [role, session]);

  // LOGIC QUAN TRỌNG: MỞ TICKET NẾU CÓ URL PARAM HOẶC SỰ KIỆN
  useEffect(() => {
      // Chỉ chạy khi danh sách contacts đã có dữ liệu
      if (activeTicketId && contacts.length > 0) {
          // Ép kiểu về string để so sánh chính xác (URL là string, DB là number)
          const ticket = contacts.find(c => c.id.toString() === activeTicketId.toString());
          
          if (ticket) {
              // Nếu đang mở đúng ticket đó rồi thì thôi, chưa thì mở
              if (!showTicketModal || showTicketModal.id.toString() !== activeTicketId.toString()) {
                  openTicketChat(ticket);
              }
          }
      }
  }, [activeTicketId, contacts]); 

  // LẮNG NGHE SỰ KIỆN "FORCE_OPEN_TICKET" (Xử lý khi click thông báo mà URL không đổi)
  useEffect(() => {
      const handleForceOpen = (e) => {
          const ticketId = e.detail;
          const ticket = contacts.find(c => c.id.toString() === ticketId.toString());
          if (ticket) {
              openTicketChat(ticket);
          } else {
              // Nếu chưa có trong list (ví dụ list cũ), fetch lại
              fetchContacts().then((data) => {
                  const newTicket = data?.find(c => c.id.toString() === ticketId.toString());
                  if (newTicket) openTicketChat(newTicket);
              });
          }
      };

      window.addEventListener('FORCE_OPEN_TICKET', handleForceOpen);
      return () => window.removeEventListener('FORCE_OPEN_TICKET', handleForceOpen);
  }, [contacts]);

  // Scroll xuống cuối khi chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [ticketReplies]);

  // REALTIME LIST
  useEffect(() => {
      if (!session) return;
      const channel = supabase.channel('realtime-contacts-list')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contacts' }, 
          (payload) => { setContacts(prev => prev.map(c => c.id === payload.new.id ? payload.new : c)); })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contacts' }, 
          (payload) => {
              if (role === 'admin' || (role === 'user' && payload.new.email === session.user.email)) {
                  setContacts(prev => [payload.new, ...prev]);
                  toast.info("Có tin nhắn hỗ trợ mới!");
              }
          })
          .subscribe();
      return () => supabase.removeChannel(channel);
  }, [session, role]);

  // REALTIME CHAT ROOM
  useEffect(() => {
      if (!showTicketModal) return;
      const channel = supabase.channel(`chat-room-${showTicketModal.id}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact_replies' }, 
          (payload) => {
              if (payload.new.contact_id === showTicketModal.id) {
                  setTicketReplies(prev => [...prev, payload.new]);
              }
          })
          .subscribe();
      return () => supabase.removeChannel(channel);
  }, [showTicketModal]);

  const fetchContacts = async () => {
      let qContacts = supabase.from('contacts').select('*').order('created_at', {ascending: false});
      if (role === 'user' && session?.user?.email) {
          qContacts = qContacts.eq('email', session.user.email);
      }
      const { data } = await qContacts;
      setContacts(data || []);
      return data;
  };

  const openTicketChat = async (ticket) => {
      setShowTicketModal(ticket);
      const { data } = await supabase.from('contact_replies').select('*').eq('contact_id', ticket.id).order('created_at', { ascending: true });
      setTicketReplies(data || []);
      
      // Nếu admin mở -> đánh dấu đã xem
      if (role === 'admin' && ticket.status === 'new') {
          await supabase.from('contacts').update({ status: 'processed' }).eq('id', ticket.id);
      }
  };

  const handleSendReply = async (e) => {
      e.preventDefault();
      if (!replyMessage.trim()) return;
      try {
          const { error } = await supabase.from('contact_replies').insert({
              contact_id: showTicketModal.id,
              sender_role: role, 
              message: replyMessage
          });
          if (error) throw error;
          setReplyMessage('');
      } catch (err) { toast.error("Lỗi: " + err.message); }
  };

  return (
    <div className="animate-fade-in">
       <div className="flex justify-between items-center mb-6">
           <h2 className="text-2xl font-bold text-slate-800">{role === 'admin' ? 'Support Requests' : t('Vé hỗ trợ của tôi', 'My Support Tickets')}</h2>
           {role !== 'admin' && (
               <button onClick={() => navigate('/contact')} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow font-bold flex items-center gap-2 hover:bg-blue-700 transition">
                   <Plus size={18}/> {t('Tạo Ticket Mới', 'New Ticket')}
               </button>
           )}
       </div>

       <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase font-bold tracking-wider"><tr><th className="p-4">Date</th><th className="p-4">{role==='admin'?'Customer':'Subject'}</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead>
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
                    <td className="p-4"><span className={`px-2 py-1 rounded-md text-xs font-bold ${c.status==='new'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{c.status === 'new' ? 'New Reply' : 'Read'}</span></td>
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
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden animate-scale-in">
                  <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                      <div><h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><MessageSquare size={18} className="text-blue-600"/> Ticket #{showTicketModal.id}</h3><p className="text-xs text-slate-500">{new Date(showTicketModal.created_at).toLocaleString()}</p></div>
                      <button onClick={() => setShowTicketModal(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition"><X size={20}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                      <div className="flex justify-start"><div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none max-w-[85%] shadow-sm"><p className="text-xs font-bold text-slate-500 mb-1">{showTicketModal.name} (Khách hàng)</p><p className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed">{showTicketModal.message}</p></div></div>
                      {ticketReplies.map(r => {
                          const isMe = (role === 'admin' && r.sender_role === 'admin') || (role === 'user' && r.sender_role === 'user');
                          return (
                              <div key={r.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`p-3 rounded-2xl max-w-[85%] shadow-sm text-sm leading-relaxed ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none text-slate-800'}`}>
                                      {!isMe && <p className="text-[10px] font-bold opacity-70 mb-1 uppercase">{r.sender_role}</p>}
                                      <p className="whitespace-pre-wrap">{r.message}</p>
                                      <p className={`text-[10px] mt-1 text-right ${isMe?'text-blue-200':'text-slate-400'}`}>{new Date(r.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                  </div>
                              </div>
                          );
                      })}
                      <div ref={chatEndRef} />
                  </div>
                  <form onSubmit={handleSendReply} className="p-4 bg-white border-t flex gap-3">
                      <input className="flex-1 border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition" placeholder={t("Nhập tin nhắn...", "Type a message...")} value={replyMessage} onChange={e => setReplyMessage(e.target.value)}/>
                      <button type="submit" disabled={!replyMessage.trim()} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"><Send size={20}/></button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
