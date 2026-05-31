export function registerPageRoutes(app, deps) {
  const {
    buildPagePayload,
    redirectForSessionUser,
    requireAdminPage,
    requireAuth,
    requireClientPage,
    requirePageRateLimit,
    requireVendorPage
  } = deps;

  app.get('/', { preHandler: requirePageRateLimit }, async (_request, reply) => reply.redirect('/login'));

  app.get('/login', { preHandler: requirePageRateLimit }, async (request, reply) => {
    if (request.session.user) {
      return reply.redirect(redirectForSessionUser(request.session.user));
    }

    return reply.view('login.ejs', {
      title: 'Login',
      appConfig: await buildPagePayload(request, 'login')
    });
  });

  app.get('/subscribe', { preHandler: requirePageRateLimit }, async (request, reply) => {
    if (request.session.user) {
      return reply.redirect(redirectForSessionUser(request.session.user));
    }

    return reply.view('subscribe.ejs', {
      title: 'Subscription',
      appConfig: await buildPagePayload(request, 'subscribe')
    });
  });

  app.get('/dashboard', { preHandler: [requirePageRateLimit, requireAuth] }, async (request, reply) => {
    return reply.view('dashboard.ejs', {
      title: 'Dashboard',
      appConfig: await buildPagePayload(request, 'dashboard')
    });
  });

  app.get('/admin', { preHandler: [requirePageRateLimit, requireAdminPage] }, async (request, reply) => {
    return reply.view('admin.ejs', {
      title: 'Admin',
      appConfig: await buildPagePayload(request, 'admin')
    });
  });

  app.get('/statistics', { preHandler: [requirePageRateLimit, requireAdminPage] }, async (request, reply) => {
    return reply.view('statistics.ejs', {
      title: 'Statistics',
      appConfig: await buildPagePayload(request, 'statistics')
    });
  });

  app.get('/stocks', { preHandler: [requirePageRateLimit, requireVendorPage] }, async (request, reply) => {
    return reply.view('stocks.ejs', {
      title: 'Stocks',
      appConfig: await buildPagePayload(request, 'stocks')
    });
  });

  app.get('/vendor-statistics', { preHandler: [requirePageRateLimit, requireVendorPage] }, async (request, reply) => {
    return reply.view('vendor-statistics.ejs', {
      title: 'Vendor Statistics',
      appConfig: await buildPagePayload(request, 'vendor-statistics')
    });
  });

  app.get('/vendor-monthly-summary', { preHandler: [requirePageRateLimit, requireVendorPage] }, async (request, reply) => {
    return reply.view('vendor-monthly-summary.ejs', {
      title: 'Vendor Monthly Summary',
      appConfig: await buildPagePayload(request, 'vendor-monthly-summary')
    });
  });

  app.get('/vendor-overdue-bills', { preHandler: [requirePageRateLimit, requireVendorPage] }, async (request, reply) => {
    return reply.view('vendor-overdue-bills.ejs', {
      title: 'Vendor Overdue Bills',
      appConfig: await buildPagePayload(request, 'vendor-overdue-bills')
    });
  });

  app.get('/vendor-refunds', { preHandler: [requirePageRateLimit, requireVendorPage] }, async (request, reply) => {
    return reply.view('vendor-refunds.ejs', {
      title: 'Vendor Refunds',
      appConfig: await buildPagePayload(request, 'vendor-refunds')
    });
  });

  app.get('/find-vendors', { preHandler: [requirePageRateLimit, requireClientPage] }, async (request, reply) => {
    return reply.view('find-vendors.ejs', {
      title: 'Find Vendors',
      appConfig: await buildPagePayload(request, 'find-vendors')
    });
  });

  app.get('/order', { preHandler: [requirePageRateLimit, requireClientPage] }, async (request, reply) => {
    return reply.view('order.ejs', {
      title: 'Order',
      appConfig: await buildPagePayload(request, 'order')
    });
  });

  app.get('/account', { preHandler: [requirePageRateLimit, requireAuth] }, async (request, reply) => {
    return reply.view('account.ejs', {
      title: 'Account',
      appConfig: await buildPagePayload(request, 'account')
    });
  });
}
