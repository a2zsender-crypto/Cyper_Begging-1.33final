import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Search, Eye, RefreshCw, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Hàm lấy dữ liệu đơn hàng
  const fetchOrders = async () => {
    setLoading(true);
    try {
      // QUAN TRỌNG: Phải có order_items(*) để lấy thông tin sản phẩm
      let query = supabase
        .from('orders')
        .select('*, order_items(*)') 
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    
    // Realtime subscription để tự động cập nhật khi có đơn mới
    const subscription = supabase
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [filterStatus]);

  // Xử lý xóa đơn hàng
  const handleDeleteOrder = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa đơn hàng này? Hành động này sẽ hoàn lại kho nếu đơn đã thanh toán.')) return;
    try {
      // Gửi request xóa qua API hoặc xóa trực tiếp nếu có quyền
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
      
      alert('Đã xóa đơn hàng thành công!');
      fetchOrders();
    } catch (error) {
      alert('Lỗi khi xóa: ' + error.message);
    }
  };

  // Lọc theo từ khóa tìm kiếm
  const filteredOrders = orders.filter(order => 
    order.id.toString().includes(searchTerm) ||
    order.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.oxapay_track_id?.toString().includes(searchTerm)
  );

  // Helper: Format hiển thị trạng thái
  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center w-fit gap-1"><CheckCircle size={12}/> Hoàn thành</span>;
      case 'paid': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center w-fit gap-1"><CheckCircle size={12}/> Đã thanh toán</span>;
      case 'pending': return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold flex items-center w-fit gap-1"><Clock size={12}/> Chờ thanh toán</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-xl font-bold text-slate-800">Quản lý Đơn hàng</h2>
        <button onClick={fetchOrders} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
            <RefreshCw size={18} className="text-slate-600"/>
        </button>
      </div>

      {/* Toolbar: Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm theo ID, Email, TrackID..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="pending">Pending (Chờ)</option>
          <option value="paid">Paid (Đã trả tiền)</option>
          <option value="completed">Completed (Xong)</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider">
              <th className="p-4 border-b font-semibold">ID / Ngày</th>
              <th className="p-4 border-b font-semibold">Khách hàng</th>
              <th className="p-4 border-b font-semibold">Sản phẩm (Đã mua)</th> {/* <--- CỘT NÀY ĐÃ ĐƯỢC KHÔI PHỤC */}
              <th className="p-4 border-b font-semibold">Tổng tiền</th>
              <th className="p-4 border-b font-semibold">Trạng thái</th>
              <th className="p-4 border-b font-semibold text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
            {loading ? (
               <tr><td colSpan="6" className="p-8 text-center text-slate-400">Đang tải dữ liệu...</td></tr>
            ) : filteredOrders.length === 0 ? (
               <tr><td colSpan="6" className="p-8 text-center text-slate-400">Không tìm thấy đơn hàng nào.</td></tr>
            ) : (
              filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 align-top">
                    <div className="font-bold text-blue-600">#{order.id}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(order.created_at).toLocaleString('vi-VN')}
                    </div>
                    {order.oxapay_track_id && (
                        <div className="text-[10px] bg-slate-100 px-1 py-0.5 rounded mt-1 w-fit text-slate-500">
                            Track: {order.oxapay_track_id}
                        </div>
                    )}
                  </td>
                  
                  <td className="p-4 align-top">
                    <div className="font-semibold">{order.customer_name || 'Khách vãng lai'}</div>
                    <div className="text-xs text-slate-500">{order.customer_email}</div>
                    {order.contact_info && (
                        <div className="text-xs text-blue-500 mt-1">
                            {order.contact_method}: {order.contact_info}
                        </div>
                    )}
                  </td>

                  {/* --- PHẦN KHÔI PHỤC HIỂN THỊ SẢN PHẨM --- */}
                  <td className="p-4 align-top">
                    <div className="space-y-2">
                        {order.order_items && order.order_items.length > 0 ? (
                            order.order_items.map((item, index) => (
                                <div key={index} className="flex flex-col border-b border-dashed border-slate-200 last:border-0 pb-1 last:pb-0">
                                    <div className="font-medium text-slate-800">
                                        {item.product_name || `Product #${item.product_id}`}
                                        {item.variant_name && <span className="text-slate-500 font-normal"> ({item.variant_name})</span>}
                                    </div>
                                    <div className="text-xs text-slate-500 flex justify-between">
                                        <span>x{item.quantity}</span>
                                        <span>${item.price_at_purchase}</span>
                                    </div>
                                    {/* Hiển thị Key nếu đã được gán */}
                                    {item.assigned_key && (
                                        <div className="mt-1 p-1.5 bg-green-50 border border-green-100 rounded text-[11px] font-mono text-green-700 break-all">
                                            {item.assigned_key}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <span className="text-slate-400 italic">Không có chi tiết SP</span>
                        )}
                    </div>
                  </td>
                  {/* ------------------------------------------ */}

                  <td className="p-4 align-top font-bold text-slate-800">
                    ${order.amount}
                  </td>

                  <td className="p-4 align-top">
                    {getStatusBadge(order.status)}
                  </td>

                  <td className="p-4 align-top text-right">
                    <button 
                        onClick={() => handleDeleteOrder(order.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition" 
                        title="Xóa đơn hàng"
                    >
                        <Trash2 size={18}/>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
