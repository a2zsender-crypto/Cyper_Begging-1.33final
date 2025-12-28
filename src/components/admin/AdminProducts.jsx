import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Package, Plus, Edit, X, Upload, Key, Layers, Trash2 } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { toast } from 'react-toastify';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // Import mới

export default function AdminProducts() {
  const { t } = useLang();
  const queryClient = useQueryClient(); // Dùng để làm mới cache
  
  // --- FETCH DATA BẰNG REACT QUERY ---
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('id', {ascending: false});
      if (error) throw error;
      return data;
    }
  });

  const { data: stockCounts = {} } = useQuery({
    queryKey: ['admin-stock'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_stock').select('*');
      if (error) throw error;
      const map = {}; 
      data?.forEach(s => map[s.product_id] = s.stock_count);
      return map;
    }
  });

  // Modal States
  const [showProductModal, setShowProductModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(null);
  const [productForm, setProductForm] = useState({
    id: null, title: '', title_en: '', price: '', 
    description: '', description_en: '', is_digital: true, physical_stock: 0, images: [] 
  });
  
  const [keyInput, setKeyInput] = useState(''); 
  const [stockInput, setStockInput] = useState(0); 
  const [uploading, setUploading] = useState(false);

  // --- HANDLERS ---
  const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(true);
      const fileName = `prod-${Date.now()}`;
      const { error } = await supabase.storage.from('product-images').upload(fileName, file);
      if(error) { toast.error(error.message); setUploading(false); return; }
      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      setProductForm(prev => ({ ...prev, images: [...(prev.images || []), data.publicUrl] }));
      setUploading(false);
      toast.success("Upload ảnh thành công!");
  };

  const handleRemoveImage = (idx) => setProductForm(prev => ({...prev, images: prev.images.filter((_, i) => i !== idx)}));
  
  const openAddModal = () => {
      setProductForm({ id: null, title: '', title_en: '', price: '', description: '', description_en: '', is_digital: true, physical_stock: 0, images: [] });
      setShowProductModal(true);
  };

  const openEditModal = (p) => {
      setProductForm({
        id: p.id, title: p.title, title_en: p.title_en || '', price: p.price,
        description: p.description || '', description_en: p.description_en || '',
        is_digital: p.is_digital, physical_stock: p.physical_stock || 0, 
        images: p.images || [] 
      });
      setShowProductModal(true);
  };

  const handleSaveProduct = async (e) => {
      e.preventDefault();
      const productData = {
          title: productForm.title, title_en: productForm.title_en,
          price: parseFloat(productForm.price),
          description: productForm.description, description_en: productForm.description_en,
          images: productForm.images,
          is_digital: productForm.is_digital,
          physical_stock: productForm.is_digital ? 0 : parseInt(productForm.physical_stock)
      };
      
      try {
          if (productForm.id) {
              await supabase.from('products').update(productData).eq('id', productForm.id);
          } else {
              await supabase.from('products').insert(productData);
          }
          setShowProductModal(false);
          // Tự động làm mới danh sách sản phẩm và kho
          queryClient.invalidateQueries({ queryKey: ['admin-products'] });
          queryClient.invalidateQueries({ queryKey: ['public-products'] }); // Làm mới cả bên user luôn
          toast.success(t("Lưu sản phẩm thành công!", "Product saved successfully!"));
      } catch (err) { toast.error(err.message); }
  };

  const handleImportStock = async () => {
    try {
        if (showKeyModal.is_digital) {
            if (!keyInput.trim()) return;
            const codes = keyInput.split('\n').filter(c => c.trim() !== '');
            const insertData = codes.map(code => ({ product_id: showKeyModal.id, key_value: code.trim() }));
            const { error } = await supabase.from('product_keys').insert(insertData);
            if (error) throw error;
            toast.success(t(`Đã thêm ${insertData.length} Keys!`, `Added ${insertData.length} Keys!`));
        } else {
            const qtyToAdd = parseInt(stockInput);
            if (qtyToAdd <= 0) return toast.warn("Số lượng phải > 0");
            const newStock = (showKeyModal.physical_stock || 0) + qtyToAdd;
            const { error } = await supabase.from('products').update({ physical_stock: newStock }).eq('id', showKeyModal.id);
            if (error) throw error;
            toast.success(t("Cập nhật kho thành công!", "Stock updated!"));
        }
        setKeyInput(''); setStockInput(0); setShowKeyModal(null);
        // Làm mới dữ liệu kho ngay lập tức
        queryClient.invalidateQueries({ queryKey: ['admin-products'] });
        queryClient.invalidateQueries({ queryKey: ['admin-stock'] });
    } catch (err) {
        toast.error("Lỗi: " + err.message);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading Inventory...</div>;

  return (
    <div className="animate-fade-in">
       <div className="flex justify-between mb-6 items-center">
         <h2 className="text-2xl font-bold text-slate-800">{t('Kho Sản Phẩm', 'Inventory')}</h2>
         <button onClick={openAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow hover:bg-blue-700 transition"><Plus size={18}/> {t('Thêm Mới', 'Add New')}</button>
       </div>
       
       <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
         <table className="w-full text-left">
           <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase font-bold tracking-wider"><tr><th className="p-4">Product</th><th className="p-4">Type</th><th className="p-4">Price</th><th className="p-4">Stock</th><th className="p-4">Action</th></tr></thead>
           <tbody className="divide-y divide-slate-100">
             {products.map(p => (
               <tr key={p.id} className="hover:bg-slate-50 transition">
                 <td className="p-4 flex gap-3 items-center"><img src={p.images?.[0]} className="w-10 h-10 rounded object-cover bg-slate-100 border"/> <span className="font-medium text-sm text-slate-700">{p.title}</span></td>
                 <td className="p-4 text-xs font-medium text-slate-500">{p.is_digital ? 'Digital' : 'Physical'}</td>
                 <td className="p-4 font-bold text-green-600">${p.price}</td>
                 <td className="p-4"><span className={`px-2 py-1 rounded-md text-xs font-bold ${stockCounts[p.id]>0?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{stockCounts[p.id]||0}</span></td>
                 <td className="p-4 flex gap-2">
                    <button onClick={()=>openEditModal(p)} className="p-2 bg-slate-100 rounded hover:bg-blue-100 text-blue-600 transition"><Edit size={16}/></button>
                    <button onClick={()=>setShowKeyModal(p)} className="p-2 bg-slate-100 rounded hover:bg-green-100 text-green-600 transition"><Plus size={16}/></button>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>

       {/* MODAL EDIT PRODUCT (Giữ nguyên như cũ, chỉ thay đổi logic submit ở trên) */}
       {showProductModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto animate-scale-in">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-800">{productForm.id ? 'Edit Product' : 'Add New Product'}</h2>
                  <button onClick={() => setShowProductModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={20}/></button>
              </div>
              <form onSubmit={handleSaveProduct} className="space-y-6">
                 <div className="grid grid-cols-2 gap-5">
                    <div><label className="block text-sm font-bold mb-1.5 text-slate-600">Title (VN)</label><input required className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={productForm.title} onChange={e=>setProductForm({...productForm, title: e.target.value})}/></div>
                    <div><label className="block text-sm font-bold mb-1.5 text-slate-600">Title (EN)</label><input className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={productForm.title_en} onChange={e=>setProductForm({...productForm, title_en: e.target.value})}/></div>
                 </div>
                 <div className="grid grid-cols-2 gap-5">
                    <div><label className="block text-sm font-bold mb-1.5 text-slate-600">Price (USDT)</label><input type="number" step="0.01" required className="w-full border p-2.5 rounded-lg font-mono font-bold text-green-600 focus:ring-2 focus:ring-blue-500 outline-none" value={productForm.price} onChange={e=>setProductForm({...productForm, price: e.target.value})}/></div>
                    <div><label className="block text-sm font-bold mb-1.5 text-slate-600">Type</label><select className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={productForm.is_digital ? 'digital' : 'physical'} onChange={e => setProductForm({...productForm, is_digital: e.target.value === 'digital', physical_stock: 0})}><option value="digital">Digital (Key/Code)</option><option value="physical">Physical</option></select></div>
                 </div>
                 {!productForm.is_digital && (<div className="bg-orange-50 p-4 rounded-xl border border-orange-100"><label className="block text-sm font-bold text-orange-800 mb-1">Initial Stock</label><input type="number" className="w-full border p-2.5 rounded-lg bg-white" value={productForm.physical_stock} onChange={e=>setProductForm({...productForm, physical_stock: e.target.value})}/></div>)}
                 <div className="grid grid-cols-2 gap-5">
                     <div><label className="block text-sm font-bold mb-1.5 text-slate-600">Description (VN)</label><textarea className="w-full border p-2.5 rounded-lg h-28 resize-none focus:ring-2 focus:ring-blue-500 outline-none" value={productForm.description} onChange={e=>setProductForm({...productForm, description: e.target.value})}></textarea></div>
                     <div><label className="block text-sm font-bold mb-1.5 text-slate-600">Description (EN)</label><textarea className="w-full border p-2.5 rounded-lg h-28 resize-none focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" value={productForm.description_en} onChange={e=>setProductForm({...productForm, description_en: e.target.value})}></textarea></div>
                 </div>
                 <div>
                    <label className="block text-sm font-bold mb-2 text-slate-600">Images</label>
                    <div className="flex flex-wrap gap-3 mb-3">
                        {productForm.images && productForm.images.map((img, idx) => (
                            <div key={idx} className="relative group w-24 h-24 border rounded-lg overflow-hidden shadow-sm">
                                <img src={img} className="w-full h-full object-cover"/>
                                <button type="button" onClick={() => handleRemoveImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 opacity-0 group-hover:opacity-100 transition"><X size={12}/></button>
                            </div>
                        ))}
                    </div>
                    <label className="cursor-pointer inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium transition text-slate-600">
                        <Upload size={16}/> {uploading ? 'Uploading...' : 'Add Image'}
                        <input type="file" className="hidden" onChange={e => handleImageUpload(e)} disabled={uploading}/>
                    </label>
                 </div>
                 <div className="flex justify-end gap-3 mt-6 pt-4 border-t"><button type="button" onClick={() => setShowProductModal(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition">Cancel</button><button disabled={uploading} className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow transition">Save Product</button></div>
              </form>
           </div>
        </div>
      )}

      {/* MODAL STOCK (Giữ nguyên) */}
      {showKeyModal && (
         <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
               <h3 className="font-bold mb-4 text-lg text-slate-800 flex items-center gap-2">
                   {showKeyModal.is_digital ? <Key className="text-blue-600"/> : <Layers className="text-orange-600"/>}
                   {showKeyModal.is_digital ? 'Import Keys' : 'Update Stock'}
               </h3>
               {showKeyModal.is_digital ? (
                   <div>
                       <p className="text-xs text-slate-500 mb-2 font-medium uppercase">Enter keys (One per line)</p>
                       <textarea className="w-full border p-3 h-48 rounded-xl font-mono text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="AAAA-BBBB-CCCC&#10;XXXX-YYYY-ZZZZ"></textarea>
                   </div>
               ) : (
                   <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 text-center">
                       <p className="text-sm font-bold text-orange-800 mb-3 uppercase tracking-wide">Quantity to Add</p>
                       <input type="number" className="w-24 border p-2 rounded-lg text-center font-bold text-2xl text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none" value={stockInput} onChange={e => setStockInput(e.target.value)}/>
                   </div>
               )}
               <div className="flex justify-end gap-2 mt-6">
                   <button onClick={() => setShowKeyModal(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-medium transition">Close</button>
                   <button onClick={handleImportStock} className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 shadow transition">Save</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}