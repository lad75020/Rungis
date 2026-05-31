export function registerRefundRoutes(app, deps) {
  const {
    normalizeRefundAmount,
    normalizeString,
    REFUND_COMMENT_MAX_LENGTH,
    Refund,
    requireVendorApi,
    roundToTwoDecimals,
    User,
    mongoose
  } = deps;

  app.get('/api/vendor/refunds/clients', { preHandler: requireVendorApi }, async (request, reply) => {
    const vendorId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const vendor = await User.findOne({ _id: vendorId, role: 'vendor' })
      .select({ clientIds: 1 })
      .lean();
    if (!vendor) {
      return reply.code(404).send({ ok: false, message: 'Vendor not found.' });
    }

    const clientIds = (vendor.clientIds ?? [])
      .map((value) => value?.toString?.() ?? '')
      .filter((value) => mongoose.Types.ObjectId.isValid(value));
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

  app.post('/api/vendor/refunds', { preHandler: requireVendorApi }, async (request, reply) => {
    const vendorId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const clientId = normalizeString(request.body?.clientId);
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return reply.code(400).send({ ok: false, message: 'Invalid client id.' });
    }

    const amount = normalizeRefundAmount(request.body?.amount);
    if (!amount) {
      return reply.code(400).send({ ok: false, message: 'Refund amount must be a positive value with at most two decimals.' });
    }

    const comment = normalizeString(request.body?.comment);
    if (!comment) {
      return reply.code(400).send({ ok: false, message: 'Refund comment is required.' });
    }
    if (comment.length > REFUND_COMMENT_MAX_LENGTH) {
      return reply.code(400).send({ ok: false, message: `Refund comment must be at most ${REFUND_COMMENT_MAX_LENGTH} characters.` });
    }

    const vendor = await User.findOne({ _id: vendorId, role: 'vendor' })
      .select({ clientIds: 1 })
      .lean();
    if (!vendor) {
      return reply.code(404).send({ ok: false, message: 'Vendor not found.' });
    }

    const associatedClientIds = new Set(
      (vendor.clientIds ?? [])
        .map((value) => value?.toString?.() ?? '')
        .filter((value) => mongoose.Types.ObjectId.isValid(value))
    );
    if (!associatedClientIds.has(clientId)) {
      return reply.code(403).send({ ok: false, message: 'This client is not associated with your account.' });
    }

    const client = await User.findOne({ _id: clientId, role: 'client', isActive: true })
      .select({ _id: 1 })
      .lean();
    if (!client) {
      return reply.code(404).send({ ok: false, message: 'Client not found.' });
    }

    const refund = await Refund.create({
      vendorId,
      clientId,
      amount,
      comment,
      currency: 'EUR',
      appliedBillDate: null,
      appliedAt: null
    });

    return reply.send({
      ok: true,
      message: 'Refund queued for the next daily bill.',
      refund: {
        id: refund._id.toString(),
        clientId,
        amount: roundToTwoDecimals(amount),
        comment
      }
    });
  });
}
