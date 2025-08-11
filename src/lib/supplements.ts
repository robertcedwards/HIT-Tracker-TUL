import { supabase } from './supabase';
import { Supplement, UserSupplement, SupplementUsage } from '../types/Supplement';
import { handleSupabaseOperation, logError } from './errorHandling';

// Check available storage buckets
async function getAvailableStorageBuckets(): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    
    if (error) {
      return [];
    }
    
    const bucketNames = data?.map(bucket => bucket.name) || [];
    return bucketNames;
  } catch (err) {
    return [];
  }
}

// Find a suitable bucket for storing supplement thumbnails
async function findSuitableBucket(): Promise<string | null> {
  try {
    // First, check what buckets are actually available
    const availableBuckets = await getAvailableStorageBuckets();
    
    // Look for a bucket that might be suitable for images
    const suitableBucket = availableBuckets.find(name => 
      name.includes('image') || 
      name.includes('thumbnail') || 
      name.includes('media') ||
      name.includes('storage') ||
      name.includes('public')
    );
    
    if (suitableBucket) {
      return suitableBucket;
    }
    
    // If no suitable bucket found, try to create one
    if (availableBuckets.length === 0) {
      try {
        const { error: createError } = await supabase.storage.createBucket('supplement-thumbnails', {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          fileSizeLimit: 5242880 // 5MB
        });
        
        if (createError) {
          return null;
        } else {
          return 'supplement-thumbnails';
        }
      } catch (err) {
        return null;
      }
    }
    
    // If we have buckets but none are suitable, use the first one
    if (availableBuckets.length > 0) {
      return availableBuckets[0];
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Convert file to base64 for fallback storage
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = error => reject(error);
  });
}

// Utility functions for thumbnail handling
export function isBase64Thumbnail(url: string): boolean {
  return url.startsWith('data:image/');
}

export function getThumbnailSrc(thumbnailUrl: string | null): string | null {
  if (!thumbnailUrl) return null;
  
  // If it's already a base64 string, return as is
  if (isBase64Thumbnail(thumbnailUrl)) {
    return thumbnailUrl;
  }
  
  // If it's a regular URL, return as is
  if (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://')) {
    return thumbnailUrl;
  }
  
  // If it's a relative path, assume it's a Supabase storage URL
  return thumbnailUrl;
}

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
    // Find a suitable storage bucket
    const bucketName = await findSuitableBucket();
    if (!bucketName) {
      // Store thumbnail as base64 in the database as fallback
      try {
        const base64Thumbnail = await fileToBase64(thumbnailFile);
        const supplementWithBase64Thumbnail = {
          ...supplement,
          thumbnailUrl: base64Thumbnail // Store base64 data in thumbnailUrl field
        };
        return await addSupplement(supplementWithBase64Thumbnail);
      } catch (base64Error) {
        return await addSupplement(supplement);
      }
    }

    // Upload thumbnail to Supabase Storage
    const fileName = `${Date.now()}-${thumbnailFile.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, thumbnailFile);

    if (uploadError) {
      // If bucket doesn't exist, try to create it (this requires admin privileges)
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('404')) {
        // Try to create the bucket (this may fail without admin privileges)
        const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          fileSizeLimit: 5242880 // 5MB
        });
        
        if (createBucketError) {
          // Continue without thumbnail - just add the supplement
          return await addSupplement(supplement);
        } else {
          // Retry the upload
          const { error: retryError } = await supabase.storage
            .from(bucketName)
            .upload(fileName, thumbnailFile);
            
          if (retryError) {
            return await addSupplement(supplement);
          }
        }
      } else {
        return await addSupplement(supplement);
      }
    }

    // Get public URL for the uploaded thumbnail
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    // Add supplement with thumbnail URL
    const supplementWithThumbnail = {
      ...supplement,
      thumbnailUrl: urlData.publicUrl
    };

    return await addSupplement(supplementWithThumbnail);
  } catch (error) {
    logError(error, 'addSupplementWithThumbnail');
    
    // Fallback: try to store thumbnail as base64
    try {
      const base64Thumbnail = await fileToBase64(thumbnailFile);
      const supplementWithBase64Thumbnail = {
        ...supplement,
        thumbnailUrl: base64Thumbnail
      };
      return await addSupplement(supplementWithBase64Thumbnail);
    } catch (base64Error) {
      return await addSupplement(supplement);
    }
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