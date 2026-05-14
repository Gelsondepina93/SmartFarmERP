export type UserRole = 'Admin' | 'Farm Manager' | 'Veterinarian' | 'Operator' | 'Director';

export interface UserPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  farm_id?: string;
  permissions?: UserPermissions;
}

export interface Farm {
  id: string;
  name: string;
  location: string;
  description: string;
  createdAt: any;
}

export interface Location {
  id: string;
  farm_id: string;
  name: string;
  type: 'aviary' | 'barn' | 'silo' | 'pasture' | 'warehouse';
  capacity: number;
  status: string;
}

export interface ChickenLot {
  id: string;
  lot_name: string;
  type: 'layer' | 'broiler';
  breed?: string;
  entry_date: any;
  initial_quantity: number;
  current_quantity: number;
  age_days: number;
  location_id: string;
  status: string;
  feed_efficiency?: number;
  cumulative_mortality?: number;
  silo_ids?: string[];
}

export interface EggProduction {
  id: string;
  date: any;
  lot_id: string;
  total_eggs: number;
  good_eggs: number; // Referred to as "Bons"
  broken_eggs: number;
  eggs_s?: number;
  eggs_xl?: number;
  eggs_dirty?: number;
  lay_percentage?: number; // Equivalent to HDEP
  average_egg_weight?: number; // grams
  mortality: number;
  feed_consumed?: number; // kg
  water_consumed?: number; // liters
  notes: string;
  created_by: string;
  // Computed & Stored ERP Metrics
  egg_quality_rate?: number;
  eggs_per_chicken?: number;
  hdep?: number;
  mortality_rate?: number;
}

export interface WeightRecord {
  id: string;
  lot_id: string;
  date: any;
  average_weight: number; // grams
  sample_size: number;
  mortality: number;
  feed_consumed?: number; // kg
  water_consumed?: number; // liters
  notes?: string;
  created_by: string;
  // Computed
  fcr?: number; // Feed Conversion Ratio
  weight_gain?: number; // Gain since last record
}

export interface Animal {
  id: string;
  tag_number: string;
  animal_type: 'cow' | 'goat' | 'sheep';
  breed: string;
  sex: 'male' | 'female';
  birth_date: any;
  weight: number;
  status: string;
  location_id: string;
}

export interface MilkProduction {
  id: string;
  animal_id: string;
  lactation_id: string;
  date: any;
  liters: number;
  milking_shift: 'morning' | 'evening';
  created_by: string;
}

export interface Feed {
  id: string;
  name: string;
  type: string;
  protein_percentage: number;
  unit: string;
  cost_per_unit: number;
}

export interface Silo {
  id: string;
  name: string;
  location_id: string;
  capacity_kg: number;
  current_stock: number;
  feed_id?: string;
  daily_consumption_average?: number;
  remaining_feed_days?: number;
}

export interface FeedStockMovement {
  id: string;
  silo_id: string;
  movement_type: 'in' | 'out';
  quantity: number;
  date: any;
  user_id: string;
  notes?: string;
}

export interface FeedConsumption {
  id: string;
  date: any;
  feed_id?: string;
  silo_id: string;
  lot_id?: string;
  animal_id?: string;
  quantity: number;
  created_by: string;
}

export interface Cost {
  id: string;
  date: any;
  category: 'feed' | 'labor' | 'electricity' | 'veterinary' | 'maintenance' | 'other';
  amount: number;
  related_lot_id?: string;
  related_animal_id?: string;
  notes: string;
}

export interface Sale {
  id: string;
  date: any;
  product_type: 'eggs' | 'milk' | 'animals' | 'feed';
  quantity: number;
  unit_price: number;
  total_amount: number;
  customer?: string;
}

export interface EggInventory {
  id: string;
  total_stock: number;
  last_updated: any;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: 'medicine' | 'equipment';
  stock: number;
  min_stock: number;
  unit: string;
  price: number;
  status: 'good' | 'low' | 'critical';
  created_by: string;
  last_updated: string;
}

export interface HealthRecord {
  id: string;
  date: string;
  service: string;
  provider: string;
  status: 'pending' | 'completed';
  notes: string;
  created_by: string;
  animal_id?: string;
  lot_id?: string;
}

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export interface OfflineRecord<T> {
  id: string; // UUID
  data: T | null;
  collection: string;
  operation: 'create' | 'update' | 'delete';
  sync_status: SyncStatus;
  device_id: string;
  timestamp: number;
  error?: string;
}
