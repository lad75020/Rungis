import { buildRungisFacturXInput, buildRungisInvoiceView } from '../../services/rungis-bills/invoice-data.js';
import { sendRungisBillPdf } from '../../services/rungis-bills/pdf.js';

function sendDocumentError(reply, error, fallbackMessage) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  return reply.code(statusCode).type('application/json; charset=utf-8').send({
    error: error?.errorCode ?? 'generation_failed',
    message: error?.message || fallbackMessage,
    details: Array.isArray(error?.details) ? error.details : []
  });
}

function ensureOwnRungisBill(bill, sessionUser) {
  return String(bill?.userId) === String(sessionUser?.id) && bill?.role === sessionUser?.role;
}

export function registerRungisBillRoutes(app, deps) {
  const {
    getUserLogoUrl,
    requireRungisBillUserApi,
    RungisBill,
    sendFacturXBill,
    sanitizeFilenamePart
  } = deps;

  app.get('/api/rungis-bills/current', { preHandler: requireRungisBillUserApi }, async (request, reply) => {
    const bills = await RungisBill.find({
      userId: request.session.user.id,
      role: request.session.user.role,
      paid: false
    })
      .sort({ applicableYear: -1, applicableMonth: -1, createdAt: -1 })
      .lean();

    return reply.send({
      ok: true,
      bills: bills.map((bill) => buildRungisInvoiceView(bill, { getUserLogoUrl }))
    });
  });

  app.get('/api/rungis-bills/:billId', { preHandler: requireRungisBillUserApi }, async (request, reply) => {
    const bill = await RungisBill.findById(request.params?.billId).lean();
    if (!bill || !ensureOwnRungisBill(bill, request.session.user)) {
      return reply.code(404).send({ ok: false, message: 'Rungis bill not found.' });
    }
    return reply.send({ ok: true, invoice: buildRungisInvoiceView(bill, { getUserLogoUrl }) });
  });

  app.get('/api/rungis-bills/:billId/pdf', { preHandler: requireRungisBillUserApi }, async (request, reply) => {
    const bill = await RungisBill.findById(request.params?.billId).lean();
    if (!bill || !ensureOwnRungisBill(bill, request.session.user)) {
      return reply.code(404).type('text/plain; charset=utf-8').send('Rungis bill not found.');
    }
    try {
      const invoice = buildRungisInvoiceView(bill, { getUserLogoUrl });
      const filename = `rungis-bill-${invoice.applicableYear}-${String(invoice.applicableMonth).padStart(2, '0')}-${sanitizeFilenamePart(invoice.userUniqueId ?? invoice.id)}.pdf`;
      return sendRungisBillPdf(reply, { invoice, filename });
    } catch (error) {
      return sendDocumentError(reply, error, 'Unable to generate Rungis PDF.');
    }
  });

  app.get('/api/rungis-bills/:billId/factur-x', { preHandler: requireRungisBillUserApi }, async (request, reply) => {
    const bill = await RungisBill.findById(request.params?.billId).lean();
    if (!bill || !ensureOwnRungisBill(bill, request.session.user)) {
      return reply.code(404).send({ error: 'not_found', message: 'Rungis bill not found.', details: [] });
    }
    try {
      const invoice = buildRungisInvoiceView(bill, { getUserLogoUrl });
      return await sendFacturXBill(reply, buildRungisFacturXInput(invoice));
    } catch (error) {
      return sendDocumentError(reply, error, 'Unable to generate Rungis Factur-X PDF.');
    }
  });
}
