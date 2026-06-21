import { randomInt } from 'node:crypto';

export function registerManagementRoutes(app, context, deps) {
  const {
    addBillPenaltyLine,
    addUtcDays,
    bcrypt,
    BILL_PENALTY_MAX_PERCENT,
    BILL_PENALTY_MIN_PERCENT,
    Bill,
    buildUnpaidReminderKey,
    buildValidatedAtFilter,
    buildVendorDayOrderKey,
    generateBillsForDay,
    getAppStyleProfileSetting,
    getBillOverdueDaysSetting,
    getOrCreatePersistedBillUuid,
    getUserLogoUrl,
    hasDangerousInputKeys,
    listClientUnpaidReminders,
    mapAdminManagedUser,
    mapPendingUser,
    mongoose,
    normalizeAppStyleProfile,
    normalizeBillOverdueDays,
    normalizeString,
    parseIsoDayUtc,
    parseSiretValue,
    requireAdminApi,
    requireClientApi,
    requireVendorApi,
    roundToTwoDecimals,
    getRungisBillingSettings,
    getProcessedRungisBillMonths,
    generateRungisBillsForPreviousMonth,
    hasProcessedRungisBillMonth,
    markRungisBillPaid,
    persistProcessedRungisBillMonth,
    searchUnpaidRungisBills,
    setAppStyleProfileSetting,
    setBillOverdueDaysSetting,
    setRungisBillingSettings,
    RungisBill,
    generateAdminUserUniqueId: generateAdminUserUniqueIdOverride,
    upsertUnpaidReminder,
    User,
    ValidatedOrder
  } = deps;
  const {
    assignVendorClientAssociation,
    broadcastClientUnpaidReminders,
    redisClient,
    removeVendorClientAssociation
  } = context;

  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const adminUserRoles = new Set(['vendor', 'client', 'admin']);
  const protectedAdminUserFields = new Set([
    '_id',
    'id',
    'uniqueId',
    'passwordHash',
    'passkeys',
    'vendorIds',
    'clientIds',
    'favoriteMerchandiseIds',
    'createdAt',
    'updatedAt'
  ]);
  const adminUserSelect = {
    role: 1,
    username: 1,
    uniqueId: 1,
    firstName: 1,
    lastName: 1,
    organisation: 1,
    city: 1,
    zipcode: 1,
    email: 1,
    physicalAddress: 1,
    phoneNumber: 1,
    businessDescription: 1,
    vatId: 1,
    billMentions: 1,
    logoFilename: 1,
    businessRegistrationId: 1,
    isActive: 1,
    createdAt: 1,
    updatedAt: 1
  };
  const requiredAdminUserFields = [
    'username',
    'firstName',
    'lastName',
    'organisation',
    'city',
    'zipcode',
    'email',
    'physicalAddress',
    'phoneNumber',
    'businessRegistrationId'
  ];

  const hasProtectedAdminUserFields = (payload) => Object.keys(payload ?? {}).some((field) => protectedAdminUserFields.has(field));
  const addFieldError = (errors, field, message) => {
    errors[field] = message;
  };

  const normalizeEmail = (value) => normalizeString(value).toLowerCase();
  const normalizeOptionalAdminString = (value) => normalizeString(value);

  function buildAdminUserValidation(payload, mode) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, code: 400, message: 'User form payload is required.', fieldErrors: {} };
    }

    if (hasDangerousInputKeys?.(payload) || hasProtectedAdminUserFields(payload)) {
      return { ok: false, code: 400, message: 'User form contains unsupported fields.', fieldErrors: {} };
    }

    const fieldErrors = {};
    const role = normalizeString(payload.role).toLowerCase();
    if (!adminUserRoles.has(role)) {
      addFieldError(fieldErrors, 'role', 'Role must be vendor, client, or admin.');
    }

    const data = {
      role,
      username: normalizeString(payload.username).toLowerCase(),
      firstName: normalizeString(payload.firstName),
      lastName: normalizeString(payload.lastName),
      organisation: normalizeString(payload.organisation),
      city: normalizeString(payload.city),
      zipcode: normalizeString(payload.zipcode),
      email: normalizeEmail(payload.email),
      physicalAddress: normalizeString(payload.physicalAddress),
      phoneNumber: normalizeString(payload.phoneNumber),
      businessDescription: normalizeOptionalAdminString(payload.businessDescription),
      vatId: normalizeOptionalAdminString(payload.vatId).toUpperCase(),
      billMentions: normalizeOptionalAdminString(payload.billMentions),
      logoFilename: normalizeOptionalAdminString(payload.logoFilename)
    };

    for (const field of requiredAdminUserFields) {
      if (field !== 'businessRegistrationId' && !data[field]) {
        addFieldError(fieldErrors, field, 'This field is required.');
      }
    }

    const siretResult = parseSiretValue(payload.businessRegistrationId);
    if (!siretResult.ok) {
      addFieldError(fieldErrors, 'businessRegistrationId', siretResult.message);
    } else {
      data.businessRegistrationId = siretResult.value;
    }

    if (data.vatId && data.vatId.length !== 13) {
      addFieldError(fieldErrors, 'vatId', 'VAT ID must be exactly 13 characters.');
    }

    if (data.businessDescription.length > 2000) {
      addFieldError(fieldErrors, 'businessDescription', 'Business description is limited to 2000 characters.');
    }

    if (data.billMentions.length > 2000) {
      addFieldError(fieldErrors, 'billMentions', 'Bill mentions are limited to 2000 characters.');
    }

    const password = typeof payload.password === 'string' ? payload.password : '';
    if (mode === 'create' && password.length === 0) {
      addFieldError(fieldErrors, 'password', 'Password is required.');
    }
    if (password && password.length < 8) {
      addFieldError(fieldErrors, 'password', 'Password must be at least 8 characters.');
    }
    if (password) {
      data.password = password;
    }

    if (mode === 'update') {
      if (typeof payload.isActive !== 'boolean') {
        addFieldError(fieldErrors, 'isActive', 'Active status must be a boolean.');
      } else {
        data.isActive = payload.isActive;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, code: 400, message: 'User form contains invalid fields.', fieldErrors };
    }

    return { ok: true, data };
  }

  async function findDuplicateAdminUser(data, excludeId = '') {
    const duplicateConditions = [
      { username: data.username },
      { email: data.email }
    ];

    const filter = { $or: duplicateConditions };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }

    const duplicate = await User.findOne(filter)
      .select({ username: 1, email: 1 })
      .lean();
    if (!duplicate) {
      return null;
    }

    if (normalizeString(duplicate.username).toLowerCase() === data.username) {
      return { field: 'username', message: 'Username is already used.' };
    }
    if (normalizeString(duplicate.email).toLowerCase() === data.email) {
      return { field: 'email', message: 'Email is already used.' };
    }

    return { field: 'username', message: 'User already exists.' };
  }

  function duplicateResponse(reply, duplicate) {
    return reply.code(409).send({
      ok: false,
      message: duplicate.message,
      fieldErrors: { [duplicate.field]: duplicate.message }
    });
  }

  const generateUniqueIdCandidate = () => String(randomInt(0, 100000)).padStart(5, '0');
  const isDuplicateUniqueIdError = (error) => {
    return error?.code === 11000 && (error.keyPattern?.uniqueId || Object.prototype.hasOwnProperty.call(error.keyValue ?? {}, 'uniqueId'));
  };

  async function adminUserUniqueIdExists(uniqueId) {
    const existing = await User.findOne({ uniqueId })
      .select({ _id: 1 })
      .lean();
    return Boolean(existing);
  }

  async function generateAdminUserUniqueId() {
    if (typeof generateAdminUserUniqueIdOverride === 'function') {
      const generated = normalizeString(await generateAdminUserUniqueIdOverride());
      if (!/^\d{5}$/.test(generated)) {
        throw new Error('Generated user unique ID must be exactly 5 digits.');
      }
      return generated;
    }

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = generateUniqueIdCandidate();
      // MongoDB's unique index is the final authority; this preflight keeps normal
      // operation deterministic and avoids avoidable duplicate-key retries.
      if (!(await adminUserUniqueIdExists(candidate))) {
        return candidate;
      }
    }

    throw new Error('Unable to allocate a unique user identifier.');
  }

  async function createAdminUserWithGeneratedUniqueId(userData) {
    let lastDuplicateError = null;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const uniqueId = await generateAdminUserUniqueId();
      try {
        return await User.create({
          ...userData,
          uniqueId
        });
      } catch (error) {
        if (!isDuplicateUniqueIdError(error)) {
          throw error;
        }
        lastDuplicateError = error;
      }
    }

    throw lastDuplicateError ?? new Error('Unable to allocate a unique user identifier.');
  }

  app.get('/api/admin/pending-users', { preHandler: requireAdminApi }, async (_request, reply) => {
    const users = await User.find({ isActive: false, role: { $in: ['vendor', 'client'] } })
      .sort({ createdAt: 1 })
      .lean();

    return reply.send({
      ok: true,
      users: users.map(mapPendingUser)
    });
  });

  app.get('/api/admin/users/search', { preHandler: requireAdminApi }, async (request, reply) => {
    const organizationPrefix = normalizeString(request.query?.organization ?? request.query?.organisation);
    if (!organizationPrefix) {
      return reply.send({ ok: true, users: [] });
    }

    if (organizationPrefix.length > 100) {
      return reply.code(400).send({ ok: false, message: 'Organization search is limited to 100 characters.' });
    }

    const users = await User.find({
      role: { $in: ['vendor', 'client', 'admin'] },
      organisation: { $regex: `^${escapeRegex(organizationPrefix)}`, $options: 'i' }
    })
      .sort({ organisation: 1, username: 1 })
      .limit(25)
      .select(adminUserSelect)
      .lean();

    return reply.send({
      ok: true,
      users: users.map(mapAdminManagedUser)
    });
  });


  app.post('/api/admin/users', { preHandler: requireAdminApi }, async (request, reply) => {
    const validation = buildAdminUserValidation(request.body, 'create');
    if (!validation.ok) {
      return reply.code(validation.code).send({ ok: false, message: validation.message, fieldErrors: validation.fieldErrors });
    }

    const duplicate = await findDuplicateAdminUser(validation.data);
    if (duplicate) {
      return duplicateResponse(reply, duplicate);
    }

    const { password, ...userData } = validation.data;
    const passwordHash = await bcrypt.hash(password, 12);
    const createdUser = await createAdminUserWithGeneratedUniqueId({
      ...userData,
      passwordHash,
      isActive: false
    });

    return reply.code(201).send({
      ok: true,
      user: mapAdminManagedUser(createdUser),
      message: 'User created.'
    });
  });

  app.get('/api/admin/users/:id', { preHandler: requireAdminApi }, async (request, reply) => {
    const id = normalizeString(request.params?.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.code(400).send({ ok: false, message: 'Invalid user id.' });
    }

    const user = await User.findById(id)
      .select(adminUserSelect)
      .lean();
    if (!user) {
      return reply.code(404).send({ ok: false, message: 'User not found.' });
    }

    return reply.send({ ok: true, user: mapAdminManagedUser(user) });
  });

  app.put('/api/admin/users/:id', { preHandler: requireAdminApi }, async (request, reply) => {
    const id = normalizeString(request.params?.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.code(400).send({ ok: false, message: 'Invalid user id.' });
    }

    const existingUser = await User.findById(id)
      .select({ _id: 1 })
      .lean();
    if (!existingUser) {
      return reply.code(404).send({ ok: false, message: 'User not found.' });
    }

    const validation = buildAdminUserValidation(request.body, 'update');
    if (!validation.ok) {
      return reply.code(validation.code).send({ ok: false, message: validation.message, fieldErrors: validation.fieldErrors });
    }

    const duplicate = await findDuplicateAdminUser(validation.data, id);
    if (duplicate) {
      return duplicateResponse(reply, duplicate);
    }

    const { password, ...updateData } = validation.data;
    const update = { $set: updateData };
    if (password) {
      update.$set.passwordHash = await bcrypt.hash(password, 12);
    }

    const updatedUser = await User.findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .select(adminUserSelect)
      .lean();

    if (!updatedUser) {
      return reply.code(404).send({ ok: false, message: 'User not found.' });
    }

    return reply.send({
      ok: true,
      user: mapAdminManagedUser(updatedUser),
      message: 'User updated.'
    });
  });

  app.get('/api/admin/associations', { preHandler: requireAdminApi }, async (_request, reply) => {
    const [clients, vendors] = await Promise.all([
      User.find({ role: 'client', isActive: true })
        .sort({ username: 1 })
        .select({ username: 1, organisation: 1, vendorIds: 1, isActive: 1 })
        .lean(),
      User.find({ role: 'vendor', isActive: true })
        .sort({ username: 1 })
        .select({ username: 1, organisation: 1, clientIds: 1, isActive: 1 })
        .lean()
    ]);

    return reply.send({
      ok: true,
      clients: clients.map((client) => ({
        id: client._id.toString(),
        username: client.username,
        organisation: client.organisation,
        isActive: Boolean(client.isActive),
        vendorIds: (client.vendorIds ?? []).map((vendorId) => vendorId.toString())
      })),
      vendors: vendors.map((vendor) => ({
        id: vendor._id.toString(),
        username: vendor.username,
        organisation: vendor.organisation,
        isActive: Boolean(vendor.isActive),
        clientIds: (vendor.clientIds ?? []).map((clientId) => clientId.toString())
      }))
    });
  });

  app.get('/api/admin/settings/bill-overdue-days', { preHandler: requireAdminApi }, async (_request, reply) => {
    const billOverdueDays = await getBillOverdueDaysSetting();
    return reply.send({ ok: true, billOverdueDays });
  });

  app.put('/api/admin/settings/bill-overdue-days', { preHandler: requireAdminApi }, async (request, reply) => {
    const billOverdueDays = normalizeBillOverdueDays(request.body?.billOverdueDays);
    if (!billOverdueDays) {
      return reply.code(400).send({ ok: false, message: 'Bill overdue days must be an integer between 1 and 3650.' });
    }

    setBillOverdueDaysSetting(billOverdueDays);
    return reply.send({ ok: true, billOverdueDays, message: 'Bill overdue days updated.' });
  });

  app.get('/api/admin/settings/app-style-profile', { preHandler: requireAdminApi }, async (_request, reply) => {
    const appStyleProfile = await getAppStyleProfileSetting();
    return reply.send({ ok: true, appStyleProfile });
  });

  app.put('/api/admin/settings/app-style-profile', { preHandler: requireAdminApi }, async (request, reply) => {
    const appStyleProfile = normalizeAppStyleProfile(request.body?.appStyleProfile);
    if (!appStyleProfile) {
      return reply.code(400).send({ ok: false, message: 'App style profile must be either primary or secondary.' });
    }

    setAppStyleProfileSetting(appStyleProfile);
    return reply.send({
      ok: true,
      appStyleProfile,
      message: `Application style profile updated to ${appStyleProfile}.`
    });
  });

  app.get('/api/admin/settings/rungis-billing', { preHandler: requireAdminApi }, async (_request, reply) => {
    const settings = getRungisBillingSettings();
    return reply.send({ ok: true, ...settings });
  });

  app.put('/api/admin/settings/rungis-billing', { preHandler: requireAdminApi }, async (request, reply) => {
    const settings = setRungisBillingSettings(request.body);
    if (!settings) {
      return reply.code(400).send({ ok: false, message: 'Rungis fee and VAT rates must be percentages between 0 and 100.' });
    }
    return reply.send({ ok: true, ...settings, message: 'Rungis billing settings updated.' });
  });

  app.post('/api/admin/rungis-bills/send', { preHandler: requireAdminApi }, async (request, reply) => {
    try {
      const month = normalizeString(request.body?.month);
      if (hasProcessedRungisBillMonth(month)) {
        return reply.code(409).send({
          ok: false,
          month,
          processedMonths: getProcessedRungisBillMonths(),
          message: `Rungis bills for ${month} have already been processed.`
        });
      }
      const result = await generateRungisBillsForPreviousMonth({
        RungisBill,
        User,
        ValidatedOrder,
        adminUserId: request.session.user.id,
        settings: getRungisBillingSettings(),
        month
      });
      const processedMonths = persistProcessedRungisBillMonth(result.monthKey);
      return reply.send({
        ok: true,
        ...result,
        processedMonths,
        message: `Rungis bills completed for ${result.monthKey}: ${result.generated} generated, ${result.updated} updated, ${result.skippedPaid} paid skipped.`
      });
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      return reply.code(statusCode).send({ ok: false, message: error?.message ?? 'Rungis bill generation failed.' });
    }
  });

  app.get('/api/admin/rungis-bills', { preHandler: requireAdminApi }, async (request, reply) => {
    try {
      const rows = await searchUnpaidRungisBills({
        RungisBill,
        month: request.query?.month,
        organization: request.query?.organization
      });
      return reply.send({ ok: true, rows });
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      return reply.code(statusCode).send({ ok: false, message: error?.message ?? 'Rungis bill search failed.' });
    }
  });

  app.patch('/api/admin/rungis-bills/:billId/paid', { preHandler: requireAdminApi }, async (request, reply) => {
    try {
      const result = await markRungisBillPaid({
        RungisBill,
        billId: request.params?.billId,
        adminUserId: request.session.user.id
      });
      return reply.send({
        ok: true,
        alreadyPaid: result.alreadyPaid,
        bill: result.bill,
        message: result.alreadyPaid ? 'Rungis bill was already paid.' : 'Rungis bill marked paid.'
      });
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      return reply.code(statusCode).send({ ok: false, message: error?.message ?? 'Unable to mark Rungis bill paid.' });
    }
  });

  app.post('/api/admin/bills/run-daily-generation', { preHandler: requireAdminApi }, async (request, reply) => {
    const day = normalizeString(request.body?.day);
    const parsedDay = parseIsoDayUtc(day);
    if (!parsedDay) {
      return reply.code(400).send({ ok: false, message: 'Bill generation day must be a valid ISO date (YYYY-MM-DD).' });
    }

    const result = await generateBillsForDay(day);
    return reply.send({
      ok: true,
      day: result.day,
      upserted: Number(result.upserted ?? 0),
      appliedRefundCount: Number(result.appliedRefundCount ?? 0),
      message: `Daily bill generation completed for ${result.day}. ${Number(result.upserted ?? 0)} bill(s) updated.`
    });
  });

  app.get('/api/admin/statistics/activated-orders', { preHandler: requireAdminApi }, async (request, reply) => {
    const fromDate = normalizeString(request.query?.fromDate);
    const toDate = normalizeString(request.query?.toDate);
    const dateFilterResult = buildValidatedAtFilter(fromDate, toDate);
    if (!dateFilterResult.ok) {
      return reply.code(400).send({ ok: false, message: dateFilterResult.message });
    }

    const matchFilter = {};
    if (Object.keys(dateFilterResult.filter).length > 0) {
      matchFilter.validatedAt = dateFilterResult.filter;
    }

    const rows = await ValidatedOrder.aggregate([
      { $match: matchFilter },
      {
        $addFields: {
          orderAmount: {
            $ifNull: ['$grandTotal', { $sum: '$items.lineTotal' }]
          }
        }
      },
      {
        $group: {
          _id: {
            day: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$validatedAt',
                timezone: 'UTC'
              }
            }
          },
          orderCount: { $sum: 1 },
          totalAmount: { $sum: '$orderAmount' }
        }
      },
      { $sort: { '_id.day': 1 } }
    ]);

    return reply.send({
      ok: true,
      rows: rows.map((row) => ({
        day: row._id.day,
        orderCount: Number(row.orderCount ?? 0),
        totalAmount: roundToTwoDecimals(Number(row.totalAmount ?? 0)),
        currency: 'EUR'
      }))
    });
  });

  app.get('/api/vendor/statistics/sales-by-category', { preHandler: requireVendorApi }, async (request, reply) => {
    const currentUserId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const fromDate = normalizeString(request.query?.fromDate);
    const toDate = normalizeString(request.query?.toDate);
    const dateFilterResult = buildValidatedAtFilter(fromDate, toDate);
    if (!dateFilterResult.ok) {
      return reply.code(400).send({ ok: false, message: dateFilterResult.message });
    }

    const matchFilter = {
      'items.vendorId': new mongoose.Types.ObjectId(currentUserId)
    };
    if (Object.keys(dateFilterResult.filter).length > 0) {
      matchFilter.validatedAt = dateFilterResult.filter;
    }

    const rows = await ValidatedOrder.aggregate([
      { $match: matchFilter },
      { $unwind: '$items' },
      { $match: { 'items.vendorId': new mongoose.Types.ObjectId(currentUserId) } },
      {
        $group: {
          _id: '$items.category',
          totalAmount: { $sum: '$items.lineTotal' }
        }
      },
      { $sort: { totalAmount: -1, _id: 1 } }
    ]);

    return reply.send({
      ok: true,
      rows: rows.map((row) => ({
        category: normalizeString(row._id) || 'Uncategorized',
        totalAmount: roundToTwoDecimals(Number(row.totalAmount ?? 0)),
        currency: 'EUR'
      }))
    });
  });

  app.get('/api/vendor/statistics/sales-by-client', { preHandler: requireVendorApi }, async (request, reply) => {
    const currentUserId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const fromDate = normalizeString(request.query?.fromDate);
    const toDate = normalizeString(request.query?.toDate);
    const dateFilterResult = buildValidatedAtFilter(fromDate, toDate);
    if (!dateFilterResult.ok) {
      return reply.code(400).send({ ok: false, message: dateFilterResult.message });
    }

    const vendorObjectId = new mongoose.Types.ObjectId(currentUserId);
    const matchFilter = {
      'items.vendorId': vendorObjectId
    };
    if (Object.keys(dateFilterResult.filter).length > 0) {
      matchFilter.validatedAt = dateFilterResult.filter;
    }

    const rows = await ValidatedOrder.aggregate([
      { $match: matchFilter },
      { $unwind: '$items' },
      { $match: { 'items.vendorId': vendorObjectId } },
      {
        $group: {
          _id: {
            clientId: '$clientId',
            clientUsername: '$clientUsername'
          },
          totalAmount: { $sum: '$items.lineTotal' }
        }
      },
      { $sort: { totalAmount: -1, '_id.clientUsername': 1 } }
    ]);

    const clientIds = rows
      .map((row) => row?._id?.clientId)
      .filter((value) => mongoose.Types.ObjectId.isValid(value));
    const clients = await User.find({ _id: { $in: clientIds } })
      .select({ _id: 1, organisation: 1 })
      .lean();
    const clientOrganisationById = new Map(
      clients.map((client) => [client._id.toString(), normalizeString(client.organisation)])
    );

    return reply.send({
      ok: true,
      rows: rows.map((row) => {
        const clientId = row._id.clientId.toString();
        const username = normalizeString(row._id.clientUsername) || clientId;
        const organisation = clientOrganisationById.get(clientId) || '';
        return {
          clientId,
          clientName: organisation || username,
          totalAmount: roundToTwoDecimals(Number(row.totalAmount ?? 0)),
          currency: 'EUR'
        };
      })
    });
  });

  app.get('/api/vendor/monthly-summary/clients', { preHandler: requireVendorApi }, async (request, reply) => {
    const currentUserId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const vendor = await User.findOne({ _id: currentUserId, role: 'vendor', isActive: true })
      .select({ clientIds: 1 })
      .lean();
    if (!vendor) {
      return reply.code(404).send({ ok: false, message: 'Vendor not found.' });
    }

    const clientIds = (vendor.clientIds ?? [])
      .map((clientId) => clientId?.toString?.() ?? '')
      .filter((clientId) => mongoose.Types.ObjectId.isValid(clientId));

    if (clientIds.length === 0) {
      return reply.send({ ok: true, clients: [] });
    }

    const clients = await User.find({
      _id: { $in: clientIds.map((clientId) => new mongoose.Types.ObjectId(clientId)) },
      role: 'client',
      isActive: true
    })
      .sort({ organisation: 1, username: 1 })
      .select({ _id: 1, organisation: 1, username: 1 })
      .lean();

    return reply.send({
      ok: true,
      clients: clients.map((client) => ({
        id: client._id.toString(),
        name: normalizeString(client.organisation) || normalizeString(client.username) || client._id.toString()
      }))
    });
  });

  app.get('/api/vendor/monthly-summary', { preHandler: requireVendorApi }, async (request, reply) => {
    const currentUserId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const year = Number(request.query?.year);
    const month = Number(request.query?.month);
    const clientId = normalizeString(request.query?.clientId);
    if (!Number.isInteger(year) || year < 2000 || year > 9999) {
      return reply.code(400).send({ ok: false, message: 'Year must be a valid 4-digit integer.' });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return reply.code(400).send({ ok: false, message: 'Month must be an integer between 1 and 12.' });
    }
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return reply.code(400).send({ ok: false, message: 'Client id is invalid.' });
    }

    const vendorObjectId = new mongoose.Types.ObjectId(currentUserId);
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const vendor = await User.findOne({
      _id: vendorObjectId,
      role: 'vendor',
      isActive: true,
      clientIds: clientObjectId
    })
      .select({ _id: 1 })
      .lean();
    if (!vendor) {
      return reply.code(403).send({ ok: false, message: 'The selected client is not assigned to this vendor.' });
    }

    const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    const bills = await Bill.find({
      vendorId: vendorObjectId,
      clientId: clientObjectId,
      date: {
        $gte: periodStart,
        $lt: periodEnd
      }
    })
      .sort({ date: 1 })
      .select({ uuid: 1, date: 1, clientId: 1, totalPrice: 1, currency: 1 })
      .lean();

    if (bills.length === 0) {
      return reply.send({ ok: true, rows: [], grandTotal: 0, currency: 'EUR' });
    }

    const orderRows = await ValidatedOrder.aggregate([
      {
        $match: {
          clientId: clientObjectId,
          validatedAt: {
            $gte: periodStart,
            $lt: periodEnd
          },
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
            }
          },
          deliveryDate: { $min: '$deliveryDate' }
        }
      }
    ]);

    const deliveryDateByDay = new Map(
      orderRows.map((row) => [
        normalizeString(row?._id?.day),
        row?.deliveryDate
          ? new Date(row.deliveryDate).toISOString().slice(0, 10)
          : null
      ])
    );

    const rows = await Promise.all(bills.map(async (bill) => {
      const day = new Date(bill.date).toISOString().slice(0, 10);
      const billId = await getOrCreatePersistedBillUuid({
        day,
        vendorId: currentUserId,
        clientId: bill.clientId?.toString?.() ?? clientId
      });
      return {
        key: buildVendorDayOrderKey(clientId, day),
        billId,
        deliveryDate: deliveryDateByDay.get(day) ?? null,
        totalAmount: roundToTwoDecimals(Number(bill.totalPrice ?? 0)),
        currency: normalizeString(bill.currency) || 'EUR'
      };
    }));

    return reply.send({
      ok: true,
      rows,
      grandTotal: roundToTwoDecimals(rows.reduce((sum, row) => sum + row.totalAmount, 0)),
      currency: rows[0]?.currency || 'EUR'
    });
  });

  app.get('/api/vendor/bills/overdue-unsettled', { preHandler: requireVendorApi }, async (request, reply) => {
    const currentUserId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const vendorObjectId = new mongoose.Types.ObjectId(currentUserId);
    const billOverdueDays = await getBillOverdueDaysSetting();
    const overdueCutoffDate = new Date();
    overdueCutoffDate.setUTCHours(0, 0, 0, 0);
    overdueCutoffDate.setUTCDate(overdueCutoffDate.getUTCDate() - billOverdueDays);

    const rows = await ValidatedOrder.aggregate([
      {
        $match: {
          deliveryDate: { $lte: overdueCutoffDate },
          'items.vendorId': vendorObjectId
        }
      },
      { $unwind: '$items' },
      { $match: { 'items.vendorId': vendorObjectId } },
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
      { $sort: { '_id.clientUsername': 1, '_id.day': -1 } }
    ]);

    if (rows.length === 0) {
      return reply.send({ ok: true, groups: [], currency: 'EUR' });
    }

    const clientIds = [...new Set(
      rows
        .map((row) => row?._id?.clientId?.toString?.() ?? '')
        .filter((value) => mongoose.Types.ObjectId.isValid(value))
    )];
    const dayValues = rows
      .map((row) => normalizeString(row?._id?.day))
      .filter((value) => parseIsoDayUtc(value));
    const minDay = dayValues.length > 0 ? dayValues.reduce((min, day) => (day < min ? day : min), dayValues[0]) : '';
    const maxDay = dayValues.length > 0 ? dayValues.reduce((max, day) => (day > max ? day : max), dayValues[0]) : '';

    const billDocs = (
      clientIds.length > 0 && minDay && maxDay
        ? await Bill.find({
          vendorId: vendorObjectId,
          clientId: { $in: clientIds.map((clientId) => new mongoose.Types.ObjectId(clientId)) },
          date: {
            $gte: parseIsoDayUtc(minDay),
            $lte: parseIsoDayUtc(maxDay)
          }
        })
          .select({ clientId: 1, date: 1, vendorSettled: 1, totalPrice: 1, lineCount: 1, penaltyLines: 1 })
          .lean()
        : []
    );

    const billStatusByClientDay = new Map(
      billDocs.map((bill) => [
        `${bill.clientId.toString()}::${new Date(bill.date).toISOString().slice(0, 10)}`,
        {
          vendorSettled: Boolean(bill.vendorSettled),
          totalPrice: roundToTwoDecimals(Number(bill.totalPrice ?? 0)),
          lineCount: Number(bill.lineCount ?? 0),
          hasPenaltyLine: Array.isArray(bill.penaltyLines) && bill.penaltyLines.length > 0
        }
      ])
    );

    const clientDocs = await User.find({ _id: { $in: clientIds } })
      .select({ _id: 1, organisation: 1 })
      .lean();
    const clientOrganisationById = new Map(
      clientDocs.map((client) => [client._id.toString(), normalizeString(client.organisation)])
    );

    const nowMs = Date.now();
    const grouped = new Map();

    for (const row of rows) {
      const clientId = row._id.clientId.toString();
      const day = normalizeString(row._id.day);
      const deliveryDate = normalizeString(row._id.deliveryDate);
      const billKey = `${clientId}::${day}`;
      const billStatus = billStatusByClientDay.get(billKey) ?? null;
      const isVendorSettled = Boolean(billStatus?.vendorSettled);

      if (isVendorSettled) {
        continue;
      }

      const deliveryDateObject = parseIsoDayUtc(deliveryDate);
      const dueDateMs = deliveryDateObject
        ? addUtcDays(deliveryDateObject, billOverdueDays).getTime()
        : nowMs;
      const daysPastDue = Math.max(
        0,
        Math.floor((nowMs - dueDateMs) / (24 * 60 * 60 * 1000))
      );

      const billTotalPrice = billStatus?.totalPrice ?? roundToTwoDecimals(Number(row.totalPrice ?? 0));

      const group = grouped.get(clientId) ?? {
        clientId,
        clientName: row._id.clientUsername ?? clientId,
        organisation: clientOrganisationById.get(clientId) || row._id.clientUsername || clientId,
        billCount: 0,
        totalAmount: 0,
        currency: 'EUR',
        bills: []
      };

      group.bills.push({
        key: buildVendorDayOrderKey(clientId, day),
        day,
        deliveryDate,
        orderedAt: row.orderedAt,
        totalPrice: billTotalPrice,
        totalQuantity: Number(row.totalQuantity ?? 0),
        lineCount: Number(billStatus?.lineCount ?? row.lineCount ?? 0),
        daysPastDue,
        hasPenaltyLine: Boolean(billStatus?.hasPenaltyLine)
      });
      group.billCount += 1;
      group.totalAmount = roundToTwoDecimals(group.totalAmount + billTotalPrice);
      grouped.set(clientId, group);
    }

    const groups = [...grouped.values()]
      .sort((left, right) => left.organisation.localeCompare(right.organisation))
      .map((group) => ({
        ...group,
        bills: [...group.bills].sort((left, right) => left.day.localeCompare(right.day))
      }));

    const remindedClientIds = [];
    for (const group of groups) {
      const reminderKey = buildUnpaidReminderKey(group.clientId, currentUserId);
      const reminderRaw = await redisClient.sendCommand(['GET', reminderKey]).catch(() => null);
      if (reminderRaw) {
        remindedClientIds.push(group.clientId);
      }
    }

    return reply.send({ ok: true, groups, currency: 'EUR', billOverdueDays, remindedClientIds });
  });

  app.post('/api/vendor/bills/penalty-lines', { preHandler: requireVendorApi }, async (request, reply) => {
    const vendorId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const result = await addBillPenaltyLine({
      key: request.body?.key,
      vendorId,
      percentage: request.body?.percentage
    });
    if (!result.ok) {
      return reply.code(result.code ?? 400).send({ ok: false, message: result.message });
    }

    return reply.send({
      ok: true,
      bill: result.bill,
      message: `Penalty line added (${result.bill.percentage}% of the bill total). Allowed range: ${BILL_PENALTY_MIN_PERCENT}-${BILL_PENALTY_MAX_PERCENT}%.`
    });
  });

  app.post('/api/vendor/unpaid-reminders', { preHandler: requireVendorApi }, async (request, reply) => {
    const vendorId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const clientId = normalizeString(request.body?.clientId);
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return reply.code(400).send({ ok: false, message: 'Invalid client id.' });
    }

    const totalAmount = Number(request.body?.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      return reply.code(400).send({ ok: false, message: 'Invalid total amount.' });
    }

    const client = await User.findOne({ _id: clientId, role: 'client' })
      .select({ _id: 1 })
      .lean();
    if (!client) {
      return reply.code(404).send({ ok: false, message: 'Client not found.' });
    }

    const vendorName = normalizeString(request.session.user?.organisation)
      || normalizeString(request.session.user?.username)
      || vendorId;

    await upsertUnpaidReminder(redisClient, {
      clientId,
      vendorId,
      vendorName,
      totalAmount,
      currency: 'EUR'
    });
    await broadcastClientUnpaidReminders(clientId);

    return reply.send({ ok: true, message: 'Late payment reminder sent.' });
  });

  app.get('/api/client/unpaid-reminders', { preHandler: requireClientApi }, async (request, reply) => {
    const clientId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const reminders = await listClientUnpaidReminders(redisClient, clientId);
    return reply.send({ ok: true, reminders });
  });

  app.get('/api/client/find-vendors', { preHandler: requireClientApi }, async (request, reply) => {
    const clientId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const client = await User.findOne({ _id: clientId, role: 'client' })
      .select({ vendorIds: 1 })
      .lean();
    if (!client) {
      return reply.code(404).send({ ok: false, message: 'Client not found.' });
    }

    const assignedVendorIds = new Set(
      (client.vendorIds ?? [])
        .map((vendorId) => vendorId?.toString?.() ?? '')
        .filter((vendorId) => mongoose.Types.ObjectId.isValid(vendorId))
    );

    const vendors = await User.find({ role: 'vendor', isActive: true })
      .sort({ organisation: 1, username: 1 })
      .select({ _id: 1, organisation: 1, username: 1, logoFilename: 1, businessDescription: 1 })
      .lean();

    return reply.send({
      ok: true,
      vendors: vendors.map((vendor) => ({
        id: vendor._id.toString(),
        organisation: normalizeString(vendor.organisation) || normalizeString(vendor.username) || vendor._id.toString(),
        logoUrl: getUserLogoUrl(vendor.logoFilename),
        businessDescription: normalizeString(vendor.businessDescription),
        isAssigned: assignedVendorIds.has(vendor._id.toString())
      }))
    });
  });

  app.post('/api/client/find-vendors/:vendorId/assign', { preHandler: requireClientApi }, async (request, reply) => {
    const clientId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const vendorId = normalizeString(request.params?.vendorId);
    const result = await assignVendorClientAssociation(clientId, vendorId);
    if (!result.ok) {
      return reply.code(result.code ?? 400).send({ ok: false, message: result.message });
    }

    return reply.send({ ok: true, message: 'Vendor added to your list.' });
  });

  app.post('/api/admin/associations/client/:clientId/vendor/:vendorId', { preHandler: requireAdminApi }, async (request, reply) => {
    const clientId = normalizeString(request.params?.clientId);
    const vendorId = normalizeString(request.params?.vendorId);
    const result = await assignVendorClientAssociation(clientId, vendorId);
    if (!result.ok) {
      return reply.code(result.code ?? 400).send({ ok: false, message: result.message });
    }

    return reply.send({ ok: true, message: result.message });
  });

  app.delete('/api/admin/associations/client/:clientId/vendor/:vendorId', { preHandler: requireAdminApi }, async (request, reply) => {
    const clientId = normalizeString(request.params?.clientId);
    const vendorId = normalizeString(request.params?.vendorId);
    const result = await removeVendorClientAssociation(clientId, vendorId);
    if (!result.ok) {
      return reply.code(result.code ?? 400).send({ ok: false, message: result.message });
    }

    return reply.send({ ok: true, message: result.message });
  });

  app.post('/api/admin/associations/vendor/:vendorId/client/:clientId', { preHandler: requireAdminApi }, async (request, reply) => {
    const clientId = normalizeString(request.params?.clientId);
    const vendorId = normalizeString(request.params?.vendorId);
    const result = await assignVendorClientAssociation(clientId, vendorId);
    if (!result.ok) {
      return reply.code(result.code ?? 400).send({ ok: false, message: result.message });
    }

    return reply.send({ ok: true, message: result.message });
  });

  app.delete('/api/admin/associations/vendor/:vendorId/client/:clientId', { preHandler: requireAdminApi }, async (request, reply) => {
    const clientId = normalizeString(request.params?.clientId);
    const vendorId = normalizeString(request.params?.vendorId);
    const result = await removeVendorClientAssociation(clientId, vendorId);
    if (!result.ok) {
      return reply.code(result.code ?? 400).send({ ok: false, message: result.message });
    }

    return reply.send({ ok: true, message: result.message });
  });

  app.post('/api/admin/users/:id/activate', { preHandler: requireAdminApi }, async (request, reply) => {
    const id = normalizeString(request.params?.id);

    if (!id) {
      return reply.code(400).send({ ok: false, message: 'User id is required.' });
    }

    let user;
    try {
      user = await User.findById(id).lean();
    } catch {
      return reply.code(400).send({ ok: false, message: 'Invalid user id.' });
    }

    if (!user) {
      return reply.code(404).send({ ok: false, message: 'User not found.' });
    }

    if (user.role === 'admin') {
      return reply.code(400).send({ ok: false, message: 'Admin users are not managed from this page.' });
    }

    if (user.isActive) {
      return reply.send({ ok: true, userId: id, message: 'User is already active.' });
    }

    await User.updateOne({ _id: id }, { $set: { isActive: true } });

    return reply.send({ ok: true, userId: id, message: 'User activated.' });
  });

  app.patch('/api/admin/users/:id/active', { preHandler: requireAdminApi }, async (request, reply) => {
    const id = normalizeString(request.params?.id);
    const isActive = request.body?.isActive;

    if (!id) {
      return reply.code(400).send({ ok: false, message: 'User id is required.' });
    }

    if (typeof isActive !== 'boolean') {
      return reply.code(400).send({ ok: false, message: 'User active state must be a boolean.' });
    }

    let user;
    try {
      user = await User.findById(id).lean();
    } catch {
      return reply.code(400).send({ ok: false, message: 'Invalid user id.' });
    }

    if (!user) {
      return reply.code(404).send({ ok: false, message: 'User not found.' });
    }

    if (user.role === 'admin') {
      return reply.code(400).send({ ok: false, message: 'Admin users are not managed from this page.' });
    }

    if (Boolean(user.isActive) === isActive) {
      return reply.send({
        ok: true,
        user: mapAdminManagedUser(user),
        message: isActive ? 'User is already enabled.' : 'User is already disabled.'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(id, { $set: { isActive } }, { new: true })
      .select({ role: 1, username: 1, organisation: 1, email: 1, isActive: 1, createdAt: 1, updatedAt: 1 })
      .lean();

    if (!updatedUser) {
      return reply.code(404).send({ ok: false, message: 'User not found.' });
    }

    return reply.send({
      ok: true,
      user: mapAdminManagedUser(updatedUser),
      message: isActive ? 'User enabled.' : 'User disabled.'
    });
  });

  app.delete('/api/admin/users/:id', { preHandler: requireAdminApi }, async (request, reply) => {
    const id = normalizeString(request.params?.id);

    if (!id) {
      return reply.code(400).send({ ok: false, message: 'User id is required.' });
    }

    let user;
    try {
      user = await User.findById(id).lean();
    } catch {
      return reply.code(400).send({ ok: false, message: 'Invalid user id.' });
    }

    if (!user) {
      return reply.code(404).send({ ok: false, message: 'User not found.' });
    }

    if (user.role === 'admin') {
      return reply.code(400).send({ ok: false, message: 'Admin users cannot be deleted from this page.' });
    }

    if (user.isActive) {
      return reply.code(400).send({ ok: false, message: 'Only pending users can be deleted.' });
    }

    await User.deleteOne({ _id: id, isActive: false, role: { $in: ['vendor', 'client'] } });

    return reply.send({ ok: true, userId: id, message: 'Pending user deleted.' });
  });
}
