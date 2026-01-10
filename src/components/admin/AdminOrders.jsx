import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

// Component nhỏ để hiển thị Key có nút ẩn/hiện (Mắt)
const SensitiveDataDisplay = ({ data, label }) => {
    const [isVisible, setIsVisible] = useState(false);
    if (!data || data.length < 2) return null; // Không hiện nếu không có data

    return (
        <div className="text-xs mt-1">
            <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-600">{label}:</span>
                <button 
                    onClick={() => setIsVisible(!isVisible)}
                    className="text-gray-400 hover:text-blue-600 focus:outline-none"
                    title={isVisible ? "Ẩn" : "Hiện"}
                >
                    {isVisible ? (
                        // Icon Eye Off
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                    ) : (
                        // Icon Eye
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    )}
                </button>
            </div>
            <div className={`p-2 rounded mt-1 border ${isVisible ? 'bg-white border-gray-200 text-gray-800' : 'bg-gray-100 border-gray-200 text-gray-400 select-none'}`}>
                {isVisible ? (
                    <code className="break-all font-mono">{data}</code>
                ) : (
                    '••••••••••••••••••••••••••'
                )}
            </div>
        </div>
    );
};

export default function AdminOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    
    // State cho update status
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [newStatus, setNewStatus] = useState('');

    useEffect(() => {
        fetchOrders();
        // Realtime subscription
        const channel = supabase
            .channel('admin-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders();
            })
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
        if (!confirm("Bạn có chắc muốn xóa đơn này?")) return;
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
            if (!res.ok) throw new Error("Failed to delete");
            fetchOrders();
            if (selectedOrder?.id === id) setSelectedOrder(null);
        } catch (err) {
            alert(err.message);
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
            fetchOrders(); // Refresh list
        } catch (err) {
            alert("Lỗi cập nhật: " + err.message);
        } finally {
            setUpdatingStatus(false);
        }
    };

    if (loading) return <div>Loading orders...</div>;

    return (
        <div>
            <h2 className="text-xl font-bold mb-4">Quản lý Đơn hàng</h2>
            <div className="overflow-x-auto bg-white rounded shadow">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 border-b">
                            <th className="p-3">ID</th>
                            <th className="p-3">Khách hàng</th>
                            <th className="p-3">Tổng</th>
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
                                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                                          order.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                          order.status === 'shipping' ? 'bg-purple-100 text-purple-800' :
                                          'bg-gray-100 text-gray-800'}`}>
                                        {order.status}
                                    </span>
                                </td>
                                <td className="p-3 text-sm text-gray-500">
                                    {new Date(order.created_at).toLocaleString()}
                                </td>
                                <td className="p-3 space-x-2">
                                    <button 
                                        onClick={() => handleViewOrder(order)}
                                        className="text-blue-600 hover:underline">
                                        Chi tiết
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteOrder(order.id)}
                                        className="text-red-600 hover:underline">
                                        Xóa
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal Chi tiết đơn hàng */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-xl font-bold">Chi tiết đơn hàng #{selectedOrder.id}</h3>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
                        </div>
                        
                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-6 mb-6">
                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Thông tin khách hàng</h4>
                                <p><strong>Email:</strong> {selectedOrder.customer_email}</p>
                                <p><strong>Tên:</strong> {selectedOrder.customer_name || '---'}</p>
                                <p><strong>SĐT:</strong> {selectedOrder.phone_number || selectedOrder.contact_info || '---'}</p>
                                
                                {/* CHỈ HIỆN ĐỊA CHỈ NẾU CÓ DỮ LIỆU */}
                                {selectedOrder.shipping_address && (
                                    <div className="mt-3">
                                        <p className="font-bold text-gray-700">Địa chỉ giao hàng:</p>
                                        <div className="bg-yellow-50 p-2 border border-yellow-200 rounded text-sm mt-1">
                                            {selectedOrder.shipping_address}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Thông tin đơn hàng</h4>
                                <p><strong>Ngày tạo:</strong> {new Date(selectedOrder.created_at).toLocaleString()}</p>
                                <p><strong>Track ID:</strong> {selectedOrder.oxapay_track_id || '---'}</p>
                                <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cập nhật trạng thái</label>
                                    <div className="flex gap-2">
                                        <select 
                                            value={newStatus} 
                                            onChange={(e) => setNewStatus(e.target.value)}
                                            className="border rounded px-2 py-1 text-sm flex-1 focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="pending">Pending (Chờ)</option>
                                            <option value="paid">Paid (Đã TT)</option>
                                            <option value="shipping">Shipping (Đang giao)</option>
                                            <option value="completed">Completed (Xong)</option>
                                            <option value="cancelled">Cancelled (Hủy)</option>
                                        </select>
                                        <button 
                                            onClick={handleUpdateStatus}
                                            disabled={updatingStatus}
                                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50 font-medium"
                                        >
                                            {updatingStatus ? '...' : 'Lưu'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Product List */}
                        <div className="border-t pt-4">
                            <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Danh sách sản phẩm</h4>
                            <ul className="space-y-3">
                                {selectedOrder.order_items.map(item => (
                                    <li key={item.id} className="border rounded p-3 bg-gray-50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-gray-800">
                                                    {item.product_name || item.products?.title}
                                                </div>
                                                {item.variant_name && <div className="text-sm text-gray-500">Loại: {item.variant_name}</div>}
                                                <div className="text-sm">SL: x{item.quantity}</div>
                                            </div>
                                            <div className="font-bold text-blue-600">
                                                ${item.price_at_purchase}
                                            </div>
                                        </div>
                                        
                                        {/* Hiển thị Key với nút ẩn/hiện */}
                                        {item.assigned_key && (
                                            <SensitiveDataDisplay data={item.assigned_key} label="Key/Code" />
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className="text-right mt-6 pt-4 border-t text-xl font-bold text-gray-800">
                            Tổng cộng: ${selectedOrder.amount}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
