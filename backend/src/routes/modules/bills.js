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
        logoFilename: 1,
        businessRegistrationId: 1
      })
      .lean();
    const client = await User.findById(bill.clientId)
      .select({
        organisation: 1,
        physicalAddress: 1,
        zipcode: 1,
        city: 1,
        logoFilename: 1,
        businessRegistrationId: 1
      })
      .lean();
    const filename = `vendor-bill-${sanitizeFilenamePart(bill.day)}-${sanitizeFilenamePart(bill.clientUsername)}.pdf`;
    return sendBillPdf(reply, {
      filename,
      title: t('pdf.vendorBillTitle', 'Vendor Bill'),
      topLogoPath: getUserLogoAbsolutePath(client?.logoFilename),
      labels: {
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
        item: t('pdf.item', 'Item'),
        category: t('pdf.category', 'Category'),
        unitPrice: t('pdf.unitPrice', 'Unit price'),
        qty: t('pdf.qty', 'Qty'),
        lineTotal: t('pdf.lineTotal', 'Line total'),
        total: t('common.total', 'Total')
      },
      billIdentifier,
      orderedAt: bill.orderedAt,
      deliveryDate: bill.deliveryDate,
      vendor: {
        organisation: vendor?.organisation ?? request.session.user.organisation ?? '-',
        address: vendor?.physicalAddress ?? request.session.user.physicalAddress ?? '-',
        zipcode: vendor?.zipcode ?? request.session.user.zipcode ?? '-',
        city: vendor?.city ?? request.session.user.city ?? '-',
        phoneNumber: vendor?.phoneNumber ?? request.session.user.phoneNumber ?? '-',
        businessId: vendor?.businessRegistrationId ?? request.session.user.businessRegistrationId ?? '-'
      },
      client: {
        organisation: client?.organisation ?? '-',
        address: client?.physicalAddress ?? '-',
        zipcode: client?.zipcode ?? '-',
        city: client?.city ?? '-',
        businessId: client?.businessRegistrationId ?? '-'
      },
      items: bill.items,
      totalPrice: bill.totalPrice,
      currency: bill.currency
    });
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
        logoFilename: 1,
        businessRegistrationId: 1
      })
      .lean();
    const client = await User.findById(request.session.user.id)
      .select({
        organisation: 1,
        physicalAddress: 1,
        zipcode: 1,
        city: 1,
        logoFilename: 1,
        businessRegistrationId: 1
      })
      .lean();
    const filename = `client-bill-${sanitizeFilenamePart(bill.day)}-${sanitizeFilenamePart(bill.vendorName)}.pdf`;
    return sendBillPdf(reply, {
      filename,
      title: t('pdf.clientBillTitle', 'Client Bill'),
      topLogoPath: getUserLogoAbsolutePath(vendor?.logoFilename),
      labels: {
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
        item: t('pdf.item', 'Item'),
        category: t('pdf.category', 'Category'),
        unitPrice: t('pdf.unitPrice', 'Unit price'),
        qty: t('pdf.qty', 'Qty'),
        lineTotal: t('pdf.lineTotal', 'Line total'),
        total: t('common.total', 'Total')
      },
      billIdentifier,
      orderedAt: bill.orderedAt,
      deliveryDate: bill.deliveryDate,
      vendor: {
        organisation: vendor?.organisation ?? bill.vendorName ?? '-',
        address: vendor?.physicalAddress ?? '-',
        zipcode: vendor?.zipcode ?? '-',
        city: vendor?.city ?? '-',
        phoneNumber: vendor?.phoneNumber ?? '-',
        businessId: vendor?.businessRegistrationId ?? '-'
      },
      client: {
        organisation: client?.organisation ?? request.session.user.organisation ?? '-',
        address: client?.physicalAddress ?? request.session.user.physicalAddress ?? '-',
        zipcode: client?.zipcode ?? request.session.user.zipcode ?? '-',
        city: client?.city ?? request.session.user.city ?? '-',
        businessId: client?.businessRegistrationId ?? request.session.user.businessRegistrationId ?? '-'
      },
      items: bill.items,
      totalPrice: bill.totalPrice,
      currency: bill.currency
    });
  });
}
