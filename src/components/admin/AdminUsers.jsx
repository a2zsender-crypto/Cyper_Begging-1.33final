import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useLang } from '../../context/LangContext';

export default function AdminUsers({ session }) {
  const { t } = useLang();
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'user' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
      const { data } = await supabase.from('profiles').select('*');
      setUsers(data || []);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
        const { data, error } = await supabase.functions.invoke('admin-actions', { 
            body: { action: 'create_user', payload: newUser } 
        });
        if (error || data?.error) throw new Error(data?.error || error.message);
        
        toast.success(t("Tạo user thành công!", "User created!")); 
        fetchUsers(); 
        setNewUser({email:'', password:'', role:'user'});
    } catch (err) { 
        toast.error("Lỗi: " + err.message); 
    }
  };

  const handleDeleteUser = async (uid) => {
    if (!confirm(t("Bạn chắc chắn muốn xóa user này?", "Delete user?"))) return;
    try {
        const { data, error } = await supabase.functions.invoke('admin-actions', { 
            body: { action: 'delete_user', payload: { userId: uid } } 
        });
        if (error || data?.error) throw new Error(data?.error || error.message);
        
        fetchUsers();
        toast.success("Đã xóa user.");
    } catch (err) { 
        toast.error("Lỗi: " + err.message); 
    }
  };

  return (
    <div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex gap-4">
            <input className="border p-2 rounded-lg flex-1 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Email" value={newUser.email} onChange={e=>setNewUser({...newUser,email:e.target.value})}/>
            <input className="border p-2 rounded-lg flex-1 outline-none focus:ring-2 focus:ring-blue-500" type="password" placeholder="Pass" value={newUser.password} onChange={e=>setNewUser({...newUser,password:e.target.value})}/>
            <select className="border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})}><option value="user">User</option><option value="admin">Admin</option></select>
            <button onClick={handleCreateUser} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition">Create</button>
        </div>
        <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
            {users.map(u=>(
                <div key={u.id} className="flex justify-between border-b last:border-0 p-4 items-center hover:bg-slate-50 transition">
                    <span className="text-slate-700 font-medium">{u.email} <span className="text-xs bg-gray-100 px-2 py-1 rounded ml-2 text-slate-500 border">{u.role}</span></span>
                    <button onClick={()=>handleDeleteUser(u.id)} className="text-red-500 hover:bg-red-50 p-2 rounded transition"><Trash2 size={18}/></button>
                </div>
            ))}
        </div>
    </div>
  );
}