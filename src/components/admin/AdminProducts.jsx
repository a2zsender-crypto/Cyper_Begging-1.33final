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
  const [showKeyModal, setShowKeyModal] = useState(null);
  
  // Form State
  const [productForm, setProductForm] = useState({
    id: null, title: '', title_en: '', price: '', 
    description: '', description_en: '', is_digital: true, 
    physical_stock: 0, images: [], 
    variants: [], 
    allow_external_key: false 
  });
  
  const [skuList, setSkuList] = useState([]); 

  const [keyInput, setKeyInput] = useState(''); 
  const [stockInput, setStockInput] = useState(0); 
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  // State quản lý upload ảnh cho từng dòng SKU (để hiện loading)
  const [skuUploading, setSkuUploading] = useState({}); 

  // --- LOGIC SINH MA TRẬN BIẾN THỂ (GENERATOR) ---
  useEffect(() => {
    if (!productForm.variants || productForm.variants.length === 0) {
        if (!productForm.id && skuList.length > 0) setSkuList([]); 
        return;
    }

    const generateCombinations = (groups, prefix = {}) => {
        if (!groups.length) return [prefix];
        const firstGroup = groups[0];
        const restGroups = groups.slice(1);
        let combinations = [];
        
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
        
        const mergedSkus = combos.map(combo => {
            const existing = skuList.find(s => JSON.stringify(s.options) === JSON.stringify(combo));
            if (existing) return existing;
            
            return {
                id: null,
                options: combo,
                sku_name: Object.values(combo).join(' - '),
                stock: 0,
                price: productForm.price || 0, // Mặc định lấy giá gốc
                image: '', // Ảnh riêng cho SKU
                is_active: true
            };
        });
        
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

  // --- HANDLERS CHO FORM BIẾN THỂ ---
  const addVariantGroup = () => setProductForm(prev => ({ ...prev, variants: [...(prev.variants || []), { name: '', options: [] }] }));
  
  const removeVariantGroup = (idx) => {
      setProductForm(prev => { 
          const n = [...prev.variants]; n.splice(idx, 1); return { ...prev, variants: n }; 
      });
  };

  const updateVariantName = (idx, val) => setProductForm(prev => { const n = [...prev.variants]; n[idx].name = val; return { ...prev, variants: n }; });
  
  const addOptionToGroup = (idx) => setProductForm(prev => { 
      const n = [...prev.variants]; 
      n[idx].options.push({ label: '', label_en: '' }); 
      return { ...prev, variants: n }; 
  });
  
  const removeOptionFromGroup = (gIdx, oIdx) => setProductForm(prev => { const n = [...prev.variants]; n[gIdx].options.splice(oIdx, 1); return { ...prev, variants: n }; });
  
  const updateOption = (gIdx, oIdx, field, val) => setProductForm(prev => { const n = [...prev.variants]; n[gIdx].options[oIdx][field] = val; return { ...prev, variants: n }; });

  // --- HANDLERS CHO SKU LIST (KHO, GIÁ, ẢNH) ---
  const updateSkuField = (index, field, value) => {
      const newSkus = [...skuList];
      newSkus[index][field] = value;
      setSkuList(newSkus);
  };

  // Upload ảnh cho 1 dòng SKU cụ thể
  const handleSkuImageUpload = async (e, index) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setSkuUploading(prev => ({...prev, [index]: true}));
      try {
          const fileName = `sku-${Date.now()}-${index}`;
          const { error } = await supabase.storage.from('product-images').upload(fileName, file);
          if(error) throw error;
          
          const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
          updateSkuField(index, 'image', data.publicUrl);
          toast.success("Đã tải ảnh biến thể!");
      } catch (err) { 
          toast.error(err.message); 
      } finally { 
          setSkuUploading(prev => ({...prev, [index]: false})); 
      }
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
        physical_stock: p.physical_stock || 0, 
        images: p.images || [], 
        variants: p.variants || [], 
        allow_external_key: p.allow_external_key || false
      });
      
      if (p.variants && p.variants.length > 0) {
          await fetchSkus(p.id);
      } else {
          setSkuList([]);
      }
      setShowProductModal(true);
  };

  const handleSaveProduct = async (e) => {
      e.preventDefault();
      setProcessing(true);
      
      try {
          const productData = {
              title: productForm.title, title_en: productForm.title_en,
              price: parseFloat(productForm.price) || 0,
              description: productForm.description, description_en: productForm.description_en,
              images: productForm.images, is_digital: productForm.is_digital,
              variants: productForm.variants, 
              allow_external_key: productForm.allow_external_key
          };
          
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

          if (productForm.variants && productForm.variants.length > 0 && skuList.length > 0) {
               // A. Xóa SKU cũ không còn trong list
               const { data: existingVariants } = await supabase.from('product_variants').select('id').eq('product_id', productId);
               const existingIds = existingVariants?.map(v => v.id) || [];
               const currentUiIds = skuList.map(s => s.id).filter(id => id !== null);
               const idsToDelete = existingIds.filter(id => !currentUiIds.includes(id));

               if (idsToDelete.length > 0) {
                   await supabase.from('product_variants').delete().in('id', idsToDelete);
               }

               // B. Upsert SKU mới
               const upsertData = skuList.map(sku => ({
                   id: sku.id, 
                   product_id: productId,
                   options: sku.options,
                   sku_name: Object.values(sku.options).join(' - '),
                   price: parseFloat(sku.price) || 0, // Lưu giá chính xác của SKU
                   stock: parseInt(sku.stock) || 0,
                   image: sku.image, // Lưu ảnh SKU
                   is_active: true
               }));

               const { error: upsertError } = await supabase.from('product_variants').upsert(upsertData);
               if (upsertError) throw upsertError;
          }

          setShowProductModal(false);
          queryClient.invalidateQueries({ queryKey: ['admin-products'] });
          toast.success(t("Đã lưu sản phẩm thành công!", "Product saved successfully!"));

      } catch (err) { 
          toast.error("Lỗi: " + err.message); 
      } finally {
          setProcessing(false);
      }
  };

  const handleImportStock = async () => {
    try {
        if (!showKeyModal?.product) return;
        const currentProd = showKeyModal.product;
        const targetSku = showKeyModal.sku; 
        
        if (currentProd.is_digital) {
            if (!keyInput.trim()) return;
            const codes = keyInput.split('\n').filter(c => c.trim() !== '');
            
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
            
            // Cập nhật stock hiển thị UI tạm thời
            if (targetSku) {
                const newStock = (parseInt(targetSku.stock) || 0) + insertData.length;
                const skuIndex = skuList.findIndex(s => s === targetSku);
                if (skuIndex >= 0) updateSkuField(skuIndex, 'stock', newStock);
            }

        } else {
            const qtyToAdd = parseInt(stockInput);
            if (isNaN(qtyToAdd) || qtyToAdd <= 0) return toast.warn("Số lượng > 0");

            if (targetSku) {
                const newStock = (parseInt(targetSku.stock) || 0) + qtyToAdd;
                
                // Cập nhật DB
                if (targetSku.id) {
                     await supabase.from('product_variants').update({ stock: newStock }).eq('id', targetSku.id);
                }
                
                // Cập nhật UI
                const skuIndex = skuList.findIndex(s => s === targetSku);
                if (skuIndex >= 0) updateSkuField(skuIndex, 'stock', newStock);
            } else {
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
         </div>
         <button onClick={openAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow hover:bg-blue-700 transition"><Plus size={18}/> {t('Thêm Mới', 'Add New')}</button>
       </div>
       
       {/* MAIN TABLE (LIST) */}
       <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
         <table className="w-full text-left">
           <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase font-bold tracking-wider">
               <tr>
                   <th className="p-4">{t('Sản phẩm', 'Product')}</th>
                   <th className="p-4">{t('Cấu hình', 'Config')}</th>
                   <th className="p-4">{t('Tổng Tồn kho', 'Total Stock')}</th>
                   <th className="p-4 text-right">{t('Thao tác', 'Action')}</th>
               </tr>
           </thead>
           <tbody className="divide-y divide-slate-100">
             {products.map(p => {
               const hasVariants = p.variants && p.variants.length > 0;
               return (
               <tr key={p.id} className="hover:bg-slate-50 transition">
                 <td className="p-4 flex gap-3 items-center">
                    <div className="w-12 h-12 rounded bg-slate-100 border flex-shrink-0 overflow-hidden">
                        <img src={p.images?.[0] || 'https://via.placeholder.com/50'} className="w-full h-full object-cover"/>
                    </div> 
                    <div>
                        <span className="font-bold text-slate-700 block text-base">{p.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${p.is_digital ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                            {p.is_digital ? 'Digital' : 'Physical'}
                        </span>
                    </div>
                 </td>
                 <td className="p-4">
                     {hasVariants ? (
                         <div className="space-y-1">
                             {p.variants.map((v, i) => (
                                 <div key={i} className="text-xs text-slate-600">
                                     <span className="font-bold">{v.name}: </span>
                                     <span>{v.options?.map(o=>o.label).join(', ')}</span>
                                 </div>
                             ))}
                         </div>
                     ) : <span className="text-slate-400 italic text-xs">Không biến thể</span>}
                 </td>
                 <td className="p-4 font-mono font-bold text-lg text-slate-700">
                    {/* Hiển thị tạm, lý tưởng là sum từ bảng variants */}
                    {hasVariants ? '---' : p.physical_stock}
                 </td>
                 <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                        {!hasVariants && (
                             <button onClick={()=>setShowKeyModal({product: p, variant: null})} className="p-2 bg-green-50 text-green-600 rounded hover:bg-green-100"><Plus size={16}/></button>
                        )}
                        <button onClick={()=>openEditModal(p)} className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Edit size={16}/></button>
                    </div>
                 </td>
               </tr>
             )})}
           </tbody>
         </table>
       </div>

       {/* MODAL EDIT/ADD */}
       {showProductModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl my-8 flex flex-col max-h-[90vh]">
              <div className="p-6 border-b flex justify-between items-center bg-white rounded-t-2xl">
                  <h2 className="text-xl font-bold text-slate-800">{productForm.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h2>
                  <button onClick={() => setShowProductModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-8">
                 {/* 1. INFO */}
                 <section>
                     <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-l-4 border-blue-500 pl-3">1. Thông tin chung</h3>
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div><label className="block text-sm font-bold mb-1">Tên SP (VN)</label><input required className="w-full border p-2 rounded" value={productForm.title} onChange={e=>setProductForm({...productForm, title: e.target.value})}/></div>
                            <div><label className="block text-sm font-bold mb-1">Giá cơ bản (USDT)</label><input type="number" className="w-full border p-2 rounded font-mono font-bold text-green-600" value={productForm.price} onChange={e=>setProductForm({...productForm, price: e.target.value})}/></div>
                            <div className="flex gap-4 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={productForm.is_digital} onChange={()=>setProductForm({...productForm, is_digital: true})}/> Digital (Key)</label>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={!productForm.is_digital} onChange={()=>setProductForm({...productForm, is_digital: false})}/> Physical (Ship)</label>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-bold mb-1">Mô tả</label><textarea className="w-full border p-2 rounded h-24" value={productForm.description} onChange={e=>setProductForm({...productForm, description: e.target.value})}></textarea></div>
                            <div>
                                <label className="block text-sm font-bold mb-2">Ảnh Chính</label>
                                <div className="flex gap-2">
                                    {productForm.images.map((img, i) => <img key={i} src={img} className="w-16 h-16 object-cover rounded border"/>)}
                                    <label className="w-16 h-16 flex items-center justify-center border border-dashed rounded cursor-pointer hover:bg-slate-50"><Upload size={16}/><input type="file" className="hidden" onChange={handleImageUpload}/></label>
                                </div>
                            </div>
                        </div>
                     </div>
                 </section>

                 {/* 2. DEFINITION (Chỉ tạo nhóm và options, KHÔNG nhập giá/ảnh ở đây) */}
                 <section>
                    <div className="flex justify-between items-center mb-4 border-l-4 border-purple-500 pl-3">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">2. Cấu hình biến thể (Tạo nhóm)</h3>
                        <button type="button" onClick={addVariantGroup} className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded">+ Thêm Nhóm</button>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                        {productForm.variants.map((group, gIdx) => (
                            <div key={gIdx} className="bg-white p-3 rounded border flex gap-4 items-start relative">
                                <button onClick={() => removeVariantGroup(gIdx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><X size={16}/></button>
                                <div className="w-1/4">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Tên Nhóm</label>
                                    <input placeholder="Ví dụ: Màu sắc" className="w-full border-b font-bold text-sm py-1 outline-none focus:border-purple-500" value={group.name} onChange={(e) => updateVariantName(gIdx, e.target.value)} />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Các lựa chọn</label>
                                    <div className="flex flex-wrap gap-2">
                                        {group.options.map((opt, oIdx) => (
                                            <div key={oIdx} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border">
                                                <input placeholder="Giá trị" className="bg-transparent w-20 text-sm outline-none" value={opt.label} onChange={e => updateOption(gIdx, oIdx, 'label', e.target.value)} />
                                                <button onClick={() => removeOptionFromGroup(gIdx, oIdx)} className="text-slate-400 hover:text-red-500"><X size={12}/></button>
                                            </div>
                                        ))}
                                        <button onClick={() => addOptionToGroup(gIdx)} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 font-bold rounded hover:bg-blue-100">+ Thêm</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {productForm.variants.length === 0 && <p className="text-sm text-slate-400 italic text-center">Chưa có biến thể. Sản phẩm này sẽ được bán như sản phẩm đơn.</p>}
                    </div>
                 </section>

                 {/* 3. SKU MATRIX (Nhập GIÁ và ẢNH tại đây) */}
                 {productForm.variants.length > 0 && skuList.length > 0 && (
                     <section>
                         <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-l-4 border-green-500 pl-3">3. Chi tiết từng biến thể (SKU)</h3>
                         <div className="overflow-x-auto rounded-xl border border-slate-200">
                             <table className="w-full text-sm text-left bg-white">
                                 <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-500">
                                     <tr>
                                         <th className="p-3">Tên Biến Thể</th>
                                         <th className="p-3 w-32 text-center">Ảnh riêng</th>
                                         <th className="p-3 w-32 text-center">Giá bán ($)</th>
                                         <th className="p-3 w-24 text-center">Tồn kho</th>
                                         <th className="p-3 text-right">Nhập Kho</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                     {skuList.map((sku, idx) => (
                                         <tr key={idx} className="hover:bg-slate-50">
                                             <td className="p-3 font-medium text-slate-700">
                                                 {Object.entries(sku.options).map(([k, v]) => (
                                                     <span key={k} className="mr-2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs border border-blue-100">{k}: <b>{v}</b></span>
                                                 ))}
                                             </td>
                                             <td className="p-3 text-center">
                                                 <label className="inline-block w-10 h-10 rounded border overflow-hidden cursor-pointer relative group bg-white">
                                                     {sku.image ? <img src={sku.image} className="w-full h-full object-cover"/> : <ImageIcon size={16} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-300"/>}
                                                     {skuUploading[idx] && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>}
                                                     <input type="file" className="hidden" onChange={(e) => handleSkuImageUpload(e, idx)} />
                                                 </label>
                                             </td>
                                             <td className="p-3">
                                                 <input type="number" step="0.01" className="w-full text-center border p-1 rounded font-bold text-green-600" 
                                                    value={sku.price} 
                                                    onChange={(e) => updateSkuField(idx, 'price', e.target.value)} 
                                                 />
                                             </td>
                                             <td className="p-3 text-center font-bold">{sku.stock}</td>
                                             <td className="p-3 text-right">
                                                 <button type="button" onClick={() => setShowKeyModal({product: productForm, sku: sku})} className="bg-slate-800 text-white px-3 py-1 rounded text-xs hover:bg-black">
                                                     {productForm.is_digital ? <Key size={12}/> : <Package size={12}/>}
                                                 </button>
                                             </td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         </div>
                     </section>
                 )}
              </div>

              <div className="p-4 border-t bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
                  <button onClick={() => setShowProductModal(false)} className="px-5 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded">Hủy</button>
                  <button onClick={handleSaveProduct} disabled={processing} className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700 transition flex items-center gap-2">
                      {processing ? 'Đang lưu...' : <><Save size={18}/> Lưu Sản Phẩm</>}
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL IMPORT (Giữ nguyên logic cũ nhưng hỗ trợ nhập cho SKU) */}
      {showKeyModal && (
         <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md">
               <h3 className="font-bold mb-4 text-lg text-slate-800 flex items-center gap-2">
                   {showKeyModal.product.is_digital ? t('Nhập Keys', 'Import Keys') : t('Thêm tồn kho', 'Add Stock')}
               </h3>
               {showKeyModal.sku && <div className="mb-4 bg-purple-50 p-2 rounded text-xs text-purple-700 font-bold border border-purple-100">
                   Biến thể: {Object.values(showKeyModal.sku.options).join(' - ')}
               </div>}
               
               {showKeyModal.product.is_digital ? (
                   <textarea className="w-full border p-3 h-48 rounded-xl font-mono text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="Mỗi dòng 1 key..."></textarea>
               ) : (
                   <div className="text-center"><input type="number" className="w-24 border p-2 rounded-lg text-center font-bold text-2xl" value={stockInput} onChange={e => setStockInput(e.target.value)}/></div>
               )}
               
               <div className="flex justify-end gap-2 mt-6">
                   <button onClick={() => setShowKeyModal(null)} className="px-4 py-2 text-slate-500 font-bold">Đóng</button>
                   <button onClick={handleImportStock} className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 shadow">Lưu</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
