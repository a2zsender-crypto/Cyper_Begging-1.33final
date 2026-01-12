import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Trash2, Plus, Mail, Shield, Calendar, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import { useLang } from '../../context/LangContext';

// Nhận prop role từ Admin.jsx
export default function AdminUsers({ role }) { 
  const { t } = useLang();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State tạo user
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    // Lấy list user từ bảng profiles
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) toast.error("Error fetching users");
    else setUsers(data || []);
    setLoading(false);
  };

  const handleDelete = async (userId) => {
    if (role !== 'admin') return toast.error("Permission denied"); // Chặn Mod
    if (!window.confirm(t("Bạn có chắc muốn xóa user này?", "Are you sure?"))) return;

    try {
        const { data, error } = await supabase.functions.invoke('admin-actions', {
            body: { action: 'deleteUser', payload: { userId } }
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        
        toast.success(t("Đã xóa user", "User deleted"));
        fetchUsers();
    } catch (err) {
        toast.error("Lỗi: " + err.message);
    }
  };

  const handleCreate = async (e) => {
      e.preventDefault();
      if (role !== 'admin') return toast.error("Permission denied"); // Chặn Mod
      setCreating(true);
      try {
          const { data, error } = await supabase.functions.invoke('admin-actions', {
              body: { action: 'createUser', payload: newUser }
          });

          if (error || data?.error) throw new Error(data?.error || error?.message);

          toast.success(t("Tạo user thành công!", "User created!"));
          setShowCreate(false);
          setNewUser({ email: '', password: '', role: 'user' });
          fetchUsers();
      } catch (err) {
          toast.error("Lỗi: " + err.message);
      } finally {
          setCreating(false);
      }
  };

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800">{t("Quản lý người dùng", "User Management")}</h2>
            
            {/* Chỉ Admin mới thấy nút Thêm */}
            {role === 'admin' && (
                <button 
                    onClick={() => setShowCreate(!showCreate)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
                >
                    <Plus size={18}/> {t("Thêm mới", "Add User")}
                </button>
            )}
        </div>

        {/* Form tạo user (Chỉ Admin) */}
        {showCreate && role === 'admin' && (
            <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 flex gap-4 items-end animate-slide-down">
                <div className="flex-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                    <input required type="email" className="w-full border p-2 rounded mt-1" 
                        value={newUser.email} onChange={e=>setNewUser({...newUser, email: e.target.value})}
                    />
                </div>
                <div className="flex-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                    <input required type="password" className="w-full border p-2 rounded mt-1" 
                        value={newUser.password} onChange={e=>setNewUser({...newUser, password: e.target.value})}
                    />
                </div>
                <div className="w-32">
                    <label className="text-xs font-bold text-slate-500 uppercase">Role</label>
                    <select className="w-full border p-2 rounded mt-1"
                        value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value})}
                    >
                        <option value="user">User</option>
                        <option value="mod">Mod</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <button disabled={creating} className="bg-green-600 text-white px-6 py-2.5 rounded font-bold hover:bg-green-700">
                    {creating ? '...' : t('Lưu', 'Save')}
                </button>
            </form>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                    <tr>
                        <th className="p-4">Email</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Created</th>
                        {role === 'admin' && <th className="p-4 text-center">Action</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50">
                            <td className="p-4 flex items-center gap-3 font-medium text-slate-700">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-full"><Mail size={16}/></div>
                                {u.email}
                            </td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase
                                    ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                                      u.role === 'mod' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}
                                `}>
                                    {u.role}
                                </span>
                            </td>
                            <td className="p-4 text-slate-500">
                                {new Date(u.created_at).toLocaleDateString()}
                            </td>
                            {role === 'admin' && (
                                <td className="p-4 text-center">
                                    <button 
                                        onClick={() => handleDelete(u.id)}
                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition"
                                        title="Delete User"
                                    >
                                        <Trash2 size={18}/>
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
            {users.length === 0 && !loading && (
                <div className="p-8 text-center text-slate-400 italic">No users found.</div>
            )}
        </div>
    </div>
  );
}
