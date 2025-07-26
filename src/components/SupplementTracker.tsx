import { useState, useEffect, useRef } from 'react';
import { searchSupplements, addSupplement, getUserSupplements, addUserSupplement, logSupplementUsage, getSupplementUsages, updateUserSupplementDosage, updateSupplementUsage } from '../lib/supplements';
import { Supplement, UserSupplement, SupplementUsage, DsldProduct } from '../types/Supplement';
import { supabase } from '../lib/supabase';
import { Plus, Check, Loader2, Edit2, Trash2, X, PillBottle, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Quagga from 'quagga';
import { Link, useNavigate } from 'react-router-dom';
import { Dumbbell, User, LogOut } from 'lucide-react';
import { SupplementInfoModal } from './SupplementInfoModal';
import { handleDsldApiCall, getErrorMessage, logError } from '../lib/errorHandling';

export function SupplementTracker() {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Supplement[]>([]);
  const [dsldResults, setDsldResults] = useState<DsldProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [userSupplements, setUserSupplements] = useState<UserSupplement[]>([]);
  const [customDosage, setCustomDosage] = useState('');
  const [usageLog, setUsageLog] = useState<SupplementUsage[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [customAddMode, setCustomAddMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [editingDosage, setEditingDosage] = useState<Record<string, string>>({});
  const [dosageLoading, setDosageLoading] = useState<{ [userSupplementId: string]: boolean }>({});
  const [pillCounts, setPillCounts] = useState<{ [userSupplementId: string]: number }>({});
  const [editingUsageId, setEditingUsageId] = useState<string | null>(null);
  const [editedUsage, setEditedUsage] = useState<{ timestamp: string; dosage_mg: string }>({ timestamp: '', dosage_mg: '' });
  const [usageLoading, setUsageLoading] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [infoModal, setInfoModal] = useState<{ dsldId?: string; supplement?: Supplement | DsldProduct | null }>({});

  // Helper function to determine appropriate dosage unit
  const getDosageDisplayText = (userSupplement: UserSupplement, editingValue?: string) => {
    const dosageValue = editingValue !== undefined
      ? editingValue
      : userSupplement.custom_dosage_mg != null
        ? String(userSupplement.custom_dosage_mg)
        : userSupplement.supplement?.default_dosage_mg != null
          ? String(userSupplement.supplement.default_dosage_mg)
          : '';

    if (!dosageValue || dosageValue === '0') return '-';

    // Check if it's a multi-ingredient supplement
    const isMultiIngredient = userSupplement.supplement?._ingredientInfo?.isMultiIngredient;
    
    if (isMultiIngredient) {
      // For multi-ingredient supplements, show as pills/tablets
      const count = parseInt(dosageValue);
      return count === 1 ? '1 pill' : `${count} pills`;
    } else {
      // For single-ingredient supplements, check for common units
      const supplement = userSupplement.supplement;
      const supplementName = supplement?.name?.toLowerCase() || '';
      
      // Check for vitamin D (often measured in IU)
      if (supplementName.includes('vitamin d') || supplementName.includes('vit d')) {
        return `${dosageValue} IU`;
      }
      
      // Check for vitamin E (often measured in IU)  
      if (supplementName.includes('vitamin e') || supplementName.includes('vit e')) {
        return `${dosageValue} IU`;
      }
      
      // Check for vitamin A (often measured in IU)
      if (supplementName.includes('vitamin a') || supplementName.includes('vit a')) {
        return `${dosageValue} IU`;
      }
      
      // Default to mg for most supplements
      return `${dosageValue} mg`;
    }
  };

  // Helper function for usage log dosage display
  const getUsageLogDosageText = (usage: SupplementUsage) => {
    const dosageValue = usage.dosage_mg || usage.user_supplement?.custom_dosage_mg || usage.user_supplement?.supplement?.default_dosage_mg;
    
    if (!dosageValue) return '-';

    // Check if it's a multi-ingredient supplement
    const isMultiIngredient = usage.user_supplement?.supplement?._ingredientInfo?.isMultiIngredient;
    
    if (isMultiIngredient) {
      // For multi-ingredient supplements, show as pills/tablets
      const count = parseInt(String(dosageValue));
      return count === 1 ? '1 pill' : `${count} pills`;
    } else {
      // For single-ingredient supplements, check for common units
      const supplement = usage.user_supplement?.supplement;
      const supplementName = supplement?.name?.toLowerCase() || '';
      
      // Check for vitamin D (often measured in IU)
      if (supplementName.includes('vitamin d') || supplementName.includes('vit d')) {
        return `${dosageValue} IU`;
      }
      
      // Check for vitamin E (often measured in IU)  
      if (supplementName.includes('vitamin e') || supplementName.includes('vit e')) {
        return `${dosageValue} IU`;
      }
      
      // Check for vitamin A (often measured in IU)
      if (supplementName.includes('vitamin a') || supplementName.includes('vit a')) {
        return `${dosageValue} IU`;
      }
      
      // Default to mg for most supplements
      return `${dosageValue} mg`;
    }
  };

  // Auto-fill dosage input when search results change
  useEffect(() => {
    let defaultDosage: number | null = null;
    
    // Check search results first (Supplement type)
    const searchResultWithDosage = searchResults.find(s => s.default_dosage_mg);
    if (searchResultWithDosage) {
      defaultDosage = searchResultWithDosage.default_dosage_mg!;
    }
    
    // Then check DSLD results (DsldProduct type)
    if (!defaultDosage) {
      const dsldResultWithDosage = dsldResults.find(d => d.defaultDosageMg);
      if (dsldResultWithDosage) {
        defaultDosage = dsldResultWithDosage.defaultDosageMg!;
      }
    }
    
    // Auto-fill if we found a dosage and the field is empty
    if (defaultDosage && !customDosage) {
      // Check if this is a multi-ingredient supplement
      const supplementWithInfo = searchResultWithDosage || dsldResults.find(d => d.defaultDosageMg);
      const isMultiIngredient = supplementWithInfo?._ingredientInfo?.isMultiIngredient;
      
      if (isMultiIngredient) {
        // For multi-ingredient supplements, show "1" (representing 1 pill)
        // but store the total mg in the backend for logging
        console.log(`🔧 Auto-filling dosage field with: 1 (multi-ingredient pill, total: ${defaultDosage}mg)`);
        setCustomDosage('1');
      } else {
        // For single-ingredient supplements, show the actual dosage
        console.log(`🔧 Auto-filling dosage field with: ${defaultDosage}mg`);
        setCustomDosage(String(defaultDosage));
      }
    }
    
    // Clear dosage when no results
    if (searchResults.length === 0 && dsldResults.length === 0 && customDosage) {
      console.log(`🔧 Clearing dosage field - no search results`);
      setCustomDosage('');
    }
  }, [searchResults, dsldResults]);

  useEffect(() => {
    // No-op for production
    return () => {};
  }, []);

  // Get user ID on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  // ESC key handler for modals
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showCamera) {
          stopCameraScan();
        } else if (infoModal.dsldId) {
          setInfoModal({});
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCamera, infoModal.dsldId]);

  // Fetch user supplements
  useEffect(() => {
    if (!userId) return;
    getUserSupplements(userId).then(setUserSupplements);
    getSupplementUsages(userId, 30).then(setUsageLog);
  }, [userId]);

  // Manual search handler
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setSearchResults([]);
    setDsldResults([]);
    
    try {
      // Local DB search
      const local = await searchSupplements(search);
      setSearchResults(local);
      
      // DSLD search (proxy) with improved error handling
      const data = await handleDsldApiCall<any>(() =>
        fetch(`/.netlify/functions/dsld-proxy?type=search&q=${encodeURIComponent(search)}`)
      );
      
      // Debug: Log the raw API response
      console.log('🔍 Raw DSLD API response:', data);
      
      let products: any[] = [];
      if (Array.isArray(data.products)) {
        products = data.products;
      } else if (Array.isArray(data.hits)) {
        products = data.hits;
      } else if (data && Array.isArray(data.hits)) {
        products = data.hits;
      } else if (data && data.hits && Array.isArray(data.hits)) {
        products = data.hits;
      } else if (Array.isArray(data)) {
        products = data;
      } else if (data && data.labels && Array.isArray(data.labels)) {
        products = data.labels;
      }
      
      console.log('🔍 Extracted products array:', products);
      
      setDsldResults(products.map((p: any) => {
        const source = p._source || p;
        
        // Try to extract serving size/dosage from various possible fields
        let defaultDosageMg = source.defaultDosageMg || source.default_dosage_mg;
        
        // Debug product information
        const debugProductName = source.fullName || source.productName || source.product_name || source.name;
        console.log(`🔍 [SEARCH] Checking product: "${debugProductName}"`);
        console.log(`🔍 [SEARCH] Available source keys:`, Object.keys(source));
        console.log(`🔍 [SEARCH] Ingredient rows length:`, source.ingredientRows?.length || 0);
        console.log(`🔍 [SEARCH] Has default dosage:`, !!defaultDosageMg);
        
        // PRIORITY 1: Try to parse from ingredient rows (most accurate for dosage)
        if (!defaultDosageMg && source.ingredientRows && source.ingredientRows.length > 0) {
          console.log(`🧪 Parsing ingredients for ${source.fullName || source.productName || source.name}:`, JSON.stringify(source.ingredientRows, null, 2));
          
          // Check if this is a single or multi-ingredient supplement
          const ingredientsWithDosage = [];
          
                      for (const ingredient of source.ingredientRows) {
              console.log(`🔬 Processing ingredient:`, JSON.stringify(ingredient, null, 2));
            
            if (ingredient.quantity && ingredient.quantity.length > 0) {
              for (const quantity of ingredient.quantity) {
                const quantityStr = String(quantity.quantity);
                console.log(`🔬 Checking quantity string: "${quantityStr}"`);
                
                // Extract mg dosages
                const mgMatch = quantityStr.match(/(\d+(?:\.\d+)?)\s*mg/i);
                if (mgMatch) {
                  console.log(`✅ Found mg dosage: ${mgMatch[1]}mg for ${ingredient.name}`);
                  ingredientsWithDosage.push({
                    name: ingredient.name,
                    mg: parseFloat(mgMatch[1])
                  });
                }
                
                // Extract mcg dosages and convert to mg (1000mcg = 1mg)
                const mcgMatch = quantityStr.match(/(\d+(?:\.\d+)?)\s*mcg/i);
                if (mcgMatch) {
                  console.log(`✅ Found mcg dosage: ${mcgMatch[1]}mcg (${parseFloat(mcgMatch[1]) / 1000}mg) for ${ingredient.name}`);
                  ingredientsWithDosage.push({
                    name: ingredient.name,
                    mg: parseFloat(mcgMatch[1]) / 1000
                  });
                }
              }
            }
          }
          
          console.log(`🔬 Total ingredients with dosage found:`, ingredientsWithDosage);
          
          if (ingredientsWithDosage.length > 0) {
            if (ingredientsWithDosage.length === 1) {
              // Single ingredient - use its dosage
              defaultDosageMg = Math.round(ingredientsWithDosage[0].mg);
              console.log(`✅ Single ingredient detected: ${defaultDosageMg}mg`);
            } else {
              // Multi-ingredient - sum all ingredients for total dose
              const totalMg = ingredientsWithDosage.reduce((sum, ing) => sum + ing.mg, 0);
              defaultDosageMg = Math.round(totalMg);
              console.log(`✅ Multi-ingredient detected: ${defaultDosageMg}mg total from ${ingredientsWithDosage.length} ingredients`);
            }
            
            // Add metadata to track ingredient info for search results
            source._ingredientInfo = {
              isMultiIngredient: ingredientsWithDosage.length > 1,
              ingredients: ingredientsWithDosage,
              totalMg: defaultDosageMg
            };
            
            console.log(`✅ Set _ingredientInfo:`, source._ingredientInfo);
          } else {
            console.log(`❌ No ingredients with dosage found`);
          }
        }
        
        // PRIORITY 2: Try to parse from product name if no ingredient-based dosage found
        if (!defaultDosageMg) {
          console.log(`🔍 [SEARCH] Trying product name parsing for: "${debugProductName}"`);
          
          // Look for dosage patterns in product name
          const nameMatch = debugProductName.match(/(\d+(?:\.\d+)?)\s*mg/i);
          if (nameMatch) {
            defaultDosageMg = Math.round(parseFloat(nameMatch[1]));
            console.log(`✅ [SEARCH] Extracted dosage from product name: ${defaultDosageMg}mg`);
          } else {
            console.log(`❌ [SEARCH] No dosage found in product name`);
          }
        }
        
        // PRIORITY 3: Try to parse serving size if no explicit dosage (but avoid capsule counts)
        if (!defaultDosageMg && source.servingSizes && source.servingSizes.length > 0) {
          const servingSize = source.servingSizes[0];
          if (servingSize.minQuantity) {
            // Look for dosage with "mg" specifically, avoid "capsule" 
            const quantityStr = String(servingSize.minQuantity).toLowerCase();
            if (quantityStr.includes('mg') && !quantityStr.includes('capsule')) {
              const dosageMatch = quantityStr.match(/(\d+)\s*mg/i);
              if (dosageMatch) {
                defaultDosageMg = parseInt(dosageMatch[1]);
              }
            }
          }
        }
        
        // Try to extract image URL from possible fields
        const imageUrl = source.imageUrl || source.image_url || source.productImage || source.product_image || source.image || undefined;
        
        // Debug logging for dosage extraction
        const productName = source.fullName || source.productName || source.product_name || source.name;
        console.log(`🔍 Dosage extraction for ${productName}:`, {
          defaultDosageMg: defaultDosageMg,
          hasServingSizes: !!source.servingSizes,
          servingSizes: source.servingSizes,
          hasIngredientRows: !!source.ingredientRows,
          ingredientRows: source.ingredientRows,
          allSourceKeys: Object.keys(source)
        });
        
        if (defaultDosageMg) {
          console.log(`✅ Search: Extracted dosage for ${productName}: ${defaultDosageMg}mg`);
        } else {
          console.log(`❌ Search: No dosage found for ${productName}`);
        }
        
        return {
          dsldId: p._id || source.dsldId || source.dsld_id || source.id,
          productName: source.fullName || source.productName || source.product_name || source.name,
          brandName: source.brandName || source.brand_name || '',
          defaultDosageMg: defaultDosageMg || undefined,
          imageUrl
        };
      }));
    } catch (e: any) {
      logError(e, 'handleSearch');
      const userMessage = getErrorMessage(e);
      setError(userMessage);
      setDsldResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Barcode search handler
  const handleBarcodeSearch = async (e?: React.FormEvent, overrideBarcode?: string) => {
    if (e) e.preventDefault();
    const code = overrideBarcode !== undefined ? overrideBarcode : barcode;
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setSearchResults([]);
    setDsldResults([]);
    
    try {
      // DSLD search by barcode (quote-wrapped) with improved error handling
      const q = encodeURIComponent('"' + code.trim() + '"');
      const data = await handleDsldApiCall<any>(() =>
        fetch(`/.netlify/functions/dsld-proxy?type=search&q=${q}`)
      );
      
      // Debug: Log the raw API response for barcode
      console.log('🔍 Raw DSLD Barcode API response:', data);
      
      let products: any[] = [];
      if (Array.isArray(data.products)) {
        products = data.products;
      } else if (Array.isArray(data.hits)) {
        products = data.hits;
      } else if (data && Array.isArray(data.hits)) {
        products = data.hits;
      } else if (data && data.hits && Array.isArray(data.hits)) {
        products = data.hits;
      } else if (Array.isArray(data)) {
        products = data;
      } else if (data && data.labels && Array.isArray(data.labels)) {
        products = data.labels;
      }
      
      console.log('🔍 Extracted barcode products array:', products);
      
      setDsldResults(products.map((p: any) => {
        const source = p._source || p;
        
        // Try to extract serving size/dosage from various possible fields
        let defaultDosageMg = source.defaultDosageMg || source.default_dosage_mg;
        
        // PRIORITY 1: Try to parse from ingredient rows (most accurate for dosage)
        if (!defaultDosageMg && source.ingredientRows && source.ingredientRows.length > 0) {
          console.log(`🧪 [BARCODE] Parsing ingredients for ${source.fullName || source.productName || source.name}:`, source.ingredientRows);
          
          // Check if this is a single or multi-ingredient supplement
          const ingredientsWithDosage = [];
          
          for (const ingredient of source.ingredientRows) {
            console.log(`🔬 [BARCODE] Processing ingredient:`, ingredient);
            
            if (ingredient.quantity && ingredient.quantity.length > 0) {
              for (const quantity of ingredient.quantity) {
                const quantityStr = String(quantity.quantity);
                console.log(`🔬 [BARCODE] Checking quantity string: "${quantityStr}"`);
                
                // Extract mg dosages
                const mgMatch = quantityStr.match(/(\d+(?:\.\d+)?)\s*mg/i);
                if (mgMatch) {
                  console.log(`✅ [BARCODE] Found mg dosage: ${mgMatch[1]}mg for ${ingredient.name}`);
                  ingredientsWithDosage.push({
                    name: ingredient.name,
                    mg: parseFloat(mgMatch[1])
                  });
                }
                
                // Extract mcg dosages and convert to mg (1000mcg = 1mg)
                const mcgMatch = quantityStr.match(/(\d+(?:\.\d+)?)\s*mcg/i);
                if (mcgMatch) {
                  console.log(`✅ [BARCODE] Found mcg dosage: ${mcgMatch[1]}mcg (${parseFloat(mcgMatch[1]) / 1000}mg) for ${ingredient.name}`);
                  ingredientsWithDosage.push({
                    name: ingredient.name,
                    mg: parseFloat(mcgMatch[1]) / 1000
                  });
                }
              }
            }
          }
          
          console.log(`🔬 [BARCODE] Total ingredients with dosage found:`, ingredientsWithDosage);
          
          if (ingredientsWithDosage.length > 0) {
            if (ingredientsWithDosage.length === 1) {
              // Single ingredient - use its dosage
              defaultDosageMg = Math.round(ingredientsWithDosage[0].mg);
              console.log(`✅ [BARCODE] Single ingredient detected: ${defaultDosageMg}mg`);
            } else {
              // Multi-ingredient - sum all ingredients for total dose
              const totalMg = ingredientsWithDosage.reduce((sum, ing) => sum + ing.mg, 0);
              defaultDosageMg = Math.round(totalMg);
              console.log(`✅ [BARCODE] Multi-ingredient detected: ${defaultDosageMg}mg total from ${ingredientsWithDosage.length} ingredients`);
            }
            
            // Add metadata to track ingredient info for barcode results
            source._ingredientInfo = {
              isMultiIngredient: ingredientsWithDosage.length > 1,
              ingredients: ingredientsWithDosage,
              totalMg: defaultDosageMg
            };
            
            console.log(`✅ [BARCODE] Set _ingredientInfo:`, source._ingredientInfo);
          } else {
            console.log(`❌ [BARCODE] No ingredients with dosage found`);
          }
        }
        
        // PRIORITY 2: Try to parse from product name if no ingredient-based dosage found
        if (!defaultDosageMg) {
          const productName = source.fullName || source.productName || source.product_name || source.name;
          console.log(`🔍 [BARCODE] Trying product name parsing for: "${productName}"`);
          
          // Look for dosage patterns in product name
          const nameMatch = productName.match(/(\d+(?:\.\d+)?)\s*mg/i);
          if (nameMatch) {
            defaultDosageMg = Math.round(parseFloat(nameMatch[1]));
            console.log(`✅ [BARCODE] Extracted dosage from product name: ${defaultDosageMg}mg`);
          } else {
            console.log(`❌ [BARCODE] No dosage found in product name`);
          }
        }
        
        // PRIORITY 3: Try to parse serving size if no explicit dosage (but avoid capsule counts)
        if (!defaultDosageMg && source.servingSizes && source.servingSizes.length > 0) {
          const servingSize = source.servingSizes[0];
          if (servingSize.minQuantity) {
            // Look for dosage with "mg" specifically, avoid "capsule" 
            const quantityStr = String(servingSize.minQuantity).toLowerCase();
            if (quantityStr.includes('mg') && !quantityStr.includes('capsule')) {
              const dosageMatch = quantityStr.match(/(\d+)\s*mg/i);
              if (dosageMatch) {
                defaultDosageMg = parseInt(dosageMatch[1]);
              }
            }
          }
        }
        
        const imageUrl = source.imageUrl || source.image_url || source.productImage || source.product_image || source.image || undefined;
        
        // Debug logging for dosage extraction
        const productName = source.fullName || source.productName || source.product_name || source.name;
        console.log(`🔍 Barcode dosage extraction for ${productName}:`, {
          defaultDosageMg: defaultDosageMg,
          hasServingSizes: !!source.servingSizes,
          servingSizes: source.servingSizes,
          hasIngredientRows: !!source.ingredientRows,
          ingredientRows: source.ingredientRows,
          allSourceKeys: Object.keys(source)
        });
        
        if (defaultDosageMg) {
          console.log(`✅ Barcode: Extracted dosage for ${productName}: ${defaultDosageMg}mg`);
        } else {
          console.log(`❌ Barcode: No dosage found for ${productName}`);
        }
        
        return {
          dsldId: p._id || source.dsldId || source.dsld_id || source.id,
          productName: source.fullName || source.productName || source.product_name || source.name,
          brandName: source.brandName || source.brand_name || '',
          defaultDosageMg: defaultDosageMg || undefined,
          imageUrl
        };
      }));
    } catch (e: any) {
      logError(e, 'handleBarcodeSearch');
      const userMessage = getErrorMessage(e);
      setError(userMessage);
      setDsldResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Check for duplicates
  const checkForDuplicate = (supplementId: string): boolean => {
    return userSupplements.some(us => us.supplement?.id === supplementId);
  };

  // Add supplement to user list
  const handleAddUserSupplement = async (supplement: Supplement, customDosage?: string) => {
    if (!userId) return;
    
    // Check for duplicates
    if (checkForDuplicate(supplement.id)) {
      setError(`"${supplement.name}" is already in your supplement list.`);
      return;
    }
    
    setLoading(true);
    try {
      // For multi-ingredient supplements, convert pill count to total mg
      let actualDosage: number | undefined;
      if (customDosage) {
        const isMultiIngredient = supplement._ingredientInfo?.isMultiIngredient;
        if (isMultiIngredient && supplement.default_dosage_mg) {
          // User entered pill count, convert to total mg
          const pillCount = Number(customDosage);
          actualDosage = supplement.default_dosage_mg * pillCount;
          console.log(`🔧 Converting ${pillCount} pills to ${actualDosage}mg for multi-ingredient supplement`);
        } else {
          // Single ingredient or no default dosage, use as-is
          actualDosage = Number(customDosage);
        }
      }
      
      await addUserSupplement(userId, supplement.id, actualDosage);
      setCustomDosage(''); // Clear custom dosage after successful add
      setSearch(''); // Only clear after successful add
      setSearchResults([]);
      setDsldResults([]);
      setError(null); // Clear any previous errors
      // Refresh user supplements
      const updated = await getUserSupplements(userId);
      setUserSupplements(updated);
    } catch (e: any) {
      logError(e, 'handleAddUserSupplement');
      const userMessage = getErrorMessage(e);
      setError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  // Add DSLD supplement to DB, then to user list
  const handleAddDsldSupplement = async (dsld: DsldProduct, customDosage?: string) => {
    if (!userId) return;
    
    // Check if this DSLD supplement is already in user's list by dsld_id
    const existingByDsldId = userSupplements.find(us => us.supplement?.dsld_id === dsld.dsldId);
    if (existingByDsldId) {
      setError(`"${dsld.productName}" is already in your supplement list.`);
      return;
    }
    
    setLoading(true);
    try {
      // For multi-ingredient supplements, convert pill count to total mg
      let processedCustomDosage = customDosage;
      if (customDosage && dsld._ingredientInfo?.isMultiIngredient && dsld.defaultDosageMg) {
        const pillCount = Number(customDosage);
        const totalMg = dsld.defaultDosageMg * pillCount;
        processedCustomDosage = String(totalMg);
        console.log(`🔧 Converting ${pillCount} pills to ${totalMg}mg for DSLD multi-ingredient supplement`);
      }
      
      // Debug logging for dosage auto-fill
      console.log('Adding DSLD supplement:', {
        name: dsld.productName,
        apiDosage: dsld.defaultDosageMg,
        userInput: customDosage,
        isMultiIngredient: dsld._ingredientInfo?.isMultiIngredient,
        finalDosage: processedCustomDosage || (dsld.defaultDosageMg ? String(dsld.defaultDosageMg) : undefined)
      });
      
      // Add to shared DB
      const supplement = await addSupplement({
        dsld_id: dsld.dsldId,
        name: dsld.productName,
        brand: dsld.brandName,
        default_dosage_mg: dsld.defaultDosageMg,
        imageUrl: dsld.imageUrl
      });
      
      // Copy over the ingredient info metadata to the created supplement
      if (dsld._ingredientInfo) {
        supplement._ingredientInfo = dsld._ingredientInfo;
      }
      
      await handleAddUserSupplement(supplement, processedCustomDosage);
    } catch (e: any) {
      logError(e, 'handleAddDsldSupplement');
      const userMessage = getErrorMessage(e);
      setError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  // Add custom supplement handler
  const handleAddCustomSupplement = async () => {
    if (!userId || !customName.trim()) return;
    
    // Check for duplicates by name (case insensitive)
    const existingByName = userSupplements.find(us => 
      us.supplement?.name.toLowerCase() === customName.trim().toLowerCase()
    );
    if (existingByName) {
      setError(`"${customName.trim()}" is already in your supplement list.`);
      return;
    }
    
    setLoading(true);
    try {
      // Add to shared DB
      const supplement = await addSupplement({
        name: customName.trim(),
        brand: customBrand.trim() || undefined,
        default_dosage_mg: customDosage ? Number(customDosage) : undefined,
        created_by: userId
      });
      await handleAddUserSupplement(supplement, customDosage);
      setCustomName('');
      setCustomBrand('');
      setCustomDosage('');
      setCustomAddMode(false);
      setSearch('');
    } catch (e: any) {
      logError(e, 'handleAddCustomSupplement');
      const userMessage = getErrorMessage(e);
      setError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  // Remove supplement from user list
  const handleRemoveUserSupplement = async (userSupplement: UserSupplement) => {
    if (!userId) return;
    
    const confirmRemove = window.confirm(
      `Remove "${userSupplement.supplement?.name}" from your supplement list?`
    );
    if (!confirmRemove) return;
    
    setLoading(true);
    setError(null); // Clear any previous errors
    try {
      // Delete from user_supplements table
      const { error } = await supabase
        .from('user_supplements')
        .delete()
        .eq('id', userSupplement.id);

      if (error) throw error;

      // Refresh user supplements
      const updated = await getUserSupplements(userId);
      setUserSupplements(updated);
      
      // Also refresh usage log to remove any orphaned entries
      const updatedUsage = await getSupplementUsages(userId, 30);
      setUsageLog(updatedUsage);
    } catch (e: any) {
      setError('Failed to remove supplement: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  // Log usage
  const handleLogUsage = async (userSupplement: UserSupplement) => {
    if (!userId) return;
    setLogLoading(true);
    try {
      const dosage = userSupplement.custom_dosage_mg ?? userSupplement.supplement?.default_dosage_mg;
      const pillCount = pillCounts[userSupplement.id] || 1;
      const totalDosage = typeof dosage === 'number' ? dosage * pillCount : undefined;
      await logSupplementUsage(userId, userSupplement.id, totalDosage);
      // Refresh usage log
      const updated = await getSupplementUsages(userId, 30);
      setUsageLog(updated);
      // Do NOT reset pill count; keep user's last value
    } finally {
      setLogLoading(false);
    }
  };
  const handlePillCountChange = (userSupplementId: string, delta: number) => {
    setPillCounts(prev => {
      const current = prev[userSupplementId] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [userSupplementId]: next };
    });
  };

  // Update dosage handler
  const handleDosageChange = (userSupplementId: string, value: string) => {
    setEditingDosage(prev => ({ ...prev, [userSupplementId]: value ?? '' }));
  };
  const handleDosageBlur = async (userSupplement: UserSupplement) => {
    const val = editingDosage[userSupplement.id];
    if (val === undefined || val === '' || isNaN(Number(val))) return;
    const newDosage = Number(val);
    if (userSupplement.custom_dosage_mg === newDosage) return;
    setDosageLoading(prev => ({ ...prev, [userSupplement.id]: true }));
    try {
      await updateUserSupplementDosage(userSupplement.id, newDosage);
      // Refresh user supplements
      if (userId) {
        const updated = await getUserSupplements(userId);
        setUserSupplements(updated);
      }
    } catch (e) {
    } finally {
      setDosageLoading(prev => ({ ...prev, [userSupplement.id]: false }));
    }
  };
  const handleDosageKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  // Edit usage log handlers
  const handleEditUsage = (usage: SupplementUsage) => {
    setEditingUsageId(usage.id);
    setEditedUsage({
      timestamp: usage.timestamp.slice(0, 16), // ISO string for input type="datetime-local"
      dosage_mg: usage.dosage_mg?.toString() || ''
    });
  };
  const handleUsageFieldChange = (field: 'timestamp' | 'dosage_mg', value: string) => {
    setEditedUsage(prev => ({ ...prev, [field]: value }));
  };
  const handleSaveUsage = async (usage: SupplementUsage) => {
    setUsageLoading(true);
    try {
      await updateSupplementUsage(usage.id, {
        timestamp: new Date(editedUsage.timestamp).toISOString(),
        dosage_mg: Number(editedUsage.dosage_mg)
      });
      if (userId) {
        const updated = await getSupplementUsages(userId, 30);
        setUsageLog(updated);
      }
      setEditingUsageId(null);
    } finally {
      setUsageLoading(false);
    }
  };
  const handleCancelEditUsage = () => {
    setEditingUsageId(null);
  };
  // Optionally, delete usage log row
  const handleDeleteUsage = async (usage: SupplementUsage) => {
    if (!window.confirm('Delete this usage log entry?')) return;
    setUsageLoading(true);
    try {
      await supabase.from('supplement_usages').delete().eq('id', usage.id);
      if (userId) {
        const updated = await getSupplementUsages(userId, 30);
        setUsageLog(updated);
      }
    } finally {
      setUsageLoading(false);
    }
  };

  // Camera scan logic
  const startCameraScan = () => {
    setCameraError(null);
    setShowCamera(true);
  };

  const stopCameraScan = () => {
    // Stop QuaggaJS immediately
    try {
      Quagga.stop();
    } catch (e) {
      // Ignore errors during cleanup
    }
    setShowCamera(false);
    setCameraError(null);
  };

  // Barcode scanning effect (start only when modal and video are mounted)
  useEffect(() => {
    if (!showCamera || !videoRef.current) return;
    let cancelled = false;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const onDetected = (result: any) => {
      if (cancelled) return;
      
      // Add quality validation to prevent false positives
      const code = result.codeResult.code;
      const format = result.codeResult.format;
      
      // Validate barcode length and format
      const isValidBarcode = (code: string, format: string) => {
        // Remove any spaces or invalid characters
        const cleanCode = code.replace(/\s+/g, '');
        
        // Basic length validation for common formats
        if (format === 'ean_13' && cleanCode.length !== 13) return false;
        if (format === 'ean_8' && cleanCode.length !== 8) return false;
        if (format === 'upc_a' && cleanCode.length !== 12) return false;
        if (format === 'upc_e' && cleanCode.length !== 8) return false;
        
        // Must be all digits for UPC/EAN codes
        if (['ean_13', 'ean_8', 'upc_a', 'upc_e'].includes(format)) {
          if (!/^\d+$/.test(cleanCode)) return false;
        }
        
        // Minimum length check for all codes
        if (cleanCode.length < 6) return false;
        
        return true;
      };
      
      if (!isValidBarcode(code, format)) {
        console.log('Invalid barcode detected:', { code, format });
        return; // Ignore invalid codes
      }
      
      if (timeoutId) clearTimeout(timeoutId);
      setBarcode(code);
      
      // Stop QuaggaJS immediately
      Quagga.stop();
      setShowCamera(false);
      
      // Immediately search for the barcode
      handleBarcodeSearch(undefined, code);
    };

    const onProcessed = () => {
      // Optional: Handle processed frames (for debugging)
      if (cancelled) return;
    };

    // Initialize QuaggaJS with more selective settings
    Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: videoRef.current,
        constraints: {
          width: 640,
          height: 480,
          facingMode: "environment" // Use back camera if available
        }
      },
      locator: {
        patchSize: "large", // Larger patch size for better accuracy
        halfSample: false   // Don't downsample for better quality
      },
      numOfWorkers: 1, // Reduce workers to avoid conflicts
      decoder: {
        readers: [
          // Focus on most common supplement barcode formats
          "ean_reader",     // EAN-13 (most common internationally)
          "upc_reader",     // UPC-A (common in US)
          "ean_8_reader",   // EAN-8 (shorter format)
          "upc_e_reader"    // UPC-E (compact format)
        ]
      },
      locate: false // Require precise positioning for better accuracy
    }, (err: any) => {
      if (cancelled) return;
      
      if (err) {
        setCameraError('Failed to initialize camera: ' + (err?.message || err));
        return;
      }

      // Set up event listeners
      Quagga.onDetected(onDetected);
      Quagga.onProcessed(onProcessed);
      
      // Start scanning
      Quagga.start();

      // Timeout after 15 seconds
      timeoutId = setTimeout(() => {
        if (!cancelled) {
          setCameraError('No barcode detected. Please try again or check lighting and barcode type.');
        }
      }, 15000);
    });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      
      // Stop QuaggaJS
      try {
        Quagga.stop();
        // Clear all event listeners
        Quagga.offDetected();
        Quagga.offProcessed();
      } catch (e) {
        // Ignore cleanup errors
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCamera, videoRef.current]);

  // Backfill missing dosages for existing supplements
  const backfillMissingDosages = async () => {
    if (!userId) return;
    
    const supplementsNeedingDosage = userSupplements.filter(us => 
      !us.custom_dosage_mg && 
      us.supplement?.default_dosage_mg && 
      us.supplement.default_dosage_mg > 0
    );
    
    if (supplementsNeedingDosage.length === 0) {
      setError('No supplements found that need dosage backfill.');
      return;
    }
    
    setLoading(true);
    try {
      for (const userSupplement of supplementsNeedingDosage) {
        if (userSupplement.supplement?.default_dosage_mg) {
          await updateUserSupplementDosage(
            userSupplement.id, 
            userSupplement.supplement.default_dosage_mg
          );
        }
      }
      
      // Refresh user supplements
      const updated = await getUserSupplements(userId);
      setUserSupplements(updated);
      
      setError(`✅ Updated ${supplementsNeedingDosage.length} supplements with missing dosages.`);
    } catch (e: any) {
      logError(e, 'backfillMissingDosages');
      const userMessage = getErrorMessage(e);
      setError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  // Chart data: group by date, supplement
  // Build chart data: one object per date, each supplement as a key
  const supplementNames = Array.from(new Set(usageLog.map(u => u.user_supplement?.supplement?.name).filter((n): n is string => typeof n === 'string' && !!n)));
  // Get all unique dates (sorted)
  const allDates = Array.from(new Set(usageLog.map(u => new Date(u.timestamp).toLocaleDateString()))).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  // Build a map: {date: {supplementName: dosage}}
  const dateMap: Record<string, Record<string, number>> = {};
  usageLog.forEach(u => {
    const date = new Date(u.timestamp).toLocaleDateString();
    const name = u.user_supplement?.supplement?.name || '';
    if (!dateMap[date]) dateMap[date] = {};
    dateMap[date][name] = u.dosage_mg || u.user_supplement?.custom_dosage_mg || u.user_supplement?.supplement?.default_dosage_mg || 0;
  });
  // Build chartData array: [{date, Supplement1: dosage, Supplement2: dosage, ...}]
  const chartData = allDates.map(date => {
    const row: any = { date };
    supplementNames.forEach(name => {
      row[name] = dateMap[date]?.[name] || 0;
    });
    return row;
  });
  // Chart colors
  const chartColors = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00C49F', '#e57373', '#ba68c8', '#ffd54f', '#4fc3f7'
  ];

  // Mini heatmap for supplement consistency (current week)
  function SupplementConsistencyHeatmap({ usageLog, supplementNames, chartColors }: { usageLog: SupplementUsage[], supplementNames: string[], chartColors: string[] }) {
    // Get start of current week (Sunday)
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    // Build a map: {supplementName: [bool, ...] for Sun-Sat}
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const supplementDayMap: Record<string, boolean[]> = {};
    supplementNames.forEach(name => {
      supplementDayMap[name] = Array(7).fill(false);
    });
    usageLog.forEach(u => {
      const name = u.user_supplement?.supplement?.name;
      if (!name) return;
      const date = new Date(u.timestamp);
      // Only count this week
      if (date < startOfWeek) return;
      const dayIdx = date.getDay();
      supplementDayMap[name][dayIdx] = true;
    });
    return (
      <div className="mb-6">
        <h3 className="text-base font-semibold mb-2 text-center">This Week's Consistency</h3>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="pr-2 text-left">Supplement</th>
                {dayLabels.map(day => (
                  <th key={day} className="px-1 font-normal text-gray-500">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {supplementNames.map((name, sIdx) => (
                <tr key={name}>
                  <td className="pr-2 font-medium text-gray-700">{name}</td>
                  {supplementDayMap[name].map((taken, idx) => (
                    <td key={idx} className="px-1">
                      <div
                        className={`w-5 h-5 rounded ${taken ? '' : 'bg-gray-200'} border border-gray-300`}
                        style={taken ? { backgroundColor: chartColors[sIdx % chartColors.length] } : {}}
                        title={taken ? 'Taken' : 'Not taken'}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white overflow-x-hidden">
      <div className="max-w-6xl mx-auto p-6 overflow-x-hidden">
        <div className="bg-white rounded-3xl shadow-lg shadow-blue-100 p-6 mb-6">
          <div className="flex flex-col gap-4">
            {/* Logo and Title Row */}
            <div className="flex items-center justify-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <PillBottle className="w-8 h-8 text-blue-500" />
              </div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
                Supplement Flow
              </h1>
            </div>
            
            {/* Navigation Row */}
            <div className="flex items-center justify-center gap-3 md:gap-4">
              <Link
                to="/"
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-2xl transition-colors text-sm"
              >
                <Dumbbell size={16} />
                <span>Exercise</span>
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-2xl transition-colors text-sm"
              >
                <User size={16} />
                <span>Profile</span>
              </Link>
              <button
                onClick={async () => { await supabase.auth.signOut(); navigate('/'); }}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-2xl transition-colors text-sm"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
        {/* Search input and manual search button */}
        <div className="bg-white rounded-3xl shadow-lg shadow-blue-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-center">Add or Search Supplement</h2>
          <div className="bg-gray-50 rounded-xl p-4">
            {/* Barcode search UI */}
            <form onSubmit={handleBarcodeSearch} className="flex flex-col md:flex-row gap-2 mb-4">
              <input
                type="text"
                className="w-full md:w-64 p-2 border rounded-lg"
                placeholder="Scan or enter barcode (UPC/EAN)"
                value={String(barcode ?? '')}
                onChange={e => {
                  setBarcode(e.target.value);
                  // Clear error when user starts typing
                  if (error) setError(null);
                }}
                disabled={loading}
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={loading || !barcode.trim()}
              >
                Search Barcode
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                onClick={startCameraScan}
                disabled={showCamera}
              >
                Scan Barcode
              </button>
            </form>
            {/* Camera modal */}
            {showCamera && (
              <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-4 relative">
                  <button className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-2xl font-bold" onClick={stopCameraScan}>×</button>
                  <h3 className="text-lg font-semibold mb-2">Scan Barcode</h3>
                  <div className="relative">
                    <div ref={videoRef} className="w-72 h-48 bg-black rounded overflow-hidden" />
                    {/* Scanning guide overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-48 h-16 border-2 border-red-500 bg-red-500/10 rounded">
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">
                              Position barcode here
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {cameraError && <div className="text-red-600 text-sm">{cameraError}</div>}
                  <div className="text-xs text-gray-500 text-center max-w-xs">
                    Position the barcode horizontally within the red rectangle.<br/>
                    Hold steady until detected automatically.
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleSearch} className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
              <input
                ref={inputRef}
                type="text"
                className="w-full p-2 border rounded-lg"
                placeholder="Search for a supplement (e.g. Vitamin D, Creatine)"
                value={String(search ?? '')}
                onChange={e => {
                  setSearch(e.target.value);
                  // Clear error when user starts typing
                  if (error) setError(null);
                }}
                disabled={loading}
                autoFocus
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={loading || !search.trim()}
              >
                Search
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                onClick={() => {
                  setCustomAddMode(m => !m);
                  // Clear error when switching modes
                  if (error) setError(null);
                }}
              >
                {customAddMode ? 'Cancel' : 'Add Custom'}
              </button>
            </form>
            
            {/* Dosage override field for search results */}
            {!loading && search && (searchResults.length > 0 || dsldResults.length > 0) && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Dosage Override:</label>
                  <input
                    type="number"
                    className="w-24 p-1 border rounded text-center"
                    placeholder="mg"
                    value={customDosage}
                    onChange={e => setCustomDosage(e.target.value)}
                    min="0"
                  />
                  <span className="text-xs text-gray-600">
                    Leave empty to use recommended dosages
                  </span>
                </div>
              </div>
            )}
            
            {error && <div className="text-red-600 mb-2">{error}</div>}
            {loading && <div className="flex items-center gap-2 text-blue-600"><Loader2 className="animate-spin" size={18} /> Loading...</div>}
            {/* Results only after search */}
            {!loading && search && (searchResults.length > 0 || dsldResults.length > 0) && (
              <div className="mt-2">
                {searchResults.length > 0 && <div className="mb-2 text-xs text-gray-500">From local database:</div>}
                {searchResults.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 hover:bg-blue-50 rounded cursor-pointer">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <span className="font-medium">{s.name}</span>
                        {s.default_dosage_mg && (
                          <span className="text-xs text-green-600">
                            Recommended: {s._ingredientInfo?.isMultiIngredient ? '1 pill' : `${s.default_dosage_mg}mg`}
                          </span>
                        )}
                      </div>
                      {s.brand && <span className="ml-2 text-xs text-gray-400">({s.brand})</span>}
                      {/* Info button for custom/local supplements: only if dsldId exists */}
                      {typeof s.dsld_id === 'string' && s.dsld_id && (
                        <button className="ml-2 p-1 text-blue-500 hover:text-blue-700" onClick={() => setInfoModal({ dsldId: s.dsld_id as string, supplement: s })}>
                          <Info size={16} />
                        </button>
                      )}
                    </div>
                    <button
                      className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        // Use custom dosage if specified, otherwise use supplement's default dosage
                        const dosageToUse = customDosage 
                          ? customDosage 
                          : (s.default_dosage_mg ? String(s.default_dosage_mg) : undefined);
                        handleAddUserSupplement(s, dosageToUse);
                      }}
                    >
                      <Plus size={14} /> Add {
                        customDosage 
                          ? `(${customDosage}mg)` 
                          : (s.default_dosage_mg 
                              ? (s._ingredientInfo?.isMultiIngredient ? '(1 pill)' : `(${s.default_dosage_mg}mg)`)
                              : '')
                      }
                    </button>
                  </div>
                ))}
                {dsldResults.length > 0 && <div className="mb-2 mt-4 text-xs text-gray-500">From DSLD database:</div>}
                {dsldResults.map(dsld => {
                  return (
                    <div key={dsld.dsldId} className="flex items-center justify-between p-2 hover:bg-blue-50 rounded cursor-pointer">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <span className="font-medium">{dsld.productName}</span>
                          {dsld.defaultDosageMg && (
                            <span className="text-xs text-green-600">
                              Recommended: {dsld._ingredientInfo?.isMultiIngredient ? '1 pill' : `${dsld.defaultDosageMg}mg`}
                            </span>
                          )}
                        </div>
                        {dsld.brandName && <span className="ml-2 text-xs text-gray-400">({dsld.brandName})</span>}
                        {/* Info button for DSLD supplements */}
                        <button className="ml-2 p-1 text-blue-500 hover:text-blue-700" onClick={() => setInfoModal({ dsldId: dsld.dsldId, supplement: dsld })}>
                          <Info size={16} />
                        </button>
                      </div>
                      <button
                        className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          // Use custom dosage if specified, otherwise use API dosage
                          const dosageToUse = customDosage 
                            ? customDosage 
                            : (dsld.defaultDosageMg ? String(dsld.defaultDosageMg) : undefined);
                          handleAddDsldSupplement(dsld, dosageToUse);
                        }}
                      >
                        <Plus size={14} /> Add {
                          customDosage 
                            ? `(${customDosage}mg)` 
                            : (dsld.defaultDosageMg 
                                ? (dsld._ingredientInfo?.isMultiIngredient ? '(1 pill)' : `(${dsld.defaultDosageMg}mg)`)
                                : '')
                        }
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Custom add form */}
            {customAddMode && (
              <div className="mt-4 p-4 bg-white rounded-xl border">
                <h3 className="font-semibold mb-2">Add Custom Supplement</h3>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    className="p-2 border rounded-lg"
                    placeholder="Supplement Name *"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    className="p-2 border rounded-lg"
                    placeholder="Brand (optional)"
                    value={customBrand}
                    onChange={e => setCustomBrand(e.target.value)}
                  />
                  <input
                    type="number"
                    className="p-2 border rounded-lg"
                    placeholder="Dosage (mg) - auto-filled from search results"
                    value={customDosage}
                    onChange={e => setCustomDosage(e.target.value)}
                  />
                  {(searchResults.some(s => s.default_dosage_mg) || dsldResults.some(d => d.defaultDosageMg)) && (
                    <div className="text-xs text-blue-600 mt-1">
                      💡 Supplements with recommended dosages will use their default values. Use this field to override if needed.
                    </div>
                  )}
                  <button
                    className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    onClick={handleAddCustomSupplement}
                    disabled={loading || !customName.trim()}
                  >
                    Add Custom Supplement
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User supplement list */}
        <div className="bg-white rounded-3xl shadow-lg shadow-blue-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-center flex-1">My Supplements</h2>
            {userSupplements.some(us => !us.custom_dosage_mg && us.supplement?.default_dosage_mg) && (
              <button
                onClick={backfillMissingDosages}
                className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 disabled:opacity-50"
                disabled={loading}
                title="Auto-fill missing dosages from database"
              >
                Fix Dosages
              </button>
            )}
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            {userSupplements.length === 0 && <div className="text-gray-400">No supplements added yet.</div>}
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-2 py-1 text-left">Name</th>
                  <th className="px-2 py-1 text-left hidden md:table-cell">Brand</th>
                  <th className="px-2 py-1 text-left hidden md:table-cell">Dosage</th>
                  <th className="px-2 py-1 text-center">Log</th>
                </tr>
              </thead>
              <tbody>
                {userSupplements.map(us => {
                  return (
                    <tr key={us.id} className="border-t">
                      <td className="px-2 py-1 font-medium">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{us.supplement?.name}</span>
                            {/* Info button for user supplement if dsld_id exists */}
                            {typeof us.supplement?.dsld_id === 'string' && us.supplement?.dsld_id && (
                              <button className="ml-1 p-1 text-blue-500 hover:text-blue-700" onClick={() => setInfoModal({ dsldId: us.supplement!.dsld_id as string, supplement: us.supplement })}>
                                <Info size={14} />
                              </button>
                            )}
                            {/* Delete button next to info icon */}
                            <button
                              className="ml-1 p-1 text-red-500 hover:text-red-700 disabled:opacity-50"
                              onClick={() => handleRemoveUserSupplement(us)}
                              disabled={loading}
                              title="Remove from my supplements"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="md:hidden">
                            {/* Show brand below name on mobile */}
                            {us.supplement?.brand && (
                              <div className="text-xs text-gray-500">
                                {us.supplement.brand}
                              </div>
                            )}
                            {/* Show dosage info on mobile */}
                            <div className="text-xs text-gray-500">
                              {getDosageDisplayText(us, editingDosage[us.id])}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-1 hidden md:table-cell">{us.supplement?.brand || '-'}</td>
                    <td className="px-2 py-1 hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          className="w-16 md:w-20 p-1 border rounded text-center"
                          value={
                            editingDosage[us.id] !== undefined
                              ? editingDosage[us.id]
                              : us.custom_dosage_mg != null
                                ? String(us.custom_dosage_mg)
                                : us.supplement?.default_dosage_mg != null
                                  ? String(us.supplement.default_dosage_mg)
                                  : ''
                          }
                          onChange={e => handleDosageChange(us.id, e.target.value)}
                          onBlur={() => handleDosageBlur(us)}
                          onKeyDown={e => handleDosageKeyDown(e)}
                          min="0"
                          disabled={dosageLoading[us.id]}
                        />
                        <span className="text-xs text-gray-500">
                          {(() => {
                            // Get the unit for this supplement
                            const isMultiIngredient = us.supplement?._ingredientInfo?.isMultiIngredient;
                            if (isMultiIngredient) return 'pills';
                            
                            const supplementName = us.supplement?.name?.toLowerCase() || '';
                            if (supplementName.includes('vitamin d') || supplementName.includes('vit d')) return 'IU';
                            if (supplementName.includes('vitamin e') || supplementName.includes('vit e')) return 'IU';
                            if (supplementName.includes('vitamin a') || supplementName.includes('vit a')) return 'IU';
                            return 'mg';
                          })()}
                        </span>
                        {dosageLoading[us.id] && <Loader2 className="animate-spin text-blue-500" size={16} />}
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex flex-col md:flex-row items-center gap-1 md:gap-2">
                        {/* Mobile: Vertical stacked layout */}
                        <div className="flex md:hidden flex-col items-center gap-1">
                          <button
                            className="w-8 h-8 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center justify-center"
                            onClick={() => handlePillCountChange(us.id, 1)}
                            disabled={logLoading}
                            tabIndex={-1}
                          >
                            +
                          </button>
                          <button
                            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 min-w-[3rem]"
                            onClick={() => handleLogUsage(us)}
                            disabled={logLoading}
                          >
                            {logLoading ? (
                              <Loader2 className="animate-spin" size={14} />
                            ) : (
                              <span>{pillCounts[us.id] || 1}</span>
                            )}
                          </button>
                          <button
                            className="w-8 h-8 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center justify-center"
                            onClick={() => handlePillCountChange(us.id, -1)}
                            disabled={logLoading || (pillCounts[us.id] || 1) <= 1}
                            tabIndex={-1}
                          >
                            -
                          </button>
                        </div>
                        {/* Desktop: Horizontal layout */}
                        <div className="hidden md:flex items-center gap-2">
                          <button
                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            onClick={() => handlePillCountChange(us.id, -1)}
                            disabled={logLoading || (pillCounts[us.id] || 1) <= 1}
                            tabIndex={-1}
                          >
                            -
                          </button>
                          <button
                            className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 min-w-[3rem]"
                            onClick={() => handleLogUsage(us)}
                            disabled={logLoading}
                          >
                            {logLoading ? (
                              <Loader2 className="animate-spin" size={14} />
                            ) : (
                              <>
                                <Check size={14} />
                                <span>Log</span>
                                <span className="ml-1">{pillCounts[us.id] || 1}</span>
                              </>
                            )}
                          </button>
                          <button
                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            onClick={() => handlePillCountChange(us.id, 1)}
                            disabled={logLoading}
                            tabIndex={-1}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Consistency mini-chart */}
        <div className="bg-white rounded-3xl shadow-lg shadow-blue-100 p-6 mb-6">
          <SupplementConsistencyHeatmap usageLog={usageLog} supplementNames={supplementNames} chartColors={chartColors} />
        </div>

        {/* Usage log table and chart */}
        <div className="bg-white rounded-3xl shadow-lg shadow-blue-100 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-center">Usage Log</h2>
          <div className="bg-gray-50 rounded-xl p-4">
            {usageLog.length === 0 && <div className="text-gray-400">No usage logged yet.</div>}
            <table className="w-full text-xs md:text-sm mb-4">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-2 py-1 text-left">Date</th>
                  <th className="px-2 py-1 text-left">Supplement</th>
                  <th className="px-2 py-1 text-left">Dosage</th>
                  <th className="px-2 py-1 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usageLog.map(u => (
                  <tr key={u.id} className="border-t">
                    {editingUsageId === u.id ? (
                      <>
                        <td className="px-2 py-1">
                          <input
                            type="datetime-local"
                            className="p-1 border rounded text-xs"
                            value={editedUsage.timestamp}
                            onChange={e => handleUsageFieldChange('timestamp', e.target.value)}
                            disabled={usageLoading}
                          />
                        </td>
                        <td className="px-2 py-1">{u.user_supplement?.supplement?.name || '-'}</td>
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              className="w-16 p-1 border rounded text-xs text-center"
                              value={editedUsage.dosage_mg}
                              onChange={e => handleUsageFieldChange('dosage_mg', e.target.value)}
                              disabled={usageLoading}
                            />
                            <span className="text-xs text-gray-500">
                              {(() => {
                                // Get the unit for this supplement in usage log
                                const isMultiIngredient = u.user_supplement?.supplement?._ingredientInfo?.isMultiIngredient;
                                if (isMultiIngredient) return 'pills';
                                
                                const supplementName = u.user_supplement?.supplement?.name?.toLowerCase() || '';
                                if (supplementName.includes('vitamin d') || supplementName.includes('vit d')) return 'IU';
                                if (supplementName.includes('vitamin e') || supplementName.includes('vit e')) return 'IU';
                                if (supplementName.includes('vitamin a') || supplementName.includes('vit a')) return 'IU';
                                return 'mg';
                              })()}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1 flex gap-1">
                          <button className="p-1 bg-green-500 text-white rounded hover:bg-green-600" onClick={() => handleSaveUsage(u)} disabled={usageLoading}><Check size={14} /></button>
                          <button className="p-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400" onClick={handleCancelEditUsage} disabled={usageLoading}><X size={14} /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-1">{new Date(u.timestamp).toLocaleString()}</td>
                        <td className="px-2 py-1">{u.user_supplement?.supplement?.name || '-'}</td>
                        <td className="px-2 py-1">{getUsageLogDosageText(u)}</td>
                        <td className="px-2 py-1 flex gap-1">
                          <button className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600" onClick={() => handleEditUsage(u)} disabled={usageLoading}><Edit2 size={14} /></button>
                          <button className="p-1 bg-red-500 text-white rounded hover:bg-red-600" onClick={() => handleDeleteUsage(u)} disabled={usageLoading}><Trash2 size={14} /></button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Chart */}
            {usageLog.length > 0 && (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 30, bottom: 5, left: 20 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="dosage" orientation="left" label={{ value: 'Dosage (mg)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    {supplementNames.map((name, idx) => (
                      <Bar
                        key={name}
                        yAxisId="dosage"
                        dataKey={name}
                        name={name}
                        fill={chartColors[idx % chartColors.length]}
                        stackId={undefined}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
        {/* Supplement Info Modal */}
        {infoModal.dsldId && (
          <SupplementInfoModal
            dsldId={infoModal.dsldId}
            open={!!infoModal.dsldId}
            onClose={() => setInfoModal({})}
          />
        )}

        {/* Footer */}
        <footer className="bg-white rounded-3xl shadow-lg shadow-blue-100 p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-6 text-sm">
              <Link to="/privacy" className="text-gray-700 hover:text-gray-900 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 py-1 transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-gray-700 hover:text-gray-900 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 py-1 transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
} 