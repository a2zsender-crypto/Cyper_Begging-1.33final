import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Plus, Edit, X, Upload, Key, Layers, Settings, Image as ImageIcon, Save, Tag, RefreshCw } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { toast } from 'react-toastify';
import { useQuery, useQueryClient } from '@tanstack/react-query'; 

export default function AdminProducts() {
  const { t, lang } = useLang(); 
  const queryClient = useQueryClient(); 
  
// --- FETCH PRODUCTS & STOCK & VARIANTS ---
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      // 1. Lấy products kèm variants
      const { data: productsData, error: prodError } = await supabase
        .from('products')
        .select(`*, product_variants(*)`)
        .order('id', {ascending: false});
        
      if (prodError) throw prodError;

      // 2. Lấy dữ liệu tồn kho từ View
      const { data: stockData, error: stockError } = await supabase
        .from('view_product_variant_stock')
        .select('*');
      
      if (stockError) console.error("Stock View Error:", stockError);

      // 3. Merge Stock
      return productsData.map(p => {
          const variantStocks = stockData?.filter(s => s.product_id === p.id) || [];
          
          // Tính tổng tồn kho khả dụng của toàn bộ sản phẩm
          const totalStock = variantStocks.reduce((sum, item) => {
              // Tồn kho gốc (Digital lấy digital_stock, Physical lấy total_stock)
              const base = p.is_digital ? (item.digital_stock || 0) : (item.total_stock || 0);
              // Khả dụng = Gốc - Đang giữ (pending)
              return sum + Math.max(0, base - (item.pending_stock || 0));
          }, 0);

          let updatedVariants = [];
          if (p.product_variants && p.product_variants.length > 0) {
              updatedVariants = p.product_variants.map(rawVariant => {
                  const viewItem = stockData?.find(s => s.variant_id === rawVariant.id);
                  let vStock = 0;
                  if (viewItem) {
                      const base = p.is_digital ? (viewItem.digital_stock || 0) : (viewItem.total_stock || 0);
                      vStock = Math.max(0, base - (viewItem.pending_stock || 0));
                  } else {
                      vStock = rawVariant.stock || 0;
                  }
                  return { ...rawVariant, stock: vStock };
              });
          }

          let thumb = (p.images && p.images.length > 0) ? p.images[0] : null;
          if (!thumb && updatedVariants.length > 0) {
              const vWithImg = updatedVariants.find(v => v.image);
              if (vWithImg) thumb = vWithImg.image;
          }
          if (!thumb) thumb = 'https://via.placeholder.com/50?text=NoImg';

          return {
              ...p,
              product_variants: updatedVariants,
              true_stock: totalStock, // Đây là giá trị hiển thị ở cột Tồn kho
              display_image: thumb 
          };
      });
    }
  });

  // --- FETCH SKU NAMES ---
  const [existingSkuNames, setExistingSkuNames] = useState(new Set());
  
  useEffect(() => {
      const fetchAllSkus = async () => {
          const { data } = await supabase.from('product_variants').select('sku_name');
          if (data) {
              const names = new Set(data.map(item => item.sku_name?.trim().toLowerCase()));
              setExistingSkuNames(names);
          }
      };
      fetchAllSkus();
  }, [products]); 

  // --- MODAL STATES ---
  const [showProductModal, setShowProductModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(null); 
  
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
  const [skuUploading, setSkuUploading] = useState(null);

  // --- LOGIC GENERATOR ---
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
        const currentSessionNames = new Set(); 
        skuList.forEach(s => currentSessionNames.add(s.sku_name.toLowerCase()));

        const mergedSkus = combos.map(combo => {
            const sortObj = (o) => Object.keys(o).sort().reduce((r, k) => (r[k] = o[k], r), {});
            const comboStr = JSON.stringify(sortObj(combo));

            const existing = skuList.find(s => JSON.stringify(sortObj(s.options)) === comboStr);
            if (existing) {
                currentSessionNames.add(existing.sku_name.toLowerCase());
                return existing;
            }
            
            let baseName = Object.values(combo).join(' - ');
            let uniqueName = baseName;
            let counter = 1;

            while (
                existingSkuNames.has(uniqueName.toLowerCase()) || 
                currentSessionNames.has(uniqueName.toLowerCase())
            ) {
                uniqueName = `${baseName}${counter}`; 
                counter++;
            }
            currentSessionNames.add(uniqueName.toLowerCase());

            return {
                id: null, options: combo, sku_name: uniqueName,
                stock: 0, price_mod: 0, image: '', is_active: true
            };
        });
        
        const currentOptionsJSON = JSON.stringify(skuList.map(s => s.options));
        const newOptionsJSON = JSON.stringify(mergedSkus.map(s => s.options));
        if (currentOptionsJSON !== newOptionsJSON) setSkuList(mergedSkus);
    } else {
        setSkuList([]);
    }
  }, [productForm.variants]);

  // --- HANDLERS UI ---
  const addVariantGroup = () => setProductForm(prev => ({ ...prev, variants: [...(prev.variants || []), { name: '', options: [] }] }));
  const removeVariantGroup = (idx) => setProductForm(prev => { const n = [...prev.variants]; n.splice(idx, 1); return { ...prev, variants: n }; });
  const updateVariantName = (idx, val) => setProductForm(prev => { const n = [...prev.variants]; n[idx].name = val; return { ...prev, variants: n }; });
  const addOptionToGroup = (idx) => setProductForm(prev => { const n = [...prev.variants]; n[idx].options.push({ label: '', label_en: '' }); return { ...prev, variants: n }; });
  const removeOptionFromGroup = (gIdx, oIdx) => setProductForm(prev => { const n = [...prev.variants]; n[gIdx].options.splice(oIdx, 1); return { ...prev, variants: n }; });
  const updateOption = (gIdx, oIdx, field, val) => setProductForm(prev => { const n = [...prev.variants]; n[gIdx].options[oIdx][field] = val; return { ...prev, variants: n }; });
  
  const updateSkuField = (index, field, value) => {
      const newSkus = [...skuList];
      newSkus[index][field] = value;
      setSkuList(newSkus);
  };

  const handleSkuImageUpload = async (e, index) => {
      const file = e.target.files[0];
      if (!file) return;
      setSkuUploading(index);
      try {
          const fileName = `sku-${Date.now()}`;
          const { error } = await supabase.storage.from('product-images').upload(fileName, file);
          if(error) throw error;
          const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
          updateSkuField(index, 'image', data.publicUrl);
          toast.success(t("OK", "OK"));
      } catch (err) { toast.error(err.message); } finally { setSkuUploading(null); }
  };

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
          toast.success(t("OK", "OK"));
      } catch (err) { toast.error(err.message); } finally { setUploading(false); }
  };
  const handleRemoveImage = (idx) => setProductForm(prev => ({...prev, images: prev.images.filter((_, i) => i !== idx)}));

  const openAddModal = () => {
      setProductForm({ id: null, title: '', title_en: '', price: '', description: '', description_en: '', is_digital: true, physical_stock: 0, images: [], variants: [], allow_external_key: false });
      setSkuList([]);
      setShowProductModal(true);
  };

  const openEditModal = (p) => {
      setProductForm({
        id: p.id, title: p.title, title_en: p.title_en || '', price: p.price,
        description: p.description || '', description_en: p.description_en || '',
        is_digital: p.is_digital, physical_stock: p.physical_stock || 0, 
        images: p.images || [], 
        variants: p.variants || [], 
        allow_external_key: p.allow_external_key || false
      });
      
      if (p.product_variants) {
          setSkuList(p.product_variants);
      } else {
          setSkuList([]);
      }
      setShowProductModal(true);
  };

  // --- SAVE PRODUCT ---
  const handleSaveProduct = async (e) => {
      e.preventDefault();
      setProcessing(true);
      try {
          if (skuList.length > 0) {
              const skuNames = skuList.map(s => s.sku_name.trim().toLowerCase());
              const uniqueNames = new Set(skuNames);
              if (skuNames.length !== uniqueNames.size) throw new Error(t("Mã SKU bị trùng!", "Duplicate SKU names!"));
              if (skuList.some(s => !s.sku_name || s.sku_name.trim() === '')) throw new Error(t("Mã SKU không được trống!", "SKU required!"));
          }

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
               const { data: existingVariants } = await supabase.from('product_variants').select('id').eq('product_id', productId);
               const existingIds = existingVariants?.map(v => v.id) || [];
               const currentUiIds = skuList.map(s => s.id).filter(id => id !== null && id !== undefined);
               const idsToDelete = existingIds.filter(id => !currentUiIds.includes(id));
               
               if (idsToDelete.length > 0) await supabase.from('product_variants').delete().in('id', idsToDelete);

               const upsertData = skuList.map(sku => {
                   const record = {
                       product_id: productId,
                       options: sku.options,
                       sku_name: sku.sku_name.trim(),
                       price_mod: parseFloat(sku.price_mod) || 0,
                       stock: parseInt(sku.stock) || 0,
                       image: sku.image,
                       is_active: true
                   };
                   if (sku.id) record.id = sku.id;
                   return record;
               });

               const { error: upsertError } = await supabase.from('product_variants').upsert(upsertData);
               if (upsertError) throw upsertError;
          }

          setShowProductModal(false);
          queryClient.invalidateQueries({ queryKey: ['admin-products'] });
          toast.success(t("Lưu thành công!", "Saved successfully!"));
      } catch (err) { 
          toast.error(t("Lỗi: ", "Error: ") + err.message); 
      } finally {
          setProcessing(false);
      }
  };

// --- [QUAN TRỌNG] IMPORT STOCK FIX ---
  const handleImportStock = async () => {
    try {
        if (!showKeyModal?.product) return;
        const currentProd = showKeyModal.product;
        const targetSku = showKeyModal.sku; 
        
        if (currentProd.is_digital) {
            if (!keyInput.trim()) return;
            const codes = keyInput.split('\n').filter(c => c.trim() !== '');
            
            // [FIX CORE] Chuẩn bị dữ liệu insert
            let variantId = null; 
            let skuNameForDb = null;
            let variantInfo = {};

            if (targetSku) {
                // Nếu có biến thể, BẮT BUỘC phải lấy ID
                if (!targetSku.id) {
                     return toast.error(t("Vui lòng lưu sản phẩm trước khi nhập Key!", "Please Save Product First!"));
                }
                variantId = targetSku.id;
                skuNameForDb = targetSku.sku_name;
                variantInfo = { ...targetSku.options };
            }

            const insertData = codes.map(code => ({ 
                product_id: currentProd.id, 
                variant_id: variantId,  
                key_value: code.trim(), // <--- ĐÃ SỬA: Dùng key_value thay vì content
                sku_name: skuNameForDb, 
                is_used: false 
            }));
            
            const { error } = await supabase.from('product_keys').insert(insertData);
            if (error) throw error;
            toast.success(t(`Đã thêm ${insertData.length} Keys!`, `Added ${insertData.length} Keys!`));
            
            queryClient.invalidateQueries({ queryKey: ['admin-products'] });

        } else {
            // [LOGIC KHO VẬT LÝ - GIỮ NGUYÊN]
            const qtyToAdd = parseInt(stockInput);
            if (isNaN(qtyToAdd) || qtyToAdd <= 0) return toast.warn(t("Số lượng > 0", "Qty > 0"));
            
            if (targetSku) {
                const currentStock = parseInt(targetSku.stock) || 0;
                const newStock = currentStock + qtyToAdd;

                if (!targetSku.id) {
                     return toast.error(t("Vui lòng lưu sản phẩm trước!", "Please Save Product First!"));
                }
                const { error } = await supabase.from('product_variants').update({ stock: newStock }).eq('id', targetSku.id);
                if (error) throw error;
                
                const skuIndex = skuList.findIndex(s => s.id === targetSku.id);
                if (skuIndex >= 0) updateSkuField(skuIndex, 'stock', newStock);
                
                toast.success(t("Cập nhật kho thành công!", "Stock updated!"));
                
            } else {
                if (!currentProd.id) return toast.warn(t("Vui lòng lưu sản phẩm trước!", "Please save product first!"));
                const { data: latest } = await supabase.from('products').select('physical_stock').eq('id', currentProd.id).single();
                const newStock = (latest.physical_stock || 0) + qtyToAdd;
                
                const { error } = await supabase.from('products').update({ physical_stock: newStock }).eq('id', currentProd.id);
                if (error) throw error;
                
                setProductForm(prev => ({ ...prev, physical_stock: newStock }));
                toast.success(t("Cập nhật kho thành công!", "Stock updated!"));
            }
        }
        setKeyInput(''); setStockInput(0); setShowKeyModal(null);
        queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    } catch (err) { toast.error(t("Lỗi: ", "Error: ") + err.message); }
  };

  // ... (Phần return render giữ nguyên)
  if (isLoading) return <div className="p-8 text-center text-slate-500">{t('Đang tải...', 'Loading...')}</div>;
  return (
    <div className="animate-fade-in pb-20">
       <div className="flex justify-between mb-6 items-center">
         <div>
             <h2 className="text-2xl font-bold text-slate-800">{t('Kho Sản Phẩm', 'Inventory')}</h2>
             <p className="text-sm text-slate-500">{t('Quản lý sản phẩm và biến thể', 'Manage products and variants')}</p>
         </div>
         <button onClick={openAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow hover:bg-blue-700 transition"><Plus size={18}/> {t('Thêm Mới', 'Add New')}</button>
       </div>
       
       <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
         <table className="w-full text-left">
           <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase font-bold tracking-wider">
               <tr>
                   <th className="p-4">{t('Sản phẩm', 'Product')}</th>
                   <th className="p-4">{t('Phân loại', 'Type')}</th>
                   <th className="p-4 text-center">{t('Tồn kho', 'Stock')}</th>
                   <th className="p-4 text-right">{t('Thao tác', 'Action')}</th>
               </tr>
           </thead>
           <tbody className="divide-y divide-slate-100">
             {products.map(p => {
               const hasVariants = p.variants && p.variants.length > 0;
               const displayStock = p.true_stock || 0;

               return (
               <tr key={p.id} className="hover:bg-slate-50 transition">
                 <td className="p-4 flex gap-3 items-center">
                    <div className="w-10 h-10 rounded bg-slate-100 border overflow-hidden flex-shrink-0">
                         <img src={p.display_image} className="w-full h-full object-cover"/>
                    </div>
                    <div>
                        <span className="font-medium text-sm text-slate-700 block">{lang === 'vi' ? p.title : (p.title_en || p.title)}</span>
                        {hasVariants && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 inline-block mt-1">{t('Đa biến thể', 'Multi-variants')}</span>}
                    </div>
                 </td>
                 <td className="p-4 text-xs font-medium text-slate-500">{p.is_digital ? 'Digital' : 'Physical'}</td>
                 <td className="p-4 text-center">
                     <span className={`px-2 py-1 rounded-md text-xs font-bold ${displayStock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {displayStock}
                     </span>
                 </td>
                 <td className="p-4 text-right flex justify-end gap-2">
                    <button onClick={()=>openEditModal(p)} className="p-2 bg-slate-100 rounded hover:bg-blue-100 text-blue-600 transition" title={t("Sửa", "Edit")}><Edit size={16}/></button>
                    {!hasVariants && (
                        <button onClick={()=>setShowKeyModal({product: p, variant: null})} className="p-2 bg-slate-100 rounded hover:bg-green-100 text-green-600 transition" title={t("Nhập kho", "Stock")}><Plus size={16}/></button>
                    )}
                 </td>
               </tr>
             )})}
           </tbody>
         </table>
       </div>

       {showProductModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
              <div className="p-5 border-b flex justify-between items-center bg-white sticky top-0 z-10">
                  <h2 className="text-xl font-bold text-slate-800">{productForm.id ? t('Sửa sản phẩm', 'Edit Product') : t('Thêm sản phẩm mới', 'Add New Product')}</h2>
                  <button onClick={() => setShowProductModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={20}/></button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                 {/* ... Input Fields (Title, Price, Variants) giống hệt file cũ của bạn ... */}
                 {/* ... Chỉ render phần showKeyModal ở dưới là quan trọng ... */}
                 
                 {/* Copy lại toàn bộ nội dung render form từ file cũ vào đây */}
                 {/* Để gọn, tôi chỉ hiển thị lại những phần cần thiết */}
                 
                 <div className="grid grid-cols-2 gap-5">
                   <div>
                       <label className="block text-sm font-bold mb-1.5 text-slate-600">{t('Tên sản phẩm (VN)', 'Product Name (VN)')}</label>
                       <input required className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={productForm.title} onChange={e=>setProductForm({...productForm, title: e.target.value})}/>
                   </div>
                   <div>
                       <label className="block text-sm font-bold mb-1.5 text-slate-600">{t('Tên (EN - Optional)', 'Name (EN)')}</label>
                       <input className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" value={productForm.title_en} onChange={e=>setProductForm({...productForm, title_en: e.target.value})}/>
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-5">
                   <div>
                       <label className="block text-sm font-bold mb-1.5 text-slate-600">{t('Giá ($ USDT)', 'Price (USDT)')}</label>
                       <input type="number" step="0.01" required className="w-full border p-2.5 rounded-lg font-mono font-bold text-green-600 focus:ring-2 focus:ring-blue-500 outline-none" value={productForm.price} onChange={e=>setProductForm({...productForm, price: e.target.value})}/>
                   </div>
                   <div>
                         <label className="block text-sm font-bold mb-1.5 text-slate-600">{t('Loại sản phẩm', 'Product Type')}</label>
                         <select className="w-full border p-2.5 rounded-lg outline-none bg-white" value={productForm.is_digital ? 'digital' : 'physical'} onChange={e => setProductForm({...productForm, is_digital: e.target.value === 'digital'})}>
                             <option value="digital">Digital (Key)</option>
                             <option value="physical">Physical (Ship)</option>
                         </select>
                         
                         {productForm.is_digital && (
                             <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                                 <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={productForm.allow_external_key} onChange={e => setProductForm({...productForm, allow_external_key: e.target.checked})}/>
                                 <span className="text-xs font-bold text-blue-600 hover:text-blue-800 transition">{t('Lấy code qua API (Appota) khi hết kho', 'Get code via API if OOS')}</span>
                             </label>
                         )}
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-5">
                     <div><label className="block text-sm font-bold mb-1.5 text-slate-600">{t('Mô tả (VN)', 'Description (VN)')}</label><textarea className="w-full border p-2.5 rounded-lg h-20 resize-none outline-none" value={productForm.description} onChange={e=>setProductForm({...productForm, description: e.target.value})}></textarea></div>
                     <div><label className="block text-sm font-bold mb-1.5 text-slate-600">{t('Mô tả (EN)', 'Description (EN)')}</label><textarea className="w-full border p-2.5 rounded-lg h-20 resize-none outline-none bg-slate-50" value={productForm.description_en} onChange={e=>setProductForm({...productForm, description_en: e.target.value})}></textarea></div>
                 </div>

                 <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                        <label className="block text-sm font-bold text-slate-700 flex items-center gap-2"><Settings size={16}/> {t('Cấu hình biến thể', 'Variant Config')}</label>
                        <button type="button" onClick={addVariantGroup} className="text-xs bg-white border hover:bg-slate-100 px-3 py-1.5 rounded-lg font-bold transition shadow-sm">{t('+ Thêm nhóm', '+ Add Group')}</button>
                    </div>
                    <div className="space-y-3">
                        {productForm.variants?.map((group, gIdx) => (
                            <div key={gIdx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative group">
                                <button type="button" onClick={() => removeVariantGroup(gIdx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition"><X size={16}/></button>
                                <div className="grid grid-cols-12 gap-3 items-start">
                                    <div className="col-span-4">
                                        <input type="text" placeholder="Tên nhóm (VD: Size)" className="w-full border rounded p-1.5 text-sm font-bold outline-none" value={group.name} onChange={(e) => updateVariantName(gIdx, e.target.value)} />
                                    </div>
                                    <div className="col-span-8 flex flex-wrap gap-2">
                                        {group.options?.map((opt, oIdx) => (
                                            <div key={oIdx} className="flex items-center gap-1 bg-slate-100 pl-2 pr-1 py-1 rounded border">
                                                <input placeholder="VN" className="bg-transparent w-14 text-sm outline-none" value={opt.label} onChange={e => updateOption(gIdx, oIdx, 'label', e.target.value)} />
                                                <span className="text-slate-300">|</span>
                                                <input placeholder="EN" className="bg-transparent w-14 text-sm outline-none text-slate-500" value={opt.label_en} onChange={e => updateOption(gIdx, oIdx, 'label_en', e.target.value)} />
                                                <button type="button" onClick={() => removeOptionFromGroup(gIdx, oIdx)} className="text-slate-400 hover:text-red-500"><X size={14}/></button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => addOptionToGroup(gIdx)} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 font-bold rounded hover:bg-blue-100">+ Opt</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {productForm.variants.length > 0 && skuList.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">{t('Chi tiết biến thể (API & Giá)', 'Variant Details')}</label>
                            <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 text-xs uppercase text-slate-500 font-bold">
                                        <tr>
                                            <th className="p-2 w-1/3">{t('Tên SKU (API Code)', 'SKU Name')}</th>
                                            <th className="p-2 w-20 text-center">{t('Ảnh', 'Img')}</th>
                                            <th className="p-2 w-28">{t('Giá (+/-)', 'Price')}</th>
                                            <th className="p-2 w-20 text-center">{t('Kho', 'Stock')}</th>
                                            <th className="p-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {skuList.map((sku, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="p-2">
                                                    <div className="flex flex-col gap-1">
                                                        <input 
                                                            type="text" 
                                                            className="w-full border rounded p-1.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                                                            value={sku.sku_name}
                                                            onChange={(e) => updateSkuField(idx, 'sku_name', e.target.value)}
                                                            placeholder="Mã SKU (API Code)"
                                                        />
                                                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                                            <Tag size={10}/> {Object.values(sku.options).join(' / ')}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-2 text-center">
                                                    <label className="inline-block w-8 h-8 border rounded bg-slate-50 cursor-pointer overflow-hidden relative group">
                                                        {sku.image ? <img src={sku.image} className="w-full h-full object-cover"/> : <ImageIcon size={14} className="m-auto mt-2 text-slate-300"/>}
                                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleSkuImageUpload(e, idx)} disabled={skuUploading !== null}/>
                                                    </label>
                                                </td>
                                                <td className="p-2">
                                                    <input type="number" step="0.01" className="w-full border rounded p-1 text-xs" placeholder="0" value={sku.price_mod} onChange={(e) => updateSkuField(idx, 'price_mod', e.target.value)}/>
                                                </td>
                                                <td className="p-2 text-center font-bold text-slate-600">{sku.stock}</td>
                                                <td className="p-2 text-center">
                                                     <button type="button" onClick={() => setShowKeyModal({product: productForm, sku: sku})} className="text-slate-400 hover:text-blue-600" title={t("Nhập kho", "Import Stock")}><Plus size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                 </div>

                 <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-bold mb-2 text-slate-600">{t('Hình ảnh chung', 'General Images')}</label>
                        <div className="flex flex-wrap gap-3">
                            {productForm.images && productForm.images.map((img, idx) => (
                                <div key={idx} className="relative group w-16 h-16 border rounded overflow-hidden shadow-sm">
                                    <img src={img} className="w-full h-full object-cover"/>
                                    <button type="button" onClick={() => handleRemoveImage(idx)} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 opacity-0 group-hover:opacity-100 transition"><X size={10}/></button>
                                </div>
                            ))}
                            <label className="cursor-pointer inline-flex items-center justify-center w-16 h-16 bg-slate-50 hover:bg-slate-100 rounded border border-dashed border-slate-300 transition text-slate-400">
                                {uploading ? '...' : <Upload size={20}/>}
                                <input type="file" className="hidden" onChange={handleImageUpload} disabled={uploading}/>
                            </label>
                        </div>
                    </div>
                    {(!productForm.variants || productForm.variants.length === 0) && (
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex justify-between items-center">
                             <div>
                                <label className="block text-sm font-bold text-orange-800">{t('Kho hàng (Sản phẩm đơn)', 'Inventory')}</label>
                                <div className="text-2xl font-bold text-orange-600">{productForm.physical_stock}</div>
                             </div>
                             <button type="button" onClick={() => { if(!productForm.id) return toast.warn("Lưu trước!"); setShowKeyModal({product: productForm, sku: null}); }} className="bg-white border border-orange-200 text-orange-700 px-3 py-1.5 rounded font-bold hover:bg-orange-100 transition shadow-sm text-sm">{t('Nhập kho', 'Import')}</button>
                        </div>
                    )}
                 </div>
              </div>

              <div className="p-5 border-t bg-slate-50 flex justify-end gap-3 sticky bottom-0 z-10">
                  <button type="button" onClick={() => setShowProductModal(false)} className="px-5 py-2 text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg font-medium transition">{t('Hủy', 'Cancel')}</button>
                  <button type="button" onClick={handleSaveProduct} disabled={processing} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow transition flex items-center gap-2">
                      {processing ? t('Đang lưu...', 'Saving...') : <><Save size={18}/> {t('Lưu Sản Phẩm', 'Save Product')}</>}
                  </button>
              </div>
           </div>
        </div>
      )}

       {showKeyModal && (
         <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
               <h3 className="font-bold mb-4 text-lg text-slate-800 flex items-center gap-2">
                   {showKeyModal.product.is_digital ? <Key className="text-blue-600"/> : <Layers className="text-orange-600"/>}
                   {showKeyModal.product.is_digital ? t('Nhập Keys', 'Import Keys') : t('Thêm tồn kho', 'Add Stock')}
               </h3>
               {showKeyModal.sku && (
                   <div className="mb-4 bg-slate-100 p-3 rounded border border-slate-200">
                       <div className="text-xs text-slate-500 uppercase font-bold mb-1">{t('Biến thể (SKU)', 'Variant (SKU)')}</div>
                       <div className="text-sm font-bold text-blue-700">{showKeyModal.sku.sku_name}</div>
                   </div>
               )}
               
               {showKeyModal.product.is_digital ? (
                   <textarea className="w-full border p-3 h-32 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="Mỗi dòng 1 key..."></textarea>
               ) : (
                   <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center"><input type="number" className="w-24 border p-2 rounded-lg text-center font-bold text-2xl outline-none" value={stockInput} onChange={e => setStockInput(e.target.value)}/></div>
               )}
               <div className="flex justify-end gap-2 mt-6">
                   <button onClick={() => setShowKeyModal(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-medium transition">{t('Đóng', 'Close')}</button>
                   <button onClick={handleImportStock} className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 shadow transition">{t('Lưu', 'Save')}</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
