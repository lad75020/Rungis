import {
  calculateLineTotalIncludingVat,
  calculatePriceIncludingVat,
  getVatCategory,
  getVatExemptionReason,
  normalizeVatRate
} from '../../utils/vat.js';

export function registerWebsocketRoutes(app, context, deps) {
  const {
    addUtcDays,
    BILL_CLIENT_COMMENT_MAX_LENGTH,
    Bill,
    buildClientVendorDayBillKey,
    buildValidatedAtFilter,
    buildVendorDayOrderKey,
    clearRedisCart,
    getBillOverdueDaysSetting,
    getClientBillDetails,
    getClientBillSettlementMap,
    getClientWithVendors,
    getRedisCart,
    getVendorBillDetails,
    getVendorBillSettlementMap,
    getVendorClientOverdueUnsettledTotal,
    hasDangerousInputKeys,
    listVendorBillMessages,
    markVendorBillMessageRead,
    mapBillSettlement,
    mapCart,
    mapMerchandise,
    mapOrderCatalogItem,
    dismissVendorBillMessage,
    Merchandise,
    mongoose,
    normalizeString,
    parseClientVendorDayBillKey,
    parseIsoDayUtc,
    parseVendorDayOrderKey,
    removeUnpaidReminder,
    roundToTwoDecimals,
    sanitizeStockPayload,
    saveRedisCart,
    setBillClientComment,
    setBillSettlement,
    upsertUnpaidReminder,
    User,
    ValidatedOrder
  } = deps;
  const {
    adminConnections,
    broadcastClientUnpaidReminders,
    broadcastOrderCatalogRemove,
    broadcastOrderCatalogUpsert,
    broadcastOrderPriceUpdate,
    broadcastStocksSnapshot,
    clientDashboardConnections,
    dropAdminConnection,
    dropClientDashboardConnection,
    dropOrderConnection,
    dropStockConnection,
    dropVendorDashboardConnection,
    orderConnections,
    redisClient,
    sendToVendorDashboardConnections,
    stockConnections,
    vendorDashboardConnections
  } = context;

  const parseBillPageDateRange = (input = {}) => {
    const fromDate = normalizeString(input.fromDate);
    const toDate = normalizeString(input.toDate);
    const fromDay = fromDate ? parseIsoDayUtc(fromDate) : null;
    const toDay = toDate ? parseIsoDayUtc(toDate) : null;

    if ((fromDate && !fromDay) || (toDate && !toDay)) {
      return { ok: false, message: 'Invalid date. Use YYYY-MM-DD.' };
    }
    if (fromDay && toDay && fromDay.getTime() > toDay.getTime()) {
      return { ok: false, message: 'From date must be before or equal to to date.' };
    }

    const filter = {};
    if (fromDay) {
      filter.$gte = fromDay;
    }
    if (toDay) {
      filter.$lt = addUtcDays(toDay, 1);
    }
    return { ok: true, filter };
  };

  const billDay = (value) => new Date(value).toISOString().slice(0, 10);

  const getCounterpartyName = (user) => normalizeString(user?.organisation)
    || normalizeString(user?.username)
    || user?._id?.toString?.()
    || '';

  const getBillAmountIncludingVat = (bill) => {
    const gross = Number(bill?.totalPriceIncludingVat);
    if (Number.isFinite(gross) && gross > 0) {
      return roundToTwoDecimals(gross);
    }
    return roundToTwoDecimals(Number(bill?.totalPrice ?? 0));
  };

  const getBillCurrency = (bill) => normalizeString(bill?.currency) || 'EUR';

  const getBillDeliveryDateMap = async ({ bills, role, currentUserId }) => {
    if (!Array.isArray(bills) || bills.length === 0) {
      return new Map();
    }

    const days = bills.map((bill) => billDay(bill.date));
    const dates = days.map((day) => parseIsoDayUtc(day)).filter(Boolean);
    const minDate = new Date(Math.min(...dates.map((date) => date.getTime())));
    const maxDate = addUtcDays(new Date(Math.max(...dates.map((date) => date.getTime()))), 1);

    const counterpartyIds = [...new Set(bills.map((bill) => (
      role === 'client' ? bill.vendorId?.toString?.() : bill.clientId?.toString?.()
    )).filter((value) => mongoose.Types.ObjectId.isValid(value)))].map((value) => new mongoose.Types.ObjectId(value));

    if (counterpartyIds.length === 0) {
      return new Map();
    }

    const match = role === 'client'
      ? { clientId: currentUserId, validatedAt: { $gte: minDate, $lt: maxDate }, 'items.vendorId': { $in: counterpartyIds } }
      : { validatedAt: { $gte: minDate, $lt: maxDate }, 'items.vendorId': currentUserId, clientId: { $in: counterpartyIds } };

    const rows = await ValidatedOrder.aggregate([
      { $match: match },
      { $unwind: '$items' },
      role === 'client'
        ? { $match: { 'items.vendorId': { $in: counterpartyIds } } }
        : { $match: { 'items.vendorId': currentUserId } },
      {
        $group: {
          _id: {
            counterpartyId: role === 'client' ? '$items.vendorId' : '$clientId',
            day: { $dateToString: { format: '%Y-%m-%d', date: '$validatedAt', timezone: 'UTC' } }
          },
          deliveryDate: { $max: '$deliveryDate' }
        }
      }
    ]);

    return new Map(rows.map((row) => [
      `${row._id.counterpartyId.toString()}::${row._id.day}`,
      row.deliveryDate ? billDay(row.deliveryDate) : row._id.day
    ]));
  };

  const buildClientBillPageRows = async ({ currentUserId, requestPayload }) => {
    const dateRange = parseBillPageDateRange(requestPayload);
    if (!dateRange.ok) {
      return dateRange;
    }

    const paymentStatus = normalizeString(requestPayload?.paymentStatus) || 'all';
    if (!['all', 'paid', 'unpaid', 'late'].includes(paymentStatus)) {
      return { ok: false, message: 'Invalid payment status filter.' };
    }

    const selectedVendorId = normalizeString(requestPayload?.vendorId);
    if (selectedVendorId && !mongoose.Types.ObjectId.isValid(selectedVendorId)) {
      return { ok: false, message: 'Invalid vendor selection.' };
    }

    const baseQuery = { clientId: currentUserId };
    if (Object.keys(dateRange.filter).length > 0) {
      baseQuery.date = dateRange.filter;
    }

    const allAccessibleBills = await Bill.find(baseQuery)
      .select({ date: 1, vendorId: 1, clientId: 1, vendorSettled: 1, clientSettled: 1, totalPrice: 1, totalPriceIncludingVat: 1, currency: 1 })
      .sort({ date: -1 })
      .lean();

    const accessibleVendorIds = [...new Set(allAccessibleBills
      .map((bill) => bill.vendorId?.toString?.() ?? '')
      .filter((value) => mongoose.Types.ObjectId.isValid(value)))];

    const vendorDocs = accessibleVendorIds.length > 0
      ? await User.find({ _id: { $in: accessibleVendorIds.map((vendorId) => new mongoose.Types.ObjectId(vendorId)) }, role: 'vendor' })
        .select({ _id: 1, organisation: 1, username: 1 })
        .lean()
      : [];
    const vendorNameById = new Map(vendorDocs.map((vendor) => [vendor._id.toString(), getCounterpartyName(vendor)]));
    const vendors = accessibleVendorIds
      .map((vendorId) => ({ id: vendorId, name: vendorNameById.get(vendorId) || vendorId }))
      .sort((left, right) => left.name.localeCompare(right.name));

    const filteredBills = selectedVendorId
      ? allAccessibleBills.filter((bill) => bill.vendorId?.toString?.() === selectedVendorId)
      : allAccessibleBills;
    const deliveryDateByKey = await getBillDeliveryDateMap({ bills: filteredBills, role: 'client', currentUserId });
    const overdueDays = await getBillOverdueDaysSetting();
    const nowMs = Date.now();

    const bills = filteredBills
      .map((bill) => {
        const vendorId = bill.vendorId.toString();
        const day = billDay(bill.date);
        const settlement = mapBillSettlement(bill);
        const deliveryDate = deliveryDateByKey.get(`${vendorId}::${day}`) || day;
        const deliveryDateObject = parseIsoDayUtc(deliveryDate) || parseIsoDayUtc(day);
        const dueDateMs = deliveryDateObject ? addUtcDays(deliveryDateObject, overdueDays).getTime() : nowMs;
        const isLate = !settlement.vendorSettled && nowMs > dueDateMs;
        const rowPaymentStatus = settlement.vendorSettled ? 'paid' : (isLate ? 'late' : 'unpaid');
        return {
          key: buildClientVendorDayBillKey(vendorId, day),
          vendorId,
          vendorOrganisationName: vendorNameById.get(vendorId) || vendorId,
          billDate: day,
          amountIncludingVat: getBillAmountIncludingVat(bill),
          currency: getBillCurrency(bill),
          paymentStatus: rowPaymentStatus,
          isPaid: settlement.vendorSettled,
          isLate,
          received: settlement.clientSettled
        };
      })
      .filter((bill) => paymentStatus === 'all' || bill.paymentStatus === paymentStatus)
      .sort((left, right) => right.billDate.localeCompare(left.billDate) || left.vendorOrganisationName.localeCompare(right.vendorOrganisationName));

    return { ok: true, data: { bills, vendors, currency: 'EUR' } };
  };

  const buildVendorBillPageRows = async ({ currentUserId, requestPayload }) => {
    const dateRange = parseBillPageDateRange(requestPayload);
    if (!dateRange.ok) {
      return dateRange;
    }

    const receptionStatus = normalizeString(requestPayload?.receptionStatus) || 'all';
    if (!['all', 'received', 'not-received'].includes(receptionStatus)) {
      return { ok: false, message: 'Invalid reception status filter.' };
    }

    const selectedClientId = normalizeString(requestPayload?.clientId);
    if (selectedClientId && !mongoose.Types.ObjectId.isValid(selectedClientId)) {
      return { ok: false, message: 'Invalid client selection.' };
    }

    const baseQuery = { vendorId: currentUserId };
    if (Object.keys(dateRange.filter).length > 0) {
      baseQuery.date = dateRange.filter;
    }

    const allAccessibleBills = await Bill.find(baseQuery)
      .select({ date: 1, vendorId: 1, clientId: 1, vendorSettled: 1, clientSettled: 1, totalPrice: 1, totalPriceIncludingVat: 1, currency: 1 })
      .sort({ date: -1 })
      .lean();

    const accessibleClientIds = [...new Set(allAccessibleBills
      .map((bill) => bill.clientId?.toString?.() ?? '')
      .filter((value) => mongoose.Types.ObjectId.isValid(value)))];

    const clientDocs = accessibleClientIds.length > 0
      ? await User.find({ _id: { $in: accessibleClientIds.map((clientId) => new mongoose.Types.ObjectId(clientId)) }, role: 'client' })
        .select({ _id: 1, organisation: 1, username: 1 })
        .lean()
      : [];
    const clientNameById = new Map(clientDocs.map((client) => [client._id.toString(), getCounterpartyName(client)]));
    const clients = accessibleClientIds
      .map((clientId) => ({ id: clientId, name: clientNameById.get(clientId) || clientId }))
      .sort((left, right) => left.name.localeCompare(right.name));

    const filteredBills = selectedClientId
      ? allAccessibleBills.filter((bill) => bill.clientId?.toString?.() === selectedClientId)
      : allAccessibleBills;

    const bills = filteredBills
      .map((bill) => {
        const clientId = bill.clientId.toString();
        const day = billDay(bill.date);
        const settlement = mapBillSettlement(bill);
        const received = settlement.clientSettled;
        const rowReceptionStatus = received ? 'received' : 'not-received';
        return {
          key: buildVendorDayOrderKey(clientId, day),
          clientId,
          clientOrganisationName: clientNameById.get(clientId) || clientId,
          billDate: day,
          amountIncludingVat: getBillAmountIncludingVat(bill),
          currency: getBillCurrency(bill),
          receptionStatus: rowReceptionStatus,
          received,
          paid: settlement.vendorSettled
        };
      })
      .filter((bill) => receptionStatus === 'all' || bill.receptionStatus === receptionStatus)
      .sort((left, right) => right.billDate.localeCompare(left.billDate) || left.clientOrganisationName.localeCompare(right.clientOrganisationName));

    return { ok: true, data: { bills, clients, currency: 'EUR' } };
  };

  app.get('/ws', { websocket: true }, async (socket, request) => {
    const token = request.query?.token;

    if (!token) {
      socket.close(4001, 'Missing token');
      return;
    }

    try {
      const decoded = await request.server.jwt.verify(token);
      socket.send(
        JSON.stringify({
          type: 'welcome',
          userId: decoded.sub,
          role: decoded.role,
          page: decoded.page,
          at: new Date().toISOString()
        })
      );

      const syncSocketPageRegistration = (pageInput) => {
        const activePage = normalizeString(pageInput || decoded.page);
        dropOrderConnection(socket);
        dropStockConnection(socket);
        dropAdminConnection(socket);
        dropClientDashboardConnection(socket);
        dropVendorDashboardConnection(socket);

        if (activePage === 'order' && decoded.role === 'client' && mongoose.Types.ObjectId.isValid(decoded.sub)) {
          orderConnections.set(socket, { clientId: decoded.sub.toString() });
        }

        if (activePage === 'stocks' && decoded.role === 'vendor' && mongoose.Types.ObjectId.isValid(decoded.sub)) {
          stockConnections.set(socket, { vendorId: decoded.sub.toString() });
        }

        if (activePage === 'admin' && decoded.role === 'admin') {
          adminConnections.set(socket, {});
        }

        if (activePage === 'dashboard' && decoded.role === 'client' && mongoose.Types.ObjectId.isValid(decoded.sub)) {
          clientDashboardConnections.set(socket, { clientId: decoded.sub.toString() });
        }

        if (activePage === 'dashboard' && decoded.role === 'vendor' && mongoose.Types.ObjectId.isValid(decoded.sub)) {
          vendorDashboardConnections.set(socket, { vendorId: decoded.sub.toString() });
        }
      };

      syncSocketPageRegistration(decoded.page);

      const keepAliveTimer = setInterval(() => {
        try {
          if (socket.readyState === 1) {
            socket.ping();
          }
        } catch {
          clearInterval(keepAliveTimer);
          dropOrderConnection(socket);
          dropStockConnection(socket);
          dropAdminConnection(socket);
          dropClientDashboardConnection(socket);
          dropVendorDashboardConnection(socket);
        }
      }, 25000);

      const cleanupSocket = () => {
        clearInterval(keepAliveTimer);
        dropOrderConnection(socket);
        dropStockConnection(socket);
        dropAdminConnection(socket);
        dropClientDashboardConnection(socket);
        dropVendorDashboardConnection(socket);
      };

      socket.on('close', cleanupSocket);

      socket.on('error', cleanupSocket);

      socket.on('message', (rawPayload) => {
        try {
          const payload = JSON.parse(rawPayload.toString());
          if (hasDangerousInputKeys(payload)) {
            socket.send(JSON.stringify({ type: 'error', message: 'Invalid websocket payload.' }));
            return;
          }

          if (payload.type === 'ping') {
            syncSocketPageRegistration(payload.page);
            socket.send(JSON.stringify({ type: 'pong', at: new Date().toISOString() }));
            return;
          }

          if (payload.type === 'api') {
            void (async () => {
              const requestId = payload.requestId;
              const respond = (ok, data, message) => {
                socket.send(
                  JSON.stringify({
                    type: 'api:result',
                    requestId,
                    action: payload.action,
                    ok,
                    data: ok ? data : undefined,
                    message: ok ? undefined : message
                  })
                );
              };

              try {
                const action = normalizeString(payload.action);
                if (!action) {
                  respond(false, null, 'Missing websocket action.');
                  return;
                }

                if (action === 'auth:username-available') {
                  const username = normalizeString(payload.payload?.username).toLowerCase();
                  if (!username) {
                    respond(false, null, 'Username is required.');
                    return;
                  }

                  const existing = await User.findOne({ username })
                    .select({ _id: 1 })
                    .lean();
                  respond(true, { username, available: !existing });
                  return;
                }

                if (!mongoose.Types.ObjectId.isValid(decoded.sub)) {
                  respond(false, null, 'Invalid user identifier.');
                  return;
                }

                const currentUserId = new mongoose.Types.ObjectId(decoded.sub);

                if (action.startsWith('bill-pages:')) {
                  if (action === 'bill-pages:client:list') {
                    if (decoded.role !== 'client') {
                      respond(false, null, 'Only clients can access bill pages.');
                      return;
                    }

                    const result = await buildClientBillPageRows({
                      currentUserId,
                      requestPayload: payload.payload ?? {}
                    });
                    if (!result.ok) {
                      respond(false, null, result.message);
                      return;
                    }
                    respond(true, result.data);
                    return;
                  }

                  if (action === 'bill-pages:client:set-received') {
                    if (decoded.role !== 'client') {
                      respond(false, null, 'Only clients can update bill reception status.');
                      return;
                    }

                    const parsedKey = parseClientVendorDayBillKey(payload.payload?.key);
                    if (!parsedKey) {
                      respond(false, null, 'Invalid bill selection.');
                      return;
                    }
                    const dayStart = parseIsoDayUtc(parsedKey.day);
                    if (!dayStart) {
                      respond(false, null, 'Invalid bill day.');
                      return;
                    }
                    const dayEnd = addUtcDays(dayStart, 1);
                    const vendorId = new mongoose.Types.ObjectId(parsedKey.vendorId);
                    const existingBill = await Bill.findOne({
                      clientId: currentUserId,
                      vendorId,
                      date: { $gte: dayStart, $lt: dayEnd }
                    }).select({ _id: 1 }).lean();
                    if (!existingBill) {
                      respond(false, null, 'Bill not found or not accessible.');
                      return;
                    }

                    const received = Boolean(payload.payload?.received);
                    const settlement = await setBillSettlement({
                      day: parsedKey.day,
                      vendorId: parsedKey.vendorId,
                      clientId: currentUserId.toString(),
                      role: 'client',
                      settled: received
                    });
                    respond(true, {
                      key: buildClientVendorDayBillKey(parsedKey.vendorId, parsedKey.day),
                      received: settlement.clientSettled,
                      settlement
                    });
                    return;
                  }

                  if (action === 'bill-pages:vendor:list') {
                    if (decoded.role !== 'vendor') {
                      respond(false, null, 'Only vendors can access bill pages.');
                      return;
                    }

                    const result = await buildVendorBillPageRows({
                      currentUserId,
                      requestPayload: payload.payload ?? {}
                    });
                    if (!result.ok) {
                      respond(false, null, result.message);
                      return;
                    }
                    respond(true, result.data);
                    return;
                  }

                  if (action === 'bill-pages:vendor:set-paid') {
                    if (decoded.role !== 'vendor') {
                      respond(false, null, 'Only vendors can update bill paid status.');
                      return;
                    }

                    const parsedKey = parseVendorDayOrderKey(payload.payload?.key);
                    if (!parsedKey) {
                      respond(false, null, 'Invalid bill selection.');
                      return;
                    }
                    const dayStart = parseIsoDayUtc(parsedKey.day);
                    if (!dayStart) {
                      respond(false, null, 'Invalid bill day.');
                      return;
                    }
                    const dayEnd = addUtcDays(dayStart, 1);
                    const clientId = new mongoose.Types.ObjectId(parsedKey.clientId);
                    const existingBill = await Bill.findOne({
                      vendorId: currentUserId,
                      clientId,
                      date: { $gte: dayStart, $lt: dayEnd }
                    }).select({ _id: 1 }).lean();
                    if (!existingBill) {
                      respond(false, null, 'Bill not found or not accessible.');
                      return;
                    }

                    const paid = Boolean(payload.payload?.paid);
                    const settlement = await setBillSettlement({
                      day: parsedKey.day,
                      vendorId: currentUserId.toString(),
                      clientId: parsedKey.clientId,
                      role: 'vendor',
                      settled: paid
                    });
                    respond(true, {
                      key: buildVendorDayOrderKey(parsedKey.clientId, parsedKey.day),
                      paid: settlement.vendorSettled,
                      settlement
                    });
                    return;
                  }

                  respond(false, null, 'Unknown bill page action.');
                  return;
                }

                if (action.startsWith('dashboard:')) {
                  if (action === 'dashboard:vendor-orders:list') {
                    if (decoded.role !== 'vendor') {
                      respond(false, null, 'Only vendors can access dashboard order operations.');
                      return;
                    }

                    const fromDate = normalizeString(payload.payload?.fromDate);
                    const toDate = normalizeString(payload.payload?.toDate);
                    const dateFilterResult = buildValidatedAtFilter(fromDate, toDate);
                    if (!dateFilterResult.ok) {
                      respond(false, null, dateFilterResult.message);
                      return;
                    }

                    const matchFilter = {
                      'items.vendorId': currentUserId
                    };

                    if (Object.keys(dateFilterResult.filter).length > 0) {
                      matchFilter.validatedAt = dateFilterResult.filter;
                    }

                    const rows = await ValidatedOrder.aggregate([
                      { $match: matchFilter },
                      { $unwind: '$items' },
                      { $match: { 'items.vendorId': currentUserId } },
                      {
                        $group: {
                          _id: {
                            clientId: '$clientId',
                            clientUsername: '$clientUsername',
                            day: {
                              $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$validatedAt',
                                timezone: 'UTC'
                              }
                            }
                          },
                          totalPrice: { $sum: '$items.lineTotal' },
                          totalQuantity: { $sum: '$items.quantity' },
                          lineCount: { $sum: 1 }
                        }
                      },
                      { $sort: { '_id.day': -1, '_id.clientUsername': 1 } }
                    ]);

                    const orders = rows.map((row) => {
                      const clientId = row._id.clientId.toString();
                      const day = row._id.day;

                      return {
                        key: buildVendorDayOrderKey(clientId, day),
                        clientId,
                        clientUsername: row._id.clientUsername ?? clientId,
                        day,
                        totalQuantity: Number(row.totalQuantity ?? 0),
                        lineCount: Number(row.lineCount ?? 0),
                        totalPrice: roundToTwoDecimals(Number(row.totalPrice ?? 0)),
                        currency: 'EUR'
                      };
                    });

                    respond(true, { orders, currency: 'EUR' });
                    return;
                  }

                  if (action === 'dashboard:vendor-bills:list') {
                    if (decoded.role !== 'vendor') {
                      respond(false, null, 'Only vendors can access dashboard bill operations.');
                      return;
                    }

                    const day = normalizeString(payload.payload?.date);
                    const dayStart = parseIsoDayUtc(day);
                    if (!dayStart) {
                      respond(false, null, 'Invalid date. Use YYYY-MM-DD.');
                      return;
                    }

                    const dayEnd = addUtcDays(dayStart, 1);

                    const rows = await ValidatedOrder.aggregate([
                      {
                        $match: {
                          validatedAt: { $gte: dayStart, $lt: dayEnd },
                          'items.vendorId': currentUserId
                        }
                      },
                      { $unwind: '$items' },
                      { $match: { 'items.vendorId': currentUserId } },
                      {
                        $group: {
                          _id: {
                            clientId: '$clientId',
                            clientUsername: '$clientUsername'
                          },
                          totalPrice: { $sum: '$items.lineTotal' },
                          totalQuantity: { $sum: '$items.quantity' },
                          lineCount: { $sum: 1 }
                        }
                      },
                      { $sort: { '_id.clientUsername': 1 } }
                    ]);

                    const billDocs = await Bill.find({
                      date: dayStart,
                      vendorId: currentUserId
                    })
                      .select({
                        clientId: 1,
                        totalPrice: 1,
                        totalQuantity: 1,
                        lineCount: 1,
                        vendorSettled: 1,
                        clientSettled: 1
                      })
                      .lean();
                    const rowByClientId = new Map(
                      rows.map((row) => [row._id.clientId.toString(), row])
                    );
                    const clientIds = [...new Set([
                      ...rows
                        .map((row) => row?._id?.clientId)
                        .filter((value) => mongoose.Types.ObjectId.isValid(value))
                        .map((value) => value.toString()),
                      ...billDocs
                        .map((bill) => bill?.clientId?.toString?.() ?? '')
                        .filter((value) => mongoose.Types.ObjectId.isValid(value))
                    ])];
                    const clients = await User.find({
                      _id: { $in: clientIds.map((clientId) => new mongoose.Types.ObjectId(clientId)) }
                    })
                      .select({ _id: 1, organisation: 1, username: 1 })
                      .lean();
                    const clientOrganisationById = new Map(
                      clients.map((client) => [
                        client._id.toString(),
                        normalizeString(client.organisation) || normalizeString(client.username) || client._id.toString()
                      ])
                    );
                    const billByClientId = new Map(
                      billDocs.map((bill) => [bill.clientId.toString(), bill])
                    );

                    const bills = clientIds.map((clientId) => {
                      const row = rowByClientId.get(clientId);
                      const bill = billByClientId.get(clientId) ?? null;
                      const settlement = mapBillSettlement(bill);
                      return {
                        key: buildVendorDayOrderKey(clientId, day),
                        clientId,
                        clientUsername: row?._id?.clientUsername ?? clientOrganisationById.get(clientId) ?? clientId,
                        organisation: clientOrganisationById.get(clientId) || row?._id?.clientUsername || clientId,
                        day,
                        totalQuantity: Number(bill?.totalQuantity ?? row?.totalQuantity ?? 0),
                        lineCount: Number(bill?.lineCount ?? row?.lineCount ?? 0),
                        totalPrice: roundToTwoDecimals(Number(bill?.totalPrice ?? row?.totalPrice ?? 0)),
                        currency: 'EUR',
                        ...settlement
                      };
                    });

                    respond(true, { bills, currency: 'EUR' });
                    return;
                  }

                  if (action === 'dashboard:vendor-bills:clients') {
                    if (decoded.role !== 'vendor') {
                      respond(false, null, 'Only vendors can access dashboard bill operations.');
                      return;
                    }

                    const vendor = await User.findOne({
                      _id: currentUserId,
                      role: 'vendor'
                    })
                      .select({ clientIds: 1 })
                      .lean();

                    const clientIds = (vendor?.clientIds ?? [])
                      .map((clientId) => clientId?.toString?.() ?? '')
                      .filter((clientId) => mongoose.Types.ObjectId.isValid(clientId));

                    if (clientIds.length === 0) {
                      respond(true, { clients: [] });
                      return;
                    }

                    const clients = await User.find({
                      _id: { $in: clientIds.map((clientId) => new mongoose.Types.ObjectId(clientId)) },
                      role: 'client',
                      isActive: true
                    })
                      .select({ _id: 1, organisation: 1, username: 1 })
                      .sort({ organisation: 1, username: 1 })
                      .lean();

                    const options = clients.map((client) => ({
                      id: client._id.toString(),
                      name: normalizeString(client.organisation)
                        || normalizeString(client.username)
                        || client._id.toString()
                    }));

                    respond(true, { clients: options });
                    return;
                  }

                  if (action === 'dashboard:vendor-bills:list-by-client-range') {
                    if (decoded.role !== 'vendor') {
                      respond(false, null, 'Only vendors can access dashboard bill operations.');
                      return;
                    }

                    const clientId = normalizeString(payload.payload?.clientId);
                    if (!mongoose.Types.ObjectId.isValid(clientId)) {
                      respond(false, null, 'Invalid client id.');
                      return;
                    }

                    const fromDate = normalizeString(payload.payload?.fromDate);
                    const toDate = normalizeString(payload.payload?.toDate);
                    const dateFilterResult = buildValidatedAtFilter(fromDate, toDate);
                    if (!dateFilterResult.ok) {
                      respond(false, null, dateFilterResult.message);
                      return;
                    }

                    const selectedClientId = new mongoose.Types.ObjectId(clientId);
                    const orderMatchFilter = {
                      clientId: selectedClientId,
                      'items.vendorId': currentUserId
                    };
                    if (Object.keys(dateFilterResult.filter).length > 0) {
                      orderMatchFilter.validatedAt = dateFilterResult.filter;
                    }

                    const rows = await ValidatedOrder.aggregate([
                      { $match: orderMatchFilter },
                      { $unwind: '$items' },
                      { $match: { 'items.vendorId': currentUserId } },
                      {
                        $group: {
                          _id: {
                            day: {
                              $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$validatedAt',
                                timezone: 'UTC'
                              }
                            },
                            clientUsername: '$clientUsername'
                          },
                          totalPrice: { $sum: '$items.lineTotal' },
                          totalQuantity: { $sum: '$items.quantity' },
                          lineCount: { $sum: 1 }
                        }
                      },
                      { $sort: { '_id.day': -1 } }
                    ]);

                    const billQuery = {
                      vendorId: currentUserId,
                      clientId: selectedClientId
                    };
                    if (Object.keys(dateFilterResult.filter).length > 0) {
                      billQuery.date = dateFilterResult.filter;
                    }

                    const billDocs = await Bill.find(billQuery)
                      .select({
                        date: 1,
                        totalPrice: 1,
                        totalQuantity: 1,
                        lineCount: 1,
                        vendorSettled: 1,
                        clientSettled: 1
                      })
                      .lean();

                    const rowByDay = new Map(
                      rows.map((row) => [normalizeString(row?._id?.day), row])
                    );
                    const billByDay = new Map(
                      billDocs.map((bill) => [new Date(bill.date).toISOString().slice(0, 10), bill])
                    );
                    const days = [...new Set([
                      ...rows.map((row) => normalizeString(row?._id?.day)).filter(Boolean),
                      ...billDocs.map((bill) => new Date(bill.date).toISOString().slice(0, 10))
                    ])].sort((left, right) => right.localeCompare(left));

                    const client = await User.findById(clientId)
                      .select({ _id: 1, organisation: 1, username: 1 })
                      .lean();
                    const clientUsername = normalizeString(client?.username)
                      || normalizeString(rows[0]?._id?.clientUsername)
                      || clientId;
                    const organisation = normalizeString(client?.organisation) || clientUsername || clientId;

                    const bills = days.map((day) => {
                      const row = rowByDay.get(day) ?? null;
                      const bill = billByDay.get(day) ?? null;
                      const settlement = mapBillSettlement(bill);
                      return {
                        key: buildVendorDayOrderKey(clientId, day),
                        clientId,
                        clientUsername,
                        organisation,
                        day,
                        totalQuantity: Number(bill?.totalQuantity ?? row?.totalQuantity ?? 0),
                        lineCount: Number(bill?.lineCount ?? row?.lineCount ?? 0),
                        totalPrice: roundToTwoDecimals(Number(bill?.totalPrice ?? row?.totalPrice ?? 0)),
                        currency: 'EUR',
                        ...settlement
                      };
                    });

                    respond(true, { bills, currency: 'EUR' });
                    return;
                  }

                  if (action === 'dashboard:vendor-bill-messages:list') {
                    if (decoded.role !== 'vendor') {
                      respond(false, null, 'Only vendors can access dashboard bill operations.');
                      return;
                    }

                    const messages = await listVendorBillMessages(currentUserId.toString());
                    respond(true, { messages });
                    return;
                  }

                  if (action === 'dashboard:vendor-bill-messages:read') {
                    if (decoded.role !== 'vendor') {
                      respond(false, null, 'Only vendors can access dashboard bill operations.');
                      return;
                    }

                    const parsedKey = parseVendorDayOrderKey(payload.payload?.key);
                    if (!parsedKey) {
                      respond(false, null, 'Invalid bill message selection.');
                      return;
                    }

                    const message = await markVendorBillMessageRead({
                      day: parsedKey.day,
                      vendorId: currentUserId.toString(),
                      clientId: parsedKey.clientId
                    });

                    if (!message) {
                      respond(false, null, 'Bill message not found.');
                      return;
                    }

                    sendToVendorDashboardConnections(currentUserId.toString(), () => ({
                      type: 'dashboard:vendor-bill-message:update',
                      message
                    }));

                    respond(true, { message });
                    return;
                  }

                  if (action === 'dashboard:vendor-bill-messages:dismiss') {
                    if (decoded.role !== 'vendor') {
                      respond(false, null, 'Only vendors can access dashboard bill operations.');
                      return;
                    }

                    const parsedKey = parseVendorDayOrderKey(payload.payload?.key);
                    if (!parsedKey) {
                      respond(false, null, 'Invalid bill message selection.');
                      return;
                    }

                    const dismissed = await dismissVendorBillMessage({
                      day: parsedKey.day,
                      vendorId: currentUserId.toString(),
                      clientId: parsedKey.clientId
                    });
                    if (!dismissed) {
                      respond(false, null, 'Bill message not found.');
                      return;
                    }

                    sendToVendorDashboardConnections(currentUserId.toString(), () => ({
                      type: 'dashboard:vendor-bill-message:remove',
                      key: payload.payload?.key
                    }));

                    respond(true, { key: payload.payload?.key });
                    return;
                  }

                  if (action === 'dashboard:client-carts:list') {
                    if (decoded.role !== 'client') {
                      respond(false, null, 'Only clients can access dashboard cart operations.');
                      return;
                    }

                    const fromDate = normalizeString(payload.payload?.fromDate);
                    const toDate = normalizeString(payload.payload?.toDate);
                    const dateFilterResult = buildValidatedAtFilter(fromDate, toDate);
                    if (!dateFilterResult.ok) {
                      respond(false, null, dateFilterResult.message);
                      return;
                    }

                    const query = {
                      clientId: currentUserId
                    };
                    if (Object.keys(dateFilterResult.filter).length > 0) {
                      query.validatedAt = dateFilterResult.filter;
                    }

                    const carts = await ValidatedOrder.find(query)
                      .sort({ validatedAt: -1 })
                      .select({ validatedAt: 1, items: 1, grandTotal: 1, currency: 1 })
                      .lean();

                    const summaries = carts.map((cart) => ({
                      key: cart._id.toString(),
                      validatedAt: cart.validatedAt,
                      day: new Date(cart.validatedAt).toISOString().slice(0, 10),
                      totalQuantity: Number(
                        (cart.items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)
                      ),
                      lineCount: Number((cart.items ?? []).length),
                      totalPrice: roundToTwoDecimals(Number(cart.grandTotal ?? 0)),
                      currency: cart.currency || 'EUR'
                    }));

                    respond(true, { carts: summaries, currency: 'EUR' });
                    return;
                  }

                  if (action === 'dashboard:client-bills:list') {
                    if (decoded.role !== 'client') {
                      respond(false, null, 'Only clients can access dashboard bill operations.');
                      return;
                    }

                    const day = normalizeString(payload.payload?.date);
                    const dayStart = parseIsoDayUtc(day);
                    if (!dayStart) {
                      respond(false, null, 'Invalid date. Use YYYY-MM-DD.');
                      return;
                    }

                    const dayEnd = addUtcDays(dayStart, 1);

                    const rows = await ValidatedOrder.aggregate([
                      {
                        $match: {
                          clientId: currentUserId,
                          validatedAt: { $gte: dayStart, $lt: dayEnd }
                        }
                      },
                      { $unwind: '$items' },
                      {
                        $group: {
                          _id: {
                            vendorId: '$items.vendorId',
                            vendorName: '$items.vendorName'
                          },
                          totalPrice: { $sum: '$items.lineTotal' },
                          totalQuantity: { $sum: '$items.quantity' },
                          lineCount: { $sum: 1 }
                        }
                      },
                      { $sort: { '_id.vendorName': 1 } }
                    ]);

                    const billDocs = await Bill.find({
                      date: dayStart,
                      clientId: currentUserId
                    })
                      .select({
                        vendorId: 1,
                        totalPrice: 1,
                        totalQuantity: 1,
                        lineCount: 1,
                        vendorSettled: 1,
                        clientSettled: 1
                      })
                      .lean();
                    const rowByVendorId = new Map(
                      rows.map((row) => [row._id.vendorId.toString(), row])
                    );
                    const vendorIds = [...new Set([
                      ...rows
                        .map((row) => row?._id?.vendorId)
                        .filter((value) => mongoose.Types.ObjectId.isValid(value))
                        .map((value) => value.toString()),
                      ...billDocs
                        .map((bill) => bill?.vendorId?.toString?.() ?? '')
                        .filter((value) => mongoose.Types.ObjectId.isValid(value))
                    ])];
                    const vendors = await User.find({
                      _id: { $in: vendorIds.map((vendorId) => new mongoose.Types.ObjectId(vendorId)) }
                    })
                      .select({ _id: 1, organisation: 1, username: 1 })
                      .lean();
                    const vendorOrganisationById = new Map(
                      vendors.map((vendor) => [
                        vendor._id.toString(),
                        normalizeString(vendor.organisation) || normalizeString(vendor.username) || vendor._id.toString()
                      ])
                    );
                    const billByVendorId = new Map(
                      billDocs.map((bill) => [bill.vendorId.toString(), bill])
                    );

                    const bills = vendorIds.map((vendorId) => {
                      const row = rowByVendorId.get(vendorId);
                      const bill = billByVendorId.get(vendorId) ?? null;
                      const settlement = mapBillSettlement(bill);
                      return {
                        key: buildClientVendorDayBillKey(vendorId, day),
                        vendorId,
                        vendorName: row?._id?.vendorName ?? vendorOrganisationById.get(vendorId) ?? vendorId,
                        organisation: vendorOrganisationById.get(vendorId) || row?._id?.vendorName || vendorId,
                        day,
                        totalQuantity: Number(bill?.totalQuantity ?? row?.totalQuantity ?? 0),
                        lineCount: Number(bill?.lineCount ?? row?.lineCount ?? 0),
                        totalPrice: roundToTwoDecimals(Number(bill?.totalPrice ?? row?.totalPrice ?? 0)),
                        currency: 'EUR',
                        ...settlement
                      };
                    });

                    respond(true, { bills, currency: 'EUR' });
                    return;
                  }

                  if (action === 'dashboard:client-bills:vendors') {
                    if (decoded.role !== 'client') {
                      respond(false, null, 'Only clients can access dashboard bill operations.');
                      return;
                    }

                    const client = await getClientWithVendors(currentUserId);
                    if (!client || client.role !== 'client') {
                      respond(false, null, 'Client account not found.');
                      return;
                    }

                    const vendorIds = (client.vendorIds ?? [])
                      .map((value) => value?.toString?.() ?? '')
                      .filter((value) => mongoose.Types.ObjectId.isValid(value));

                    if (vendorIds.length === 0) {
                      respond(true, { vendors: [] });
                      return;
                    }

                    const vendorDocs = await User.find({
                      _id: { $in: vendorIds.map((vendorId) => new mongoose.Types.ObjectId(vendorId)) },
                      role: 'vendor'
                    })
                      .select({ _id: 1, username: 1, organisation: 1 })
                      .lean();

                    const vendors = vendorDocs
                      .map((vendor) => ({
                        id: vendor._id.toString(),
                        name: normalizeString(vendor.organisation) || normalizeString(vendor.username) || vendor._id.toString()
                      }))
                      .sort((left, right) => left.name.localeCompare(right.name));

                    respond(true, { vendors });
                    return;
                  }

                  if (action === 'dashboard:client-bills:unpaid-by-vendor') {
                    if (decoded.role !== 'client') {
                      respond(false, null, 'Only clients can access dashboard bill operations.');
                      return;
                    }

                    const vendorId = normalizeString(payload.payload?.vendorId);
                    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
                      respond(false, null, 'Invalid vendor selection.');
                      return;
                    }

                    const client = await getClientWithVendors(currentUserId);
                    if (!client || client.role !== 'client') {
                      respond(false, null, 'Client account not found.');
                      return;
                    }

                    const associatedVendorIds = new Set(
                      (client.vendorIds ?? [])
                        .map((value) => value?.toString?.() ?? '')
                        .filter((value) => mongoose.Types.ObjectId.isValid(value))
                    );
                    if (!associatedVendorIds.has(vendorId)) {
                      respond(false, null, 'This vendor is not associated with your account.');
                      return;
                    }

                    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);
                    const billOverdueDays = await getBillOverdueDaysSetting();
                    const rows = await ValidatedOrder.aggregate([
                      {
                        $match: {
                          clientId: currentUserId,
                          'items.vendorId': vendorObjectId
                        }
                      },
                      { $unwind: '$items' },
                      { $match: { 'items.vendorId': vendorObjectId } },
                      {
                        $group: {
                          _id: {
                            day: {
                              $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$validatedAt',
                                timezone: 'UTC'
                              }
                            },
                            deliveryDate: {
                              $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$deliveryDate',
                                timezone: 'UTC'
                              }
                            }
                          },
                          orderedAt: { $min: '$validatedAt' },
                          totalPrice: { $sum: '$items.lineTotal' },
                          totalQuantity: { $sum: '$items.quantity' },
                          lineCount: { $sum: 1 }
                        }
                      },
                      { $sort: { '_id.day': -1 } }
                    ]);
                    const billDocs = await Bill.find({
                      clientId: currentUserId,
                      vendorId: vendorObjectId
                    })
                      .select({
                        date: 1,
                        orderedAt: 1,
                        totalPrice: 1,
                        totalQuantity: 1,
                        lineCount: 1,
                        vendorSettled: 1,
                        clientSettled: 1
                      })
                      .lean();

                    const vendorDoc = await User.findOne({ _id: vendorObjectId, role: 'vendor' })
                      .select({ _id: 1, username: 1, organisation: 1 })
                      .lean();
                    const vendorName = normalizeString(vendorDoc?.organisation)
                      || normalizeString(vendorDoc?.username)
                      || vendorId;
                    const nowMs = Date.now();

                    const rowByDay = new Map(
                      rows.map((row) => [normalizeString(row?._id?.day), row])
                    );
                    const billByDay = new Map(
                      billDocs.map((bill) => [new Date(bill.date).toISOString().slice(0, 10), bill])
                    );
                    const days = [...new Set([
                      ...rows.map((row) => normalizeString(row?._id?.day)).filter(Boolean),
                      ...billDocs.map((bill) => new Date(bill.date).toISOString().slice(0, 10))
                    ])].sort((left, right) => right.localeCompare(left));

                    const bills = days
                      .map((day) => {
                        const row = rowByDay.get(day);
                        const bill = billByDay.get(day) ?? null;
                        const deliveryDate = normalizeString(row?._id?.deliveryDate) || day;
                        const settlement = mapBillSettlement(bill);
                        const deliveryDateObject = parseIsoDayUtc(deliveryDate);
                        const dueDateMs = deliveryDateObject
                          ? addUtcDays(deliveryDateObject, billOverdueDays).getTime()
                          : nowMs;
                        const daysPastDue = Math.max(
                          0,
                          Math.floor((nowMs - dueDateMs) / (24 * 60 * 60 * 1000))
                        );

                        return {
                          key: buildClientVendorDayBillKey(vendorId, day),
                          vendorId,
                          vendorName,
                          organisation: vendorName,
                          day,
                          orderedAt: row?.orderedAt ?? bill?.orderedAt ?? parseIsoDayUtc(day),
                          deliveryDate,
                          totalQuantity: Number(bill?.totalQuantity ?? row?.totalQuantity ?? 0),
                          lineCount: Number(bill?.lineCount ?? row?.lineCount ?? 0),
                          totalPrice: roundToTwoDecimals(Number(bill?.totalPrice ?? row?.totalPrice ?? 0)),
                          currency: 'EUR',
                          daysPastDue,
                          isOverdue: daysPastDue > 0,
                          ...settlement
                        };
                      })
                      .filter((bill) => !bill.vendorSettled);

                    respond(true, { bills, currency: 'EUR', billOverdueDays });
                    return;
                  }

                  if (action === 'dashboard:vendor-orders:details') {
                    if (decoded.role !== 'vendor') {
                      respond(false, null, 'Only vendors can access dashboard order operations.');
                      return;
                    }

                    const parsedKey = parseVendorDayOrderKey(payload.payload?.key);
                    if (!parsedKey) {
                      respond(false, null, 'Invalid order selection.');
                      return;
                    }

                    const dayStart = parseIsoDayUtc(parsedKey.day);
                    if (!dayStart) {
                      respond(false, null, 'Invalid order day.');
                      return;
                    }

                    const dayEnd = addUtcDays(dayStart, 1);
                    const clientId = new mongoose.Types.ObjectId(parsedKey.clientId);

                    const orders = await ValidatedOrder.find({
                      clientId,
                      validatedAt: { $gte: dayStart, $lt: dayEnd },
                      'items.vendorId': currentUserId
                    })
                      .select({ clientUsername: 1, items: 1 })
                      .lean();

                    if (orders.length === 0) {
                      respond(false, null, 'Order details not found for the selected client/day.');
                      return;
                    }

                    const itemMap = new Map();
                    let totalPrice = 0;

                    for (const order of orders) {
                      for (const item of order.items ?? []) {
                        if (item.vendorId.toString() !== currentUserId.toString()) {
                          continue;
                        }

                        const key = `${item.merchandiseId.toString()}::${item.unitPrice}`;
                        const existing = itemMap.get(key);

                        if (existing) {
                          existing.quantity += item.quantity;
                          existing.lineTotal = roundToTwoDecimals(existing.lineTotal + item.lineTotal);
                        } else {
                          itemMap.set(key, {
                            merchandiseId: item.merchandiseId.toString(),
                            name: item.name,
                            reference: item.reference,
                            category: item.category,
                            unitPrice: item.unitPrice,
                            quantity: item.quantity,
                            lineTotal: item.lineTotal
                          });
                        }

                        totalPrice = roundToTwoDecimals(totalPrice + item.lineTotal);
                      }
                    }

                    const items = [...itemMap.values()].sort((left, right) => {
                      const byName = left.name.localeCompare(right.name);
                      if (byName !== 0) {
                        return byName;
                      }

                      return left.reference.localeCompare(right.reference);
                    });

                    if (items.length === 0) {
                      respond(false, null, 'No item found for this vendor in the selected order.');
                      return;
                    }

                    respond(true, {
                      order: {
                        key: buildVendorDayOrderKey(parsedKey.clientId, parsedKey.day),
                        day: parsedKey.day,
                        clientId: parsedKey.clientId,
                        clientUsername: orders[0].clientUsername ?? parsedKey.clientId,
                        items,
                        totalPrice,
                        currency: 'EUR'
                      }
                    });
                    return;
                  }

                  if (action === 'dashboard:vendor-bills:details') {
                    if (decoded.role !== 'vendor') {
                      respond(false, null, 'Only vendors can access dashboard bill operations.');
                      return;
                    }

                    const result = await getVendorBillDetails(
                      currentUserId.toString(),
                      payload.payload?.key
                    );
                    if (!result.ok) {
                      respond(false, null, result.message);
                      return;
                    }

                    respond(true, { bill: result.bill });
                    return;
                  }

                  if (action === 'dashboard:vendor-bills:settle') {
                    if (decoded.role !== 'vendor') {
                      respond(false, null, 'Only vendors can access dashboard bill operations.');
                      return;
                    }

                    const parsedKey = parseVendorDayOrderKey(payload.payload?.key);
                    if (!parsedKey) {
                      respond(false, null, 'Invalid bill selection.');
                      return;
                    }

                    const settled = Boolean(payload.payload?.settled);
                    const settlement = await setBillSettlement({
                      day: parsedKey.day,
                      vendorId: currentUserId.toString(),
                      clientId: parsedKey.clientId,
                      role: 'vendor',
                      settled
                    });

                    if (settled) {
                      const vendorId = currentUserId.toString();
                      const billOverdueDays = await getBillOverdueDaysSetting();
                      const remainingUnsettledTotal = await getVendorClientOverdueUnsettledTotal(
                        vendorId,
                        parsedKey.clientId,
                        billOverdueDays
                      );

                      if (remainingUnsettledTotal > 0) {
                        const vendorName = normalizeString(request.session?.user?.organisation)
                          || normalizeString(request.session?.user?.username)
                          || normalizeString(decoded.username)
                          || vendorId;
                        await upsertUnpaidReminder(redisClient, {
                          clientId: parsedKey.clientId,
                          vendorId,
                          vendorName,
                          totalAmount: remainingUnsettledTotal,
                          currency: 'EUR'
                        }).catch(() => {});
                      } else {
                        await removeUnpaidReminder(redisClient, {
                          clientId: parsedKey.clientId,
                          vendorId
                        }).catch(() => {});
                      }

                      await broadcastClientUnpaidReminders(parsedKey.clientId);
                    }

                    respond(true, {
                      key: buildVendorDayOrderKey(parsedKey.clientId, parsedKey.day),
                      settlement
                    });
                    return;
                  }

                  if (action === 'dashboard:client-carts:details') {
                    if (decoded.role !== 'client') {
                      respond(false, null, 'Only clients can access dashboard cart operations.');
                      return;
                    }

                    const cartId = normalizeString(payload.payload?.key);
                    if (!mongoose.Types.ObjectId.isValid(cartId)) {
                      respond(false, null, 'Invalid cart selection.');
                      return;
                    }

                    const cart = await ValidatedOrder.findOne({
                      _id: cartId,
                      clientId: currentUserId
                    })
                      .select({ validatedAt: 1, items: 1, grandTotal: 1, grandTotalIncludingVat: 1, currency: 1 })
                      .lean();

                    if (!cart) {
                      respond(false, null, 'Validated cart not found.');
                      return;
                    }

                    const items = (cart.items ?? [])
                      .map((item) => ({
                        merchandiseId: item.merchandiseId.toString(),
                        name: item.name,
                        reference: item.reference,
                        category: item.category,
                        vendorId: item.vendorId.toString(),
                        vendorName: item.vendorName,
                        unitPrice: item.unitPrice,
                        vatRate: normalizeVatRate(item.vatRate),
                        unitPriceIncludingVat: item.unitPriceIncludingVat ?? calculatePriceIncludingVat(item.unitPrice, item.vatRate),
                        quantity: item.quantity,
                        lineTotal: item.lineTotal,
                        lineTotalIncludingVat: item.lineTotalIncludingVat ?? calculateLineTotalIncludingVat(item.lineTotal, item.vatRate),
                        vatCategory: item.vatCategory,
                        vatExemptionReason: item.vatExemptionReason
                      }))
                      .sort((left, right) => {
                        const vendorCompare = left.vendorName.localeCompare(right.vendorName);
                        if (vendorCompare !== 0) {
                          return vendorCompare;
                        }

                        return left.name.localeCompare(right.name);
                      });

                    respond(true, {
                      cart: {
                        key: cart._id.toString(),
                        validatedAt: cart.validatedAt,
                        day: new Date(cart.validatedAt).toISOString().slice(0, 10),
                        items,
                        totalPrice: roundToTwoDecimals(Number(cart.grandTotal ?? 0)),
                        totalPriceIncludingVat: roundToTwoDecimals(Number(cart.grandTotalIncludingVat ?? cart.grandTotal ?? 0)),
                        currency: cart.currency || 'EUR'
                      }
                    });
                    return;
                  }

                  if (action === 'dashboard:client-bills:details') {
                    if (decoded.role !== 'client') {
                      respond(false, null, 'Only clients can access dashboard bill operations.');
                      return;
                    }

                    const result = await getClientBillDetails(
                      currentUserId.toString(),
                      payload.payload?.key
                    );
                    if (!result.ok) {
                      respond(false, null, result.message);
                      return;
                    }

                    respond(true, { bill: result.bill });
                    return;
                  }

                  if (action === 'dashboard:client-bills:comment') {
                    if (decoded.role !== 'client') {
                      respond(false, null, 'Only clients can access dashboard bill operations.');
                      return;
                    }

                    const parsedKey = parseClientVendorDayBillKey(payload.payload?.key);
                    if (!parsedKey) {
                      respond(false, null, 'Invalid bill selection.');
                      return;
                    }

                    const comment = normalizeString(payload.payload?.comment);
                    if (!comment) {
                      respond(false, null, 'Comment is required.');
                      return;
                    }

                    if (comment.length > BILL_CLIENT_COMMENT_MAX_LENGTH) {
                      respond(false, null, `Comment must be at most ${BILL_CLIENT_COMMENT_MAX_LENGTH} characters.`);
                      return;
                    }

                    const dayStart = parseIsoDayUtc(parsedKey.day);
                    if (!dayStart) {
                      respond(false, null, 'Invalid bill day.');
                      return;
                    }

                    const dayEnd = addUtcDays(dayStart, 1);
                    const existingOrder = await ValidatedOrder.findOne({
                      clientId: currentUserId,
                      validatedAt: { $gte: dayStart, $lt: dayEnd },
                      'items.vendorId': new mongoose.Types.ObjectId(parsedKey.vendorId)
                    })
                      .select({ _id: 1 })
                      .lean();

                    if (!existingOrder) {
                      respond(false, null, 'Bill details not found for the selected vendor/day.');
                      return;
                    }

                    const commentPayload = await setBillClientComment({
                      day: parsedKey.day,
                      vendorId: parsedKey.vendorId,
                      clientId: currentUserId.toString(),
                      comment
                    });

                    const clientOrganisation = normalizeString(request.session?.user?.organisation)
                      || normalizeString(request.session?.user?.username)
                      || currentUserId.toString();
                    const vendorMessageSummary = {
                      key: buildVendorDayOrderKey(currentUserId.toString(), parsedKey.day),
                      clientId: currentUserId.toString(),
                      clientOrganisation,
                      day: parsedKey.day,
                      message: commentPayload.clientComment,
                      sentAt: commentPayload.clientCommentSentAt,
                      isRead: false
                    };

                    sendToVendorDashboardConnections(parsedKey.vendorId, () => ({
                      type: 'dashboard:vendor-bill-message:update',
                      message: vendorMessageSummary
                    }));

                    respond(true, {
                      key: buildClientVendorDayBillKey(parsedKey.vendorId, parsedKey.day),
                      ...commentPayload
                    });
                    return;
                  }

                  if (action === 'dashboard:client-bills:settle') {
                    if (decoded.role !== 'client') {
                      respond(false, null, 'Only clients can access dashboard bill operations.');
                      return;
                    }

                    const parsedKey = parseClientVendorDayBillKey(payload.payload?.key);
                    if (!parsedKey) {
                      respond(false, null, 'Invalid bill selection.');
                      return;
                    }

                    const settled = Boolean(payload.payload?.settled);
                    const settlement = await setBillSettlement({
                      day: parsedKey.day,
                      vendorId: parsedKey.vendorId,
                      clientId: currentUserId.toString(),
                      role: 'client',
                      settled
                    });

                    respond(true, {
                      key: buildClientVendorDayBillKey(parsedKey.vendorId, parsedKey.day),
                      settlement
                    });
                    return;
                  }

                  respond(false, null, 'Unknown dashboard action.');
                  return;
                }

                if (action.startsWith('stocks:')) {
                  if (decoded.role !== 'vendor') {
                    respond(false, null, 'Only vendors can access stock operations.');
                    return;
                  }

                  if (action === 'stocks:list') {
                    const items = await Merchandise.find({ vendorId: currentUserId })
                      .sort({ createdAt: -1 })
                      .lean();

                    respond(true, { items: items.map(mapMerchandise) });
                    return;
                  }

                  if (action === 'stocks:create') {
                    const input = sanitizeStockPayload(payload.payload);

                    if (
                      !input.name ||
                      !input.reference ||
                      !input.category ||
                      !Number.isFinite(input.price) ||
                      input.price < 0 ||
                      !Number.isFinite(input.vatRate) ||
                      input.vatRate < 0 ||
                      input.vatRate > 100 ||
                      !Number.isInteger(input.stock) ||
                      input.stock < 0 ||
                      (input.minimumStockThreshold !== null &&
                        (!Number.isInteger(input.minimumStockThreshold) || input.minimumStockThreshold < 0))
                    ) {
                      respond(
                        false,
                        null,
                        'Name, reference, category, non-negative price, VAT rate between 0 and 100, non-negative integer stock and optional non-negative integer minimum threshold are required.'
                      );
                      return;
                    }

                    const merchandise = await Merchandise.create({
                      name: input.name,
                      reference: input.reference,
                      price: input.price,
                      vatRate: input.vatRate,
                      stock: input.stock,
                      minimumStockThreshold: input.minimumStockThreshold,
                      category: input.category,
                      imageFilename: input.imageFilename || '',
                      vendorId: currentUserId
                    });

                    await broadcastOrderCatalogUpsert(
                      merchandise,
                      normalizeString(request.session?.user?.organisation) || normalizeString(request.session?.user?.username) || normalizeString(decoded.username) || currentUserId.toString()
                    );
                    await broadcastStocksSnapshot(currentUserId.toString());

                    respond(true, { item: mapMerchandise(merchandise) });
                    return;
                  }

                  if (action === 'stocks:update') {
                    const input = sanitizeStockPayload(payload.payload);

                    if (!mongoose.Types.ObjectId.isValid(input.id)) {
                      respond(false, null, 'Invalid merchandise id.');
                      return;
                    }

                    if (
                      !input.name ||
                      !input.reference ||
                      !input.category ||
                      !Number.isFinite(input.price) ||
                      input.price < 0 ||
                      !Number.isFinite(input.vatRate) ||
                      input.vatRate < 0 ||
                      input.vatRate > 100 ||
                      !Number.isInteger(input.stock) ||
                      input.stock < 0 ||
                      (input.minimumStockThreshold !== null &&
                        (!Number.isInteger(input.minimumStockThreshold) || input.minimumStockThreshold < 0))
                    ) {
                      respond(
                        false,
                        null,
                        'Name, reference, category, non-negative price, VAT rate between 0 and 100, non-negative integer stock and optional non-negative integer minimum threshold are required.'
                      );
                      return;
                    }

                    const existing = await Merchandise.findOne({
                      _id: input.id,
                      vendorId: currentUserId
                    }).lean();

                    if (!existing) {
                      respond(false, null, 'Merchandise not found.');
                      return;
                    }

                    const updated = await Merchandise.findOneAndUpdate(
                      { _id: input.id, vendorId: currentUserId },
                      {
                        $set: {
                          name: input.name,
                          reference: input.reference,
                          category: input.category,
                          price: input.price,
                          vatRate: input.vatRate,
                          stock: input.stock,
                          minimumStockThreshold: input.minimumStockThreshold,
                          imageFilename: input.imageFilename || ''
                        }
                      },
                      { new: true }
                    ).lean();

                    if (!updated) {
                      respond(false, null, 'Merchandise not found.');
                      return;
                    }

                    await broadcastOrderCatalogUpsert(
                      updated,
                      normalizeString(request.session?.user?.organisation) || normalizeString(request.session?.user?.username) || normalizeString(decoded.username) || currentUserId.toString()
                    );

                    if (existing.price !== updated.price || normalizeVatRate(existing.vatRate) !== normalizeVatRate(updated.vatRate)) {
                      await broadcastOrderPriceUpdate(
                        updated,
                        normalizeString(request.session?.user?.organisation) || normalizeString(request.session?.user?.username) || normalizeString(decoded.username) || currentUserId.toString()
                      );
                    }

                    await broadcastStocksSnapshot(currentUserId.toString());

                    respond(true, { item: mapMerchandise(updated) });
                    return;
                  }

                  if (action === 'stocks:delete') {
                    const input = sanitizeStockPayload(payload.payload);

                    if (!mongoose.Types.ObjectId.isValid(input.id)) {
                      respond(false, null, 'Invalid merchandise id.');
                      return;
                    }

                    const toDelete = await Merchandise.findOne({
                      _id: input.id,
                      vendorId: currentUserId
                    }).lean();

                    if (!toDelete) {
                      respond(false, null, 'Merchandise not found.');
                      return;
                    }

                    const result = await Merchandise.deleteOne({ _id: input.id, vendorId: currentUserId });
                    if (result.deletedCount === 0) {
                      respond(false, null, 'Merchandise not found.');
                      return;
                    }

                    await broadcastOrderCatalogRemove(
                      toDelete._id.toString(),
                      toDelete.vendorId.toString()
                    );
                    await broadcastStocksSnapshot(currentUserId.toString());

                    respond(true, { id: input.id });
                    return;
                  }

                  respond(false, null, 'Unknown stock action.');
                  return;
                }

                if (action.startsWith('order:')) {
                  if (decoded.role !== 'client') {
                    respond(false, null, 'Only clients can access order operations.');
                    return;
                  }

                  const client = await getClientWithVendors(currentUserId);
                  if (!client || client.role !== 'client') {
                    respond(false, null, 'Client account not found.');
                    return;
                  }

                  const vendorIds = (client.vendorIds ?? [])
                    .filter((value) => mongoose.Types.ObjectId.isValid(value))
                    .map((value) => new mongoose.Types.ObjectId(value));
                  const vendorIdSet = new Set(vendorIds.map((value) => value.toString()));
                  const favoriteMerchandiseIds = (client.favoriteMerchandiseIds ?? [])
                    .filter((value) => mongoose.Types.ObjectId.isValid(value))
                    .map((value) => value.toString());

                  if (action === 'order:catalog') {
                    if (vendorIds.length === 0) {
                      respond(true, {
                        categories: [],
                        items: [],
                        favoriteMerchandiseIds,
                        currency: 'EUR'
                      });
                      return;
                    }

                    const vendors = await User.find({ _id: { $in: vendorIds } })
                      .select({ username: 1, organisation: 1 })
                      .lean();
                    const vendorNameById = new Map(
                      vendors.map((vendor) => [
                        vendor._id.toString(),
                        normalizeString(vendor.organisation) || normalizeString(vendor.username) || vendor._id.toString()
                      ])
                    );

                    const merchandises = await Merchandise.find({ vendorId: { $in: vendorIds } })
                      .where('stock').gt(0)
                      .sort({ category: 1, name: 1, price: 1 })
                      .lean();
                    const items = merchandises.map((item) => {
                      const vendorId = item.vendorId.toString();
                      return mapOrderCatalogItem(
                        item,
                        vendorNameById.get(vendorId) ?? vendorId
                      );
                    });
                    const categories = [...new Set(items.map((item) => item.category))].sort();

                    respond(true, {
                      categories,
                      items,
                      favoriteMerchandiseIds,
                      currency: 'EUR'
                    });
                    return;
                  }

                  if (action === 'order:favorites:toggle') {
                    const merchandiseId = normalizeString(payload.payload?.merchandiseId);
                    if (!mongoose.Types.ObjectId.isValid(merchandiseId)) {
                      respond(false, null, 'Invalid merchandise id.');
                      return;
                    }

                    const merchandise = await Merchandise.findById(merchandiseId)
                      .select({ vendorId: 1 })
                      .lean();
                    if (!merchandise) {
                      respond(false, null, 'Merchandise not found.');
                      return;
                    }

                    const merchandiseVendorId = merchandise.vendorId.toString();
                    if (!vendorIdSet.has(merchandiseVendorId)) {
                      respond(false, null, 'This merchandise is not available from your vendors.');
                      return;
                    }

                    const isAlreadyFavorite = favoriteMerchandiseIds.includes(merchandiseId);
                    const merchandiseObjectId = new mongoose.Types.ObjectId(merchandiseId);

                    if (isAlreadyFavorite) {
                      await User.updateOne(
                        { _id: currentUserId },
                        { $pull: { favoriteMerchandiseIds: merchandiseObjectId } }
                      );
                    } else {
                      await User.updateOne(
                        { _id: currentUserId },
                        { $addToSet: { favoriteMerchandiseIds: merchandiseObjectId } }
                      );
                    }

                    const refreshedClient = await User.findById(currentUserId)
                      .select({ favoriteMerchandiseIds: 1 })
                      .lean();
                    const refreshedFavorites = (refreshedClient?.favoriteMerchandiseIds ?? [])
                      .filter((value) => mongoose.Types.ObjectId.isValid(value))
                      .map((value) => value.toString());

                    respond(true, {
                      merchandiseId,
                      isFavorite: !isAlreadyFavorite,
                      favoriteMerchandiseIds: refreshedFavorites
                    });
                    return;
                  }

                  if (action === 'order:cart:get') {
                    const deliveryDate = normalizeString(payload.payload?.deliveryDate);
                    if (!parseIsoDayUtc(deliveryDate)) {
                      respond(false, null, 'Invalid delivery date. Use YYYY-MM-DD.');
                      return;
                    }

                    const cart = await getRedisCart(redisClient, currentUserId.toString(), deliveryDate);
                    respond(true, { cart: mapCart(cart, currentUserId.toString()) });
                    return;
                  }

                  if (action === 'order:cart:set-delivery-date') {
                    const fromDeliveryDate = normalizeString(payload.payload?.fromDeliveryDate);
                    const toDeliveryDate = normalizeString(payload.payload?.toDeliveryDate);
                    if (!parseIsoDayUtc(fromDeliveryDate) || !parseIsoDayUtc(toDeliveryDate)) {
                      respond(false, null, 'Invalid delivery date. Use YYYY-MM-DD.');
                      return;
                    }

                    if (fromDeliveryDate === toDeliveryDate) {
                      const cart = await getRedisCart(redisClient, currentUserId.toString(), toDeliveryDate);
                      respond(true, { cart: mapCart(cart, currentUserId.toString()) });
                      return;
                    }

                    const sourceCart = await getRedisCart(redisClient, currentUserId.toString(), fromDeliveryDate);
                    if (sourceCart.items.length === 0) {
                      const targetCart = await getRedisCart(redisClient, currentUserId.toString(), toDeliveryDate);
                      respond(true, { cart: mapCart(targetCart, currentUserId.toString()) });
                      return;
                    }

                    const targetCart = await getRedisCart(redisClient, currentUserId.toString(), toDeliveryDate);
                    if (targetCart.items.length > 0) {
                      respond(false, null, 'A cart already exists for the selected delivery date.');
                      return;
                    }

                    sourceCart.deliveryDate = toDeliveryDate;
                    await saveRedisCart(redisClient, sourceCart);
                    await clearRedisCart(redisClient, currentUserId.toString(), fromDeliveryDate);
                    respond(true, { cart: mapCart(sourceCart, currentUserId.toString()) });
                    return;
                  }

                  if (action === 'order:cart:add') {
                    const merchandiseId = normalizeString(payload.payload?.merchandiseId);
                    const quantity = Number(payload.payload?.quantity);
                    const deliveryDate = normalizeString(payload.payload?.deliveryDate);

                    if (!mongoose.Types.ObjectId.isValid(merchandiseId)) {
                      respond(false, null, 'Invalid merchandise id.');
                      return;
                    }

                    if (!Number.isInteger(quantity) || quantity < 1) {
                      respond(false, null, 'Quantity must be an integer greater than 0.');
                      return;
                    }

                    if (!parseIsoDayUtc(deliveryDate)) {
                      respond(false, null, 'Invalid delivery date. Use YYYY-MM-DD.');
                      return;
                    }

                    const merchandise = await Merchandise.findById(merchandiseId).lean();
                    if (!merchandise) {
                      respond(false, null, 'Merchandise not found.');
                      return;
                    }

                    if (merchandise.stock <= 0) {
                      respond(false, null, 'This merchandise is currently unavailable.');
                      return;
                    }

                    const merchandiseVendorId = merchandise.vendorId.toString();
                    if (!vendorIdSet.has(merchandiseVendorId)) {
                      respond(false, null, 'This merchandise is not available from your vendors.');
                      return;
                    }

                    const vendor = await User.findById(merchandise.vendorId)
                      .select({ username: 1, organisation: 1 })
                      .lean();
                    const vendorName = normalizeString(vendor?.organisation) || normalizeString(vendor?.username) || merchandiseVendorId;

                    const cart = await getRedisCart(redisClient, currentUserId.toString(), deliveryDate);

                    const existingItem = cart.items.find(
                      (item) => item.merchandiseId.toString() === merchandiseId
                    );

                    if (existingItem) {
                      const nextQuantity = existingItem.quantity + quantity;
                      if (nextQuantity > merchandise.stock) {
                        respond(false, null, `Only ${merchandise.stock} units are currently available.`);
                        return;
                      }

                      const frozenUnitPrice =
                        Number.isFinite(existingItem.unitPrice) && existingItem.unitPrice >= 0
                          ? existingItem.unitPrice
                          : merchandise.price;

                      const frozenVatRate = normalizeVatRate(existingItem.vatRate ?? merchandise.vatRate);

                      existingItem.name = merchandise.name;
                      existingItem.reference = merchandise.reference;
                      existingItem.category = merchandise.category;
                      existingItem.vendorId = merchandise.vendorId.toString();
                      existingItem.vendorName = vendorName;
                      existingItem.unitPrice = frozenUnitPrice;
                      existingItem.vatRate = frozenVatRate;
                      existingItem.unitPriceIncludingVat = calculatePriceIncludingVat(frozenUnitPrice, frozenVatRate);
                      existingItem.quantity = nextQuantity;
                      existingItem.lineTotal = roundToTwoDecimals(
                        frozenUnitPrice * existingItem.quantity
                      );
                      existingItem.lineTotalIncludingVat = calculateLineTotalIncludingVat(
                        existingItem.lineTotal,
                        frozenVatRate
                      );
                    } else {
                      if (quantity > merchandise.stock) {
                        respond(false, null, `Only ${merchandise.stock} units are currently available.`);
                        return;
                      }
                      const vatRate = normalizeVatRate(merchandise.vatRate);
                      const lineTotal = roundToTwoDecimals(merchandise.price * quantity);

                      cart.items.push({
                        merchandiseId: merchandise._id.toString(),
                        name: merchandise.name,
                        reference: merchandise.reference,
                        category: merchandise.category,
                        vendorId: merchandise.vendorId.toString(),
                        vendorName,
                        unitPrice: merchandise.price,
                        vatRate,
                        unitPriceIncludingVat: calculatePriceIncludingVat(merchandise.price, vatRate),
                        quantity,
                        lineTotal,
                        lineTotalIncludingVat: calculateLineTotalIncludingVat(lineTotal, vatRate)
                      });
                    }

                    await saveRedisCart(redisClient, cart);
                    respond(true, { cart: mapCart(cart, currentUserId.toString()) });
                    return;
                  }

                  if (action === 'order:cart:update') {
                    const merchandiseId = normalizeString(payload.payload?.merchandiseId);
                    const quantity = Number(payload.payload?.quantity);
                    const deliveryDate = normalizeString(payload.payload?.deliveryDate);

                    if (!mongoose.Types.ObjectId.isValid(merchandiseId)) {
                      respond(false, null, 'Invalid merchandise id.');
                      return;
                    }

                    if (!Number.isInteger(quantity) || quantity < 1) {
                      respond(false, null, 'Quantity must be an integer greater than 0.');
                      return;
                    }

                    if (!parseIsoDayUtc(deliveryDate)) {
                      respond(false, null, 'Invalid delivery date. Use YYYY-MM-DD.');
                      return;
                    }

                    const cart = await getRedisCart(redisClient, currentUserId.toString(), deliveryDate);

                    const item = cart.items.find(
                      (cartItem) => cartItem.merchandiseId.toString() === merchandiseId
                    );
                    if (!item) {
                      respond(false, null, 'Cart item not found.');
                      return;
                    }

                    const merchandise = await Merchandise.findById(merchandiseId).lean();
                    if (!merchandise || merchandise.stock <= 0) {
                      respond(false, null, 'This merchandise is currently unavailable.');
                      return;
                    }

                    if (quantity > merchandise.stock) {
                      respond(false, null, `Only ${merchandise.stock} units are currently available.`);
                      return;
                    }

                    const frozenUnitPrice =
                      Number.isFinite(item.unitPrice) && item.unitPrice >= 0
                        ? item.unitPrice
                        : merchandise.price;

                    const frozenVatRate = normalizeVatRate(item.vatRate ?? merchandise.vatRate);

                    item.quantity = quantity;
                    item.unitPrice = frozenUnitPrice;
                    item.vatRate = frozenVatRate;
                    item.unitPriceIncludingVat = calculatePriceIncludingVat(frozenUnitPrice, frozenVatRate);
                    item.lineTotal = roundToTwoDecimals(frozenUnitPrice * quantity);
                    item.lineTotalIncludingVat = calculateLineTotalIncludingVat(item.lineTotal, frozenVatRate);
                    await saveRedisCart(redisClient, cart);

                    respond(true, { cart: mapCart(cart, currentUserId.toString()) });
                    return;
                  }

                  if (action === 'order:cart:remove') {
                    const merchandiseId = normalizeString(payload.payload?.merchandiseId);
                    const deliveryDate = normalizeString(payload.payload?.deliveryDate);

                    if (!mongoose.Types.ObjectId.isValid(merchandiseId)) {
                      respond(false, null, 'Invalid merchandise id.');
                      return;
                    }

                    if (!parseIsoDayUtc(deliveryDate)) {
                      respond(false, null, 'Invalid delivery date. Use YYYY-MM-DD.');
                      return;
                    }

                    const cart = await getRedisCart(redisClient, currentUserId.toString(), deliveryDate);
                    if (cart.items.length === 0) {
                      respond(true, { cart: mapCart(cart, currentUserId.toString()) });
                      return;
                    }

                    const initialLength = cart.items.length;
                    cart.items = cart.items.filter(
                      (cartItem) => cartItem.merchandiseId.toString() !== merchandiseId
                    );

                    if (cart.items.length === initialLength) {
                      respond(false, null, 'Cart item not found.');
                      return;
                    }

                    await saveRedisCart(redisClient, cart);
                    respond(true, { cart: mapCart(cart, currentUserId.toString()) });
                    return;
                  }

                  if (action === 'order:cart:validate') {
                    const groupBy =
                      payload.payload?.groupBy === 'category' ? 'category' : 'vendor';
                    const deliveryDate = normalizeString(payload.payload?.deliveryDate);
                    const deliveryDateUtc = parseIsoDayUtc(deliveryDate);
                    if (!deliveryDateUtc) {
                      respond(false, null, 'Invalid delivery date. Use YYYY-MM-DD.');
                      return;
                    }

                    const cart = await getRedisCart(redisClient, currentUserId.toString(), deliveryDate);
                    if (!cart || cart.items.length === 0) {
                      respond(false, null, 'Cart is empty.');
                      return;
                    }

                    const merchandiseIds = cart.items.map((item) => item.merchandiseId);
                    const merchandises = await Merchandise.find({
                      _id: { $in: merchandiseIds }
                    }).lean();
                    const merchandiseById = new Map(
                      merchandises.map((merchandise) => [merchandise._id.toString(), merchandise])
                    );

                    const totalsSourceItems = [];
                    const validatedOrderItems = [];

                    for (const cartItem of cart.items) {
                      const merchandise = merchandiseById.get(cartItem.merchandiseId.toString());
                      if (!merchandise) {
                        respond(false, null, `Merchandise ${cartItem.reference} no longer exists.`);
                        return;
                      }

                      const vendorId = merchandise.vendorId.toString();
                      if (!vendorIdSet.has(vendorId)) {
                        respond(false, null, `Merchandise ${cartItem.reference} is no longer available from your vendors.`);
                        return;
                      }

                      if (merchandise.stock < cartItem.quantity) {
                        respond(false, null, `Insufficient stock for ${cartItem.reference}. Available: ${merchandise.stock}.`);
                        return;
                      }

                      const effectiveUnitPrice =
                        Number.isFinite(cartItem.unitPrice) && cartItem.unitPrice >= 0
                          ? cartItem.unitPrice
                          : merchandise.price;
                      const effectiveVatRate = normalizeVatRate(cartItem.vatRate ?? merchandise.vatRate);
                      const lineTotal = roundToTwoDecimals(effectiveUnitPrice * cartItem.quantity);
                      const unitPriceIncludingVat = calculatePriceIncludingVat(effectiveUnitPrice, effectiveVatRate);
                      const lineTotalIncludingVat = calculateLineTotalIncludingVat(lineTotal, effectiveVatRate);
                      const vendorName = cartItem.vendorName || merchandise.vendorId.toString();

                      totalsSourceItems.push({
                        vendorId,
                        vendorName,
                        category: merchandise.category,
                        quantity: cartItem.quantity,
                        lineTotal,
                        lineTotalIncludingVat
                      });

                      validatedOrderItems.push({
                        merchandiseId: merchandise._id,
                        name: merchandise.name,
                        reference: merchandise.reference,
                        category: merchandise.category,
                        vendorId: merchandise.vendorId,
                        vendorName,
                        unitPrice: effectiveUnitPrice,
                        vatRate: effectiveVatRate,
                        unitPriceIncludingVat,
                        quantity: cartItem.quantity,
                        lineTotal,
                        lineTotalIncludingVat,
                        vatCategory: getVatCategory(effectiveVatRate),
                        vatExemptionReason: getVatExemptionReason(effectiveVatRate)
                      });
                    }

                    const cartGrandTotal = roundToTwoDecimals(
                      totalsSourceItems.reduce((sum, item) => sum + item.lineTotal, 0)
                    );
                    const cartGrandTotalIncludingVat = roundToTwoDecimals(
                      totalsSourceItems.reduce((sum, item) => sum + item.lineTotalIncludingVat, 0)
                    );
                    const clientUsername =
                      normalizeString(decoded.username) || currentUserId.toString();

                    const validatedOrder = await ValidatedOrder.create({
                      clientId: currentUserId,
                      clientUsername,
                      validatedAt: new Date(),
                      deliveryDate: deliveryDateUtc,
                      currency: 'EUR',
                      items: validatedOrderItems,
                      grandTotal: cartGrandTotal,
                      grandTotalIncludingVat: cartGrandTotalIncludingVat
                    });

                    const decrementedStocks = [];
                    const updatedMerchandises = [];

                    try {
                      for (const cartItem of cart.items) {
                        const quantityToDecrement = Number(cartItem.quantity);
                        const updatedMerchandise = await Merchandise.findOneAndUpdate(
                          {
                            _id: cartItem.merchandiseId,
                            stock: { $gte: quantityToDecrement }
                          },
                          {
                            $inc: { stock: -quantityToDecrement }
                          },
                          { new: true }
                        ).lean();

                        if (!updatedMerchandise) {
                          throw new Error('STOCK_CHANGED_DURING_VALIDATION');
                        }

                        decrementedStocks.push({
                          merchandiseId: cartItem.merchandiseId,
                          quantity: quantityToDecrement
                        });
                        updatedMerchandises.push(updatedMerchandise);
                      }
                    } catch (error) {
                      if (decrementedStocks.length > 0) {
                        await Merchandise.bulkWrite(
                          decrementedStocks.map((entry) => ({
                            updateOne: {
                              filter: { _id: entry.merchandiseId },
                              update: { $inc: { stock: entry.quantity } }
                            }
                          })),
                          { ordered: false }
                        ).catch(() => {});
                      }

                      await ValidatedOrder.deleteOne({ _id: validatedOrder._id }).catch(() => {});
                      if (error instanceof Error && error.message === 'STOCK_CHANGED_DURING_VALIDATION') {
                        respond(false, null, 'Stock changed while validating. Please refresh your cart.');
                        return;
                      }

                      respond(false, null, 'Stock update failed while validating the cart.');
                      return;
                    }

                    const vendorNameById = new Map(
                      validatedOrderItems.map((item) => [item.vendorId.toString(), item.vendorName])
                    );

                    for (const merchandise of updatedMerchandises) {
                      const vendorId = merchandise.vendorId.toString();
                      const vendorName =
                        vendorNameById.get(vendorId) ?? vendorId;
                      await broadcastOrderCatalogUpsert(merchandise, vendorName);
                    }

                    const stockVendorIds = new Set(
                      updatedMerchandises.map((merchandise) => merchandise.vendorId.toString())
                    );
                    for (const vendorId of stockVendorIds) {
                      await broadcastStocksSnapshot(vendorId);
                    }

                    await clearRedisCart(redisClient, currentUserId.toString(), deliveryDate);
                    cart.items = [];

                    const totalsMap = new Map();

                    for (const item of totalsSourceItems) {
                      const key = groupBy === 'vendor' ? item.vendorId : item.category;
                      const label =
                        groupBy === 'vendor' ? item.vendorName : item.category;
                      const currentTotal = totalsMap.get(key) ?? 0;
                      const currentTotalIncludingVat = totalsMap.get(`${key}:includingVat`) ?? 0;
                      totalsMap.set(
                        key,
                        roundToTwoDecimals(currentTotal + item.lineTotal)
                      );
                      totalsMap.set(
                        `${key}:includingVat`,
                        roundToTwoDecimals(currentTotalIncludingVat + item.lineTotalIncludingVat)
                      );
                      if (!totalsMap.get(`${key}:label`)) {
                        totalsMap.set(`${key}:label`, label);
                      }
                    }

                    const totals = [...totalsMap.entries()]
                      .filter(([key]) => !String(key).endsWith(':label') && !String(key).endsWith(':includingVat'))
                      .map(([key, total]) => ({
                        key,
                        label: totalsMap.get(`${key}:label`) ?? key,
                        total,
                        totalIncludingVat: totalsMap.get(`${key}:includingVat`) ?? total
                      }))
                      .sort((a, b) => String(a.label).localeCompare(String(b.label)));

                    respond(true, {
                      groupBy,
                      totals,
                      grandTotal: cartGrandTotal,
                      grandTotalIncludingVat: cartGrandTotalIncludingVat,
                      currency: 'EUR',
                      cart: mapCart(cart, currentUserId.toString())
                    });
                    return;
                  }

                  respond(false, null, 'Unknown order action.');
                  return;
                }

                respond(false, null, 'Unknown websocket action.');
              } catch (error) {
                if (error?.code === 11000) {
                  respond(false, null, 'A merchandise with this reference already exists for this vendor.');
                  return;
                }

                const message = error instanceof Error && error.message
                  ? error.message
                  : 'Websocket operation failed.';
                request.log.error({ err: error, action: payload.action }, 'Websocket operation failed');
                respond(false, null, message);
              }
            })();
            return;
          }

          socket.send(JSON.stringify({ type: 'echo', payload }));
        } catch {
          socket.send(JSON.stringify({ type: 'error', message: 'Invalid websocket payload.' }));
        }
      });
    } catch {
      socket.close(4002, 'Invalid token');
    }
  });
}
