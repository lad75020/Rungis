import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild
} from '@angular/core';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';

import {
  ACTIVATED_ORDERS_STATS_PAGE_SIZE,
  AVAILABLE_LANGUAGES,
  EMPTY_CART,
  SIGNUP_ROLES
} from './app.constants';
import type {
  AccessKeySummary,
  AdminActivatedOrderStat,
  AdminClientAssociation,
  AdminVendorAssociation,
  AlertType,
  AppStyleProfile,
  AppBootstrapConfig,
  AppToast,
  CartData,
  CartGroupBy,
  CartItem,
  CartValidation,
  CatalogItem,
  CatalogPriceVariation,
  ClientDashboardCartDetails,
  ClientDashboardCartSummary,
  ClientVendorDiscoveryItem,
  ClientUnpaidBillSummary,
  ClientUnpaidReminder,
  LanguageCode,
  OrderTab,
  OrderVendorOption,
  PageName,
  PendingUser,
  SessionUser,
  SignupRole,
  StockItem,
  StockSortKey,
  ThemeMode,
  ToastType,
  VendorBillClientOption,
  VendorBillMessageSummary,
  VendorBillsTab,
  VendorCategorySalesStat,
  VendorClientSalesStat,
  VendorMonthlySummaryBill,
  VendorDashboardOrderDetails,
  VendorDashboardOrderSummary,
  VendorOverdueBill,
  VendorOverdueBillGroup,
  VendorRefundClientOption,
  WsApiResponse
} from './app.types';
import {
  errorToMessage,
  getRelativeIsoDay,
  isSupportedImageFile,
  normalizePageName
} from './app.utils';
import {
  browserSupportsAccessKeys,
  startAccessKeyAuthentication,
  startAccessKeyRegistration
} from './webauthn-client';

@Component({
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly activatedOrdersStatsPageSize = ACTIVATED_ORDERS_STATS_PAGE_SIZE;
  @ViewChild('stockImageInput') private stockImageInput?: ElementRef<HTMLInputElement>;

  private readonly config: AppBootstrapConfig = window.__APP_CONFIG__ ?? {
    page: 'login',
    language: 'en',
    translations: { en: {}, fr: {} },
    appStyleProfile: 'primary',
    wsToken: '',
    sessionUser: null
  };

  private readonly wsPendingRequests = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  private requestCounter = 0;
  private toastCounter = 0;
  private lastTransientWsAlert:
    | {
        message: string;
        shownAt: number;
      }
    | null = null;
  private socket: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private lastPongAt = 0;
  private stockSnapshotVersion = 0;
  private stockListRequestSeq = 0;
  private cartSnapshotVersion = 0;
  private cartLoadRequestSeq = 0;
  private isDestroying = false;
  private systemThemeMediaQuery: MediaQueryList | null = null;
  private readonly toastTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly systemThemeChangeHandler = () => {
    if (this.themeMode() === 'system') {
      this.applyTheme();
    }
  };

  protected readonly page = signal<PageName>(normalizePageName(this.config.page));
  protected readonly language = signal<LanguageCode>(this.config.language ?? 'en');
  protected readonly availableLanguages: LanguageCode[] = AVAILABLE_LANGUAGES;
  protected readonly currentLanguageFlag = computed(() => (this.language() === 'en' ? '🇬🇧' : '🇫🇷'));
  protected readonly currentLanguageLabel = computed(() => (this.language() === 'en' ? 'English' : 'French'));
  protected readonly themeMode = signal<ThemeMode>('system');
  protected readonly currentThemeIcon = computed(() => {
    const mode = this.themeMode();
    return mode === 'light' ? '☀️' : mode === 'dark' ? '🌙' : '💻';
  });
  protected readonly currentThemeLabel = computed(() => {
    const mode = this.themeMode();
    return mode === 'light' ? this.t('theme.light') : mode === 'dark' ? this.t('theme.dark') : this.t('theme.system');
  });
  protected readonly sessionUser = signal<SessionUser | null>(this.config.sessionUser ?? null);
  protected readonly roles: SignupRole[] = SIGNUP_ROLES;

  protected readonly pendingUsers = signal<PendingUser[]>([]);
  protected readonly loadingPendingUsers = signal(false);
  protected readonly activatingUserIds = signal<string[]>([]);
  protected readonly deletingPendingUserIds = signal<string[]>([]);
  protected readonly showingPendingUserModal = signal(false);
  protected readonly selectedPendingUser = signal<PendingUser | null>(null);
  protected readonly adminClients = signal<AdminClientAssociation[]>([]);
  protected readonly adminVendors = signal<AdminVendorAssociation[]>([]);
  protected readonly loadingAdminAssociations = signal(false);
  protected readonly loadingAdminBillOverdueDays = signal(false);
  protected readonly savingAdminBillOverdueDays = signal(false);
  protected readonly loadingAdminAppStyleProfile = signal(false);
  protected readonly savingAdminAppStyleProfile = signal(false);
  protected readonly adminBillOverdueDays = signal(30);
  protected readonly adminAppStyleProfile = signal<AppStyleProfile>(this.config.appStyleProfile ?? 'primary');
  protected readonly adminBillGenerationDay = signal(getRelativeIsoDay(0));
  protected readonly runningAdminBillGeneration = signal(false);
  protected readonly selectedAdminClientId = signal('');
  protected readonly selectedAdminVendorId = signal('');
  protected readonly selectedVendorForClientId = signal('');
  protected readonly selectedClientForVendorId = signal('');
  protected readonly assigningAssociation = signal(false);
  protected readonly removingAssociationKey = signal('');

  protected readonly stockItems = signal<StockItem[]>([]);
  protected readonly stockSortKey = signal<StockSortKey>('name');
  protected readonly stockSortDirection = signal<'asc' | 'desc'>('asc');
  protected readonly loadingStockItems = signal(false);
  protected readonly savingStockItem = signal(false);
  protected readonly deletingStockItemIds = signal<string[]>([]);
  protected readonly editingStockItemId = signal<string | null>(null);
  protected readonly selectedStockImageFile = signal<File | null>(null);

  protected readonly orderCategories = signal<string[]>([]);
  protected readonly orderCatalogItems = signal<CatalogItem[]>([]);
  protected readonly selectedOrderCategory = signal('all');
  protected readonly selectedOrderVendor = signal('all');
  protected readonly selectedOrderTab = signal<OrderTab>('catalog');
  protected readonly favoriteMerchandiseIds = signal<string[]>([]);
  protected readonly togglingFavoriteItemIds = signal<string[]>([]);
  protected readonly loadingOrderCatalog = signal(false);
  protected readonly loadingOrderCart = signal(false);
  protected readonly orderDeliveryDate = signal(getRelativeIsoDay(0));
  protected readonly addingToCart = signal(false);
  protected readonly updatingCartItemIds = signal<string[]>([]);
  protected readonly removingCartItemIds = signal<string[]>([]);
  protected readonly validatingCart = signal(false);
  protected readonly cart = signal<CartData>(EMPTY_CART);
  protected readonly cartGroupBy = signal<CartGroupBy>('vendor');
  protected readonly cartValidation = signal<CartValidation | null>(null);
  protected readonly orderPriceVariations = signal<Record<string, CatalogPriceVariation>>({});
  protected readonly vendorBillsDate = signal(getRelativeIsoDay(0));
  protected readonly vendorBillsTab = signal<VendorBillsTab>('by-date');
  protected readonly vendorBillsRangeFromDate = signal(getRelativeIsoDay(-30));
  protected readonly vendorBillsRangeToDate = signal(getRelativeIsoDay(0));
  protected readonly loadingVendorBillClients = signal(false);
  protected readonly vendorBillClients = signal<VendorBillClientOption[]>([]);
  protected readonly selectedVendorBillClientId = signal('');
  protected readonly loadingVendorOrderSummaries = signal(false);
  protected readonly vendorOrderSummaries = signal<VendorDashboardOrderSummary[]>([]);
  protected readonly selectedVendorOrderKey = signal('');
  protected readonly vendorBillsExpanded = signal(false);
  protected readonly loadingVendorOrderDetails = signal(false);
  protected readonly vendorOrderDetails = signal<VendorDashboardOrderDetails | null>(null);
  protected readonly showingVendorOrderModal = signal(false);
  protected readonly updatingVendorBillSettlement = signal(false);
  protected readonly loadingVendorBillMessages = signal(false);
  protected readonly vendorBillMessages = signal<VendorBillMessageSummary[]>([]);
  protected readonly deletingVendorBillMessageKeys = signal<string[]>([]);
  protected readonly clientBillsDate = signal(getRelativeIsoDay(0));
  protected readonly clientBillsTab = signal<'by-date' | 'unpaid'>('by-date');
  protected readonly loadingClientCartSummaries = signal(false);
  protected readonly clientCartSummaries = signal<ClientDashboardCartSummary[]>([]);
  protected readonly selectedClientCartKey = signal('');
  protected readonly clientBillsExpanded = signal(false);
  protected readonly loadingClientBillVendors = signal(false);
  protected readonly clientBillVendors = signal<OrderVendorOption[]>([]);
  protected readonly selectedClientUnpaidVendorId = signal('');
  protected readonly loadingClientUnpaidVendorBills = signal(false);
  protected readonly clientUnpaidVendorBills = signal<ClientUnpaidBillSummary[]>([]);
  protected readonly loadingClientCartDetails = signal(false);
  protected readonly clientCartDetails = signal<ClientDashboardCartDetails | null>(null);
  protected readonly showingClientCartModal = signal(false);
  protected readonly updatingClientBillSettlement = signal(false);
  protected readonly clientBillCommentDraft = signal('');
  protected readonly sendingClientBillComment = signal(false);
  protected readonly selectedSubscriptionLogoFile = signal<File | null>(null);
  protected readonly selectedAccountLogoFile = signal<File | null>(null);
  protected readonly accessKeys = signal<AccessKeySummary[]>([]);
  protected readonly loadingAccessKeys = signal(false);
  protected readonly deletingAccessKeyIds = signal<string[]>([]);
  protected readonly loadingActivatedOrdersStats = signal(false);
  protected readonly activatedOrdersStats = signal<AdminActivatedOrderStat[]>([]);
  protected readonly activatedOrdersStatsPage = signal(0);
  protected readonly vendorStatsFromDate = signal(getRelativeIsoDay(-30));
  protected readonly vendorStatsToDate = signal(getRelativeIsoDay(0));
  protected readonly loadingVendorCategorySalesStats = signal(false);
  protected readonly vendorCategorySalesStats = signal<VendorCategorySalesStat[]>([]);
  protected readonly vendorClientSalesStats = signal<VendorClientSalesStat[]>([]);
  protected readonly loadingVendorOverdueBills = signal(false);
  protected readonly vendorOverdueBillGroups = signal<VendorOverdueBillGroup[]>([]);
  protected readonly remindedOverdueBillClientIds = signal<string[]>([]);
  protected readonly sendingUnpaidReminderClientIds = signal<string[]>([]);
  protected readonly vendorOverdueBillPenaltyPercentByKey = signal<Record<string, number>>({});
  protected readonly applyingVendorOverduePenaltyKeys = signal<string[]>([]);
  protected readonly loadingVendorRefundClients = signal(false);
  protected readonly savingVendorRefund = signal(false);
  protected readonly vendorRefundClients = signal<VendorRefundClientOption[]>([]);
  protected readonly loadingVendorMonthlySummaryClients = signal(false);
  protected readonly loadingVendorMonthlySummary = signal(false);
  protected readonly vendorMonthlySummaryYear = signal(new Date().getUTCFullYear());
  protected readonly vendorMonthlySummaryMonth = signal(new Date().getUTCMonth() + 1);
  protected readonly vendorMonthlySummaryClients = signal<VendorBillClientOption[]>([]);
  protected readonly selectedVendorMonthlySummaryClientId = signal('');
  protected readonly vendorMonthlySummaryBills = signal<VendorMonthlySummaryBill[]>([]);
  protected readonly vendorMonthlySummaryGrandTotal = signal(0);
  protected readonly vendorMonthlySummaryCurrency = signal('EUR');
  protected readonly vendorMonthlySummaryLoaded = signal(false);
  protected readonly loadingClientVendorDiscovery = signal(false);
  protected readonly clientVendorDiscoveryItems = signal<ClientVendorDiscoveryItem[]>([]);
  protected readonly assigningClientVendorIds = signal<string[]>([]);
  protected readonly showingClientVendorDiscoveryModal = signal(false);
  protected readonly selectedClientVendorDiscoveryItem = signal<ClientVendorDiscoveryItem | null>(null);
  protected readonly loadingClientUnpaidReminders = signal(false);
  protected readonly clientUnpaidReminders = signal<ClientUnpaidReminder[]>([]);

  protected readonly alertMessage = signal('');
  protected readonly alertType = signal<AlertType>('info');
  protected readonly toasts = signal<AppToast[]>([]);
  protected readonly wsStatus = signal<'connecting' | 'connected' | 'closed' | 'error'>('connecting');
  protected readonly updatingAccount = signal(false);
  protected readonly webAuthnSupported = signal(false);
  protected readonly enrollingAccessKey = signal(false);
  protected readonly signingInWithAccessKey = signal(false);

  protected readonly wsBadgeClass = computed(() => {
    switch (this.wsStatus()) {
      case 'connected':
        return 'text-bg-success';
      case 'error':
        return 'text-bg-danger';
      case 'closed':
        return 'text-bg-secondary';
      default:
        return 'text-bg-warning';
    }
  });

  protected readonly isAdmin = computed(() => this.sessionUser()?.role === 'admin');
  protected readonly isVendor = computed(() => this.sessionUser()?.role === 'vendor');
  protected readonly isClient = computed(() => this.sessionUser()?.role === 'client');
  protected readonly selectedVendorBillLabel = computed(() => {
    const selected = this.vendorOrderSummaries().find((order) => order.key === this.selectedVendorOrderKey());
    if (!selected) {
      return this.t('dashboard.selectBill');
    }

    return `${selected.organisation} - ${selected.totalPrice.toFixed(2)} ${selected.currency === 'EUR' ? '€' : selected.currency}`;
  });
  protected readonly selectedClientBillLabel = computed(() => {
    const selected = this.clientCartSummaries().find((bill) => bill.key === this.selectedClientCartKey());
    if (!selected) {
      return this.t('dashboard.selectBill');
    }

    return `${selected.organisation} - ${selected.totalPrice.toFixed(2)} ${selected.currency === 'EUR' ? '€' : selected.currency}`;
  });
  protected readonly selectedAdminClient = computed(() => {
    return this.adminClients().find((client) => client.id === this.selectedAdminClientId()) ?? null;
  });
  protected readonly selectedAdminVendor = computed(() => {
    return this.adminVendors().find((vendor) => vendor.id === this.selectedAdminVendorId()) ?? null;
  });
  protected readonly selectedClientAssignedVendors = computed(() => {
    const selectedClient = this.selectedAdminClient();
    if (!selectedClient) {
      return [];
    }

    const vendorIds = new Set(selectedClient.vendorIds);
    return this.adminVendors().filter((vendor) => vendorIds.has(vendor.id));
  });
  protected readonly selectedVendorAssignedClients = computed(() => {
    const selectedVendor = this.selectedAdminVendor();
    if (!selectedVendor) {
      return [];
    }

    const clientIds = new Set(selectedVendor.clientIds);
    return this.adminClients().filter((client) => clientIds.has(client.id));
  });
  protected readonly selectableAdminClients = computed(() => {
    return this.adminClients().filter((client) => client.isActive);
  });
  protected readonly selectableAdminVendors = computed(() => {
    return this.adminVendors().filter((vendor) => vendor.isActive);
  });
  protected readonly hasUnreadVendorBillMessages = computed(() => {
    return this.vendorBillMessages().some((message) => !message.isRead);
  });

  protected readonly filteredOrderCatalogItems = computed(() => {
    return this.getVisibleOrderCatalogItems(
      this.selectedOrderCategory(),
      this.selectedOrderVendor()
    );
  });

  protected readonly favoriteOrderCatalogItems = computed(() => {
    const favoriteSet = new Set(this.favoriteMerchandiseIds());
    const favoriteItems = this.orderCatalogItems().filter((item) => favoriteSet.has(item.id));
    return this.sortOrderCatalogItems(favoriteItems);
  });

  protected readonly orderItemsForSelectedTab = computed(() => {
    return this.selectedOrderTab() === 'favorites'
      ? this.favoriteOrderCatalogItems()
      : this.filteredOrderCatalogItems();
  });

  protected readonly orderVendors = computed<OrderVendorOption[]>(() => {
    const namesById = new Map<string, string>();
    for (const item of this.orderCatalogItems()) {
      if (!namesById.has(item.vendorId)) {
        namesById.set(item.vendorId, item.vendorName);
      }
    }

    return [...namesById.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  });

  protected readonly sortedCartItems = computed(() => {
    const groupBy = this.cartGroupBy();

    return [...this.cart().items].sort((left, right) => {
      const leftGroupKey = groupBy === 'vendor' ? left.vendorName : left.category;
      const rightGroupKey = groupBy === 'vendor' ? right.vendorName : right.category;

      const groupCompare = leftGroupKey.localeCompare(rightGroupKey);
      if (groupCompare !== 0) {
        return groupCompare;
      }

      return left.name.localeCompare(right.name);
    });
  });

  protected readonly sortedStockItems = computed(() => {
    const key = this.stockSortKey();
    const direction = this.stockSortDirection();
    const factor = direction === 'asc' ? 1 : -1;

    return [...this.stockItems()].sort((left, right) => {
      const compare = left[key].localeCompare(right[key], undefined, { sensitivity: 'base' });
      if (compare !== 0) {
        return compare * factor;
      }

      return left.reference.localeCompare(right.reference, undefined, { sensitivity: 'base' }) * factor;
    });
  });

  protected readonly stockCategories = computed(() => {
    return [...new Set(this.stockItems().map((item) => item.category).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));
  });

  protected readonly activatedOrdersChart = computed(() => {
    const rows = this.activatedOrdersStats();
    if (rows.length === 0) {
      return null;
    }

    const width = 860;
    const height = 320;
    const marginLeft = 48;
    const marginRight = 56;
    const marginTop = 20;
    const marginBottom = 34;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const maxOrderCount = Math.max(1, ...rows.map((row) => Number(row.orderCount ?? 0)));
    const maxTotalAmount = Math.max(1, ...rows.map((row) => Number(row.totalAmount ?? 0)));
    const xDenominator = Math.max(1, rows.length - 1);

    const countPoints = rows.map((row, index) => {
      const x = marginLeft + (index / xDenominator) * plotWidth;
      const y = marginTop + (1 - Number(row.orderCount ?? 0) / maxOrderCount) * plotHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    const amountPoints = rows.map((row, index) => {
      const x = marginLeft + (index / xDenominator) * plotWidth;
      const y = marginTop + (1 - Number(row.totalAmount ?? 0) / maxTotalAmount) * plotHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    const tickCount = 4;
    const leftTicks = Array.from({ length: tickCount + 1 }, (_unused, index) => {
      const ratio = index / tickCount;
      const y = marginTop + (1 - ratio) * plotHeight;
      const value = Math.round(ratio * maxOrderCount);
      return { y, label: String(value) };
    });

    const rightTicks = Array.from({ length: tickCount + 1 }, (_unused, index) => {
      const ratio = index / tickCount;
      const y = marginTop + (1 - ratio) * plotHeight;
      const value = ratio * maxTotalAmount;
      return { y, label: value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) };
    });

    return {
      width,
      height,
      marginLeft,
      marginRight,
      marginTop,
      marginBottom,
      countPolyline: countPoints.join(' '),
      amountPolyline: amountPoints.join(' '),
      firstDay: rows[0].day,
      lastDay: rows[rows.length - 1].day,
      maxOrderCount,
      maxTotalAmount,
      leftTicks,
      rightTicks
    };
  });

  protected readonly sortedActivatedOrdersStatsTableRows = computed(() => {
    return [...this.activatedOrdersStats()].sort((left, right) => right.day.localeCompare(left.day));
  });

  protected readonly activatedOrdersStatsPageCount = computed(() => {
    return Math.max(1, Math.ceil(this.sortedActivatedOrdersStatsTableRows().length / this.activatedOrdersStatsPageSize));
  });

  protected readonly paginatedActivatedOrdersStatsTableRows = computed(() => {
    const pageIndex = Math.min(this.activatedOrdersStatsPage(), this.activatedOrdersStatsPageCount() - 1);
    const start = pageIndex * this.activatedOrdersStatsPageSize;
    return this.sortedActivatedOrdersStatsTableRows().slice(start, start + this.activatedOrdersStatsPageSize);
  });

  protected readonly vendorCategorySalesPie = computed(() => {
    const rows = this.vendorCategorySalesStats().filter((row) => Number(row.totalAmount ?? 0) > 0);
    if (rows.length === 0) {
      return null;
    }

    const totalAmount = rows.reduce((sum, row) => sum + Number(row.totalAmount ?? 0), 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return null;
    }

    const colors = ['#0d6efd', '#198754', '#dc3545', '#fd7e14', '#6f42c1', '#20c997', '#d63384', '#ffc107'];
    const width = 420;
    const height = 300;
    const cx = 150;
    const cy = 150;
    const radius = 110;

    let startAngle = -Math.PI / 2;
    const slices = rows.map((row, index) => {
      const amount = Number(row.totalAmount ?? 0);
      const ratio = amount / totalAmount;
      const angle = ratio * Math.PI * 2;
      const endAngle = startAngle + angle;
      const color = colors[index % colors.length];

      const slice = {
        category: row.category,
        amount,
        percent: ratio * 100,
        currency: row.currency,
        color,
        path: '',
        fullCircle: false
      };

      if (rows.length === 1) {
        slice.fullCircle = true;
      } else {
        const x1 = cx + radius * Math.cos(startAngle);
        const y1 = cy + radius * Math.sin(startAngle);
        const x2 = cx + radius * Math.cos(endAngle);
        const y2 = cy + radius * Math.sin(endAngle);
        const largeArcFlag = angle > Math.PI ? 1 : 0;
        slice.path = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
      }

      startAngle = endAngle;
      return slice;
    });

    return {
      width,
      height,
      cx,
      cy,
      radius,
      totalAmount: Number(totalAmount.toFixed(2)),
      slices
    };
  });

  protected readonly vendorClientSalesBarChart = computed(() => {
    const rows = this.vendorClientSalesStats().filter((row) => Number(row.totalAmount ?? 0) > 0);
    if (rows.length === 0) {
      return null;
    }

    const width = 860;
    const height = 360;
    const marginLeft = 56;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 90;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const maxAmount = Math.max(1, ...rows.map((row) => Number(row.totalAmount ?? 0)));
    const barGap = 8;
    const barWidth = Math.max(10, (plotWidth - barGap * (rows.length - 1)) / rows.length);

    const bars = rows.map((row, index) => {
      const x = marginLeft + index * (barWidth + barGap);
      const value = Number(row.totalAmount ?? 0);
      const barHeight = (value / maxAmount) * plotHeight;
      const y = marginTop + (plotHeight - barHeight);
      const label = row.clientName.length > 18 ? `${row.clientName.slice(0, 15)}...` : row.clientName;
      return {
        clientId: row.clientId,
        clientName: row.clientName,
        label,
        amount: value,
        x,
        y,
        width: barWidth,
        height: barHeight
      };
    });

    const yTicks = Array.from({ length: 5 }, (_unused, index) => {
      const ratio = index / 4;
      const y = marginTop + (1 - ratio) * plotHeight;
      const value = ratio * maxAmount;
      return {
        y,
        label: value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      };
    });

    return {
      width,
      height,
      marginLeft,
      marginRight,
      marginTop,
      marginBottom,
      plotHeight,
      bars,
      yTicks
    };
  });

  protected readonly localCartAggregates = computed(() => {
    const groupBy = this.cartGroupBy();
    const groups = new Map<string, { key: string; label: string; total: number }>();

    for (const item of this.cart().items) {
      const key = groupBy === 'vendor' ? item.vendorId : item.category;
      const label = groupBy === 'vendor' ? item.vendorName : item.category;
      const current = groups.get(key);

      if (current) {
        current.total = Number((current.total + item.lineTotal).toFixed(2));
      } else {
        groups.set(key, {
          key,
          label,
          total: Number(item.lineTotal.toFixed(2))
        });
      }
    }

    return [...groups.values()].sort((left, right) => left.label.localeCompare(right.label));
  });

  protected readonly loginForm = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  protected readonly subscriptionForm = this.formBuilder.nonNullable.group({
    role: 'vendor' as SignupRole,
    username: this.formBuilder.nonNullable.control('', {
      validators: [Validators.required],
      asyncValidators: [this.usernameAvailabilityValidator()],
      updateOn: 'blur'
    }),
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    organisation: ['', [Validators.required]],
    city: ['', [Validators.required]],
    zipcode: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    physicalAddress: ['', [Validators.required]],
    phoneNumber: ['', [Validators.required]],
    businessRegistrationId: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  protected readonly accountForm = this.formBuilder.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    organisation: ['', [Validators.required]],
    city: ['', [Validators.required]],
    zipcode: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    physicalAddress: ['', [Validators.required]],
    phoneNumber: ['', [Validators.required]],
    businessDescription: ['', [Validators.maxLength(2000)]],
    businessRegistrationId: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]]
  });

  protected readonly stockForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    reference: ['', [Validators.required]],
    price: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    minimumStockThreshold: [''],
    category: ['', [Validators.required]]
  });

  protected readonly addToCartForm = this.formBuilder.nonNullable.group({
    merchandiseId: ['', [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(1)]]
  });

  protected readonly vendorRefundForm = this.formBuilder.nonNullable.group({
    clientId: ['', [Validators.required]],
    amount: [0.01, [Validators.required, Validators.min(0.01)]],
    comment: ['', [Validators.required, Validators.maxLength(32)]]
  });

  ngOnInit(): void {
    this.applyAppStyleProfile(this.config.appStyleProfile ?? 'primary');
    this.initializeThemeMode();
    void browserSupportsAccessKeys().then((isSupported) => {
      this.webAuthnSupported.set(isSupported);
      if (!isSupported && this.page() === 'account') {
        this.setAccountToast('warning', this.t('account.accessKeyNotSupported'));
      }
    });
    this.connectSocket();

    if (this.page() === 'admin') {
      void this.loadPendingUsers();
      void this.loadAdminAssociations();
      void this.loadAdminBillOverdueDays();
      void this.loadAdminAppStyleProfile();
    }

    if (this.page() === 'statistics') {
      void this.loadActivatedOrdersStats();
    }

    if (this.page() === 'vendor-statistics') {
      void this.loadVendorCategorySalesStats();
    }

    if (this.page() === 'vendor-monthly-summary') {
      void this.loadVendorMonthlySummaryClients();
    }

    if (this.page() === 'vendor-overdue-bills') {
      void this.loadVendorOverdueBills();
    }

    if (this.page() === 'vendor-refunds') {
      void this.loadVendorRefundClients();
    }

    if (this.page() === 'find-vendors') {
      void this.loadClientVendorDiscovery();
    }

    if (this.page() === 'dashboard' && this.isClient()) {
      void this.loadClientUnpaidReminders();
      void this.loadClientBillVendors();
    }

    if (this.page() === 'account') {
      const user = this.sessionUser();
      if (user) {
        this.accountForm.setValue({
          firstName: user.firstName,
          lastName: user.lastName,
          organisation: user.organisation,
          city: user.city,
          zipcode: user.zipcode,
          email: user.email,
          physicalAddress: user.physicalAddress,
          phoneNumber: user.phoneNumber,
          businessDescription: user.businessDescription ?? '',
          businessRegistrationId: String(user.businessRegistrationId)
        });
      }
      void this.loadAccessKeys();
    }
  }

  ngOnDestroy(): void {
    this.isDestroying = true;
    this.stopSocketHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.socket?.close();

    for (const pending of this.wsPendingRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(this.t('alerts.connectionClosed')));
    }

    for (const timer of this.toastTimers.values()) {
      clearTimeout(timer);
    }

    this.toastTimers.clear();
    this.wsPendingRequests.clear();

    if (this.systemThemeMediaQuery) {
      if (typeof this.systemThemeMediaQuery.removeEventListener === 'function') {
        this.systemThemeMediaQuery.removeEventListener('change', this.systemThemeChangeHandler);
      } else if (typeof this.systemThemeMediaQuery.removeListener === 'function') {
        this.systemThemeMediaQuery.removeListener(this.systemThemeChangeHandler);
      }
      this.systemThemeMediaQuery = null;
    }
  }

  protected dismissToast(toastId: number): void {
    const timer = this.toastTimers.get(toastId);
    if (timer) {
      clearTimeout(timer);
      this.toastTimers.delete(toastId);
    }

    this.toasts.set(this.toasts().filter((toast) => toast.id !== toastId));
  }

  protected async submitLogin(): Promise<void> {
    if (this.loginForm.invalid) {
      this.setAlert('danger', this.t('alerts.login.enterCredentials'));
      return;
    }

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(this.loginForm.getRawValue())
    });

    const payload = await response.json();
    if (!response.ok) {
      this.setAlert('danger', payload.message ?? this.t('alerts.login.failed'));
      return;
    }

    this.setAlert('success', this.t('alerts.login.successRedirect'));
    window.location.assign(payload.redirect ?? '/dashboard');
  }

  protected async signInWithAccessKey(): Promise<void> {
    if (!this.webAuthnSupported()) {
      this.setAlert('danger', this.t('alerts.webauthn.notSupported'));
      return;
    }

    this.signingInWithAccessKey.set(true);

    try {
      const optionsResponse = await fetch('/api/webauthn/authentication/options', {
        method: 'POST'
      });
      const optionsPayload = await optionsResponse.json().catch(() => null);
      if (!optionsResponse.ok || !optionsPayload?.options) {
        this.setAlert('danger', optionsPayload?.message ?? this.t('alerts.webauthn.authenticationFailed'));
        return;
      }

      const authenticationResponse = await startAccessKeyAuthentication(optionsPayload.options);

      const verifyResponse = await fetch('/api/webauthn/authentication/verify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ response: authenticationResponse })
      });
      const verifyPayload = await verifyResponse.json().catch(() => null);
      if (!verifyResponse.ok) {
        this.setAlert('danger', verifyPayload?.message ?? this.t('alerts.webauthn.authenticationFailed'));
        return;
      }

      this.setAlert('success', this.t('alerts.login.successRedirect'));
      window.location.assign(verifyPayload?.redirect ?? '/dashboard');
    } catch (error) {
      this.setAlert('danger', this.getWebAuthnErrorMessage(error, this.t('alerts.webauthn.authenticationFailed')));
    } finally {
      this.signingInWithAccessKey.set(false);
    }
  }

  protected async submitSubscription(): Promise<void> {
    const usernameControl = this.subscriptionForm.controls.username;
    this.subscriptionForm.markAllAsTouched();
    usernameControl.markAsTouched();
    usernameControl.updateValueAndValidity();

    if (usernameControl.pending) {
      this.setAlert('info', this.t('subscribe.checkingUsername'));
      await this.waitForControlValidation(usernameControl);
    }

    if (this.subscriptionForm.invalid) {
      this.setAlert('danger', this.getSubscriptionValidationMessage());
      return;
    }

    let logoDataUrl = '';
    if (this.selectedSubscriptionLogoFile()) {
      try {
        logoDataUrl = await this.fileToDataUrl(this.selectedSubscriptionLogoFile() as File);
      } catch {
        this.setAlert('danger', this.t('alerts.stocks.imageReadFailed'));
        return;
      }
    }

    const response = await fetch('/api/subscribe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        ...this.subscriptionForm.getRawValue(),
        logoDataUrl
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      this.setAlert('danger', payload.message ?? this.t('alerts.subscribe.failed'));
      return;
    }

    this.setAlert('success', payload.message ?? this.t('alerts.subscribe.successRedirect'));
    setTimeout(() => {
      window.location.assign(payload.redirect ?? '/login');
    }, 1200);
  }

  protected async submitAccount(): Promise<void> {
    if (!this.sessionUser()) {
      window.location.assign('/login');
      return;
    }

    if (this.accountForm.invalid) {
      this.setAlert('danger', this.t('alerts.account.fillRequired'));
      return;
    }

    this.updatingAccount.set(true);

    try {
      let logoDataUrl = '';
      if (this.selectedAccountLogoFile()) {
        try {
          logoDataUrl = await this.fileToDataUrl(this.selectedAccountLogoFile() as File);
        } catch {
          this.setAlert('danger', this.t('alerts.stocks.imageReadFailed'));
          return;
        }
      }

      const response = await fetch('/api/account', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          ...this.accountForm.getRawValue(),
          logoDataUrl
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.account.updateFailed'));
        return;
      }

      if (payload?.user) {
        this.sessionUser.set(payload.user);
      }
      this.selectedAccountLogoFile.set(null);
      this.setAlert('success', payload?.message ?? this.t('alerts.account.updated'));
    } finally {
      this.updatingAccount.set(false);
    }
  }

  protected async enrollAccessKey(): Promise<void> {
    if (!this.sessionUser()) {
      window.location.assign('/login');
      return;
    }

    if (!this.webAuthnSupported()) {
      this.setAlert('danger', this.t('alerts.webauthn.notSupported'));
      return;
    }

    this.enrollingAccessKey.set(true);

    try {
      const optionsResponse = await fetch('/api/webauthn/enrollment/options', {
        method: 'POST'
      });
      const optionsPayload = await optionsResponse.json().catch(() => null);
      if (!optionsResponse.ok || !optionsPayload?.options) {
        this.setAlert('danger', optionsPayload?.message ?? this.t('alerts.webauthn.enrollmentFailed'));
        return;
      }

      const registrationResponse = await startAccessKeyRegistration(optionsPayload.options);

      const verifyResponse = await fetch('/api/webauthn/enrollment/verify', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ response: registrationResponse })
      });
      const verifyPayload = await verifyResponse.json().catch(() => null);
      if (!verifyResponse.ok) {
        this.setAlert('danger', verifyPayload?.message ?? this.t('alerts.webauthn.enrollmentFailed'));
        return;
      }

      void this.loadAccessKeys();
      this.setAlert('success', verifyPayload?.message ?? this.t('alerts.webauthn.enrollmentSucceeded'));
    } catch (error) {
      this.setAlert('danger', this.getWebAuthnErrorMessage(error, this.t('alerts.webauthn.enrollmentFailed')));
    } finally {
      this.enrollingAccessKey.set(false);
    }
  }

  protected async loadAccessKeys(): Promise<void> {
    if (!this.sessionUser()) {
      return;
    }

    this.loadingAccessKeys.set(true);

    try {
      const response = await fetch('/api/webauthn/keys');
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.webauthn.keysLoadFailed'));
        return;
      }

      this.accessKeys.set(Array.isArray(payload?.keys) ? payload.keys : []);
    } finally {
      this.loadingAccessKeys.set(false);
    }
  }

  protected isDeletingAccessKey(accessKeyId: string): boolean {
    return this.deletingAccessKeyIds().includes(accessKeyId);
  }

  protected async removeAccessKey(accessKeyId: string): Promise<void> {
    if (this.isDeletingAccessKey(accessKeyId)) {
      return;
    }

    this.deletingAccessKeyIds.set([...this.deletingAccessKeyIds(), accessKeyId]);

    try {
      const response = await fetch(`/api/webauthn/keys/${encodeURIComponent(accessKeyId)}`, {
        method: 'DELETE'
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.webauthn.keyRemoveFailed'));
        return;
      }

      this.accessKeys.set(this.accessKeys().filter((accessKey) => accessKey.id !== accessKeyId));
      this.setAlert('success', payload?.message ?? this.t('alerts.webauthn.keyRemoved'));
    } finally {
      this.deletingAccessKeyIds.set(this.deletingAccessKeyIds().filter((id) => id !== accessKeyId));
    }
  }

  protected async loadActivatedOrdersStats(): Promise<void> {
    if (!this.isAdmin()) {
      this.setAlert('danger', this.t('admin.onlyAdmins'));
      return;
    }

    this.loadingActivatedOrdersStats.set(true);
    this.activatedOrdersStatsPage.set(0);

    try {
      const response = await fetch('/api/admin/statistics/activated-orders');
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.statistics.loadFailed'));
        return;
      }

      this.activatedOrdersStats.set(Array.isArray(payload?.rows) ? payload.rows : []);
    } finally {
      this.loadingActivatedOrdersStats.set(false);
    }
  }

  protected showPreviousActivatedOrdersStatsPage(): void {
    if (this.activatedOrdersStatsPage() === 0) {
      return;
    }

    this.activatedOrdersStatsPage.update((page) => Math.max(0, page - 1));
  }

  protected showNextActivatedOrdersStatsPage(): void {
    if (this.activatedOrdersStatsPage() >= this.activatedOrdersStatsPageCount() - 1) {
      return;
    }

    this.activatedOrdersStatsPage.update((page) => Math.min(this.activatedOrdersStatsPageCount() - 1, page + 1));
  }

  protected setVendorStatsFromDate(value: string): void {
    this.vendorStatsFromDate.set(value);
    void this.loadVendorCategorySalesStats();
  }

  protected setVendorStatsToDate(value: string): void {
    this.vendorStatsToDate.set(value);
    void this.loadVendorCategorySalesStats();
  }

  protected async loadVendorCategorySalesStats(): Promise<void> {
    if (!this.isVendor()) {
      this.setAlert('danger', this.t('stocks.onlyVendors'));
      return;
    }

    this.loadingVendorCategorySalesStats.set(true);

    try {
      const params = new URLSearchParams();
      if (this.vendorStatsFromDate()) {
        params.set('fromDate', this.vendorStatsFromDate());
      }
      if (this.vendorStatsToDate()) {
        params.set('toDate', this.vendorStatsToDate());
      }

      const queryString = params.toString();
      const [categoryResponse, clientResponse] = await Promise.all([
        fetch(`/api/vendor/statistics/sales-by-category?${queryString}`),
        fetch(`/api/vendor/statistics/sales-by-client?${queryString}`)
      ]);
      const [categoryPayload, clientPayload] = await Promise.all([
        categoryResponse.json().catch(() => null),
        clientResponse.json().catch(() => null)
      ]);

      if (!categoryResponse.ok) {
        this.setAlert('danger', categoryPayload?.message ?? this.t('alerts.vendorStatistics.loadFailed'));
        return;
      }
      if (!clientResponse.ok) {
        this.setAlert('danger', clientPayload?.message ?? this.t('alerts.vendorStatistics.loadFailed'));
        return;
      }

      this.vendorCategorySalesStats.set(Array.isArray(categoryPayload?.rows) ? categoryPayload.rows : []);
      this.vendorClientSalesStats.set(Array.isArray(clientPayload?.rows) ? clientPayload.rows : []);
    } finally {
      this.loadingVendorCategorySalesStats.set(false);
    }
  }

  protected async loadVendorOverdueBills(): Promise<void> {
    if (!this.isVendor()) {
      this.setAlert('danger', this.t('stocks.onlyVendors'));
      return;
    }

    this.loadingVendorOverdueBills.set(true);
    try {
      const response = await fetch('/api/vendor/bills/overdue-unsettled');
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.vendorOverdueBills.loadFailed'));
        return;
      }

      this.vendorOverdueBillGroups.set(Array.isArray(payload?.groups) ? payload.groups : []);
      this.initializeVendorOverdueBillPenaltyPercents(Array.isArray(payload?.groups) ? payload.groups : []);
      this.remindedOverdueBillClientIds.set(
        Array.isArray(payload?.remindedClientIds)
          ? payload.remindedClientIds.map((value: unknown) => String(value)).filter(Boolean)
          : []
      );
    } finally {
      this.loadingVendorOverdueBills.set(false);
    }
  }

  protected async loadVendorRefundClients(): Promise<void> {
    if (!this.isVendor()) {
      this.setAlert('danger', this.t('alerts.refunds.onlyVendorsAccess'));
      return;
    }

    this.loadingVendorRefundClients.set(true);
    try {
      const response = await fetch('/api/vendor/refunds/clients');
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.refunds.loadClientsFailed'));
        return;
      }

      const clients: VendorRefundClientOption[] = Array.isArray(payload?.clients) ? payload.clients : [];
      this.vendorRefundClients.set(clients);
      const selectedClientId = this.vendorRefundForm.controls.clientId.value;
      if (!clients.some((client) => client.id === selectedClientId)) {
        this.vendorRefundForm.controls.clientId.setValue(clients[0]?.id ?? '');
      }
    } finally {
      this.loadingVendorRefundClients.set(false);
    }
  }

  protected async loadVendorMonthlySummaryClients(): Promise<void> {
    if (!this.isVendor()) {
      this.setAlert('danger', this.t('stocks.onlyVendors'));
      return;
    }

    this.loadingVendorMonthlySummaryClients.set(true);
    try {
      const response = await fetch('/api/vendor/monthly-summary/clients');
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.vendorMonthlySummary.loadClientsFailed'));
        return;
      }

      const clients: VendorBillClientOption[] = Array.isArray(payload?.clients) ? payload.clients : [];
      this.vendorMonthlySummaryClients.set(clients);
      if (!clients.some((client) => client.id === this.selectedVendorMonthlySummaryClientId())) {
        this.selectedVendorMonthlySummaryClientId.set('');
      }
    } finally {
      this.loadingVendorMonthlySummaryClients.set(false);
    }
  }

  protected async loadVendorMonthlySummary(): Promise<void> {
    if (!this.isVendor()) {
      this.setAlert('danger', this.t('stocks.onlyVendors'));
      return;
    }
    if (this.loadingVendorMonthlySummary()) {
      return;
    }

    const year = Number(this.vendorMonthlySummaryYear());
    const month = Number(this.vendorMonthlySummaryMonth());
    const clientId = this.selectedVendorMonthlySummaryClientId();
    if (!Number.isInteger(year) || year < 2000 || year > 9999) {
      this.setAlert('danger', this.t('alerts.vendorMonthlySummary.invalidYear'));
      return;
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      this.setAlert('danger', this.t('alerts.vendorMonthlySummary.invalidMonth'));
      return;
    }
    if (!clientId) {
      this.setAlert('danger', this.t('alerts.vendorMonthlySummary.selectClient'));
      return;
    }

    this.loadingVendorMonthlySummary.set(true);
    this.vendorMonthlySummaryLoaded.set(false);
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        clientId
      });
      const response = await fetch(`/api/vendor/monthly-summary?${params.toString()}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.vendorMonthlySummary.loadFailed'));
        return;
      }

      const rows: VendorMonthlySummaryBill[] = Array.isArray(payload?.rows) ? payload.rows : [];
      this.vendorMonthlySummaryBills.set(rows);
      this.vendorMonthlySummaryGrandTotal.set(Number(payload?.grandTotal ?? 0));
      this.vendorMonthlySummaryCurrency.set(String(payload?.currency ?? 'EUR') || 'EUR');
      this.vendorMonthlySummaryLoaded.set(true);
    } finally {
      this.loadingVendorMonthlySummary.set(false);
    }
  }

  protected async submitVendorRefund(): Promise<void> {
    if (!this.isVendor()) {
      this.setAlert('danger', this.t('alerts.refunds.onlyVendorsAccess'));
      return;
    }

    const { clientId, amount, comment } = this.vendorRefundForm.getRawValue();
    if (!clientId) {
      this.setAlert('danger', this.t('alerts.refunds.selectClient'));
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      this.setAlert('danger', this.t('alerts.refunds.invalidAmount'));
      return;
    }

    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      this.setAlert('danger', this.t('alerts.refunds.commentRequired'));
      return;
    }
    if (trimmedComment.length > 32) {
      this.setAlert('danger', this.t('alerts.refunds.commentTooLong'));
      return;
    }

    this.savingVendorRefund.set(true);
    try {
      const response = await fetch('/api/vendor/refunds', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          clientId,
          amount: numericAmount,
          comment: trimmedComment
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.refunds.createFailed'));
        return;
      }

      this.vendorRefundForm.controls.amount.setValue(0.01);
      this.vendorRefundForm.controls.comment.setValue('');
      this.vendorRefundForm.markAsPristine();
      this.vendorRefundForm.markAsUntouched();
      this.setAlert('success', payload?.message ?? this.t('alerts.refunds.created'));
    } finally {
      this.savingVendorRefund.set(false);
    }
  }

  protected isSendingUnpaidReminder(clientId: string): boolean {
    return this.sendingUnpaidReminderClientIds().includes(clientId);
  }

  protected isReminderSentForClient(clientId: string): boolean {
    return this.remindedOverdueBillClientIds().includes(clientId);
  }

  protected async sendUnpaidReminder(group: VendorOverdueBillGroup): Promise<void> {
    if (!this.isVendor()) {
      this.setAlert('danger', this.t('stocks.onlyVendors'));
      return;
    }

    if (this.isSendingUnpaidReminder(group.clientId)) {
      return;
    }

    this.sendingUnpaidReminderClientIds.set([...this.sendingUnpaidReminderClientIds(), group.clientId]);
    try {
      const response = await fetch('/api/vendor/unpaid-reminders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          clientId: group.clientId,
          totalAmount: group.totalAmount
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.vendorOverdueBills.reminderSendFailed'));
        return;
      }

      this.remindedOverdueBillClientIds.set([
        ...new Set([...this.remindedOverdueBillClientIds(), group.clientId])
      ]);
      this.setAlert('success', payload?.message ?? this.t('alerts.vendorOverdueBills.reminderSent'));
    } finally {
      this.sendingUnpaidReminderClientIds.set(
        this.sendingUnpaidReminderClientIds().filter((id) => id !== group.clientId)
      );
    }
  }

  protected getVendorOverdueBillPenaltyPercent(key: string): number {
    const value = this.vendorOverdueBillPenaltyPercentByKey()[key];
    return Number.isInteger(value) && value >= 1 && value <= 50 ? value : 10;
  }

  protected setVendorOverdueBillPenaltyPercent(key: string, rawValue: string): void {
    const numeric = Number(rawValue);
    const nextValue = Number.isInteger(numeric) && numeric >= 1 && numeric <= 50 ? numeric : 10;
    this.vendorOverdueBillPenaltyPercentByKey.set({
      ...this.vendorOverdueBillPenaltyPercentByKey(),
      [key]: nextValue
    });
  }

  protected isApplyingVendorOverduePenalty(key: string): boolean {
    return this.applyingVendorOverduePenaltyKeys().includes(key);
  }

  protected async applyVendorOverdueBillPenalty(bill: VendorOverdueBill, event?: Event): Promise<void> {
    event?.stopPropagation();

    if (!this.isVendor()) {
      this.setAlert('danger', this.t('stocks.onlyVendors'));
      return;
    }

    if (!bill?.key || this.isApplyingVendorOverduePenalty(bill.key)) {
      return;
    }

    if (bill.hasPenaltyLine) {
      this.setAlert('danger', this.t('alerts.vendorOverdueBills.penaltyAlreadyApplied'));
      return;
    }

    const percentage = this.getVendorOverdueBillPenaltyPercent(bill.key);
    if (!Number.isInteger(percentage) || percentage < 1 || percentage > 50) {
      this.setAlert('danger', this.t('alerts.vendorOverdueBills.invalidPenaltyPercent'));
      return;
    }

    this.applyingVendorOverduePenaltyKeys.set([...this.applyingVendorOverduePenaltyKeys(), bill.key]);
    try {
      const response = await fetch('/api/vendor/bills/penalty-lines', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          key: bill.key,
          percentage
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.vendorOverdueBills.penaltyApplyFailed'));
        return;
      }

      await this.loadVendorOverdueBills();
      if (this.vendorOrderDetails()?.key === bill.key) {
        await this.openVendorOrderDetails(bill.key);
      }
      this.setAlert('success', payload?.message ?? this.t('alerts.vendorOverdueBills.penaltyApplied'));
    } finally {
      this.applyingVendorOverduePenaltyKeys.set(
        this.applyingVendorOverduePenaltyKeys().filter((key) => key !== bill.key)
      );
    }
  }

  protected async loadClientUnpaidReminders(): Promise<void> {
    if (!this.isClient()) {
      return;
    }

    this.loadingClientUnpaidReminders.set(true);
    try {
      const response = await fetch('/api/client/unpaid-reminders');
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.clientUnpaidReminders.loadFailed'));
        return;
      }

      this.clientUnpaidReminders.set(Array.isArray(payload?.reminders) ? payload.reminders : []);
    } finally {
      this.loadingClientUnpaidReminders.set(false);
    }
  }

  protected async loadClientVendorDiscovery(): Promise<void> {
    if (!this.isClient()) {
      this.setAlert('danger', this.t('findVendors.onlyClients'));
      return;
    }

    this.loadingClientVendorDiscovery.set(true);
    try {
      const response = await fetch('/api/client/find-vendors');
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.findVendors.loadFailed'));
        return;
      }

      this.clientVendorDiscoveryItems.set(Array.isArray(payload?.vendors) ? payload.vendors : []);
    } finally {
      this.loadingClientVendorDiscovery.set(false);
    }
  }

  protected isAssigningClientVendor(vendorId: string): boolean {
    return this.assigningClientVendorIds().includes(vendorId);
  }

  protected async assignClientVendor(vendorId: string, event?: Event): Promise<void> {
    event?.stopPropagation();

    if (!this.isClient()) {
      this.setAlert('danger', this.t('findVendors.onlyClients'));
      return;
    }

    const vendor = this.clientVendorDiscoveryItems().find((item) => item.id === vendorId);
    if (!vendor || vendor.isAssigned || this.isAssigningClientVendor(vendorId)) {
      return;
    }

    this.assigningClientVendorIds.set([...this.assigningClientVendorIds(), vendorId]);
    try {
      const response = await fetch(`/api/client/find-vendors/${encodeURIComponent(vendorId)}/assign`, {
        method: 'POST'
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.findVendors.assignFailed'));
        return;
      }

      this.clientVendorDiscoveryItems.set(
        this.clientVendorDiscoveryItems().map((item) =>
          item.id === vendorId
            ? { ...item, isAssigned: true }
            : item
        )
      );
      if (this.selectedClientVendorDiscoveryItem()?.id === vendorId) {
        this.selectedClientVendorDiscoveryItem.set({
          ...this.selectedClientVendorDiscoveryItem()!,
          isAssigned: true
        });
      }
      this.setAlert('success', payload?.message ?? this.t('alerts.findVendors.assigned'));
    } finally {
      this.assigningClientVendorIds.set(
        this.assigningClientVendorIds().filter((id) => id !== vendorId)
      );
    }
  }

  protected openClientVendorDiscoveryDetails(vendor: ClientVendorDiscoveryItem): void {
    this.selectedClientVendorDiscoveryItem.set(vendor);
    this.showingClientVendorDiscoveryModal.set(true);
  }

  protected closeClientVendorDiscoveryDetails(): void {
    this.showingClientVendorDiscoveryModal.set(false);
    this.selectedClientVendorDiscoveryItem.set(null);
  }

  protected onSubscriptionLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    if (!file) {
      this.selectedSubscriptionLogoFile.set(null);
      return;
    }

    if (!isSupportedImageFile(file)) {
      this.selectedSubscriptionLogoFile.set(null);
      if (input) {
        input.value = '';
      }
      this.setAlert('danger', this.t('alerts.logo.invalidType'));
      return;
    }

    this.selectedSubscriptionLogoFile.set(file);
  }

  protected onAccountLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    if (!file) {
      this.selectedAccountLogoFile.set(null);
      return;
    }

    if (!isSupportedImageFile(file)) {
      this.selectedAccountLogoFile.set(null);
      if (input) {
        input.value = '';
      }
      this.setAlert('danger', this.t('alerts.logo.invalidType'));
      return;
    }

    this.selectedAccountLogoFile.set(file);
  }

  protected openAccountPage(): void {
    if (!this.sessionUser()) {
      return;
    }

    window.location.assign('/account');
  }

  protected setLanguage(language: LanguageCode): void {
    this.language.set(language);
    document.cookie = `lang=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  protected cycleLanguage(): void {
    const languages = this.availableLanguages;
    const currentIndex = languages.indexOf(this.language());
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % languages.length : 0;
    this.setLanguage(languages[nextIndex]);
  }

  protected setThemeMode(mode: ThemeMode): void {
    this.themeMode.set(mode);
    try {
      localStorage.setItem('theme-mode', mode);
    } catch {
      // Ignore storage write failures.
    }
    this.applyTheme();
  }

  protected cycleThemeMode(): void {
    const mode = this.themeMode();
    const nextMode: ThemeMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    this.setThemeMode(nextMode);
  }

  protected t(key: string): string {
    return this.config.translations?.[this.language()]?.[key] ?? key;
  }

  private usernameAvailabilityValidator(): AsyncValidatorFn {
    return async (control: AbstractControl): Promise<ValidationErrors | null> => {
      const username = String(control.value ?? '').trim().toLowerCase();
      if (!username) {
        return null;
      }

      try {
        const data = (await this.sendWsApi('auth:username-available', {
          username
        })) as { available?: boolean };

        return data?.available ? null : { usernameTaken: true };
      } catch {
        return null;
      }
    };
  }

  protected async logout(): Promise<void> {
    if (!this.sessionUser()) {
      window.location.assign('/login');
      return;
    }

    const response = await fetch('/api/logout', {
      method: 'POST'
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      this.setAlert('danger', payload?.message ?? this.t('alerts.logout.failed'));
      return;
    }

    window.location.assign(payload?.redirect ?? '/login');
  }

  protected async loadPendingUsers(): Promise<void> {
    if (!this.isAdmin()) {
      this.setAlert('danger', this.t('alerts.admin.onlyAdminsLoad'));
      return;
    }

    this.loadingPendingUsers.set(true);

    try {
      const response = await fetch('/api/admin/pending-users');
      const payload = await response.json();

      if (!response.ok) {
        this.setAlert('danger', payload.message ?? this.t('alerts.admin.loadPendingFailed'));
        return;
      }

      this.pendingUsers.set(payload.users ?? []);

      if ((payload.users ?? []).length === 0) {
        this.setAlert('info', this.t('alerts.admin.noPendingUsers'));
      }
    } finally {
      this.loadingPendingUsers.set(false);
    }
  }

  private upsertPendingUser(user: PendingUser): void {
    const withoutUser = this.pendingUsers().filter((pendingUser) => pendingUser.id !== user.id);
    withoutUser.push(user);
    withoutUser.sort((left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);
      const safeLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;
      const safeRightTime = Number.isNaN(rightTime) ? 0 : rightTime;
      return safeLeftTime - safeRightTime;
    });
    this.pendingUsers.set(withoutUser);

    if (this.selectedPendingUser()?.id === user.id) {
      this.selectedPendingUser.set(user);
    }
  }

  protected isActivating(userId: string): boolean {
    return this.activatingUserIds().includes(userId);
  }

  protected isDeletingPendingUser(userId: string): boolean {
    return this.deletingPendingUserIds().includes(userId);
  }

  protected async activateUser(userId: string): Promise<void> {
    if (this.isActivating(userId)) {
      return;
    }

    this.activatingUserIds.set([...this.activatingUserIds(), userId]);

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/activate`, {
        method: 'POST'
      });
      const payload = await response.json();

      if (!response.ok) {
        this.setAlert('danger', payload.message ?? this.t('alerts.admin.activationFailed'));
        return;
      }

      this.pendingUsers.set(this.pendingUsers().filter((user) => user.id !== userId));
      this.setAlert('success', payload.message ?? this.t('alerts.admin.userActivated'));
    } finally {
      this.activatingUserIds.set(this.activatingUserIds().filter((id) => id !== userId));
    }
  }

  protected openPendingUserDetails(user: PendingUser): void {
    this.selectedPendingUser.set(user);
    this.showingPendingUserModal.set(true);
  }

  protected closePendingUserDetails(): void {
    this.showingPendingUserModal.set(false);
  }

  protected async deletePendingUser(userId: string, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.isDeletingPendingUser(userId)) {
      return;
    }

    this.deletingPendingUserIds.set([...this.deletingPendingUserIds(), userId]);

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE'
      });
      const payload = await response.json();

      if (!response.ok) {
        this.setAlert('danger', payload.message ?? this.t('alerts.admin.deletePendingFailed'));
        return;
      }

      this.pendingUsers.set(this.pendingUsers().filter((user) => user.id !== userId));
      if (this.selectedPendingUser()?.id === userId) {
        this.closePendingUserDetails();
      }
      this.setAlert('success', payload.message ?? this.t('alerts.admin.pendingDeleted'));
    } finally {
      this.deletingPendingUserIds.set(this.deletingPendingUserIds().filter((id) => id !== userId));
    }
  }

  protected isRemovingAssociation(key: string): boolean {
    return this.removingAssociationKey() === key;
  }

  protected async loadAdminAssociations(): Promise<void> {
    if (!this.isAdmin()) {
      return;
    }

    this.loadingAdminAssociations.set(true);

    try {
      const response = await fetch('/api/admin/associations');
      const payload = await response.json();

      if (!response.ok) {
        this.setAlert('danger', payload.message ?? this.t('alerts.admin.associationsLoadFailed'));
        return;
      }

      const clients = (payload.clients ?? []) as AdminClientAssociation[];
      const vendors = (payload.vendors ?? []) as AdminVendorAssociation[];
      this.adminClients.set(clients);
      this.adminVendors.set(vendors);

      const selectableClients = clients.filter((client) => client.isActive);
      const selectableVendors = vendors.filter((vendor) => vendor.isActive);

      if (!selectableClients.some((client) => client.id === this.selectedAdminClientId())) {
        this.selectedAdminClientId.set('');
      }

      if (!selectableVendors.some((vendor) => vendor.id === this.selectedAdminVendorId())) {
        this.selectedAdminVendorId.set('');
      }

      if (!selectableVendors.some((vendor) => vendor.id === this.selectedVendorForClientId())) {
        this.selectedVendorForClientId.set('');
      }

      if (!selectableClients.some((client) => client.id === this.selectedClientForVendorId())) {
        this.selectedClientForVendorId.set('');
      }
    } finally {
      this.loadingAdminAssociations.set(false);
    }
  }

  protected async loadAdminBillOverdueDays(): Promise<void> {
    if (!this.isAdmin()) {
      return;
    }

    this.loadingAdminBillOverdueDays.set(true);
    try {
      const response = await fetch('/api/admin/settings/bill-overdue-days');
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.admin.billOverdueDaysLoadFailed'));
        return;
      }

      const value = Number(payload?.billOverdueDays);
      if (Number.isInteger(value) && value >= 1) {
        this.adminBillOverdueDays.set(value);
      }
    } finally {
      this.loadingAdminBillOverdueDays.set(false);
    }
  }

  protected async loadAdminAppStyleProfile(): Promise<void> {
    if (!this.isAdmin()) {
      return;
    }

    this.loadingAdminAppStyleProfile.set(true);
    try {
      const response = await fetch('/api/admin/settings/app-style-profile');
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.admin.appStyleProfileLoadFailed'));
        return;
      }

      const profile = payload?.appStyleProfile === 'secondary' ? 'secondary' : 'primary';
      this.adminAppStyleProfile.set(profile);
      this.applyAppStyleProfile(profile);
    } finally {
      this.loadingAdminAppStyleProfile.set(false);
    }
  }

  protected async saveAdminBillOverdueDays(rawValue: string): Promise<void> {
    if (!this.isAdmin() || this.savingAdminBillOverdueDays()) {
      return;
    }

    const billOverdueDays = Number(rawValue);
    if (!Number.isInteger(billOverdueDays) || billOverdueDays < 1 || billOverdueDays > 3650) {
      this.setAlert('danger', this.t('alerts.admin.billOverdueDaysInvalid'));
      return;
    }

    this.savingAdminBillOverdueDays.set(true);
    try {
      const response = await fetch('/api/admin/settings/bill-overdue-days', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ billOverdueDays })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.admin.billOverdueDaysSaveFailed'));
        return;
      }

      this.adminBillOverdueDays.set(billOverdueDays);
      this.setAlert('success', payload?.message ?? this.t('alerts.admin.billOverdueDaysSaved'));
    } finally {
      this.savingAdminBillOverdueDays.set(false);
    }
  }

  protected async saveAdminAppStyleProfile(profile: AppStyleProfile): Promise<void> {
    if (!this.isAdmin() || this.savingAdminAppStyleProfile()) {
      return;
    }

    if (profile !== 'primary' && profile !== 'secondary') {
      this.setAlert('danger', this.t('alerts.admin.appStyleProfileInvalid'));
      return;
    }

    this.savingAdminAppStyleProfile.set(true);
    try {
      const response = await fetch('/api/admin/settings/app-style-profile', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ appStyleProfile: profile })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.admin.appStyleProfileSaveFailed'));
        return;
      }

      const nextProfile: AppStyleProfile = payload?.appStyleProfile === 'secondary' ? 'secondary' : 'primary';
      this.adminAppStyleProfile.set(nextProfile);
      this.applyAppStyleProfile(nextProfile);
      this.setAlert('success', payload?.message ?? this.t('alerts.admin.appStyleProfileSaved'));
    } finally {
      this.savingAdminAppStyleProfile.set(false);
    }
  }

  protected async runAdminDailyBillGeneration(rawDay: string): Promise<void> {
    if (!this.isAdmin() || this.runningAdminBillGeneration()) {
      return;
    }

    const day = rawDay.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      this.setAlert('danger', this.t('alerts.admin.dailyBillRunInvalidDay'));
      return;
    }

    this.runningAdminBillGeneration.set(true);
    try {
      const response = await fetch('/api/admin/bills/run-daily-generation', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ day })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        this.setAlert('danger', payload?.message ?? this.t('alerts.admin.dailyBillRunFailed'));
        return;
      }

      this.adminBillGenerationDay.set(day);
      this.setAlert('success', payload?.message ?? this.t('alerts.admin.dailyBillRunSucceeded'));
    } finally {
      this.runningAdminBillGeneration.set(false);
    }
  }

  protected async assignVendorToClient(clientId: string, vendorId: string): Promise<void> {
    if (!clientId || !vendorId || this.assigningAssociation()) {
      return;
    }

    this.assigningAssociation.set(true);
    try {
      const response = await fetch(
        `/api/admin/associations/client/${encodeURIComponent(clientId)}/vendor/${encodeURIComponent(vendorId)}`,
        { method: 'POST' }
      );
      const payload = await response.json();
      if (!response.ok) {
        this.setAlert('danger', payload.message ?? this.t('alerts.admin.associationAssignFailed'));
        return;
      }

      this.setAlert('success', payload.message ?? this.t('alerts.admin.associationAssigned'));
      this.selectedVendorForClientId.set('');
      this.selectedClientForVendorId.set('');
      await this.loadAdminAssociations();
    } finally {
      this.assigningAssociation.set(false);
    }
  }

  protected async removeVendorFromClient(clientId: string, vendorId: string): Promise<void> {
    if (!clientId || !vendorId) {
      return;
    }

    const key = `${clientId}:${vendorId}`;
    this.removingAssociationKey.set(key);
    try {
      const response = await fetch(
        `/api/admin/associations/client/${encodeURIComponent(clientId)}/vendor/${encodeURIComponent(vendorId)}`,
        { method: 'DELETE' }
      );
      const payload = await response.json();
      if (!response.ok) {
        this.setAlert('danger', payload.message ?? this.t('alerts.admin.associationRemoveFailed'));
        return;
      }

      this.setAlert('success', payload.message ?? this.t('alerts.admin.associationRemoved'));
      await this.loadAdminAssociations();
    } finally {
      this.removingAssociationKey.set('');
    }
  }

  protected isDeletingStockItem(itemId: string): boolean {
    return this.deletingStockItemIds().includes(itemId);
  }

  protected setStockSort(key: StockSortKey): void {
    if (this.stockSortKey() === key) {
      this.stockSortDirection.set(this.stockSortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }

    this.stockSortKey.set(key);
    this.stockSortDirection.set('asc');
  }

  protected startStockEdition(item: StockItem): void {
    this.editingStockItemId.set(item.id);
    this.selectedStockImageFile.set(null);
    this.resetStockImageInput();
    this.stockForm.setValue({
      name: item.name,
      reference: item.reference,
      price: item.price,
      stock: item.stock,
      minimumStockThreshold:
        item.minimumStockThreshold === null || item.minimumStockThreshold === undefined
          ? ''
          : String(item.minimumStockThreshold),
      category: item.category
    });
  }

  protected cancelStockEdition(): void {
    this.editingStockItemId.set(null);
    this.selectedStockImageFile.set(null);
    this.resetStockImageInput();
    this.stockForm.reset({
      name: '',
      reference: '',
      price: 0,
      stock: 0,
      minimumStockThreshold: '',
      category: ''
    });
  }

  protected onStockImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.selectedStockImageFile.set(file);
  }

  protected async loadStocks(): Promise<void> {
    if (!this.isVendor()) {
      this.setAlert('danger', this.t('alerts.stocks.onlyVendorsAccess'));
      return;
    }

    this.loadingStockItems.set(true);
    const requestSeq = ++this.stockListRequestSeq;
    const snapshotVersionAtRequest = this.stockSnapshotVersion;

    try {
      const data = (await this.sendWsApi('stocks:list', {})) as { items?: StockItem[] };
      if (requestSeq !== this.stockListRequestSeq) {
        return;
      }

      if (snapshotVersionAtRequest !== this.stockSnapshotVersion) {
        return;
      }

      this.stockItems.set(data.items ?? []);
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.stocks.loadFailed')));
    } finally {
      this.loadingStockItems.set(false);
    }
  }

  protected async submitStock(): Promise<void> {
    if (!this.isVendor()) {
      this.setAlert('danger', this.t('alerts.stocks.onlyVendorsModify'));
      return;
    }

    if (this.stockForm.invalid) {
      this.setAlert('danger', this.t('alerts.stocks.fillRequiredValid'));
      return;
    }

    const raw = this.stockForm.getRawValue();
    const rawMinimumStockThreshold = String(raw.minimumStockThreshold ?? '').trim();
    const minimumStockThreshold = rawMinimumStockThreshold === '' ? null : Number(rawMinimumStockThreshold);
    const payload = {
      name: raw.name,
      reference: raw.reference,
      category: raw.category,
      price: Number(raw.price),
      stock: Number(raw.stock),
      minimumStockThreshold
    };

    if (!Number.isFinite(payload.price) || payload.price < 0) {
      this.setAlert('danger', this.t('alerts.stocks.priceNonNegative'));
      return;
    }

    if (!Number.isInteger(payload.stock) || payload.stock < 0) {
      this.setAlert('danger', this.t('alerts.stocks.stockNonNegativeInteger'));
      return;
    }

    if (
      payload.minimumStockThreshold !== null &&
      (!Number.isInteger(payload.minimumStockThreshold) || payload.minimumStockThreshold < 0)
    ) {
      this.setAlert('danger', this.t('alerts.stocks.thresholdNonNegativeInteger'));
      return;
    }

    this.savingStockItem.set(true);

    try {
      let imageFilename = '';
      if (this.selectedStockImageFile()) {
        imageFilename = await this.uploadStockImage(this.selectedStockImageFile() as File);
      } else if (this.editingStockItemId()) {
        const existing = this.stockItems().find((item) => item.id === this.editingStockItemId());
        imageFilename = existing?.imageFilename ?? '';
      }

      if (this.editingStockItemId()) {
        await this.sendWsApi('stocks:update', {
          id: this.editingStockItemId(),
          ...payload,
          imageFilename
        });
        this.setAlert('success', this.t('alerts.stocks.updated'));
      } else {
        await this.sendWsApi('stocks:create', {
          ...payload,
          imageFilename
        });
        this.setAlert('success', this.t('alerts.stocks.created'));
      }

      this.cancelStockEdition();
      await this.loadStocks();
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.stocks.saveFailed')));
    } finally {
      this.savingStockItem.set(false);
    }
  }

  protected async deleteStock(itemId: string): Promise<void> {
    if (this.isDeletingStockItem(itemId)) {
      return;
    }

    this.deletingStockItemIds.set([...this.deletingStockItemIds(), itemId]);

    try {
      await this.sendWsApi('stocks:delete', { id: itemId });
      this.stockItems.set(this.stockItems().filter((item) => item.id !== itemId));
      this.setAlert('success', this.t('alerts.stocks.removed'));

      if (this.editingStockItemId() === itemId) {
        this.cancelStockEdition();
      }
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.stocks.removeFailed')));
    } finally {
      this.deletingStockItemIds.set(this.deletingStockItemIds().filter((id) => id !== itemId));
    }
  }

  protected setVendorBillsDate(value: string): void {
    this.vendorBillsDate.set(value);

    if (!value) {
      this.vendorOrderSummaries.set([]);
      this.selectedVendorOrderKey.set('');
      this.vendorBillsExpanded.set(false);
      this.vendorOrderDetails.set(null);
      this.showingVendorOrderModal.set(false);
      return;
    }

    void this.loadVendorDashboardOrders();
  }

  protected setVendorBillsTab(value: string): void {
    const nextTab: VendorBillsTab = value === 'by-client-range' ? 'by-client-range' : 'by-date';
    if (this.vendorBillsTab() === nextTab) {
      return;
    }

    this.vendorBillsTab.set(nextTab);
    this.vendorBillsExpanded.set(false);

    if (nextTab === 'by-client-range') {
      void this.loadVendorBillClientsForRange();
      return;
    }

    void this.loadVendorDashboardOrders();
  }

  protected setVendorBillsRangeFromDate(value: string): void {
    this.vendorBillsRangeFromDate.set(value);
    if (this.vendorBillsTab() === 'by-client-range') {
      void this.loadVendorBillClientsForRange();
    }
  }

  protected setVendorBillsRangeToDate(value: string): void {
    this.vendorBillsRangeToDate.set(value);
    if (this.vendorBillsTab() === 'by-client-range') {
      void this.loadVendorBillClientsForRange();
    }
  }

  protected setSelectedVendorBillClientId(clientId: string): void {
    this.selectedVendorBillClientId.set(clientId);
    this.vendorBillsExpanded.set(false);
    if (!clientId) {
      this.vendorOrderSummaries.set([]);
      if (this.selectedVendorOrderKey()) {
        this.selectedVendorOrderKey.set('');
        this.vendorOrderDetails.set(null);
        this.showingVendorOrderModal.set(false);
      }
      return;
    }

    void this.loadVendorDashboardOrdersByClientRange();
  }

  protected async loadVendorDashboardOrders(): Promise<void> {
    if (!this.isVendor()) {
      this.setAlert('danger', this.t('alerts.bills.onlyVendors'));
      return;
    }

    this.loadingVendorOrderSummaries.set(true);

    try {
      const data = (await this.sendWsApi('dashboard:vendor-bills:list', {
        date: this.vendorBillsDate()
      })) as { bills?: VendorDashboardOrderSummary[] };

      const orders = data.bills ?? [];
      this.vendorOrderSummaries.set(orders);

      if (!orders.some((order) => order.key === this.selectedVendorOrderKey())) {
        this.selectedVendorOrderKey.set('');
        this.vendorOrderDetails.set(null);
        this.showingVendorOrderModal.set(false);
      }
      if (orders.length === 0) {
        this.vendorBillsExpanded.set(false);
      }

      if (orders.length === 0) {
        this.setAlert('info', this.t('alerts.bills.noneForDay'));
      }
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.bills.loadFailed')));
    } finally {
      this.loadingVendorOrderSummaries.set(false);
    }
  }

  protected async loadVendorBillClientsForRange(): Promise<void> {
    if (!this.isVendor()) {
      this.setAlert('danger', this.t('alerts.bills.onlyVendors'));
      return;
    }

    this.loadingVendorBillClients.set(true);
    try {
      const data = (await this.sendWsApi('dashboard:vendor-bills:clients', {
        fromDate: this.vendorBillsRangeFromDate(),
        toDate: this.vendorBillsRangeToDate()
      })) as { clients?: VendorBillClientOption[] };

      const clients = Array.isArray(data?.clients) ? data.clients : [];
      this.vendorBillClients.set(clients);

      const selectedClientId = this.selectedVendorBillClientId();
      const nextClientId = clients.some((client) => client.id === selectedClientId)
        ? selectedClientId
        : (clients[0]?.id ?? '');

      this.selectedVendorBillClientId.set(nextClientId);

      if (!nextClientId) {
        this.vendorOrderSummaries.set([]);
        if (this.selectedVendorOrderKey()) {
          this.selectedVendorOrderKey.set('');
          this.vendorOrderDetails.set(null);
          this.showingVendorOrderModal.set(false);
        }
        return;
      }

      await this.loadVendorDashboardOrdersByClientRange();
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.bills.loadFailed')));
    } finally {
      this.loadingVendorBillClients.set(false);
    }
  }

  protected async loadVendorDashboardOrdersByClientRange(): Promise<void> {
    if (!this.isVendor()) {
      this.setAlert('danger', this.t('alerts.bills.onlyVendors'));
      return;
    }

    const clientId = this.selectedVendorBillClientId();
    if (!clientId) {
      this.vendorOrderSummaries.set([]);
      return;
    }

    this.loadingVendorOrderSummaries.set(true);

    try {
      const data = (await this.sendWsApi('dashboard:vendor-bills:list-by-client-range', {
        clientId,
        fromDate: this.vendorBillsRangeFromDate(),
        toDate: this.vendorBillsRangeToDate()
      })) as { bills?: VendorDashboardOrderSummary[] };

      const orders = data.bills ?? [];
      this.vendorOrderSummaries.set(orders);

      if (!orders.some((order) => order.key === this.selectedVendorOrderKey())) {
        this.selectedVendorOrderKey.set('');
        this.vendorOrderDetails.set(null);
        this.showingVendorOrderModal.set(false);
      }
      if (orders.length === 0) {
        this.vendorBillsExpanded.set(false);
      }
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.bills.loadFailed')));
    } finally {
      this.loadingVendorOrderSummaries.set(false);
    }
  }

  protected async loadVendorBillMessages(): Promise<void> {
    if (!this.isVendor()) {
      return;
    }

    this.loadingVendorBillMessages.set(true);

    try {
      const data = (await this.sendWsApi('dashboard:vendor-bill-messages:list', {})) as {
        messages?: VendorBillMessageSummary[];
      };
      this.vendorBillMessages.set(Array.isArray(data?.messages) ? data.messages : []);
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.bills.loadFailed')));
    } finally {
      this.loadingVendorBillMessages.set(false);
    }
  }

  protected async openVendorOrderDetails(selectedKey: string): Promise<void> {
    this.vendorBillsExpanded.set(false);
    this.selectedVendorOrderKey.set(selectedKey);

    if (!selectedKey) {
      this.vendorOrderDetails.set(null);
      this.showingVendorOrderModal.set(false);
      return;
    }

    this.loadingVendorOrderDetails.set(true);

    try {
      const data = (await this.sendWsApi('dashboard:vendor-bills:details', {
        key: selectedKey
      })) as { bill?: VendorDashboardOrderDetails };

      if (!data.bill) {
        this.setAlert('danger', this.t('alerts.bills.detailsNotFound'));
        return;
      }

      this.vendorOrderDetails.set(data.bill);
      this.showingVendorOrderModal.set(true);
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.bills.detailsLoadFailed')));
    } finally {
      this.loadingVendorOrderDetails.set(false);
    }
  }

  protected closeVendorOrderDetailsModal(): void {
    this.showingVendorOrderModal.set(false);
  }

  protected openVendorBillMessage(key: string): void {
    this.vendorBillMessages.set(
      this.vendorBillMessages().map((message) =>
        message.key === key
          ? { ...message, isRead: true }
          : message
      )
    );
    void this.markVendorBillMessageRead(key);
    void this.openVendorOrderDetails(key);
  }

  protected isDeletingVendorBillMessage(key: string): boolean {
    return this.deletingVendorBillMessageKeys().includes(key);
  }

  protected async dismissVendorBillMessage(key: string): Promise<void> {
    if (!this.isVendor() || !key || this.isDeletingVendorBillMessage(key)) {
      return;
    }

    this.deletingVendorBillMessageKeys.set([...this.deletingVendorBillMessageKeys(), key]);
    try {
      await this.sendWsApi('dashboard:vendor-bill-messages:dismiss', { key });
      this.removeVendorBillMessage(key);
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.bills.messageRemoveFailed')));
    } finally {
      this.deletingVendorBillMessageKeys.set(
        this.deletingVendorBillMessageKeys().filter((existingKey) => existingKey !== key)
      );
    }
  }

  protected toggleVendorBillsExpanded(): void {
    if (this.vendorOrderSummaries().length === 0) {
      return;
    }
    this.vendorBillsExpanded.set(!this.vendorBillsExpanded());
  }

  protected openVendorBillPdf(): void {
    const billKey = this.vendorOrderDetails()?.key || this.selectedVendorOrderKey();
    if (!billKey) {
      this.setAlert('danger', this.t('alerts.bills.selectBeforePrint'));
      return;
    }

    window.open(`/api/bills/vendor/${encodeURIComponent(billKey)}/pdf`, '_blank', 'noopener');
  }

  protected async setVendorBillSettled(settled: boolean): Promise<void> {
    const details = this.vendorOrderDetails();
    if (!details || this.updatingVendorBillSettlement()) {
      return;
    }

    this.updatingVendorBillSettlement.set(true);
    try {
      const data = (await this.sendWsApi('dashboard:vendor-bills:settle', {
        key: details.key,
        settled
      })) as {
        key?: string;
        settlement?: { vendorSettled?: boolean; clientSettled?: boolean; isSettled?: boolean };
      };

      if (!data.key || !data.settlement) {
        throw new Error(this.t('alerts.bills.settlementUpdateFailed'));
      }

      this.applyVendorBillSettlement(data.key, data.settlement);
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.bills.settlementUpdateFailed')));
    } finally {
      this.updatingVendorBillSettlement.set(false);
    }
  }

  protected setClientBillsDate(value: string): void {
    this.clientBillsDate.set(value);

    if (!value) {
      this.clientCartSummaries.set([]);
      this.selectedClientCartKey.set('');
      this.clientBillsExpanded.set(false);
      this.clientCartDetails.set(null);
      this.showingClientCartModal.set(false);
      return;
    }

    void this.loadClientDashboardCarts();
  }

  protected setClientBillsTab(value: string): void {
    const nextTab = value === 'unpaid' ? 'unpaid' : 'by-date';
    this.clientBillsTab.set(nextTab);

    if (nextTab !== 'unpaid') {
      return;
    }

    if (this.clientBillVendors().length === 0 && !this.loadingClientBillVendors()) {
      void this.loadClientBillVendors();
      return;
    }

    if (this.selectedClientUnpaidVendorId() && this.clientUnpaidVendorBills().length === 0) {
      void this.loadClientUnpaidVendorBills(this.selectedClientUnpaidVendorId());
    }
  }

  protected async loadClientBillVendors(): Promise<void> {
    if (!this.isClient()) {
      return;
    }

    this.loadingClientBillVendors.set(true);
    try {
      const data = (await this.sendWsApi('dashboard:client-bills:vendors', {})) as {
        vendors?: OrderVendorOption[];
      };
      const vendors = Array.isArray(data?.vendors) ? data.vendors : [];
      this.clientBillVendors.set(vendors);

      const currentVendorId = this.selectedClientUnpaidVendorId();
      const selectedExists = vendors.some((vendor) => vendor.id === currentVendorId);
      const vendorIdToLoad = selectedExists ? currentVendorId : (vendors[0]?.id ?? '');

      this.selectedClientUnpaidVendorId.set(vendorIdToLoad);
      if (vendorIdToLoad) {
        await this.loadClientUnpaidVendorBills(vendorIdToLoad);
      } else {
        this.clientUnpaidVendorBills.set([]);
      }
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.bills.loadFailed')));
    } finally {
      this.loadingClientBillVendors.set(false);
    }
  }

  protected setClientUnpaidVendorId(vendorId: string): void {
    this.selectedClientUnpaidVendorId.set(vendorId);
    this.clientUnpaidVendorBills.set([]);
    if (!vendorId) {
      return;
    }

    void this.loadClientUnpaidVendorBills(vendorId);
  }

  protected async loadClientUnpaidVendorBills(vendorId: string): Promise<void> {
    if (!this.isClient() || !vendorId) {
      return;
    }

    this.loadingClientUnpaidVendorBills.set(true);
    try {
      const data = (await this.sendWsApi('dashboard:client-bills:unpaid-by-vendor', {
        vendorId
      })) as { bills?: ClientUnpaidBillSummary[] };

      this.selectedClientUnpaidVendorId.set(vendorId);
      this.clientUnpaidVendorBills.set(Array.isArray(data?.bills) ? data.bills : []);
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.bills.loadFailed')));
    } finally {
      this.loadingClientUnpaidVendorBills.set(false);
    }
  }

  protected async loadClientDashboardCarts(): Promise<void> {
    if (!this.isClient()) {
      this.setAlert('danger', this.t('alerts.bills.onlyClients'));
      return;
    }

    this.loadingClientCartSummaries.set(true);

    try {
      const data = (await this.sendWsApi('dashboard:client-bills:list', {
        date: this.clientBillsDate()
      })) as { bills?: ClientDashboardCartSummary[] };

      const carts = data.bills ?? [];
      this.clientCartSummaries.set(carts);

      if (!carts.some((cart) => cart.key === this.selectedClientCartKey())) {
        this.selectedClientCartKey.set('');
        this.clientCartDetails.set(null);
        this.showingClientCartModal.set(false);
      }
      if (carts.length === 0) {
        this.clientBillsExpanded.set(false);
      }

      if (carts.length === 0) {
        this.setAlert('info', this.t('alerts.bills.noneForDay'));
      }
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.bills.loadFailed')));
    } finally {
      this.loadingClientCartSummaries.set(false);
    }
  }

  protected async openClientCartDetails(selectedKey: string): Promise<void> {
    this.clientBillsExpanded.set(false);
    this.selectedClientCartKey.set(selectedKey);

    if (!selectedKey) {
      this.clientCartDetails.set(null);
      this.clientBillCommentDraft.set('');
      this.showingClientCartModal.set(false);
      return;
    }

    this.loadingClientCartDetails.set(true);

    try {
      const data = (await this.sendWsApi('dashboard:client-bills:details', {
        key: selectedKey
      })) as { bill?: ClientDashboardCartDetails };

      if (!data.bill) {
        this.setAlert('danger', this.t('alerts.bills.detailsNotFound'));
        return;
      }

      this.clientCartDetails.set(data.bill);
      this.clientBillCommentDraft.set(data.bill.clientComment ?? '');
      this.showingClientCartModal.set(true);
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.bills.detailsLoadFailed')));
    } finally {
      this.loadingClientCartDetails.set(false);
    }
  }

  protected closeClientCartDetailsModal(): void {
    this.showingClientCartModal.set(false);
    this.clientBillCommentDraft.set('');
  }

  protected toggleClientBillsExpanded(): void {
    if (this.clientCartSummaries().length === 0) {
      return;
    }
    this.clientBillsExpanded.set(!this.clientBillsExpanded());
  }

  protected openClientBillPdf(): void {
    const billKey = this.clientCartDetails()?.key || this.selectedClientCartKey();
    if (!billKey) {
      this.setAlert('danger', this.t('alerts.bills.selectBeforePrint'));
      return;
    }

    window.open(`/api/bills/client/${encodeURIComponent(billKey)}/pdf`, '_blank', 'noopener');
  }

  protected async setClientBillSettled(settled: boolean): Promise<void> {
    const details = this.clientCartDetails();
    if (!details || this.updatingClientBillSettlement()) {
      return;
    }

    this.updatingClientBillSettlement.set(true);
    try {
      const data = (await this.sendWsApi('dashboard:client-bills:settle', {
        key: details.key,
        settled
      })) as {
        key?: string;
        settlement?: { vendorSettled?: boolean; clientSettled?: boolean; isSettled?: boolean };
      };

      if (!data.key || !data.settlement) {
        throw new Error(this.t('alerts.bills.settlementUpdateFailed'));
      }

      this.applyClientBillSettlement(data.key, data.settlement);
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.bills.settlementUpdateFailed')));
    } finally {
      this.updatingClientBillSettlement.set(false);
    }
  }

  protected async sendClientBillComment(): Promise<void> {
    const details = this.clientCartDetails();
    if (!details || this.sendingClientBillComment()) {
      return;
    }

    const comment = this.clientBillCommentDraft().trim();
    if (!comment) {
      this.setAlert('danger', this.t('alerts.bills.commentRequired'));
      return;
    }

    this.sendingClientBillComment.set(true);
    try {
      const data = (await this.sendWsApi('dashboard:client-bills:comment', {
        key: details.key,
        comment
      })) as {
        clientComment?: string;
        clientCommentSentAt?: string | null;
      };

      const nextComment = typeof data?.clientComment === 'string' ? data.clientComment : comment;
      const nextSentAt = typeof data?.clientCommentSentAt === 'string' ? data.clientCommentSentAt : null;

      this.clientBillCommentDraft.set(nextComment);
      this.clientCartDetails.set({
        ...details,
        clientComment: nextComment,
        clientCommentSentAt: nextSentAt
      });
      this.setAlert('success', this.t('alerts.bills.commentSent'));
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.bills.commentSendFailed')));
    } finally {
      this.sendingClientBillComment.set(false);
    }
  }

  private applyVendorBillSettlement(
    key: string,
    settlement: { vendorSettled?: boolean; clientSettled?: boolean; isSettled?: boolean }
  ): void {
    const vendorSettled = Boolean(settlement.vendorSettled);
    const clientSettled = Boolean(settlement.clientSettled);
    const isSettled = Boolean(settlement.isSettled);

    this.vendorOrderSummaries.set(
      this.vendorOrderSummaries().map((summary) =>
        summary.key === key
          ? { ...summary, vendorSettled, clientSettled, isSettled }
          : summary
      )
    );

    const details = this.vendorOrderDetails();
    if (details?.key === key) {
      this.vendorOrderDetails.set({
        ...details,
        vendorSettled,
        clientSettled,
        isSettled
      });
    }

    if (vendorSettled) {
      this.vendorOverdueBillGroups.set(
        this.vendorOverdueBillGroups()
          .map((group) => {
            const bills = group.bills.filter((bill) => bill.key !== key);
            if (bills.length === group.bills.length) {
              return group;
            }

            const totalAmount = Number(
              bills.reduce((sum, bill) => sum + Number(bill.totalPrice || 0), 0).toFixed(2)
            );

            return {
              ...group,
              bills,
              billCount: bills.length,
              totalAmount
            };
          })
          .filter((group) => group.bills.length > 0)
      );

      if (this.page() === 'vendor-overdue-bills') {
        const remainingClientIds = new Set(this.vendorOverdueBillGroups().map((group) => group.clientId));
        this.remindedOverdueBillClientIds.set(
          this.remindedOverdueBillClientIds().filter((clientId) => remainingClientIds.has(clientId))
        );
        this.selectedVendorOrderKey.set('');
        this.vendorOrderDetails.set(null);
        this.showingVendorOrderModal.set(false);
      }
    }
  }

  private applyClientBillSettlement(
    key: string,
    settlement: { vendorSettled?: boolean; clientSettled?: boolean; isSettled?: boolean }
  ): void {
    const vendorSettled = Boolean(settlement.vendorSettled);
    const clientSettled = Boolean(settlement.clientSettled);
    const isSettled = Boolean(settlement.isSettled);

    this.clientCartSummaries.set(
      this.clientCartSummaries().map((summary) =>
        summary.key === key
          ? { ...summary, vendorSettled, clientSettled, isSettled }
          : summary
      )
    );

    const details = this.clientCartDetails();
    if (details?.key === key) {
      this.clientCartDetails.set({
        ...details,
        vendorSettled,
        clientSettled,
        isSettled
      });
    }

    this.clientUnpaidVendorBills.set(
      this.clientUnpaidVendorBills().map((summary) =>
        summary.key === key
          ? { ...summary, vendorSettled, clientSettled, isSettled }
          : summary
      )
    );
  }

  private upsertVendorBillMessage(message: VendorBillMessageSummary): void {
    const nextMessages = [
      message,
      ...this.vendorBillMessages().filter((existing) => existing.key !== message.key)
    ].sort((left, right) => {
      const rightSentAt = right.sentAt ?? '';
      const leftSentAt = left.sentAt ?? '';
      if (rightSentAt !== leftSentAt) {
        return rightSentAt.localeCompare(leftSentAt);
      }

      return right.day.localeCompare(left.day);
    });

    this.vendorBillMessages.set(nextMessages);
  }

  private initializeVendorOverdueBillPenaltyPercents(groups: VendorOverdueBillGroup[]): void {
    const nextPercents = { ...this.vendorOverdueBillPenaltyPercentByKey() };
    const activeKeys = new Set<string>();

    for (const group of groups) {
      for (const bill of group.bills) {
        activeKeys.add(bill.key);
        if (!Number.isInteger(nextPercents[bill.key]) || nextPercents[bill.key] < 1 || nextPercents[bill.key] > 50) {
          nextPercents[bill.key] = 10;
        }
      }
    }

    for (const key of Object.keys(nextPercents)) {
      if (!activeKeys.has(key)) {
        delete nextPercents[key];
      }
    }

    this.vendorOverdueBillPenaltyPercentByKey.set(nextPercents);
  }

  private async markVendorBillMessageRead(key: string): Promise<void> {
    if (!this.isVendor() || !key) {
      return;
    }

    try {
      const data = (await this.sendWsApi('dashboard:vendor-bill-messages:read', { key })) as {
        message?: VendorBillMessageSummary;
      };
      if (data?.message) {
        this.upsertVendorBillMessage(data.message);
      }
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.bills.messageReadFailed')));
    }
  }

  private removeVendorBillMessage(key: string): void {
    this.vendorBillMessages.set(this.vendorBillMessages().filter((message) => message.key !== key));
  }

  protected setSelectedOrderTab(tab: string): void {
    this.selectedOrderTab.set(tab === 'favorites' ? 'favorites' : 'catalog');
    this.ensureSelectedOrderItemIsVisible();
  }

  protected setSelectedOrderCategory(category: string): void {
    this.selectedOrderCategory.set(category);
    this.ensureSelectedOrderItemIsVisible();
  }

  protected setSelectedOrderVendor(vendorId: string): void {
    this.selectedOrderVendor.set(vendorId);
    this.ensureSelectedOrderItemIsVisible();
  }

  protected selectCatalogItem(merchandiseId: string): void {
    this.addToCartForm.controls.merchandiseId.setValue(merchandiseId);
  }

  protected isFavoriteItem(merchandiseId: string): boolean {
    return this.favoriteMerchandiseIds().includes(merchandiseId);
  }

  protected isTogglingFavorite(merchandiseId: string): boolean {
    return this.togglingFavoriteItemIds().includes(merchandiseId);
  }

  protected async toggleFavorite(merchandiseId: string, event?: Event): Promise<void> {
    event?.stopPropagation();

    if (!this.isClient()) {
      this.setAlert('danger', this.t('alerts.order.onlyClientsFavorites'));
      return;
    }

    if (this.isTogglingFavorite(merchandiseId)) {
      return;
    }

    this.togglingFavoriteItemIds.set([...this.togglingFavoriteItemIds(), merchandiseId]);

    try {
      const data = (await this.sendWsApi('order:favorites:toggle', {
        merchandiseId
      })) as {
        isFavorite?: boolean;
        favoriteMerchandiseIds?: string[];
      };
      this.favoriteMerchandiseIds.set(data.favoriteMerchandiseIds ?? []);
      this.ensureSelectedOrderItemIsVisible();
      this.setAlert('success', data.isFavorite ? this.t('alerts.order.favoriteAdded') : this.t('alerts.order.favoriteRemoved'));
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.order.favoriteUpdateFailed')));
    } finally {
      this.togglingFavoriteItemIds.set(
        this.togglingFavoriteItemIds().filter((id) => id !== merchandiseId)
      );
    }
  }

  protected getOrderPriceVariation(itemId: string): CatalogPriceVariation | null {
    return this.orderPriceVariations()[itemId] ?? null;
  }

  protected setCartGroupBy(value: string): void {
    const groupBy: CartGroupBy = value === 'category' ? 'category' : 'vendor';
    this.cartGroupBy.set(groupBy);
    this.cartValidation.set(null);
  }

  protected isUpdatingCartItem(merchandiseId: string): boolean {
    return this.updatingCartItemIds().includes(merchandiseId);
  }

  protected isRemovingCartItem(merchandiseId: string): boolean {
    return this.removingCartItemIds().includes(merchandiseId);
  }

  protected async setOrderDeliveryDate(value: string): Promise<void> {
    const normalizedValue = (value || '').trim() || getRelativeIsoDay(0);
    const previousDate = this.orderDeliveryDate();
    if (normalizedValue === previousDate) {
      return;
    }

    this.orderDeliveryDate.set(normalizedValue);
    this.cartValidation.set(null);

    if (!this.isClient()) {
      return;
    }

    if (this.cart().items.length === 0) {
      await this.loadOrderCart();
      return;
    }

    try {
      const data = (await this.sendWsApi('order:cart:set-delivery-date', {
        fromDeliveryDate: previousDate,
        toDeliveryDate: normalizedValue
      })) as { cart?: CartData };
      this.cartSnapshotVersion += 1;
      this.cart.set(data.cart ?? EMPTY_CART);
      this.cartValidation.set(null);
    } catch (error) {
      this.orderDeliveryDate.set(previousDate);
      this.setAlert('danger', errorToMessage(error, this.t('alerts.order.cartLoadFailed')));
    }
  }

  protected async refreshOrderPage(): Promise<void> {
    await Promise.all([this.loadOrderCatalog(), this.loadOrderCart()]);
  }

  private async refreshVendorBillsView(): Promise<void> {
    if (!this.isVendor()) {
      return;
    }

    if (this.vendorBillsTab() === 'by-client-range') {
      await this.loadVendorBillClientsForRange();
      return;
    }

    await this.loadVendorDashboardOrders();
  }

  protected async loadOrderCatalog(): Promise<void> {
    if (!this.isClient()) {
      this.setAlert('danger', this.t('alerts.order.onlyClientsOrdering'));
      return;
    }

    this.loadingOrderCatalog.set(true);

    try {
      const data = (await this.sendWsApi('order:catalog', {})) as {
        categories?: string[];
        items?: CatalogItem[];
        favoriteMerchandiseIds?: string[];
      };
      const items = this.sortOrderCatalogItems(data.items ?? []);
      const categories = [...new Set(items.map((item) => item.category))].sort();

      this.orderCatalogItems.set(items);
      this.orderCategories.set(categories);
      this.favoriteMerchandiseIds.set([...(data.favoriteMerchandiseIds ?? [])]);
      this.trimOrderPriceVariations(items);
      this.reconcileOrderFiltersAndSelection();
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.order.catalogLoadFailed')));
    } finally {
      this.loadingOrderCatalog.set(false);
    }
  }

  protected async loadOrderCart(): Promise<void> {
    if (!this.isClient()) {
      this.setAlert('danger', this.t('alerts.order.onlyClientsCarts'));
      return;
    }

    this.loadingOrderCart.set(true);
    const requestSeq = ++this.cartLoadRequestSeq;
    const snapshotVersionAtRequest = this.cartSnapshotVersion;
    const deliveryDateAtRequest = this.orderDeliveryDate();

    try {
      const data = (await this.sendWsApi('order:cart:get', {
        deliveryDate: deliveryDateAtRequest
      })) as { cart?: CartData };

      if (requestSeq !== this.cartLoadRequestSeq) {
        return;
      }
      if (snapshotVersionAtRequest !== this.cartSnapshotVersion) {
        return;
      }
      if (deliveryDateAtRequest !== this.orderDeliveryDate()) {
        return;
      }

      this.cart.set(data.cart ?? EMPTY_CART);
      this.cartValidation.set(null);
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.order.cartLoadFailed')));
    } finally {
      this.loadingOrderCart.set(false);
    }
  }

  protected async addToCart(): Promise<void> {
    if (this.addToCartForm.invalid) {
      this.setAlert('danger', this.t('alerts.order.selectItemQuantity'));
      return;
    }

    const payload = this.addToCartForm.getRawValue();
    const quantity = Number(payload.quantity);

    if (!Number.isInteger(quantity) || quantity < 1) {
      this.setAlert('danger', this.t('alerts.order.quantityIntegerPositive'));
      return;
    }

    this.addingToCart.set(true);

    try {
      const data = (await this.sendWsApi('order:cart:add', {
        merchandiseId: payload.merchandiseId,
        quantity,
        deliveryDate: this.orderDeliveryDate()
      })) as { cart?: CartData };

      this.cartSnapshotVersion += 1;
      this.cart.set(data.cart ?? EMPTY_CART);
      this.cartValidation.set(null);
      this.addToCartForm.patchValue({ quantity: 1 });
      this.setAlert('success', this.t('alerts.order.itemAdded'));
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.order.addToCartFailed')));
    } finally {
      this.addingToCart.set(false);
    }
  }

  protected async updateCartQuantity(item: CartItem, rawQuantity: string): Promise<void> {
    if (this.isUpdatingCartItem(item.merchandiseId)) {
      return;
    }

    const quantity = Number(rawQuantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      this.setAlert('danger', this.t('alerts.order.quantityIntegerPositive'));
      return;
    }

    this.updatingCartItemIds.set([...this.updatingCartItemIds(), item.merchandiseId]);

    try {
      const data = (await this.sendWsApi('order:cart:update', {
        merchandiseId: item.merchandiseId,
        quantity,
        deliveryDate: this.orderDeliveryDate()
      })) as { cart?: CartData };

      this.cartSnapshotVersion += 1;
      this.cart.set(data.cart ?? EMPTY_CART);
      this.cartValidation.set(null);
      this.setAlert('success', this.t('alerts.order.cartQuantityUpdated'));
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.order.cartQuantityUpdateFailed')));
    } finally {
      this.updatingCartItemIds.set(
        this.updatingCartItemIds().filter((id) => id !== item.merchandiseId)
      );
    }
  }

  protected async removeFromCart(item: CartItem): Promise<void> {
    if (this.isRemovingCartItem(item.merchandiseId)) {
      return;
    }

    this.removingCartItemIds.set([...this.removingCartItemIds(), item.merchandiseId]);

    try {
      const data = (await this.sendWsApi('order:cart:remove', {
        merchandiseId: item.merchandiseId,
        deliveryDate: this.orderDeliveryDate()
      })) as { cart?: CartData };

      this.cartSnapshotVersion += 1;
      this.cart.set(data.cart ?? EMPTY_CART);
      this.cartValidation.set(null);
      this.setAlert('success', this.t('alerts.order.itemRemoved'));
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.order.removeCartItemFailed')));
    } finally {
      this.removingCartItemIds.set(
        this.removingCartItemIds().filter((id) => id !== item.merchandiseId)
      );
    }
  }

  protected async validateCart(): Promise<void> {
    if (!this.isClient()) {
      this.setAlert('danger', this.t('alerts.order.onlyClientsValidate'));
      return;
    }

    this.validatingCart.set(true);

    try {
      const data = (await this.sendWsApi('order:cart:validate', {
        groupBy: this.cartGroupBy(),
        deliveryDate: this.orderDeliveryDate()
      })) as Partial<CartValidation> & { cart?: CartData };

      this.cartValidation.set({
        groupBy: data.groupBy === 'category' ? 'category' : 'vendor',
        totals: data.totals ?? [],
        grandTotal: data.grandTotal ?? 0,
        currency: data.currency ?? 'EUR'
      });
      this.cartSnapshotVersion += 1;
      this.cart.set(data.cart ?? EMPTY_CART);
      this.setAlert('success', `${this.t('alerts.order.cartValidatedBy')} ${this.cartGroupBy()}.`);
    } catch (error) {
      this.setAlert('danger', errorToMessage(error, this.t('alerts.order.validateCartFailed')));
    } finally {
      this.validatingCart.set(false);
    }
  }

  private connectSocket(): void {
    if (this.isDestroying) {
      return;
    }

    if (!this.config.wsToken) {
      this.wsStatus.set('error');
      this.setAlert('danger', this.t('alerts.ws.notAvailableOnPage'));
      return;
    }

    if (this.socket && (
      this.socket.readyState === WebSocket.OPEN ||
      this.socket.readyState === WebSocket.CONNECTING
    )) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${scheme}://${window.location.host}/ws?token=${encodeURIComponent(this.config.wsToken)}`;

    this.wsStatus.set('connecting');
    const socket = new WebSocket(wsUrl);
    let hasOpened = false;
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (this.socket !== socket) {
        return;
      }

      hasOpened = true;
      this.wsStatus.set('connected');
      this.clearTransientWebSocketAlert();
      this.reconnectAttempts = 0;
      this.lastPongAt = Date.now();
      socket.send(JSON.stringify({ type: 'ping', page: this.page() }));
      this.startSocketHeartbeat();

      if (this.page() === 'stocks') {
        void this.loadStocks();
      }

      if (this.page() === 'order') {
        void this.refreshOrderPage();
      }

      if (this.page() === 'dashboard' && this.isVendor()) {
        void this.refreshVendorBillsView();
        void this.loadVendorBillMessages();
      }

      if (this.page() === 'dashboard' && this.isClient()) {
        void this.loadClientDashboardCarts();
        void this.loadClientUnpaidReminders();
        void this.loadClientBillVendors();
      }
    });

    socket.addEventListener('message', (event) => {
      if (this.socket !== socket) {
        return;
      }

      let payload: ({ type?: string; message?: string } | WsApiResponse);
      try {
        payload = JSON.parse(event.data) as
          | { type?: string; message?: string }
          | WsApiResponse;
      } catch {
        return;
      }

      if (payload.type === 'welcome') {
        this.lastPongAt = Date.now();
        return;
      }

      if (payload.type === 'pong') {
        this.lastPongAt = Date.now();
        return;
      }

      if (payload.type === 'api:result') {
        const apiPayload = payload as WsApiResponse;
        const pending = this.wsPendingRequests.get(apiPayload.requestId);
        if (!pending) {
          return;
        }

        clearTimeout(pending.timer);
        this.wsPendingRequests.delete(apiPayload.requestId);

        if (apiPayload.ok) {
          pending.resolve(apiPayload.data ?? {});
          return;
        }

        pending.reject(new Error(apiPayload.message ?? this.t('alerts.ws.requestFailed')));
        return;
      }

      if (payload.type === 'admin:pending-user:new') {
        if (this.page() === 'admin' && this.isAdmin()) {
          const adminPayload = payload as { user?: PendingUser };
          if (adminPayload.user) {
            this.upsertPendingUser(adminPayload.user);
          }
        }
        return;
      }

      if (payload.type === 'order:price:update') {
        const pricePayload = payload as {
          merchandiseId: string;
          price: number;
          stock: number;
          minimumStockThreshold: number | null;
          vendorId: string;
          vendorName?: string;
        };

        const currentItems = this.orderCatalogItems();
        const previousItem = currentItems.find(
          (item) => item.id === pricePayload.merchandiseId
        );

        const nextItems = currentItems
          .map((item) => {
            if (item.id !== pricePayload.merchandiseId) {
              return item;
            }

            return {
              ...item,
              price: pricePayload.price,
              stock: pricePayload.stock,
              minimumStockThreshold:
                typeof pricePayload.minimumStockThreshold === 'number'
                  ? pricePayload.minimumStockThreshold
                  : item.minimumStockThreshold,
              vendorName: pricePayload.vendorName ?? item.vendorName
            };
          })
          .filter((item) => item.stock > 0);

        if (previousItem && previousItem.price !== pricePayload.price) {
          this.updateOrderPriceVariation(
            pricePayload.merchandiseId,
            previousItem.price,
            pricePayload.price
          );
        }

        if (pricePayload.stock <= 0) {
          this.clearOrderPriceVariation(pricePayload.merchandiseId);
        }

        this.orderCatalogItems.set(this.sortOrderCatalogItems(nextItems));
        this.orderCategories.set(
          [...new Set(this.orderCatalogItems().map((item) => item.category))].sort()
        );
        this.reconcileOrderFiltersAndSelection();
        return;
      }

      if (payload.type === 'order:catalog:update') {
        const updatePayload = payload as {
          event: 'upsert' | 'remove';
          item: CatalogItem | { id: string };
        };

        if (updatePayload.event === 'remove') {
          const removeId = (updatePayload.item as { id: string }).id;
          this.clearOrderPriceVariation(removeId);
          this.orderCatalogItems.set(
            this.orderCatalogItems().filter((item) => item.id !== removeId)
          );
        } else {
          const incoming = updatePayload.item as CatalogItem;
          const existing = this.orderCatalogItems().find((item) => item.id === incoming.id);
          const withoutIncoming = this.orderCatalogItems().filter(
            (item) => item.id !== incoming.id
          );

          if (incoming.stock > 0) {
            withoutIncoming.push(incoming);
          } else {
            this.clearOrderPriceVariation(incoming.id);
          }

          if (existing && existing.price !== incoming.price) {
            this.updateOrderPriceVariation(incoming.id, existing.price, incoming.price);
          }

          this.orderCatalogItems.set(
            this.sortOrderCatalogItems(withoutIncoming)
          );
        }

        this.orderCategories.set(
          [...new Set(this.orderCatalogItems().map((item) => item.category))].sort()
        );
        this.reconcileOrderFiltersAndSelection();
        return;
      }

      if (payload.type === 'stocks:refresh') {
        if (this.page() === 'stocks' && this.isVendor()) {
          void this.loadStocks();
        }
        return;
      }

      if (payload.type === 'stocks:snapshot') {
        if (this.page() === 'stocks') {
          const stockPayload = payload as { items?: StockItem[] };
          this.stockSnapshotVersion += 1;
          this.stockItems.set((stockPayload.items ?? []).map((item) => ({ ...item })));
          this.loadingStockItems.set(false);
        }
        return;
      }

      if (payload.type === 'client:unpaid-reminders:update') {
        if (this.page() === 'dashboard' && this.isClient()) {
          const remindersPayload = payload as {
            reminders?: ClientUnpaidReminder[];
          };
          this.clientUnpaidReminders.set(
            Array.isArray(remindersPayload.reminders)
              ? remindersPayload.reminders
              : []
          );
        }
        return;
      }

      if (payload.type === 'dashboard:vendor-bill-message:update') {
        if (this.page() === 'dashboard' && this.isVendor()) {
          const messagePayload = payload as { message?: VendorBillMessageSummary };
          if (messagePayload.message) {
            this.upsertVendorBillMessage(messagePayload.message);

            const details = this.vendorOrderDetails();
            if (details && details.key === messagePayload.message.key) {
              this.vendorOrderDetails.set({
                ...details,
                clientComment: messagePayload.message.message,
                clientCommentSentAt: messagePayload.message.sentAt
              });
            }
          }
        }
        return;
      }

      if (payload.type === 'dashboard:vendor-bill-message:remove') {
        if (this.page() === 'dashboard' && this.isVendor()) {
          const messagePayload = payload as { key?: string };
          if (typeof messagePayload.key === 'string' && messagePayload.key) {
            this.removeVendorBillMessage(messagePayload.key);
          }
        }
        return;
      }

      if (payload.type === 'error') {
        this.setAlert('danger', payload.message ?? this.t('alerts.ws.connectionError'));
      }
    });

    socket.addEventListener('close', () => {
      if (this.socket !== socket) {
        return;
      }

      this.socket = null;
      this.stopSocketHeartbeat();
      this.wsStatus.set('closed');

      for (const pending of this.wsPendingRequests.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error(this.t('alerts.ws.disconnected')));
      }
      this.wsPendingRequests.clear();

      if (!this.isDestroying) {
        if (hasOpened) {
          this.pushTransientWebSocketAlert(this.t('alerts.ws.disconnected'));
        }
        this.scheduleSocketReconnect();
      }
    });

    socket.addEventListener('error', () => {
      if (this.socket !== socket) {
        return;
      }

      this.wsStatus.set('error');
    });
  }

  private startSocketHeartbeat(): void {
    this.stopSocketHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      const socket = this.socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      if (Date.now() - this.lastPongAt > 70000) {
        socket.close();
        return;
      }

      socket.send(JSON.stringify({ type: 'ping', page: this.page() }));
    }, 25000);
  }

  private stopSocketHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleSocketReconnect(): void {
    if (this.isDestroying || this.reconnectTimer || !this.config.wsToken) {
      return;
    }

    this.reconnectAttempts += 1;
    const delayMs = Math.min(1000 * (2 ** (this.reconnectAttempts - 1)), 30000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectSocket();
    }, delayMs);
  }

  private async sendWsApi(action: string, payload: unknown): Promise<unknown> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error(this.t('alerts.ws.disconnected'));
    }

    const requestId = ++this.requestCounter;

    const promise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.wsPendingRequests.delete(requestId);
        reject(new Error(this.t('alerts.ws.requestTimeout')));
      }, 10000);

      this.wsPendingRequests.set(requestId, {
        resolve,
        reject,
        timer
      });
    });

    this.socket.send(
      JSON.stringify({
        type: 'api',
        requestId,
        action,
        payload
      })
    );

    return promise;
  }

  private async uploadStockImage(file: File): Promise<string> {
    if (!isSupportedImageFile(file)) {
      throw new Error(this.t('alerts.stocks.imageInvalidType'));
    }

    const dataUrl = await this.fileToDataUrl(file);
    const response = await fetch('/api/vendor/item-image', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ dataUrl })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.message ?? this.t('alerts.stocks.imageUploadFailed'));
    }

    return String(payload?.imageFilename ?? '');
  }

  private async fileToDataUrl(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(this.t('alerts.stocks.imageReadFailed')));
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsDataURL(file);
    });
  }

  private getVisibleOrderCatalogItems(selectedCategory: string, selectedVendor: string): CatalogItem[] {
    return this.orderCatalogItems().filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      if (selectedVendor !== 'all' && item.vendorId !== selectedVendor) {
        return false;
      }

      return true;
    });
  }

  private ensureSelectedOrderItemIsVisible(): void {
    const selectedItemId = this.addToCartForm.controls.merchandiseId.value;
    if (!selectedItemId) {
      return;
    }

    if (!this.orderItemsForSelectedTab().some((item) => item.id === selectedItemId)) {
      this.addToCartForm.controls.merchandiseId.setValue('');
    }
  }

  private reconcileOrderFiltersAndSelection(): void {
    const selectedCategory = this.selectedOrderCategory();
    if (selectedCategory !== 'all' && !this.orderCategories().includes(selectedCategory)) {
      this.selectedOrderCategory.set('all');
    }

    const vendorIds = new Set(this.orderVendors().map((vendor) => vendor.id));
    const selectedVendor = this.selectedOrderVendor();
    if (selectedVendor !== 'all' && !vendorIds.has(selectedVendor)) {
      this.selectedOrderVendor.set('all');
    }

    this.ensureSelectedOrderItemIsVisible();
  }

  private sortOrderCatalogItems(items: CatalogItem[]): CatalogItem[] {
    return [...items].sort((left, right) => {
      const categoryCompare = left.category.localeCompare(right.category);
      if (categoryCompare !== 0) {
        return categoryCompare;
      }

      const vendorCompare = left.vendorName.localeCompare(right.vendorName);
      if (vendorCompare !== 0) {
        return vendorCompare;
      }

      return left.name.localeCompare(right.name);
    });
  }

  private updateOrderPriceVariation(itemId: string, oldPrice: number, newPrice: number): void {
    if (!Number.isFinite(oldPrice) || !Number.isFinite(newPrice) || oldPrice === newPrice) {
      this.clearOrderPriceVariation(itemId);
      return;
    }

    const direction: CatalogPriceVariation['direction'] = newPrice > oldPrice ? 'up' : 'down';
    const percent = oldPrice > 0
      ? Math.round(Math.abs(((newPrice - oldPrice) / oldPrice) * 100))
      : 0;

    this.orderPriceVariations.set({
      ...this.orderPriceVariations(),
      [itemId]: { direction, percent }
    });
  }

  private clearOrderPriceVariation(itemId: string): void {
    if (!this.orderPriceVariations()[itemId]) {
      return;
    }

    const next = { ...this.orderPriceVariations() };
    delete next[itemId];
    this.orderPriceVariations.set(next);
  }

  private trimOrderPriceVariations(items: CatalogItem[]): void {
    const allowedItemIds = new Set(items.map((item) => item.id));
    const next = Object.fromEntries(
      Object.entries(this.orderPriceVariations()).filter(([itemId]) => allowedItemIds.has(itemId))
    );
    this.orderPriceVariations.set(next);
  }

  private async waitForControlValidation(control: AbstractControl): Promise<void> {
    if (!control.pending) {
      return;
    }

    await new Promise<void>((resolve) => {
      const subscription = control.statusChanges.subscribe(() => {
        if (!control.pending) {
          subscription.unsubscribe();
          resolve();
        }
      });
    });
  }

  private getSubscriptionValidationMessage(): string {
    const controls = this.subscriptionForm.controls;

    if (controls.username.hasError('required')) {
      return this.t('alerts.validation.usernameRequired');
    }

    if (controls.username.hasError('usernameTaken')) {
      return this.t('alerts.validation.usernameTaken');
    }

    if (controls.password.hasError('minlength')) {
      return this.t('alerts.validation.passwordMinLength');
    }

    if (controls.businessRegistrationId.hasError('pattern')) {
      return this.t('alerts.validation.siret13Digits');
    }

    if (controls.email.hasError('email')) {
      return this.t('alerts.validation.emailInvalid');
    }

    return this.t('alerts.validation.fillRequiredSubscription');
  }

  private setAlert(type: AlertType, message: string): void {
    if (type === 'danger' && this.isTransientWebSocketAlert(message)) {
      this.alertMessage.set('');
      this.pushTransientWebSocketAlert(message);
      return;
    }

    this.alertMessage.set(message);
    this.alertType.set(type);
    this.pushToast(message, type, 10000);
    this.alertMessage.set('');
  }

  private isTransientWebSocketAlert(message: string): boolean {
    return (
      message === this.t('alerts.ws.disconnected') ||
      message === this.t('alerts.ws.connectionError')
    );
  }

  private pushTransientWebSocketAlert(message: string): void {
    const now = Date.now();
    if (
      this.lastTransientWsAlert &&
      this.lastTransientWsAlert.message === message &&
      now - this.lastTransientWsAlert.shownAt < 1000
    ) {
      return;
    }

    this.lastTransientWsAlert = { message, shownAt: now };
    this.pushToast(message, 'danger', 10000);
  }

  private clearTransientWebSocketAlert(): void {
    if (this.isTransientWebSocketAlert(this.alertMessage())) {
      this.alertMessage.set('');
    }
  }

  private setAccountToast(type: AlertType | 'warning', message: string): void {
    this.alertMessage.set('');
    this.pushToast(message, type, 10000);
  }

  private getWebAuthnErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      const message = error.message.trim();
      if (!message) {
        return fallback;
      }

      if (message.includes('NotAllowedError') || message.includes('timed out')) {
        return this.t('alerts.webauthn.cancelled');
      }

      return message;
    }

    return fallback;
  }

  private initializeThemeMode(): void {
    let storedMode: ThemeMode = 'system';
    try {
      const value = localStorage.getItem('theme-mode');
      if (value === 'light' || value === 'dark' || value === 'system') {
        storedMode = value;
      }
    } catch {
      // Ignore storage read failures.
    }

    this.themeMode.set(storedMode);

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      if (typeof this.systemThemeMediaQuery.addEventListener === 'function') {
        this.systemThemeMediaQuery.addEventListener('change', this.systemThemeChangeHandler);
      } else if (typeof this.systemThemeMediaQuery.addListener === 'function') {
        this.systemThemeMediaQuery.addListener(this.systemThemeChangeHandler);
      }
    }

    this.applyTheme();
  }

  private applyTheme(): void {
    const resolvedTheme = this.resolveThemeMode();
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;
  }

  private applyAppStyleProfile(profile: AppStyleProfile): void {
    const resolvedProfile: AppStyleProfile = profile === 'secondary' ? 'secondary' : 'primary';
    document.documentElement.setAttribute('data-app-style', resolvedProfile);
    this.config.appStyleProfile = resolvedProfile;

    const stylesheet = document.getElementById('app-style-profile-link');
    if (!(stylesheet instanceof HTMLLinkElement)) {
      return;
    }

    const nextHref = resolvedProfile === 'secondary'
      ? this.config.assets?.secondaryStylesCss ?? this.config.assets?.primaryStylesCss ?? this.config.assets?.stylesCss
      : this.config.assets?.primaryStylesCss ?? this.config.assets?.stylesCss;
    if (typeof nextHref === 'string' && nextHref.length > 0 && stylesheet.href !== new URL(nextHref, window.location.origin).href) {
      stylesheet.href = nextHref;
    }
  }

  private resolveThemeMode(): 'light' | 'dark' {
    const mode = this.themeMode();
    if (mode === 'light' || mode === 'dark') {
      return mode;
    }

    return this.systemThemeMediaQuery?.matches ? 'dark' : 'light';
  }

  private resetStockImageInput(): void {
    const input = this.stockImageInput?.nativeElement;
    if (input) {
      input.value = '';
    }
  }

  private pushToast(message: string, type: ToastType, durationMs = 5000): void {
    const id = ++this.toastCounter;
    this.toasts.set([...this.toasts(), { id, message, type }]);

    const timer = setTimeout(() => {
      this.dismissToast(id);
    }, durationMs);

    this.toastTimers.set(id, timer);
  }
}
