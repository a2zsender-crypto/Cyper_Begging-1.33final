import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Trash2, UserPlus, Shield, User } from 'lucide-react';
import { toast } from 'react-toastify';
import { useLang } from '../../context/LangContext';

export default function AdminUsers() {
  const { t } = useLang();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
      // Lấy danh sách từ bảng profiles
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) console.error("Fetch users error:", error);
      else setUsers(data || []);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password) return toast.warn("Vui lòng nhập Email và Password");

    setLoading(true);
    try {
        const { data, error } = await supabase.functions.invoke('admin-actions', { 
            body: { 
                action: 'create_user', 
                payload: newUser 
            } 
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        
        toast.success(t(`Đã tạo user: ${newUser.email}`, `Created user: ${newUser.email}`)); 
        setNewUser({email:'', password:'', role:'user'});
        
        // Đợi 1s để Database đồng bộ rồi fetch lại
        setTimeout(fetchUsers, 1000); 
    } catch (err) { 
        console.error(err);
        toast.error("Lỗi: " + err.message); 
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteUser = async (uid, email) => {
    if (!confirm(t(`Bạn chắc chắn muốn xóa user ${email}?`, `Delete user ${email}?`))) return;
    
    setLoading(true);
    try {
        const { data, error } = await supabase.functions.invoke('admin-actions', { 
            body: { 
                action: 'delete_user', 
                payload: { userId: uid } 
            } 
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        
        toast.success(t("Đã xóa user thành công!", "User deleted successfully!"));
        
        // Cập nhật lại list users ngay lập tức (UI Optimistic Update)
        setUsers(prev => prev.filter(u => u.id !== uid));
    } catch (err) { 
        console.error(err);
        toast.error("Lỗi: " + err.message); 
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">{t('Quản lý Người dùng', 'User Management')}</h2>

        {/* Form tạo User */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><UserPlus size={20}/> {t('Tạo người dùng mới', 'Create New User')}</h3>
            <form onSubmit={handleCreateUser} className="flex flex-col md:flex-row gap-4">
                <input 
                    className="border p-2.5 rounded-lg flex-1 outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="Email" 
                    value={newUser.email} 
                    onChange={e=>setNewUser({...newUser,email:e.target.value})}
                />
                <input 
                    className="border p-2.5 rounded-lg flex-1 outline-none focus:ring-2 focus:ring-blue-500" 
                    type="password" 
                    placeholder="Password (min 6 chars)" 
                    value={newUser.password} 
                    onChange={e=>setNewUser({...newUser,password:e.target.value})}
                />
                <select 
                    className="border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                    value={newUser.role} 
                    onChange={e=>setNewUser({...newUser,role:e.target.value})}
                >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>
                <button 
                    disabled={loading}
                    className={`px-6 py-2.5 rounded-lg font-bold text-white transition shadow-sm ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                    {loading ? 'Processing...' : 'Create'}
                </button>
            </form>
        </div>

        {/* Danh sách Users */}
        <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
            <table className="w-full text-left">
                <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase font-bold tracking-wider">
                    <tr>
                        <th className="p-4">Email</th>
                        <th className="p-4">Role</th>
                        <th className="p-4 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 transition">
                            <td className="p-4 font-medium text-slate-700 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                    <User size={16}/>
                                </div>
                                {u.email}
                            </td>
                            <td className="p-4">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${u.role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                    {u.role === 'admin' && <Shield size={10}/>}
                                    {u.role.toUpperCase()}
                                </span>
                            </td>
                            <td className="p-4 text-right">
                                <button 
                                    onClick={() => handleDeleteUser(u.id, u.email)} 
                                    disabled={loading}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                    title="Delete User"
                                >
                                    <Trash2 size={18}/>
                                </button>
                            </td>
                        </tr>
                    ))}
                    {users.length === 0 && (
                        <tr><td colSpan="3" className="p-8 text-center text-slate-400">No users found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
}
