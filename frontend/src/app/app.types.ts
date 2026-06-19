export type UserRole = 'vendor' | 'client' | 'admin';
export type SignupRole = 'vendor' | 'client';
export type PageName = 'login' | 'subscribe' | 'dashboard' | 'admin' | 'statistics' | 'vendor-statistics' | 'vendor-monthly-summary' | 'vendor-overdue-bills' | 'vendor-refunds' | 'find-vendors' | 'stocks' | 'order' | 'account';
export type LanguageCode = 'en' | 'fr';
export type ThemeMode = 'light' | 'dark' | 'system';
export type AppStyleProfile = 'primary' | 'secondary';
export type AlertType = 'success' | 'info' | 'danger';
export type ToastType = 'info' | 'success' | 'warning' | 'danger';
export type CartGroupBy = 'vendor' | 'category';
export type OrderTab = 'catalog' | 'favorites';
export type StockSortKey = 'name' | 'category';
export type VendorBillsTab = 'by-date' | 'by-client-range';

export type AppToast = {
  id: number;
  message: string;
  type: ToastType;
};

export type SessionUser = {
  id: string;
  username: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  organisation: string;
  city: string;
  zipcode: string;
  email: string;
  physicalAddress: string;
  phoneNumber: string;
  businessDescription: string;
  vatId: string;
  billMentions: string;
  logoFilename: string;
  logoUrl: string;
  businessRegistrationId: number;
  isActive: boolean;
};

export type PendingUser = {
  id: string;
  role: 'vendor' | 'client';
  username: string;
  firstName: string;
  lastName: string;
  organisation: string;
  city: string;
  zipcode: string;
  email: string;
  physicalAddress: string;
  phoneNumber: string;
  businessRegistrationId: number;
  isActive: boolean;
  createdAt: string;
};

export type AccessKeySummary = {
  id: string;
  name: string;
  keyId: string;
  deviceType: 'singleDevice' | 'multiDevice' | string;
  backedUp: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
};

export type AdminActivatedOrderStat = {
  day: string;
  orderCount: number;
  totalAmount: number;
  currency: string;
};

export type VendorCategorySalesStat = {
  category: string;
  totalAmount: number;
  currency: string;
};

export type VendorClientSalesStat = {
  clientId: string;
  clientName: string;
  totalAmount: number;
  currency: string;
};

export type VendorBillClientOption = {
  id: string;
  name: string;
};

export type VendorOverdueBill = {
  key: string;
  day: string;
  deliveryDate: string;
  orderedAt: string;
  totalPrice: number;
  totalQuantity: number;
  lineCount: number;
  daysPastDue: number;
  hasPenaltyLine: boolean;
};

export type VendorOverdueBillGroup = {
  clientId: string;
  clientName: string;
  organisation: string;
  billCount: number;
  totalAmount: number;
  currency: string;
  bills: VendorOverdueBill[];
};

export type ClientUnpaidReminder = {
  clientId: string;
  vendorId: string;
  vendorName: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
};

export type AdminClientAssociation = {
  id: string;
  username: string;
  organisation: string;
  isActive: boolean;
  vendorIds: string[];
};

export type AdminVendorAssociation = {
  id: string;
  username: string;
  organisation: string;
  isActive: boolean;
  clientIds: string[];
};

export type StockItem = {
  id: string;
  name: string;
  reference: string;
  price: number;
  vatRate: number;
  priceIncludingVat: number;
  stock: number;
  minimumStockThreshold: number | null;
  category: string;
  imageFilename: string;
  imageUrl: string;
  vendorId: string;
  createdAt: string;
  updatedAt: string;
};

export type CatalogItem = {
  id: string;
  name: string;
  reference: string;
  price: number;
  vatRate: number;
  priceIncludingVat: number;
  stock: number;
  minimumStockThreshold: number | null;
  category: string;
  imageFilename: string;
  imageUrl: string;
  vendorId: string;
  vendorName: string;
};

export type CatalogPriceVariation = {
  direction: 'up' | 'down';
  percent: number;
};

export type OrderVendorOption = {
  id: string;
  name: string;
};

export type VendorRefundClientOption = {
  id: string;
  name: string;
};

export type VendorMonthlySummaryBill = {
  key: string;
  billId: string;
  deliveryDate: string | null;
  totalAmount: number;
  currency: string;
};

export type ClientVendorDiscoveryItem = {
  id: string;
  organisation: string;
  logoUrl: string;
  businessDescription: string;
  isAssigned: boolean;
};

export type CartItem = {
  merchandiseId: string;
  name: string;
  reference: string;
  category: string;
  vendorId: string;
  vendorName: string;
  unitPrice: number;
  vatRate: number;
  unitPriceIncludingVat: number;
  quantity: number;
  lineTotal: number;
  lineTotalIncludingVat: number;
};

export type CartData = {
  clientId: string;
  deliveryDate: string;
  items: CartItem[];
  grandTotal: number;
  grandTotalIncludingVat: number;
  currency: string;
};

export type CartValidation = {
  groupBy: CartGroupBy;
  totals: Array<{
    key: string;
    label: string;
    total: number;
    totalIncludingVat: number;
  }>;
  grandTotal: number;
  grandTotalIncludingVat: number;
  currency: string;
};

export type VendorDashboardOrderSummary = {
  key: string;
  clientId: string;
  clientUsername: string;
  organisation: string;
  day: string;
  totalQuantity: number;
  lineCount: number;
  totalPrice: number;
  totalPriceIncludingVat: number;
  currency: string;
  vendorSettled: boolean;
  clientSettled: boolean;
  isSettled: boolean;
};

export type VendorDashboardOrderDetailsItem = {
  merchandiseId: string;
  kind?: 'order' | 'refund' | 'penalty';
  name: string;
  reference: string;
  category: string;
  unitPrice: number;
  vatRate: number;
  unitPriceIncludingVat: number;
  quantity: number | null;
  lineTotal: number;
  lineTotalIncludingVat: number;
  vatCategory: string;
  vatExemptionReason: string;
};

export type VendorDashboardOrderDetails = {
  key: string;
  day: string;
  clientId: string;
  clientUsername: string;
  items: VendorDashboardOrderDetailsItem[];
  totalPrice: number;
  totalPriceIncludingVat: number;
  currency: string;
  clientComment: string;
  clientCommentSentAt: string | null;
  vendorSettled: boolean;
  clientSettled: boolean;
  isSettled: boolean;
};

export type VendorBillMessageSummary = {
  key: string;
  clientId: string;
  clientOrganisation: string;
  day: string;
  message: string;
  sentAt: string | null;
  isRead: boolean;
};

export type ClientDashboardCartSummary = {
  key: string;
  vendorId: string;
  vendorName: string;
  organisation: string;
  day: string;
  totalQuantity: number;
  lineCount: number;
  totalPrice: number;
  totalPriceIncludingVat: number;
  currency: string;
  vendorSettled: boolean;
  clientSettled: boolean;
  isSettled: boolean;
};

export type ClientUnpaidBillSummary = {
  key: string;
  vendorId: string;
  vendorName: string;
  organisation: string;
  day: string;
  orderedAt: string;
  deliveryDate: string;
  totalQuantity: number;
  lineCount: number;
  totalPrice: number;
  totalPriceIncludingVat: number;
  currency: string;
  daysPastDue: number;
  isOverdue: boolean;
  vendorSettled: boolean;
  clientSettled: boolean;
  isSettled: boolean;
};

export type ClientDashboardCartDetailsItem = {
  merchandiseId: string;
  kind?: 'order' | 'refund' | 'penalty';
  name: string;
  reference: string;
  category: string;
  vendorId: string;
  vendorName: string;
  unitPrice: number;
  vatRate: number;
  unitPriceIncludingVat: number;
  quantity: number | null;
  lineTotal: number;
  lineTotalIncludingVat: number;
  vatCategory: string;
  vatExemptionReason: string;
};

export type ClientDashboardCartDetails = {
  key: string;
  vendorId: string;
  vendorName: string;
  day: string;
  items: ClientDashboardCartDetailsItem[];
  totalPrice: number;
  totalPriceIncludingVat: number;
  currency: string;
  clientComment: string;
  clientCommentSentAt: string | null;
  vendorSettled: boolean;
  clientSettled: boolean;
  isSettled: boolean;
};

export type AppBootstrapConfig = {
  page: PageName;
  language: LanguageCode;
  translations: Record<LanguageCode, Record<string, string>>;
  appStyleProfile: AppStyleProfile;
  wsToken: string;
  sessionUser: SessionUser | null;
  assets?: {
    mainJs: string;
    stylesCss: string;
    primaryStylesCss: string;
    secondaryStylesCss: string;
  };
};

export type WsApiResponse = {
  type: 'api:result';
  requestId: number;
  action: string;
  ok: boolean;
  data?: unknown;
  message?: string;
};

declare global {
  interface Window {
    __APP_CONFIG__?: AppBootstrapConfig;
  }
}
