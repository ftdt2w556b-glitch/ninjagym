export type UserRole = "admin" | "staff" | "owner";

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  pin: string | null;
  created_at: string;
}

export type SlipStatus =
  | "pending_review"
  | "cash_pending"
  | "approved"
  | "rejected";

export type PaymentMethod = "promptpay" | "cash" | "stripe";

export interface MemberRegistration {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  kids_names: string | null;
  kids_count: number;
  membership_type: string;
  sessions_remaining: number | null;
  payment_method: PaymentMethod;
  amount_paid: number | null;
  slip_image: string | null;
  slip_status: SlipStatus;
  slip_uploaded_at: string | null;
  slip_reviewed_at: string | null;
  slip_notes: string | null;
  notes: string | null;
  registered_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceLog {
  id: number;
  member_id: number | null;
  member_name: string | null;
  member_email: string | null;
  check_in_at: string;
  checked_in_by: string | null;
  notes: string | null;
}

export interface EventBooking {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  event_date: string;
  time_slot: "morning" | "afternoon" | "evening" | "weekend";
  hours: string | null;
  num_hours: number | null;
  num_kids: number;
  birthday_child_name: string | null;
  birthday_child_age: number | null;
  payment_method: PaymentMethod;
  amount_paid: number | null;
  slip_image: string | null;
  slip_status: SlipStatus;
  slip_uploaded_at: string | null;
  slip_reviewed_at: string | null;
  slip_notes: string | null;
  notes: string | null;
  photographer_requested: boolean;
  photographer_fee: number;
  created_at: string;
  updated_at: string;
}

export interface MarketingPhoto {
  id: number;
  file_path: string;
  caption: string | null;
  member_id: number | null;
  booking_id: number | null;
  uploaded_by: string | null;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  tags: string[] | null;
  created_at: string;
}

export interface ShopOrderItem {
  id: string;
  name: string;
  qty: number;
  size_or_flavor: string | null;
  unit_price: number;
}

export interface ShopOrder {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  items: ShopOrderItem[];
  total_amount: number | null;
  payment_method: PaymentMethod;
  slip_image: string | null;
  slip_status: SlipStatus;
  slip_notes: string | null;
  notes: string | null;
  slip_uploaded_at: string | null;
  slip_reviewed_at: string | null;
  created_at: string;
}

export interface CashSale {
  id: number;
  sale_type: "membership" | "shop" | "event" | "walkin" | null;
  reference_id: number | null;
  amount: number;
  items: ShopOrderItem[] | null;
  processed_by: string;
  processed_at: string;
  drawer_opened: boolean;
  receipt_printed: boolean;
  notes: string | null;
}

export interface DrawerLog {
  id: number;
  opened_by: string;
  opened_at: string;
  reason: "cash_sale" | "manual_open" | "no_sale";
  sale_id: number | null;
  tablet_ip: string | null;
}

export interface Setting {
  key: string;
  value: string;
  label: string;
}

export interface WorkInstruction {
  id: number;
  topic_name: string;
  instructions: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShopCatalogItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  options: {
    label: string;
    values?: string[];
    groups?: { label: string; values: string[] }[];
  };
}

export interface LoyaltyTransaction {
  id: number;
  profile_id: string;
  source_type: "shop_order" | "registration" | "birthday" | "daycamp" | "manual";
  source_id: number | null;
  points: number;
  description: string | null;
  created_at: string;
}

export interface MembershipType {
  id: string;
  label: string;
  perKid: boolean;
  note?: string;
  bulk?: boolean;      // true = bulk session purchase with sliding discount
  bulkBase?: string;   // key in BASE_PRICES for the per-session base price
}

export interface SaleData {
  saleId: number;
  items?: { name: string; qty: number; price: number }[];
  total: number;
  employee: string;
  memberName?: string;
}
