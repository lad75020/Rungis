function buildBillLabels(t) {
  return {
    billId: t('pdf.billId', 'Bill ID'),
    orderedAt: t('pdf.orderedAt', 'Ordered at'),
    deliveryDate: t('pdf.deliveryDate', 'Delivery date'),
    vendor: t('pdf.vendor', 'Vendor'),
    client: t('pdf.client', 'Client'),
    organisation: t('pdf.organisation', 'Organisation'),
    address: t('pdf.address', 'Address'),
    zipcode: t('pdf.zipcode', 'Zipcode'),
    city: t('pdf.city', 'City'),
    phone: t('pdf.phone', 'Phone'),
    businessId: t('pdf.businessId', 'SIRET'),
    vatId: t('account.vatId', 'VAT ID'),
    billMentions: t('account.billMentions', 'Bill mentions'),
    item: t('pdf.item', 'Item'),
    category: t('pdf.category', 'Category'),
    unitPrice: t('pdf.unitPrice', 'Unit price'),
    unitPriceIncludingVat: t('pdf.unitPriceIncludingVat', 'Unit price incl. VAT'),
    qty: t('pdf.qty', 'Qty'),
    lineTotal: t('pdf.lineTotal', 'Line total'),
    lineTotalIncludingVat: t('pdf.lineTotalIncludingVat', 'Line total incl. VAT'),
    total: t('common.total', 'Total'),
    totalIncludingVat: t('common.totalIncludingVat', 'Total incl. VAT')
  };
}

function mapVendorParty(vendor, sessionUser, fallbackOrganisation = '-') {
  return {
    organisation: vendor?.organisation ?? sessionUser?.organisation ?? fallbackOrganisation,
    address: vendor?.physicalAddress ?? sessionUser?.physicalAddress ?? '-',
    zipcode: vendor?.zipcode ?? sessionUser?.zipcode ?? '-',
    city: vendor?.city ?? sessionUser?.city ?? '-',
    phoneNumber: vendor?.phoneNumber ?? sessionUser?.phoneNumber ?? '-',
    email: vendor?.email ?? sessionUser?.email ?? '',
    businessId: vendor?.businessRegistrationId ?? sessionUser?.businessRegistrationId ?? '-',
    vatId: vendor?.vatId ?? sessionUser?.vatId ?? '',
    billMentions: vendor?.billMentions ?? sessionUser?.billMentions ?? ''
  };
}

function mapClientParty(client, sessionUser, fallbackOrganisation = '-') {
  return {
    organisation: client?.organisation ?? sessionUser?.organisation ?? fallbackOrganisation,
    address: client?.physicalAddress ?? sessionUser?.physicalAddress ?? '-',
    zipcode: client?.zipcode ?? sessionUser?.zipcode ?? '-',
    city: client?.city ?? sessionUser?.city ?? '-',
    email: client?.email ?? sessionUser?.email ?? '',
    businessId: client?.businessRegistrationId ?? sessionUser?.businessRegistrationId ?? '-'
  };
}

function sendFacturXError(reply, error, fallbackMessage) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  return reply.code(statusCode).type('application/json; charset=utf-8').send({
    error: error?.errorCode ?? 'generation_failed',
    message: error?.message || fallbackMessage,
    details: Array.isArray(error?.details) ? error.details : []
  });
}

export function registerBillRoutes(app, deps) {
  const {
    getClientBillDetails,
    getOrCreatePersistedBillUuid,
    getRequestLanguage,
    getTranslationText,
    getUserLogoAbsolutePath,
    getVendorBillDetails,
    requireClientApi,
    requireVendorApi,
    sanitizeFilenamePart,
    sendBillPdf,
    sendFacturXBill,
    User
  } = deps;

  app.get('/api/bills/vendor/:key/pdf', { preHandler: requireVendorApi }, async (request, reply) => {
    const translations = await request.server.getTranslations();
    const language = getRequestLanguage(request);
    const t = (key, fallback) => getTranslationText(translations, language, key, fallback);
    const result = await getVendorBillDetails(
      request.session.user.id,
      request.params?.key
    );
    if (!result.ok) {
      return reply
        .code(result.code ?? 400)
        .type('text/plain; charset=utf-8')
        .send(result.message ?? 'Bill not found.');
    }

    const bill = result.bill;
    const billIdentifier = await getOrCreatePersistedBillUuid({
      day: bill.day,
      vendorId: request.session.user.id,
      clientId: bill.clientId
    });
    const vendor = await User.findById(request.session.user.id)
      .select({
        organisation: 1,
        physicalAddress: 1,
        zipcode: 1,
        city: 1,
        phoneNumber: 1,
        email: 1,
        logoFilename: 1,
        businessRegistrationId: 1,
        vatId: 1,
        billMentions: 1
      })
      .lean();
    const client = await User.findById(bill.clientId)
      .select({
        organisation: 1,
        physicalAddress: 1,
        zipcode: 1,
        city: 1,
        email: 1,
        logoFilename: 1,
        businessRegistrationId: 1,
        vatId: 1,
        billMentions: 1
      })
      .lean();
    const filename = `vendor-bill-${sanitizeFilenamePart(bill.day)}-${sanitizeFilenamePart(bill.clientUsername)}.pdf`;
    return sendBillPdf(reply, {
      filename,
      title: t('pdf.vendorBillTitle', 'Vendor Bill'),
      topLogoPath: getUserLogoAbsolutePath(client?.logoFilename),
      labels: buildBillLabels(t),
      billIdentifier,
      orderedAt: bill.orderedAt,
      deliveryDate: bill.deliveryDate,
      vendor: mapVendorParty(vendor, request.session.user),
      client: mapClientParty(client, null),
      items: bill.items,
      totalPrice: bill.totalPrice,
      totalPriceIncludingVat: bill.totalPriceIncludingVat,
      currency: bill.currency
    });
  });

  app.get('/api/bills/vendor/:key/factur-x', { preHandler: requireVendorApi }, async (request, reply) => {
    const translations = await request.server.getTranslations();
    const language = getRequestLanguage(request);
    const t = (key, fallback) => getTranslationText(translations, language, key, fallback);
    const result = await getVendorBillDetails(request.session.user.id, request.params?.key);
    if (!result.ok) {
      return reply.code(result.code ?? 400).type('application/json; charset=utf-8').send({
        error: result.code === 404 ? 'bill_not_found' : 'invalid_bill_key',
        message: result.message ?? t('alerts.facturX.downloadFailed', 'Factur-X download failed.'),
        details: []
      });
    }

    const bill = result.bill;
    const billIdentifier = await getOrCreatePersistedBillUuid({
      day: bill.day,
      vendorId: request.session.user.id,
      clientId: bill.clientId
    });
    const vendor = await User.findById(request.session.user.id)
      .select({ organisation: 1, physicalAddress: 1, zipcode: 1, city: 1, phoneNumber: 1, email: 1, businessRegistrationId: 1, vatId: 1, billMentions: 1 })
      .lean();
    const client = await User.findById(bill.clientId)
      .select({ organisation: 1, physicalAddress: 1, zipcode: 1, city: 1, email: 1, businessRegistrationId: 1 })
      .lean();
    const filename = `vendor-bill-${sanitizeFilenamePart(bill.day)}-${sanitizeFilenamePart(bill.clientUsername)}-factur-x.pdf`;
    try {
      return await sendFacturXBill(reply, {
        role: 'vendor',
        filename,
        title: t('pdf.vendorBillTitle', 'Vendor Bill'),
        billIdentifier,
        bill,
        vendor: mapVendorParty(vendor, request.session.user),
        client: mapClientParty(client, null)
      });
    } catch (error) {
      request.log?.error?.({ err: error, billKey: bill.key }, 'Factur-X vendor bill generation failed');
      return sendFacturXError(reply, error, t('alerts.facturX.downloadFailed', 'Factur-X download failed.'));
    }
  });

  app.get('/api/bills/client/:key/pdf', { preHandler: requireClientApi }, async (request, reply) => {
    const translations = await request.server.getTranslations();
    const language = getRequestLanguage(request);
    const t = (key, fallback) => getTranslationText(translations, language, key, fallback);
    const result = await getClientBillDetails(
      request.session.user.id,
      request.params?.key
    );
    if (!result.ok) {
      return reply
        .code(result.code ?? 400)
        .type('text/plain; charset=utf-8')
        .send(result.message ?? 'Bill not found.');
    }

    const bill = result.bill;
    const billIdentifier = await getOrCreatePersistedBillUuid({
      day: bill.day,
      vendorId: bill.vendorId,
      clientId: request.session.user.id
    });
    const vendor = await User.findById(bill.vendorId)
      .select({
        organisation: 1,
        physicalAddress: 1,
        zipcode: 1,
        city: 1,
        phoneNumber: 1,
        email: 1,
        logoFilename: 1,
        businessRegistrationId: 1,
        vatId: 1,
        billMentions: 1
      })
      .lean();
    const client = await User.findById(request.session.user.id)
      .select({
        organisation: 1,
        physicalAddress: 1,
        zipcode: 1,
        city: 1,
        email: 1,
        logoFilename: 1,
        businessRegistrationId: 1,
        vatId: 1,
        billMentions: 1
      })
      .lean();
    const filename = `client-bill-${sanitizeFilenamePart(bill.day)}-${sanitizeFilenamePart(bill.vendorName)}.pdf`;
    return sendBillPdf(reply, {
      filename,
      title: t('pdf.clientBillTitle', 'Client Bill'),
      topLogoPath: getUserLogoAbsolutePath(vendor?.logoFilename),
      labels: buildBillLabels(t),
      billIdentifier,
      orderedAt: bill.orderedAt,
      deliveryDate: bill.deliveryDate,
      vendor: mapVendorParty(vendor, null, bill.vendorName),
      client: mapClientParty(client, request.session.user),
      items: bill.items,
      totalPrice: bill.totalPrice,
      totalPriceIncludingVat: bill.totalPriceIncludingVat,
      currency: bill.currency
    });
  });

  app.get('/api/bills/client/:key/factur-x', { preHandler: requireClientApi }, async (request, reply) => {
    const translations = await request.server.getTranslations();
    const language = getRequestLanguage(request);
    const t = (key, fallback) => getTranslationText(translations, language, key, fallback);
    const result = await getClientBillDetails(request.session.user.id, request.params?.key);
    if (!result.ok) {
      return reply.code(result.code ?? 400).type('application/json; charset=utf-8').send({
        error: result.code === 404 ? 'bill_not_found' : 'invalid_bill_key',
        message: result.message ?? t('alerts.facturX.downloadFailed', 'Factur-X download failed.'),
        details: []
      });
    }

    const bill = result.bill;
    const billIdentifier = await getOrCreatePersistedBillUuid({
      day: bill.day,
      vendorId: bill.vendorId,
      clientId: request.session.user.id
    });
    const vendor = await User.findById(bill.vendorId)
      .select({ organisation: 1, physicalAddress: 1, zipcode: 1, city: 1, phoneNumber: 1, email: 1, businessRegistrationId: 1, vatId: 1, billMentions: 1 })
      .lean();
    const client = await User.findById(request.session.user.id)
      .select({ organisation: 1, physicalAddress: 1, zipcode: 1, city: 1, email: 1, businessRegistrationId: 1 })
      .lean();
    const filename = `client-bill-${sanitizeFilenamePart(bill.day)}-${sanitizeFilenamePart(bill.vendorName)}-factur-x.pdf`;
    try {
      return await sendFacturXBill(reply, {
        role: 'client',
        filename,
        title: t('pdf.clientBillTitle', 'Client Bill'),
        billIdentifier,
        bill,
        vendor: mapVendorParty(vendor, null, bill.vendorName),
        client: mapClientParty(client, request.session.user)
      });
    } catch (error) {
      request.log?.error?.({ err: error, billKey: bill.key }, 'Factur-X client bill generation failed');
      return sendFacturXError(reply, error, t('alerts.facturX.downloadFailed', 'Factur-X download failed.'));
    }
  });
}
