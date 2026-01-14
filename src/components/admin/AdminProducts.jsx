import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Package, Plus, Edit, X, Upload, Key, Layers, Settings, Image as ImageIcon, Trash2, Save, AlertCircle } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { toast } from 'react-toastify';
import { useQuery, useQueryClient } from '@tanstack/react-query'; 

export default function AdminProducts() {
  const { t, lang } = useLang(); 
  const queryClient = useQueryClient(); 
  
  // --- FETCH PRODUCTS ---
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('id', {ascending: false});
      if (error) throw error;
      return data;
    }
  });

  // --- MODAL STATES ---
  const [showProductModal, setShowProductModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(null); // Dùng cho cả nhập Key và nhập Stock
  
  // Form State
  const [productForm, setProductForm] = useState({
    id: null, title: '', title_en: '', price: '', 
    description: '', description_en: '', is_digital: true, 
    physical_stock: 0, images: [], 
    variants: [], // Cấu trúc định nghĩa: [{name: 'Màu', options: [...]}, {name: 'Size', ...}]
    allow_external_key: false 
  });
  
  // State quản lý danh sách các biến thể chi tiết (SKUs) lấy từ DB hoặc sinh ra từ Client
  const [skuList, setSkuList] = useState([]); 

  const [keyInput, setKeyInput] = useState(''); 
  const [stockInput, setStockInput] = useState(0); 
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // --- LOGIC SINH MA TRẬN BIẾN THỂ (GENERATOR) ---
  // Mỗi khi cấu trúc variants thay đổi, ta tính toán lại các SKU tiềm năng
  useEffect(() => {
    if (!productForm.variants || productForm.variants.length === 0) {
        if (!productForm.id && skuList.length > 0) setSkuList([]); // Reset nếu tạo mới
        return;
    }

    // Hàm đệ quy tạo tổ hợp
    const generateCombinations = (groups, prefix = {}) => {
        if (!groups.length) return [prefix];
        const firstGroup = groups[0];
        const restGroups = groups.slice(1);
        let combinations = [];
        
        // Nếu group không có option nào, bỏ qua
        if(!firstGroup.options || firstGroup.options.length === 0) return generateCombinations(restGroups, prefix);
        
        firstGroup.options.forEach(opt => {
            if (opt.label) {
                combinations = combinations.concat(
                    generateCombinations(restGroups, { ...prefix, [firstGroup.name]: opt.label })
                );
            }
        });
        return combinations;
    };

    const validVariants = productForm.variants.filter(v => v.name && v.options.length > 0);
    
    if(validVariants.length > 0) {
        const combos = generateCombinations(validVariants);
        
        // Merge với skuList hiện tại (để giữ lại stock/price đã nhập)
        const mergedSkus = combos.map(combo => {
            // Tìm xem SKU này đã có trong danh sách hiện tại chưa (So sánh options object)
            // Lưu ý: JSON.stringify để so sánh object đơn giản
            const existing = skuList.find(s => JSON.stringify(s.options) === JSON.stringify(combo));
            
            if (existing) return existing;
            
            // Nếu chưa có, tạo mới
            return {
                id: null, // Chưa có ID DB
                options: combo,
                sku_name: Object.values(combo).join(' - '),
                stock: 0,
                price_mod: 0,
                image: '',
                is_active: true
            };
        });
        
        // Chỉ cập nhật nếu số lượng hoặc nội dung thay đổi đáng kể để tránh re-render loop
        if (JSON.stringify(mergedSkus.map(s => s.options)) !== JSON.stringify(skuList.map(s => s.options))) {
             setSkuList(mergedSkus);
        }
    } else {
        setSkuList([]);
    }

  }, [productForm.variants]);

  // --- FETCH SKUs KHI EDIT ---
  const fetchSkus = async (productId) => {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId);
      if(!error && data) setSkuList(data);
  };

  // --- HANDLERS CHO FORM BIẾN THỂ (CẤU TRÚC) ---
  const addVariantGroup = () => setProductForm(prev => ({ ...prev, variants: [...(prev.variants || []), { name: '', options: [] }] }));
  
  const removeVariantGroup = (idx) => {
      setProductForm(prev => { 
          const n = [...prev.variants]; 
          n.splice(idx, 1); 
          return { ...prev, variants: n }; 
      });
      // Khi xoá nhóm, skuList sẽ tự động được useEffect tính toán lại
  };

  const updateVariantName = (idx, val) => setProductForm(prev => { const n = [...prev.variants]; n[idx].name = val; return { ...prev, variants: n }; });
  
  const addOptionToGroup = (idx) => setProductForm(prev => { 
      const n = [...prev.variants]; 
      // Option cấu trúc đơn giản hơn để định nghĩa
      n[idx].options.push({ label: '', label_en: '' }); 
      return { ...prev, variants: n }; 
  });
  
  const removeOptionFromGroup = (gIdx, oIdx) => setProductForm(prev => { const n = [...prev.variants]; n[gIdx].options.splice(oIdx, 1); return { ...prev, variants: n }; });
  
  const updateOption = (gIdx, oIdx, field, val) => setProductForm(prev => { const n = [...prev.variants]; n[gIdx].options[oIdx][field] = val; return { ...prev, variants: n }; });

  // --- HANDLERS CHO SKU LIST (KHO & GIÁ) ---
  const updateSkuField = (index, field, value) => {
      const newSkus = [...skuList];
      newSkus[index][field] = value;
      setSkuList(newSkus);
  };

  // --- BASIC HANDLERS ---
  const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(true);
      try {
          const fileName = `prod-${Date.now()}`;
          const { error } = await supabase.storage.from('product-images').upload(fileName, file);
          if(error) throw error;
          const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
          setProductForm(prev => ({ ...prev, images: [...(prev.images || []), data.publicUrl] }));
          toast.success("Đã tải ảnh lên!");
      } catch (err) { toast.error(err.message); } finally { setUploading(false); }
  };
  
  const handleRemoveImage = (idx) => setProductForm(prev => ({...prev, images: prev.images.filter((_, i) => i !== idx)}));

  const openAddModal = () => {
      setProductForm({ 
        id: null, title: '', title_en: '', price: '', 
        description: '', description_en: '', is_digital: true, 
        physical_stock: 0, images: [], variants: [], allow_external_key: false 
      });
      setSkuList([]);
      setShowProductModal(true);
  };

  const openEditModal = async (p) => {
      setProductForm({
        id: p.id, title: p.title, title_en: p.title_en || '', price: p.price,
        description: p.description || '', description_en: p.description_en || '',
        is_digital: p.is_digital, 
        physical_stock: p.physical_stock || 0, // Chỉ dùng hiển thị nếu không có variant
        images: p.images || [], 
        variants: p.variants || [], // Cấu trúc
        allow_external_key: p.allow_external_key || false
      });
      
      // Nếu có variants, fetch SKU list từ bảng product_variants
      if (p.variants && p.variants.length > 0) {
          await fetchSkus(p.id);
      } else {
          setSkuList([]);
      }
      setShowProductModal(true);
  };

  // --- SAVE PRODUCT (CORE LOGIC) ---
  const handleSaveProduct = async (e) => {
      e.preventDefault();
      setProcessing(true);
      
      try {
          // 1. Lưu thông tin cơ bản vào bảng Products
          const productData = {
              title: productForm.title, title_en: productForm.title_en,
              price: parseFloat(productForm.price) || 0,
              description: productForm.description, description_en: productForm.description_en,
              images: productForm.images, is_digital: productForm.is_digital,
              variants: productForm.variants, // Lưu cấu trúc cây để lần sau render UI
              allow_external_key: productForm.allow_external_key
          };
          
          // Nếu không có variant, lưu physical_stock trực tiếp vào bảng products
          if (!productForm.variants || productForm.variants.length === 0) {
              productData.physical_stock = parseInt(productForm.physical_stock) || 0;
          }

          let productId = productForm.id;

          if (productId) {
              const { error } = await supabase.from('products').update(productData).eq('id', productId);
              if (error) throw error;
          } else {
              const { data, error } = await supabase.from('products').insert(productData).select().single();
              if (error) throw error;
              productId = data.id;
          }

          // 2. Xử lý Variants (SKU)
          // Chỉ xử lý nếu có variants defined
          if (productForm.variants && productForm.variants.length > 0 && skuList.length > 0) {
               // A. Lấy danh sách ID hiện có trong DB để biết cái nào cần xoá (nếu người dùng xoá bớt option)
               const { data: existingVariants } = await supabase.from('product_variants').select('id').eq('product_id', productId);
               const existingIds = existingVariants?.map(v => v.id) || [];
               
               const currentUiIds = skuList.map(s => s.id).filter(id => id !== null);
               const idsToDelete = existingIds.filter(id => !currentUiIds.includes(id));

               // B. Xoá các SKU không còn tồn tại
               if (idsToDelete.length > 0) {
                   await supabase.from('product_variants').delete().in('id', idsToDelete);
               }

               // C. Upsert (Thêm mới hoặc Cập nhật) các SKU
               const upsertData = skuList.map(sku => ({
                   id: sku.id, // Nếu null -> Insert, có ID -> Update
                   product_id: productId,
                   options: sku.options,
                   sku_name: Object.values(sku.options).join(' - '),
                   price_mod: parseFloat(sku.price_mod) || 0,
                   stock: parseInt(sku.stock) || 0,
                   is_active: true
               }));

               // Supabase upsert
               const { error: upsertError } = await supabase.from('product_variants').upsert(upsertData);
               if (upsertError) throw upsertError;
          }

          setShowProductModal(false);
          queryClient.invalidateQueries({ queryKey: ['admin-products'] });
          toast.success(t("Đã lưu sản phẩm thành công!", "Product saved successfully!"));

      } catch (err) { 
          console.error(err);
          toast.error("Lỗi: " + err.message); 
      } finally {
          setProcessing(false);
      }
  };

  // --- IMPORT KEY / STOCK LOGIC ---
  const handleImportStock = async () => {
    try {
        if (!showKeyModal?.product) return;
        const currentProd = showKeyModal.product;
        const targetSku = showKeyModal.sku; // Nếu là variant, sẽ có thông tin SKU
        
        if (currentProd.is_digital) {
            // --- NHẬP KEY ---
            if (!keyInput.trim()) return;
            const codes = keyInput.split('\n').filter(c => c.trim() !== '');
            
            // Thông tin variant cho Key
            let variantInfo = targetSku ? { ...targetSku.options } : {};
            const fullTitle = targetSku 
                ? `${currentProd.title} (${Object.values(targetSku.options).join(' - ')})`
                : currentProd.title;
            
            variantInfo._product_name = currentProd.title;
            variantInfo._full_title = fullTitle;

            const insertData = codes.map(code => ({ 
                product_id: currentProd.id, 
                key_value: code.trim(),
                variant_info: variantInfo, 
                is_used: false 
            }));

            const { error } = await supabase.from('product_keys').insert(insertData);
            if (error) throw error;
            
            toast.success(t(`Đã thêm ${insertData.length} Keys!`, `Added ${insertData.length} Keys!`));

            // Nếu là variants, update luôn số lượng tồn kho ảo vào bảng product_variants để hiển thị cho đẹp
            if (targetSku && targetSku.id) {
                 // Đếm lại thực tế (hoặc cộng dồn) - Ở đây ta cộng dồn cho nhanh
                 await supabase.rpc('increment_variant_stock', { v_id: targetSku.id, qty: insertData.length });
            }

        } else {
            // --- NHẬP KHO VẬT LÝ ---
            const qtyToAdd = parseInt(stockInput);
            if (isNaN(qtyToAdd) || qtyToAdd <= 0) return toast.warn("Số lượng > 0");

            if (targetSku) {
                // Update vào bảng product_variants
                // Cần lấy stock hiện tại + mới (hoặc logic cộng dồn)
                const newStock = (parseInt(targetSku.stock) || 0) + qtyToAdd;
                
                const { error } = await supabase.from('product_variants')
                    .update({ stock: newStock })
                    .eq('id', targetSku.id);
                if (error) throw error;

                // Update UI Local
                const skuIndex = skuList.findIndex(s => s.id === targetSku.id);
                if (skuIndex >= 0) updateSkuField(skuIndex, 'stock', newStock);

            } else {
                // Update vào bảng products (nếu không có variant)
                const { data: latest } = await supabase.from('products').select('physical_stock').eq('id', currentProd.id).single();
                const newStock = (latest.physical_stock || 0) + qtyToAdd;
                await supabase.from('products').update({ physical_stock: newStock }).eq('id', currentProd.id);
            }
            toast.success(t("Đã cập nhật kho!", "Stock updated!"));
        }

        setKeyInput(''); setStockInput(0); setShowKeyModal(null);
        queryClient.invalidateQueries({ queryKey: ['admin-products'] });

    } catch (err) { toast.error("Lỗi: " + err.message); }
  };


  if (isLoading) return <div className="p-8 text-center">{t('Đang tải kho...', 'Loading Inventory...')}</div>;

  return (
    <div className="animate-fade-in pb-20">
       <div className="flex justify-between mb-6 items-center">
         <div>
            <h2 className="text-2xl font-bold text-slate-800">{t('Kho Sản Phẩm & Biến Thể', 'Product & Variants')}</h2>
            <p className="text-sm text-slate-500">Quản lý sản phẩm, thiết lập biến thể cha-con và tồn kho chi tiết.</p>
         </div>
         <button onClick={openAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow hover:bg-blue-700 transition"><Plus size={18}/> {t('Thêm Mới', 'Add New')}</button>
       </div>
       
       <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
         <table className="w-full text-left">
           <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase font-bold tracking-wider">
               <tr>
                   <th className="p-4">{t('Sản phẩm', 'Product')}</th>
                   <th className="p-4">{t('Cấu hình', 'Config')}</th>
                   <th className="p-4">{t('Tồn kho', 'Stock')}</th>
                   <th className="p-4 text-right">{t('Thao tác', 'Action')}</th>
               </tr>
           </thead>
           <tbody className="divide-y divide-slate-100">
             {products.map(p => {
               // Tính tổng stock hiển thị
               const hasVariants = p.variants && p.variants.length > 0;
               return (
               <tr key={p.id} className="hover:bg-slate-50 transition">
                 <td className="p-4 flex gap-3 items-center">
                    <div className="w-12 h-12 rounded bg-slate-100 border flex-shrink-0 overflow-hidden">
                        <img src={p.images?.[0] || 'https://via.placeholder.com/50'} className="w-full h-full object-cover"/>
                    </div> 
                    <div>
                        <span className="font-bold text-slate-700 block text-base">{p.title}</span>
                        {p.title_en && <span className="text-xs text-slate-400 block">{p.title_en}</span>}
                        <div className="flex gap-2 mt-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded border ${p.is_digital ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                {p.is_digital ? 'Digital Key' : 'Physical'}
                            </span>
                        </div>
                    </div>
                 </td>
                 <td className="p-4">
                     {hasVariants ? (
                         <div className="space-y-1">
                             {p.variants.map((v, i) => (
                                 <div key={i} className="text-xs text-slate-600 flex items-center gap-1">
                                     <span className="font-bold bg-slate-200 px-1 rounded text-[10px]">{v.name}</span>
                                     <span className="text-slate-400">→</span>
                                     <span>{v.options?.map(o=>o.label).join(', ')}</span>
                                 </div>
                             ))}
                         </div>
                     ) : (
                         <span className="text-sm text-slate-400 italic">No variants</span>
                     )}
                 </td>
                 <td className="p-4">
                     {/* Hiển thị số lượng. Nếu là variants, cần query sum hoặc hiển thị từ view. Ở đây hiển thị tượng trưng */}
                     <span className="font-mono font-bold text-lg text-slate-700">
                         {/* Cần logic hiển thị tổng stock chuẩn từ view SQL */}
                         {/* Để đơn giản, ta tin vào cột physical_stock ở bảng products đã được trigger cập nhật, 
                             hoặc hiển thị 'Check detail' */}
                        {hasVariants ? '---' : (p.physical_stock || 0)}
                     </span>
                 </td>
                 <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                        {!hasVariants && (
                             <button onClick={()=>setShowKeyModal({product: p, variant: null})} className="p-2 bg-green-50 text-green-600 rounded hover:bg-green-100" title="Add Stock/Key">
                                 <Plus size={16}/>
                             </button>
                        )}
                        <button onClick={()=>openEditModal(p)} className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" title="Edit">
                            <Edit size={16}/>
                        </button>
                    </div>
                 </td>
               </tr>
             )})}
           </tbody>
         </table>
       </div>

       {/* --- MODAL EDIT/ADD PRODUCT --- */}
       {showProductModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8 flex flex-col max-h-[90vh]">
              {/* HEADER */}
              <div className="p-6 border-b flex justify-between items-center bg-white sticky top-0 z-10 rounded-t-2xl">
                  <div>
                      <h2 className="text-xl font-bold text-slate-800">
                          {productForm.id ? t('Chi tiết sản phẩm', 'Product Details') : t('Thêm sản phẩm mới', 'Add New Product')}
                      </h2>
                      <p className="text-xs text-slate-400">Thiết lập thông tin chung và cấu hình biến thể</p>
                  </div>
                  <button onClick={() => setShowProductModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={20}/></button>
              </div>

              {/* BODY - SCROLLABLE */}
              <div className="p-6 overflow-y-auto flex-1 space-y-8">
                 
                 {/* 1. THÔNG TIN CƠ BẢN */}
                 <section>
                     <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-l-4 border-blue-500 pl-3">1. Thông tin chung</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tên sản phẩm (VN) <span className="text-red-500">*</span></label>
                                <input required className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" value={productForm.title} onChange={e=>setProductForm({...productForm, title: e.target.value})}/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Giá cơ bản ($ USDT) <span className="text-red-500">*</span></label>
                                <input type="number" step="0.01" required className="w-full border border-slate-300 p-2.5 rounded-lg font-mono text-green-600 font-bold focus:ring-2 focus:ring-blue-500 outline-none" value={productForm.price} onChange={e=>setProductForm({...productForm, price: e.target.value})}/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Loại sản phẩm</label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 border p-3 rounded-lg cursor-pointer flex items-center gap-2 transition ${productForm.is_digital ? 'bg-purple-50 border-purple-200 text-purple-700' : 'hover:bg-slate-50'}`}>
                                        <input type="radio" name="type" checked={productForm.is_digital} onChange={()=>setProductForm({...productForm, is_digital: true})} className="w-4 h-4 text-purple-600"/>
                                        <Key size={18}/>
                                        <span className="font-bold">Digital (Key/File)</span>
                                    </label>
                                    <label className={`flex-1 border p-3 rounded-lg cursor-pointer flex items-center gap-2 transition ${!productForm.is_digital ? 'bg-orange-50 border-orange-200 text-orange-700' : 'hover:bg-slate-50'}`}>
                                        <input type="radio" name="type" checked={!productForm.is_digital} onChange={()=>setProductForm({...productForm, is_digital: false})} className="w-4 h-4 text-orange-600"/>
                                        <Package size={18}/>
                                        <span className="font-bold">Vật lý (Ship)</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tên tiếng Anh (Optional)</label>
                                <input className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" value={productForm.title_en} onChange={e=>setProductForm({...productForm, title_en: e.target.value})}/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả ngắn</label>
                                <textarea className="w-full border border-slate-300 p-2.5 rounded-lg h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none" value={productForm.description} onChange={e=>setProductForm({...productForm, description: e.target.value})}></textarea>
                            </div>
                        </div>
                     </div>
                 </section>

                 {/* 2. CẤU HÌNH BIẾN THỂ (DEFINITION) */}
                 <section>
                    <div className="flex justify-between items-center mb-4 border-l-4 border-purple-500 pl-3">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">2. Cấu hình biến thể (Variants)</h3>
                        <button type="button" onClick={addVariantGroup} className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-purple-700 transition flex items-center gap-1">
                            <Plus size={14}/> Thêm nhóm (Ví dụ: Size, Màu)
                        </button>
                    </div>

                    <div className="space-y-4 bg-slate-50 p-6 rounded-xl border border-slate-200">
                        {productForm.variants.length === 0 && (
                            <div className="text-center text-slate-400 text-sm py-4">Sản phẩm này chưa có biến thể (Sản phẩm đơn).</div>
                        )}
                        
                        {productForm.variants.map((group, gIdx) => (
                            <div key={gIdx} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm relative group animate-fade-in">
                                <button type="button" onClick={() => removeVariantGroup(gIdx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition"><X size={16}/></button>
                                
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-3">
                                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Tên nhóm</label>
                                        <input type="text" placeholder="Ví dụ: Size, Màu..." className="w-full border border-slate-300 rounded p-2 text-sm font-bold focus:border-purple-500 outline-none" value={group.name} onChange={(e) => updateVariantName(gIdx, e.target.value)} />
                                    </div>
                                    <div className="col-span-9">
                                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Các lựa chọn (Options)</label>
                                        <div className="flex flex-wrap gap-2">
                                            {group.options.map((opt, oIdx) => (
                                                <div key={oIdx} className="flex items-center gap-1 bg-slate-100 pl-2 pr-1 py-1 rounded border border-slate-200">
                                                    <input placeholder="Giá trị..." className="bg-transparent w-20 text-sm outline-none" value={opt.label} onChange={e => updateOption(gIdx, oIdx, 'label', e.target.value)} />
                                                    <button type="button" onClick={() => removeOptionFromGroup(gIdx, oIdx)} className="text-slate-400 hover:text-red-500"><X size={14}/></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => addOptionToGroup(gIdx)} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 font-bold rounded hover:bg-blue-100">+ Thêm</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                 </section>

                 {/* 3. CHI TIẾT SKU & TỒN KHO (INVENTORY MATRIX) */}
                 {productForm.variants.length > 0 && skuList.length > 0 && (
                     <section>
                         <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-l-4 border-green-500 pl-3">3. Quản lý kho chi tiết (SKU Matrix)</h3>
                         <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                             <table className="w-full text-sm text-left bg-white">
                                 <thead className="bg-slate
