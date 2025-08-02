import { supabase } from './supabase';
import { Supplement, UserSupplement, SupplementUsage } from '../types/Supplement';
import { handleSupabaseOperation, logError } from './errorHandling';

// --- Supplement (global/shared) ---
export async function searchSupplements(keyword: string): Promise<Supplement[]> {
  try {
    const data = await handleSupabaseOperation(async () =>
      supabase
        .from('supplements')
        .select('*')
        .ilike('name', `%${keyword}%`)
        .limit(10)
    );
    return data || [];
  } catch (error) {
    logError(error, 'searchSupplements');
    throw error;
  }
}

export async function addSupplement(supplement: Partial<Supplement>): Promise<Supplement> {
  try {
    const data = await handleSupabaseOperation(async () =>
      supabase
        .from('supplements')
        .insert(supplement)
        .select()
        .single()
    );
    return data!;
  } catch (error) {
    logError(error, 'addSupplement');
    throw error;
  }
}

export async function addSupplementWithThumbnail(
  supplement: Partial<Supplement>, 
  thumbnailFile: File
): Promise<Supplement> {
  try {
    // Debug: Log thumbnail file info
    console.log('Thumbnail file info:', {
      name: thumbnailFile.name,
      size: thumbnailFile.size,
      type: thumbnailFile.type,
      sizeInMB: (thumbnailFile.size / (1024 * 1024)).toFixed(2)
    });

    // Upload thumbnail to Supabase Storage
    const fileName = `supplement-thumbnails/${Date.now()}-${thumbnailFile.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('supplements')
      .upload(fileName, thumbnailFile);

    if (uploadError) {
      console.error('Error uploading thumbnail:', uploadError);
      console.log('Continuing without thumbnail upload...');
      
      // Continue without thumbnail - just add the supplement
      return await addSupplement(supplement);
    }

    // Get public URL for the uploaded thumbnail
    const { data: urlData } = supabase.storage
      .from('supplements')
      .getPublicUrl(fileName);

    // Add supplement with thumbnail URL
    const supplementWithThumbnail = {
      ...supplement,
      thumbnailUrl: urlData.publicUrl
    };

    return await addSupplement(supplementWithThumbnail);
  } catch (error) {
    logError(error, 'addSupplementWithThumbnail');
    throw error;
  }
}

export async function getSupplementById(id: string): Promise<Supplement | null> {
  const { data, error } = await supabase
    .from('supplements')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// --- User Supplement List ---
export async function getUserSupplements(userId: string): Promise<UserSupplement[]> {
  try {
    const data = await handleSupabaseOperation(async () =>
      supabase
        .from('user_supplements')
        .select('*, supplement:supplement_id(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    );
    return data || [];
  } catch (error) {
    logError(error, 'getUserSupplements');
    throw error;
  }
}

export async function addUserSupplement(userId: string, supplementId: string, custom_dosage_mg?: number, notes?: string): Promise<UserSupplement> {
  const { data, error } = await supabase
    .from('user_supplements')
    .insert({ user_id: userId, supplement_id: supplementId, custom_dosage_mg, notes })
    .select('*, supplement:supplement_id(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateUserSupplementDosage(userSupplementId: string, custom_dosage_mg: number): Promise<UserSupplement> {
  const { data, error } = await supabase
    .from('user_supplements')
    .update({ custom_dosage_mg })
    .eq('id', userSupplementId)
    .select('*, supplement:supplement_id(*)')
    .single();
  if (error) throw error;
  return data;
}

// --- Supplement Usage Log ---
export async function logSupplementUsage(userId: string, userSupplementId: string, dosage_mg?: number): Promise<SupplementUsage> {
  const { data, error } = await supabase
    .from('supplement_usages')
    .insert({ user_id: userId, user_supplement_id: userSupplementId, dosage_mg })
    .select('*, user_supplement:user_supplement_id(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function getSupplementUsages(userId: string, limit = 30): Promise<SupplementUsage[]> {
  const { data, error } = await supabase
    .from('supplement_usages')
    .select('*, user_supplement:user_supplement_id(*, supplement:supplement_id(*))')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function updateSupplementUsage(usageId: string, updates: { timestamp?: string, dosage_mg?: number }): Promise<SupplementUsage> {
  const { data, error } = await supabase
    .from('supplement_usages')
    .update(updates)
    .eq('id', usageId)
    .select('*, user_supplement:user_supplement_id(*, supplement:supplement_id(*))')
    .single();
  if (error) throw error;
  return data;
} 