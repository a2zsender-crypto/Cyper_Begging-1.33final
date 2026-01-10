import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

// Component nhỏ để hiển thị Key (Giữ thiết kế cũ: Ẩn/Hiện + Copy)
const KeyDisplay = ({ text }) => {
    const [visible, setVisible] = useState(false);
    
    if (!text || text.length < 5) return <span className="text-gray-400 italic">---</span>;

    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        alert("Đã copy key!");
    };

    return (
        <div className="flex items-center space-x-2 bg-gray-50 p-1 rounded border border-gray-200 text-sm font-mono max-w-xs">
            <span className="truncate flex-1">
                {visible ? text : '••••••••••••••••••••'}
            </span>
            <button onClick={() => setVisible(!visible)} className="text-gray-500 hover:text-blue-600" title="Hiện/Ẩn">
                {visible ? '👁️' : '🔒'}
            </button>
            <button onClick={handleCopy} className="text-gray-500 hover:text-green-600" title="Copy">
                📋
            </button>
        </div>
    );
};

export default function AdminOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [newStatus, setNewStatus] = useState('');

    useEffect(() => {
        fetchOrders();
        const channel = supabase
            .channel('admin-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    async function fetchOrders() {
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*, products(title))')
            .order('created_at', { ascending: false });
        
        if (error) console.error("Error fetching orders:", error);
        else setOrders(data || []);
        setLoading(false);
    }

    const handleViewOrder = (order) => {
        setSelectedOrder(order);
        setNewStatus(order.status);
    };

    const handleDeleteOrder = async (id) => {
        if (!confirm("Bạn có chắc muốn xóa đơn này? Hành động này không thể hoàn tác.")) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ action: 'delete_order', orderId: id })
            });
            
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Failed to delete");
            
            alert("Đã xóa đơn hàng!");
            fetchOrders();
            if (selectedOrder?.id === id) setSelectedOrder(null);
        } catch (err) {
            alert("Lỗi xóa đơn: " + err.message);
        }
    };

    const handleUpdateStatus = async () => {
        if (!selectedOrder) return;
        setUpdatingStatus(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ 
                    action: 'update_order_status', 
                    orderId: selectedOrder.id,
                    status: newStatus,
                    customerEmail: selectedOrder.customer_email
                })
            });
            
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Update failed");

            alert("Cập nhật trạng thái thành công!");
            setSelectedOrder({ ...selectedOrder, status: newStatus }); 
        } catch (err) {
            alert("Lỗi cập nhật: " + err.message);
        } finally {
            setUpdatingStatus(false);
        }
    };

    if (loading) return <div>Đang tải dữ liệu...</div>;

    return (
        <div>
            <h2 className="text-xl font-bold mb-4">Quản lý Đơn hàng</h2>
            <div className="overflow-x-auto bg-white rounded shadow">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 border-b">
                            <th className="p-3">ID</th>
                            <th className="p-3">Khách hàng</th>
                            <th className="p-3">Tổng tiền</th>
                            <th className="p-3">Trạng thái</th>
                            <th className="p-3">Ngày tạo</th>
                            <th className="p-3">Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map(order => (
                            <tr key={order.id} className="border-b hover:bg-gray-50">
                                <td className="p-3">#{order.id}</td>
                                <td className="p-3">
                                    <div className="font-medium">{order.customer_email}</div>
                                    <div className="text-xs text-gray-500">{order.customer_name}</div>
                                </td>
                                <td className="p-3">${order.amount}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold 
                                        ${order.status === 'paid' ? 'bg-green-100 text-green-800' : 
                                          order.status === 'shipping' ? 'bg-blue-100 text-blue-800' :
                                          order.status === 'completed' ? 'bg-purple-100 text-purple-800' :
                                          'bg-gray-100 text-gray-800'}`}>
                                        {order.status}
                                    </span>
                                </td>
                                <td className="p-3 text-sm text-gray-500">
                                    {new Date(order.created_at).toLocaleString('vi-VN')}
                                </td>
                                <td className="p-3 space-x-2">
                                    <button onClick={() => handleViewOrder(order)} className="text-blue-600 hover:underline">Chi tiết</button>
                                    <button onClick={() => handleDeleteOrder(order.id)} className="text-red-600 hover:underline">Xóa</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal Chi tiết đơn hàng */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-xl font-bold">Chi tiết đơn hàng #{selectedOrder.id}</h3>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
                            <div className="space-y-2">
                                <p><strong className="text-gray-600">Email:</strong> {selectedOrder.customer_email}</p>
                                <p><strong className="text-gray-600">Tên khách:</strong> {selectedOrder.customer_name || '---'}</p>
                                <p><strong className="text-gray-600">SĐT:</strong> {selectedOrder.phone_number || selectedOrder.contact_info || '---'}</p>
                                <p><strong className="text-gray-600">Mã vận đơn (TrackID):</strong> {selectedOrder.oxapay_track_id || '---'}</p>
                            </div>
                            
                            <div className="space-y-2">
                                <p><strong className="text-gray-600">Ngày tạo:</strong> {new Date(selectedOrder.created_at).toLocaleString('vi-VN')}</p>
                                <p><strong className="text-gray-600">Trạng thái hiện tại:</strong> {selectedOrder.status}</p>
                                
                                {/* CHỈ HIỂN THỊ NẾU CÓ ĐỊA CHỈ (SẢN PHẨM VẬT LÝ) */}
                                {selectedOrder.shipping_address && (
                                    <div className="mt-2 bg-yellow-50 p-2 border border-yellow-200 rounded">
                                        <strong className="block text-yellow-800 mb-1">📍 Địa chỉ giao hàng:</strong>
                                        <span className="text-gray-800">{selectedOrder.shipping_address}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* KHU VỰC CẬP NHẬT TRẠNG THÁI */}
                        <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
                            <div className="flex-1 w-full">
                                <label className="block text-xs font-bold text-gray-500 mb-1">CẬP NHẬT TRẠNG THÁI (Gửi thông báo cho khách)</label>
                                <div className="flex gap-2">
                                    <select 
                                        value={newStatus} 
                                        onChange={(e) => setNewStatus(e.target.value)}
                                        className="border rounded p-2 flex-1 outline-none focus:border-blue-500"
                                    >
                                        <option value="pending">Pending (Chờ thanh toán)</option>
                                        <option value="paid">Paid (Đã thanh toán - Chờ xử lý)</option>
                                        <option value="shipping">Shipping (Đang vận chuyển)</option>
                                        <option value="completed">Completed (Hoàn thành)</option>
                                        <option value="cancelled">Cancelled (Đã hủy)</option>
                                    </select>
                                    <button 
                                        onClick={handleUpdateStatus}
                                        disabled={updatingStatus}
                                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
                                    >
                                        {updatingStatus ? 'Đang lưu...' : 'Cập nhật'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <h4 className="font-bold mb-3 text-lg">Danh sách sản phẩm</h4>
                            <ul className="space-y-3">
                                {selectedOrder.order_items.map(item => (
                                    <li key={item.id} className="flex flex-col border p-3 rounded bg-gray-50">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-medium text-base text-blue-900">
                                                    {item.product_name || item.products?.title}
                                                    {item.variant_name && <span className="text-gray-600 font-normal"> ({item.variant_name})</span>}
                                                </div>
                                                <div className="text-sm text-gray-500 mt-1">Số lượng: <strong>{item.quantity}</strong></div>
                                            </div>
                                            <div className="font-bold text-gray-700">
                                                ${item.price_at_purchase}
                                            </div>
                                        </div>
                                        
                                        {/* Hiển thị Key với tính năng Ẩn/Hiện/Copy */}
                                        {item.assigned_key && item.assigned_key.length > 5 ? (
                                            <div className="mt-1">
                                                <div className="text-xs text-gray-500 mb-1">Mã sản phẩm / Key:</div>
                                                <KeyDisplay text={item.assigned_key} />
                                            </div>
                                        ) : (
                                            /* Nếu không có key (vật lý chưa giao hoặc chưa có key), hiện trạng thái */
                                            <div className="text-xs italic text-orange-600 mt-1">
                                                * Chưa có key / Đang chờ xử lý
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className="text-right mt-6 pt-4 border-t text-xl font-bold text-red-600">
                            Tổng tiền: ${selectedOrder.amount}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
