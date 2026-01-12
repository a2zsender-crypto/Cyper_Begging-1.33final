import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLang } from '../context/LangContext';
import { LayoutDashboard, ShoppingCart, Users, Package, Settings, MessageSquare, LogOut, Menu } from 'lucide-react';

// Import các components con
import AdminOrders from '../components/admin/AdminOrders';
import AdminProducts from '../components/admin/AdminProducts';
import AdminUsers from '../components/admin/AdminUsers';
import AdminSettings from '../components/admin/AdminSettings';
import AdminContacts from '../components/admin/AdminContacts';

export default function Admin() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Lấy tab hiện tại từ URL, mặc định là 'orders'
  const activeTab = searchParams.get('tab') || 'orders';

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate('/login');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Chỉ Admin hoặc Mod mới được vào
    if (profile?.role !== 'admin' && profile?.role !== 'mod') {
      return navigate('/');
    }
    
    setRole(profile.role);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  // Cấu hình Menu
  const menuItems = [
    { id: 'orders', label: t('Đơn hàng', 'Orders'), icon: ShoppingCart },
    { id: 'products', label: t('Sản phẩm', 'Products'), icon: Package },
    { id: 'contacts', label: t('Hỗ trợ', 'Support'), icon: MessageSquare },
    { id: 'users', label: t('Người dùng', 'Users'), icon: Users }, // Mod vẫn xem được Users nhưng ko xoá đc
    { id: 'settings', label: t('Cấu hình', 'Settings'), icon: Settings, restricted: true }, // Chỉ Admin
  ];

  // Lọc menu dựa trên Role
  const visibleMenuItems = menuItems.filter(item => {
      if (item.restricted && role !== 'admin') return false; // Mod không thấy Settings
      return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`bg-slate-900 text-white transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col fixed h-full z-20`}>
        <div className="p-4 flex items-center justify-between border-b border-slate-700">
          {isSidebarOpen && <span className="font-bold text-xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">ADMIN</span>}
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-800 rounded-lg">
            <Menu size={20}/>
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {visibleMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSearchParams({ tab: item.id })}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              {isSidebarOpen && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-slate-800 transition-all">
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-20'} p-8`}>
        <div className="max-w-7xl mx-auto">
          {activeTab === 'orders' && <AdminOrders />}
          {activeTab === 'products' && <AdminProducts />}
          {activeTab === 'contacts' && <AdminContacts />}
          {activeTab === 'users' && <AdminUsers role={role} />} {/* Truyền role vào đây */}
          {activeTab === 'settings' && role === 'admin' && <AdminSettings />}
        </div>
      </main>
    </div>
  );
}
