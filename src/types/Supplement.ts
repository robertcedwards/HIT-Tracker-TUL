// Supplement type (shared/global, can be DSLD or user-added)
export type Supplement = {
  id: string;
  dsld_id?: string | null;
  name: string;
  brand?: string | null;
  default_dosage_mg?: number | null;
  imageUrl?: string | null;
  created_by?: string | null;
  created_at: string;
};

// User's personal supplement list entry
export type UserSupplement = {
  id: string;
  user_id: string;
  supplement_id: string;
  custom_dosage_mg?: number | null;
  notes?: string | null;
  created_at: string;
  supplement?: Supplement; // Optionally joined
};

// Supplement usage log
export type SupplementUsage = {
  id: string;
  user_id: string;
  user_supplement_id: string;
  timestamp: string;
  dosage_mg?: number | null;
  user_supplement?: UserSupplement; // Optionally joined
};

// DSLD API result (minimal for autocomplete)
export type DsldProduct = {
  dsldId: string;
  productName: string;
  brandName?: string;
  defaultDosageMg?: number;
  imageUrl?: string;
}; 