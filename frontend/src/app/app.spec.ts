import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { App } from './app';
import { DashboardPageComponent } from './pages/dashboard-page.component';

describe('App', () => {
  beforeEach(async () => {
    if (!('createObjectURL' in URL)) {
      Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:test', configurable: true });
    }
    if (!('revokeObjectURL' in URL)) {
      Object.defineProperty(URL, 'revokeObjectURL', { value: () => undefined, configurable: true });
    }
    await TestBed.configureTestingModule({
      imports: [App, DashboardPageComponent],
      providers: [App],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    fixture.destroy();
  });

  it('uses a 10 second danger toast for account page alerts', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;

    app.page.set('account');
    app.setAlert('danger', 'Account update failed.');

    expect(app.toasts()).toEqual([
      expect.objectContaining({
        message: 'Account update failed.',
        type: 'danger'
      })
    ]);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    fixture.destroy();
  });

  it('uses a 10 second toast instead of an inline banner for websocket disconnects', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    const message = app.t('alerts.ws.disconnected');

    app.setAlert('danger', message);

    expect(app.alertMessage()).toBe('');
    expect(app.toasts()).toEqual([
      expect.objectContaining({
        message,
        type: 'danger'
      })
    ]);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    fixture.destroy();
  });

  it('clears a transient websocket banner on reconnect', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;

    app.alertMessage.set(app.t('alerts.ws.disconnected'));
    app.clearTransientWebSocketAlert();

    expect(app.alertMessage()).toBe('');
    fixture.destroy();
  });

  it('announces routed page changes on the open websocket', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    const send = vi.fn();

    vi.spyOn(app, 'loadStocks').mockResolvedValue(undefined);
    app.socket = { readyState: WebSocket.OPEN, send, close: vi.fn() };

    app.activateRoutedPage('stocks');

    expect(send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping', page: 'stocks' }));
    fixture.destroy();
  });

  it('refreshes the websocket token before reconnecting', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    const createdUrls: string[] = [];

    class MockWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;

      public readyState = MockWebSocket.CONNECTING;
      public send = vi.fn();
      public close = vi.fn();
      public addEventListener = vi.fn();

      constructor(url: string) {
        createdUrls.push(url);
      }
    }

    vi.stubGlobal('WebSocket', MockWebSocket);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, wsToken: 'fresh-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    app.config.wsToken = 'expired-token';
    app.page.set('order');
    app.sessionUser.set({ id: 'client-1', username: 'client', role: 'client' });

    await app.connectSocket({ refreshToken: true });

    expect(fetchSpy).toHaveBeenCalledWith('/api/ws-token?page=order', {
      headers: { Accept: 'application/json' }
    });
    expect(app.config.wsToken).toBe('fresh-token');
    expect(createdUrls).toHaveLength(1);
    expect(createdUrls[0]).toContain('/ws?token=fresh-token');
    fixture.destroy();
  });

  it('validates businessRegistrationId as 14 digits while keeping VAT ID separate', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.subscriptionForm.controls.businessRegistrationId.setValue('3560000000004');
    expect(app.subscriptionForm.controls.businessRegistrationId.valid).toBe(false);

    app.subscriptionForm.controls.businessRegistrationId.setValue('35600000000048');
    expect(app.subscriptionForm.controls.businessRegistrationId.valid).toBe(true);

    app.accountForm.controls.businessRegistrationId.setValue('356 000 000 00048');
    expect(app.accountForm.controls.businessRegistrationId.valid).toBe(false);

    app.accountForm.controls.vatId.setValue('FR12345678901');
    expect(app.accountForm.controls.vatId.valid).toBe(true);
    fixture.destroy();
  });

  it('omits category columns from vendor and client bill popups while preserving category state elsewhere', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    const app = TestBed.inject(App) as any;

    app.vendorOrderDetails.set({
      key: 'client-1::2026-03-07',
      clientId: 'client-1',
      clientOrganisation: 'Client',
      clientUsername: 'client',
      day: '2026-03-07',
      orderedAt: '2026-03-07T10:00:00.000Z',
      deliveryDate: '2026-03-08',
      items: [{ merchandiseId: 'item-1', name: 'Tomatoes', reference: 'TOM-001', category: 'Vegetables', unitPrice: 12.5, vatRate: 5.5, unitPriceIncludingVat: 13.19, quantity: 2, lineTotal: 25, lineTotalIncludingVat: 26.38 }],
      totalPrice: 25,
      totalPriceIncludingVat: 26.38,
      currency: 'EUR',
      clientComment: '',
      clientCommentSentAt: null,
      vendorSettled: false,
      clientSettled: false,
      isSettled: false
    });
    app.clientCartDetails.set({
      key: 'vendor-1::2026-03-07',
      vendorId: 'vendor-1',
      vendorName: 'Vendor',
      day: '2026-03-07',
      items: [{ merchandiseId: 'item-2', vendorId: 'vendor-1', vendorName: 'Vendor', name: 'Apples', reference: 'APL-001', category: 'Fruit', unitPrice: 3, vatRate: 5.5, unitPriceIncludingVat: 3.17, quantity: 4, lineTotal: 12, lineTotalIncludingVat: 12.66 }],
      totalPrice: 12,
      totalPriceIncludingVat: 12.66,
      currency: 'EUR',
      clientComment: '',
      clientCommentSentAt: null,
      vendorSettled: false,
      clientSettled: false,
      isSettled: false
    });
    app.showingVendorOrderModal.set(true);
    app.showingClientCartModal.set(true);

    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Tomatoes (TOM-001)');
    expect(text).toContain('Apples (APL-001)');
    expect(text).not.toContain('Category');
    expect(text).not.toContain('Vegetables');
    expect(text).not.toContain('Fruit');

    app.cartGroupBy.set('category');
    app.cart.set({
      items: [
        { vendorName: 'Vendor B', category: 'Fruit', name: 'Apple' },
        { vendorName: 'Vendor A', category: 'Vegetables', name: 'Carrot' }
      ]
    });

    expect(app.sortedCartItems().map((item: any) => item.category)).toEqual(['Fruit', 'Vegetables']);
    fixture.destroy();
  });

  it('uses a 10 second success toast for the client dashboard comment-sent message', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    const message = app.t('alerts.bills.commentSent');

    app.page.set('dashboard');
    app.sessionUser.set({
      id: 'client-1',
      username: 'client',
      role: 'client',
      firstName: 'Client',
      lastName: 'User',
      organisation: 'Client Org',
      city: 'Paris',
      zipcode: '75001',
      email: 'client@example.com',
      physicalAddress: '1 street',
      phoneNumber: '0000000000',
      logoFilename: '',
      logoUrl: '',
      businessRegistrationId: 35600000000048,
      isActive: true
    });

    app.setAlert('success', message);

    expect(app.alertMessage()).toBe('');
    expect(app.toasts()).toEqual([
      expect.objectContaining({
        message,
        type: 'success'
      })
    ]);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    fixture.destroy();
  });

  it('uses a 10 second danger toast for non-account page alerts', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;

    app.page.set('dashboard');
    app.setAlert('danger', 'Something failed.');

    expect(app.alertMessage()).toBe('');
    expect(app.toasts()).toEqual([
      expect.objectContaining({
        message: 'Something failed.',
        type: 'danger'
      })
    ]);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    fixture.destroy();
  });

  it('sorts admin statistics rows by descending day and paginates them 10 at a time', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    const rows = Array.from({ length: 12 }, (_unused, index) => ({
      day: `2026-01-${String(index + 1).padStart(2, '0')}`,
      orderCount: index + 1,
      totalAmount: index + 1,
      currency: 'EUR'
    }));

    app.activatedOrdersStats.set(rows);

    expect(app.paginatedActivatedOrdersStatsTableRows().map((row: any) => row.day)).toEqual([
      '2026-01-12',
      '2026-01-11',
      '2026-01-10',
      '2026-01-09',
      '2026-01-08',
      '2026-01-07',
      '2026-01-06',
      '2026-01-05',
      '2026-01-04',
      '2026-01-03'
    ]);

    app.showNextActivatedOrdersStatsPage();

    expect(app.paginatedActivatedOrdersStatsTableRows().map((row: any) => row.day)).toEqual([
      '2026-01-02',
      '2026-01-01'
    ]);
    fixture.destroy();
  });

  it('stores vendor bill messages sorted by most recent send time', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;

    app.upsertVendorBillMessage({
      key: 'client-a::2026-01-01',
      clientId: 'client-a',
      clientOrganisation: 'Alpha',
      day: '2026-01-01',
      message: 'Older',
      sentAt: '2026-01-01T09:00:00.000Z',
      isRead: true
    });
    app.upsertVendorBillMessage({
      key: 'client-b::2026-01-02',
      clientId: 'client-b',
      clientOrganisation: 'Beta',
      day: '2026-01-02',
      message: 'Newer',
      sentAt: '2026-01-02T09:00:00.000Z',
      isRead: false
    });

    expect(app.vendorBillMessages().map((message: any) => message.key)).toEqual([
      'client-b::2026-01-02',
      'client-a::2026-01-01'
    ]);
    expect(app.hasUnreadVendorBillMessages()).toBe(true);
    fixture.destroy();
  });

  it('removes a vendor bill message from the dashboard list without affecting others', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;

    app.vendorBillMessages.set([
      {
        key: 'client-a::2026-01-01',
        clientId: 'client-a',
        clientOrganisation: 'Alpha',
        day: '2026-01-01',
        message: 'Older',
        sentAt: '2026-01-01T09:00:00.000Z',
        isRead: true
      },
      {
        key: 'client-b::2026-01-02',
        clientId: 'client-b',
        clientOrganisation: 'Beta',
        day: '2026-01-02',
        message: 'Newer',
        sentAt: '2026-01-02T09:00:00.000Z',
        isRead: false
      }
    ]);

    app.removeVendorBillMessage('client-b::2026-01-02');

    expect(app.vendorBillMessages().map((message: any) => message.key)).toEqual([
      'client-a::2026-01-01'
    ]);
    expect(app.hasUnreadVendorBillMessages()).toBe(false);
    fixture.destroy();
  });

  it('updates the client bill details after sending a comment', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    const sendWsApi = vi.fn().mockResolvedValue({
      clientComment: 'Please deliver before noon.',
      clientCommentSentAt: '2026-03-07T10:00:00.000Z'
    });

    app.sendWsApi = sendWsApi;
    app.clientCartDetails.set({
      key: 'vendor-1::2026-03-07',
      vendorId: 'vendor-1',
      vendorName: 'Vendor',
      day: '2026-03-07',
      items: [],
      totalPrice: 0,
      currency: 'EUR',
      clientComment: '',
      clientCommentSentAt: null,
      vendorSettled: false,
      clientSettled: false,
      isSettled: false
    });
    app.clientBillCommentDraft.set('Please deliver before noon.');

    await app.sendClientBillComment();

    expect(sendWsApi).toHaveBeenCalledWith('dashboard:client-bills:comment', {
      key: 'vendor-1::2026-03-07',
      comment: 'Please deliver before noon.'
    });
    expect(app.clientCartDetails()).toEqual(
      expect.objectContaining({
        clientComment: 'Please deliver before noon.',
        clientCommentSentAt: '2026-03-07T10:00:00.000Z'
      })
    );
    fixture.destroy();
  });

  it('keeps the PDF action unchanged and downloads vendor Factur-X as a blob', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:factur-x');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['pdf'], { type: 'application/pdf' }), {
        status: 200,
        headers: { 'content-disposition': 'attachment; filename="vendor-factur-x.pdf"' }
      })
    );

    app.vendorOrderDetails.set({
      key: 'client-1::2026-03-07',
      clientId: 'client-1',
      clientOrganisation: 'Client',
      clientUsername: 'client',
      day: '2026-03-07',
      orderedAt: '2026-03-07T10:00:00.000Z',
      deliveryDate: '2026-03-08',
      items: [],
      totalPrice: 0,
      currency: 'EUR',
      clientComment: '',
      clientCommentSentAt: null,
      vendorSettled: false,
      clientSettled: false,
      isSettled: false
    });

    app.openVendorBillPdf();
    await app.downloadVendorFacturX();

    expect(openSpy).toHaveBeenCalledWith('/api/bills/vendor/client-1%3A%3A2026-03-07/pdf', '_blank', 'noopener');
    expect(fetchSpy).toHaveBeenCalledWith('/api/bills/vendor/client-1%3A%3A2026-03-07/factur-x', {
      method: 'GET',
      headers: { Accept: 'application/pdf, application/json' }
    });
    expect(createObjectUrlSpy).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:factur-x');
    expect(app.downloadingVendorFacturX()).toBe(false);
    fixture.destroy();
  });

  it('downloads client Factur-X and guards repeated clicks while a download is running', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:client-factur-x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let resolveFetch!: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => { resolveFetch = resolve; });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValue(fetchPromise);

    app.clientCartDetails.set({
      key: 'vendor-1::2026-03-07',
      vendorId: 'vendor-1',
      vendorName: 'Vendor',
      day: '2026-03-07',
      items: [],
      totalPrice: 0,
      currency: 'EUR',
      clientComment: '',
      clientCommentSentAt: null,
      vendorSettled: false,
      clientSettled: false,
      isSettled: false
    });

    const first = app.downloadClientFacturX();
    const second = app.downloadClientFacturX();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    resolveFetch(new Response(new Blob(['pdf'], { type: 'application/pdf' }), { status: 200 }));
    await Promise.all([first, second]);

    expect(fetchSpy).toHaveBeenCalledWith('/api/bills/client/vendor-1%3A%3A2026-03-07/factur-x', expect.any(Object));
    expect(app.downloadingClientFacturX()).toBe(false);
    fixture.destroy();
  });

  it('shows a clear Factur-X error when the download response fails', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        error: 'missing_invoice_data',
        message: 'Missing legal data.',
        details: ['Seller SIRET must be a 14-digit number.']
      }), {
        status: 422,
        headers: { 'content-type': 'application/json' }
      })
    );

    app.vendorOrderDetails.set({
      key: 'client-1::2026-03-07',
      clientId: 'client-1',
      clientOrganisation: 'Client',
      clientUsername: 'client',
      day: '2026-03-07',
      orderedAt: '2026-03-07T10:00:00.000Z',
      deliveryDate: '2026-03-08',
      items: [],
      totalPrice: 0,
      currency: 'EUR',
      clientComment: '',
      clientCommentSentAt: null,
      vendorSettled: false,
      clientSettled: false,
      isSettled: false
    });

    await app.downloadVendorFacturX();

    expect(app.toasts()).toEqual([
      expect.objectContaining({
        type: 'danger',
        message: expect.stringContaining('Missing legal data.')
      })
    ]);
    fixture.destroy();
  });

  it('loads and saves admin Rungis billing settings', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    app.sessionUser.set({ id: 'admin-1', role: 'admin' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, rungisFeeRate: 2.5, vatRate: 20 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, rungisFeeRate: 3, vatRate: 10, message: 'Saved' }), { status: 200 }));

    await app.loadAdminRungisBillingSettings();
    expect(app.adminRungisFeeRate()).toBe(2.5);
    expect(app.adminRungisVatRate()).toBe(20);

    await app.saveAdminRungisBillingSettings('3', '10');
    expect(fetchSpy).toHaveBeenLastCalledWith('/api/admin/settings/rungis-billing', expect.objectContaining({ method: 'PUT' }));
    expect(app.adminRungisFeeRate()).toBe(3);
    expect(app.adminRungisVatRate()).toBe(10);
    fixture.destroy();
  });

  it('searches and marks admin Rungis bills paid', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    app.sessionUser.set({ id: 'admin-1', role: 'admin' });
    app.adminRungisBillSearchMonth.set('2026-05');
    app.adminRungisBillSearchOrganization.set('market');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, rows: [{ id: 'bill-1', userOrganisationName: 'Market', payableAmountIncludingVat: 30, currency: 'EUR' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, message: 'Paid' }), { status: 200 }));

    await app.searchAdminRungisBills();
    expect(app.adminRungisBillSearchRows()).toHaveLength(1);
    await app.markRungisBillPaid('bill-1');
    expect(app.adminRungisBillSearchRows()).toHaveLength(0);
    fixture.destroy();
  });

  it('searches admin users by organization and toggles their status', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    app.sessionUser.set({ id: 'admin-1', role: 'admin' });
    app.adminUserSearchOrganization.set('market');
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        users: [{ id: 'user-1', role: 'vendor', username: 'vendor-one', organisation: 'Market One', email: 'vendor@example.test', isActive: true }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        message: 'User disabled.',
        user: { id: 'user-1', role: 'vendor', username: 'vendor-one', organisation: 'Market One', email: 'vendor@example.test', isActive: false }
      }), { status: 200 }));

    await app.searchAdminUsers();
    expect(fetchSpy).toHaveBeenCalledWith('/api/admin/users/search?organization=market');
    expect(app.adminUserSearchRows()).toEqual([
      expect.objectContaining({ id: 'user-1', organisation: 'Market One', isActive: true })
    ]);

    await app.toggleAdminUserActive('user-1', false);
    expect(fetchSpy).toHaveBeenLastCalledWith('/api/admin/users/user-1/active', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ isActive: false })
    }));
    expect(app.adminUserSearchRows()[0].isActive).toBe(false);
    fixture.destroy();
  });

  it('opens a Rungis invoice modal and downloads its Factur-X document', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    app.sessionUser.set({ id: 'vendor-1', role: 'vendor' });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, invoice: { id: 'bill-1', adminParty: {}, userParty: {}, payableAmountIncludingVat: 30, currency: 'EUR' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Blob(['pdf'], { type: 'application/pdf' }), { status: 200, headers: { 'content-disposition': 'attachment; filename="rungis.pdf"' } }));

    await app.openRungisInvoice('bill-1');
    expect(app.showingRungisInvoiceModal()).toBe(true);
    await app.downloadRungisFacturX();
    expect(clickSpy).toHaveBeenCalled();
    fixture.destroy();
  });
});
