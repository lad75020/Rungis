import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      businessRegistrationId: 1234567890123,
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
});
