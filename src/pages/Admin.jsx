import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Package, Settings, Users, User, ShoppingBag, LogOut, MessageSquare, Loader 
} from 'lucide-react';
import { useLang } from '../context/LangContext';

import AdminProducts from '../components/admin/AdminProducts';
import AdminOrders from '../components/admin/AdminOrders';
import AdminContacts from '../components/admin/AdminContacts';
import AdminUsers from '../components/admin/AdminUsers';
import AdminSettings from '../components/admin/AdminSettings';

export default function Admin() {
  const { t } = useLang();
  const [session, setSession] = useState(null);
  const [role, setRole] = useState('user'); 
  const [activeTab, setActiveTab] = useState('orders'); 
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
          navigate('/login');
      } else { 
          setSession(session); 
          checkRole(session.user.id); 
      }
    });
  }, []);

  // --- Tự động chuyển tab khi URL thay đổi ---
  useEffect(() => {
      const urlTab = searchParams.get('tab');
      if (urlTab && urlTab !== activeTab) {
          setActiveTab(urlTab);
      }
  }, [searchParams, activeTab]);

  async function checkRole(uid) {
    try {
        let userRole = 'user';
        const { data } = await supabase.from('profiles').select('role').eq('id', uid).single();
        if (data && data.role) userRole = data.role;
        setRole(userRole);
        
        const urlTab = searchParams.get('tab');
        if (urlTab) setActiveTab(urlTab);
        else if (userRole === 'admin') setActiveTab('products'); 
        else setActiveTab('orders');

    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  }

  const handleLogout = async () => { 
      await supabase.auth.signOut(); 
      localStorage.clear(); 
      navigate('/login'); 
  };

  if (loading) return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <Loader className="w-10 h-10 animate-spin text-blue-600"/>
      </div>
  );

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-gray-800">
      
      {/* SIDEBAR */}
      <div className={`w-64 bg-white shadow-md flex flex-col fixed h-full z-10 border-r ${role === 'user' ? 'hidden md:flex' : ''}`}>
        <div className="p-6 border-b flex items-center gap-3">
            <div className={`p-2 rounded-lg ${role==='admin' ? 'bg-blue-600' : 'bg-green-600'} text-white shadow`}>
                {role === 'admin' ? <Settings size={20}/> : <User size={20}/>}
            </div>
            <div className="overflow-hidden">
                <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide">{role === 'admin' ? 'Admin Pro' : t('Tài khoản', 'My Account')}</h2>
                <p className="text-xs text-slate-500 truncate" title={session.user.email}>{session.user.email}</p>
            </div>
        </div>
        
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {role === 'admin' && (
              <>
                <button onClick={() => { setActiveTab('products'); navigate('/admin?tab=products'); }} className={`w-full text-left px-4 py-3 rounded-lg flex gap-3 transition ${activeTab==='products' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}><Package size={20}/> {t('Sản phẩm', 'Products')}</button>
                <button onClick={() => { setActiveTab('orders'); navigate('/admin?tab=orders'); }} className={`w-full text-left px-4 py-3 rounded-lg flex gap-3 transition ${activeTab==='orders' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}><ShoppingBag size={20}/> {t('Đơn hàng', 'Orders')}</button>
                <button onClick={() => { setActiveTab('contacts'); navigate('/admin?tab=contacts'); }} className={`w-full text-left px-4 py-3 rounded-lg flex gap-3 transition ${activeTab==='contacts' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}><MessageSquare size={20}/> {t('Hỗ trợ KH', 'Support')}</button>
                <button onClick={() => { setActiveTab('users'); navigate('/admin?tab=users'); }} className={`w-full text-left px-4 py-3 rounded-lg flex gap-3 transition ${activeTab==='users' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}><Users size={20}/> {t('Người dùng', 'Users')}</button>
                <button onClick={() => { setActiveTab('settings'); navigate('/admin?tab=settings'); }} className={`w-full text-left px-4 py-3 rounded-lg flex gap-3 transition ${activeTab==='settings' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}><Settings size={20}/> {t('Cấu hình', 'Settings')}</button>
              </>
          )}

          {role !== 'admin' && (
              <>
                <button onClick={() => { setActiveTab('orders'); navigate('/admin?tab=orders'); }} className={`w-full text-left px-4 py-3 rounded-lg flex gap-3 transition ${activeTab==='orders' ? 'bg-green-50 text-green-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}><ShoppingBag size={20}/> {t('Đơn hàng của tôi', 'My Orders')}</button>
                <button onClick={() => { setActiveTab('contacts'); navigate('/admin?tab=contacts'); }} className={`w-full text-left px-4 py-3 rounded-lg flex gap-3 transition ${activeTab==='contacts' ? 'bg-green-50 text-green-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}><MessageSquare size={20}/> {t('Hỗ trợ & Phản hồi', 'Support & Replies')}</button>
              </>
          )}
        </nav>
        <button onClick={handleLogout} className="p-4 m-4 text-red-600 flex gap-2 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition justify-center font-medium"><LogOut size={20}/> {t('Đăng xuất', 'Logout')}</button>
      </div>

      {/* CONTENT */}
      <div className={`flex-1 p-8 overflow-auto ${role === 'admin' ? 'ml-64' : 'md:ml-64'}`}>
        
        {activeTab === 'products' && role === 'admin' && <AdminProducts session={session} />}
        
        {activeTab === 'orders' && <AdminOrders session={session} role={role} />}
        
        {activeTab === 'contacts' && (
            <AdminContacts 
                session={session} 
                role={role} 
                activeTicketId={searchParams.get('ticketId')} 
            />
        )}
        
        {activeTab === 'users' && role === 'admin' && <AdminUsers session={session} />}
        
        {activeTab === 'settings' && role === 'admin' && <AdminSettings />}

      </div>
    </div>
  );
}
