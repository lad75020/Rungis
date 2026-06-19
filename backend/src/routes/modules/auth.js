export function registerAuthRoutes(app, context, deps) {
  const {
    bcrypt,
    buildLoginAttemptKey,
    buildUniqueAccessKeyName,
    clearLoginAttempts,
    fs,
    generateAuthenticationOptions,
    generateRegistrationOptions,
    getErrorMessage,
    getMerchandiseImageUrl,
    getUserPasskeys,
    getWebAuthnExpectedOrigins,
    getWebAuthnRpId,
    getWebAuthnRpName,
    getLoginCooldownRemainingMs,
    isWebAuthnUserVerificationRequired,
    itemImagesDir,
    mapAccessKeySummary,
    mapPendingUser,
    mapSessionUser,
    mapStoredPasskeyToCredential,
    mongoose,
    normalizeString,
    parseImageUploadDataUrl,
    parseSiretValue,
    path,
    randomUUID,
    redirectForSessionUser,
    registerFailedLoginAttempt,
    requireAuth,
    requireVendorApi,
    summarizeUserAgent,
    User,
    userLogosDir,
    verifyAuthenticationResponse,
    verifyRegistrationResponse
  } = deps;
  const { sendToAdminConnections } = context;

  app.post('/api/login', async (request, reply) => {
    const username = normalizeString(request.body?.username).toLowerCase();
    const password = normalizeString(request.body?.password);
    const now = Date.now();
    const loginAttemptKey = buildLoginAttemptKey(request, username);
    const cooldownRemainingMs = getLoginCooldownRemainingMs(loginAttemptKey, now);
    if (cooldownRemainingMs > 0) {
      const remainingMinutes = Math.ceil(cooldownRemainingMs / 60000);
      return reply.code(429).send({
        ok: false,
        message: `Too many login attempts. Try again in ${remainingMinutes} minute(s).`
      });
    }

    if (!username || !password) {
      const attemptState = registerFailedLoginAttempt(loginAttemptKey, now);
      if (attemptState.cooldownUntil > now) {
        return reply.code(429).send({
          ok: false,
          message: 'Too many login attempts. Cooldown active for 10 minutes.'
        });
      }

      return reply.code(400).send({ ok: false, message: 'Username and password are required.' });
    }

    const user = await User.findOne({ username }).lean();
    if (!user) {
      const attemptState = registerFailedLoginAttempt(loginAttemptKey, now);
      if (attemptState.cooldownUntil > now) {
        return reply.code(429).send({
          ok: false,
          message: 'Too many login attempts. Cooldown active for 10 minutes.'
        });
      }

      return reply.code(401).send({ ok: false, message: 'Invalid credentials.' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      const attemptState = registerFailedLoginAttempt(loginAttemptKey, now);
      if (attemptState.cooldownUntil > now) {
        return reply.code(429).send({
          ok: false,
          message: 'Too many login attempts. Cooldown active for 10 minutes.'
        });
      }

      return reply.code(401).send({ ok: false, message: 'Invalid credentials.' });
    }

    if (!user.isActive) {
      const attemptState = registerFailedLoginAttempt(loginAttemptKey, now);
      if (attemptState.cooldownUntil > now) {
        return reply.code(429).send({
          ok: false,
          message: 'Too many login attempts. Cooldown active for 10 minutes.'
        });
      }

      return reply.code(403).send({
        ok: false,
        message: 'Your account is pending admin activation.'
      });
    }

    clearLoginAttempts(loginAttemptKey);

    request.session.user = mapSessionUser(user);

    return { ok: true, redirect: redirectForSessionUser(request.session.user) };
  });

  app.post('/api/subscribe', async (request, reply) => {
    const payload = {
      role: normalizeString(request.body?.role).toLowerCase(),
      username: normalizeString(request.body?.username).toLowerCase(),
      firstName: normalizeString(request.body?.firstName),
      lastName: normalizeString(request.body?.lastName),
      organisation: normalizeString(request.body?.organisation),
      city: normalizeString(request.body?.city),
      zipcode: normalizeString(request.body?.zipcode),
      email: normalizeString(request.body?.email).toLowerCase(),
      physicalAddress: normalizeString(request.body?.physicalAddress),
      phoneNumber: normalizeString(request.body?.phoneNumber),
      businessRegistrationId: normalizeString(request.body?.businessRegistrationId),
      logoDataUrl: request.body?.logoDataUrl,
      password: normalizeString(request.body?.password)
    };

    const requiredFields = [
      'role',
      'username',
      'firstName',
      'lastName',
      'organisation',
      'city',
      'zipcode',
      'email',
      'physicalAddress',
      'phoneNumber',
      'businessRegistrationId',
      'password'
    ];

    for (const key of requiredFields) {
      if (!payload[key]) {
        return reply.code(400).send({ ok: false, message: `${key} is required.` });
      }
    }

    if (!['vendor', 'client'].includes(payload.role)) {
      return reply.code(400).send({ ok: false, message: 'Role must be vendor or client.' });
    }

    const siret = parseSiretValue(payload.businessRegistrationId);
    if (!siret.ok) {
      return reply.code(400).send({ ok: false, message: siret.message });
    }

    let logoFilename = '';
    if (normalizeString(payload.logoDataUrl)) {
      const parsedLogo = parseImageUploadDataUrl(payload.logoDataUrl);
      if (!parsedLogo.ok) {
        return reply.code(400).send({ ok: false, message: parsedLogo.message });
      }

      await fs.mkdir(userLogosDir, { recursive: true });
      logoFilename = `${randomUUID()}.${parsedLogo.extension}`;
      await fs.writeFile(path.join(userLogosDir, logoFilename), parsedLogo.buffer);
    }

    const existing = await User.findOne({
      $or: [{ username: payload.username }, { email: payload.email }]
    }).lean();

    if (existing) {
      return reply.code(409).send({ ok: false, message: 'A user with that username or email already exists.' });
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const createdUser = await User.create({
      role: payload.role,
      username: payload.username,
      firstName: payload.firstName,
      lastName: payload.lastName,
      organisation: payload.organisation,
      city: payload.city,
      zipcode: payload.zipcode,
      email: payload.email,
      physicalAddress: payload.physicalAddress,
      phoneNumber: payload.phoneNumber,
      logoFilename,
      businessRegistrationId: siret.value,
      passwordHash,
      isActive: false
    });
    sendToAdminConnections(() => ({
      type: 'admin:pending-user:new',
      user: mapPendingUser(createdUser)
    }));

    return {
      ok: true,
      redirect: '/login',
      message: 'Subscription created. Your account will be active once approved by an admin.'
    };
  });

  app.post('/api/logout', { preHandler: requireAuth }, async (request, reply) => {
    await request.session.destroy();

    return reply.send({ ok: true, redirect: '/login' });
  });

  app.put('/api/account', { preHandler: requireAuth }, async (request, reply) => {
    const currentUserId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const payload = {
      firstName: normalizeString(request.body?.firstName),
      lastName: normalizeString(request.body?.lastName),
      organisation: normalizeString(request.body?.organisation),
      city: normalizeString(request.body?.city),
      zipcode: normalizeString(request.body?.zipcode),
      email: normalizeString(request.body?.email).toLowerCase(),
      physicalAddress: normalizeString(request.body?.physicalAddress),
      phoneNumber: normalizeString(request.body?.phoneNumber),
      businessDescription: normalizeString(request.body?.businessDescription),
      vatId: normalizeString(request.body?.vatId).toUpperCase(),
      billMentions: normalizeString(request.body?.billMentions),
      businessRegistrationId: normalizeString(request.body?.businessRegistrationId),
      logoDataUrl: request.body?.logoDataUrl
    };

    const requiredFields = [
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

    for (const key of requiredFields) {
      if (!payload[key]) {
        return reply.code(400).send({ ok: false, message: `${key} is required.` });
      }
    }

    const siret = parseSiretValue(payload.businessRegistrationId);
    if (!siret.ok) {
      return reply.code(400).send({ ok: false, message: siret.message });
    }

    if (request.session.user?.role === 'vendor' && payload.vatId && payload.vatId.length !== 13) {
      return reply.code(400).send({ ok: false, message: 'VAT ID must be exactly 13 characters.' });
    }

    let logoFilenameToSet = '';
    if (normalizeString(payload.logoDataUrl)) {
      const parsedLogo = parseImageUploadDataUrl(payload.logoDataUrl);
      if (!parsedLogo.ok) {
        return reply.code(400).send({ ok: false, message: parsedLogo.message });
      }

      await fs.mkdir(userLogosDir, { recursive: true });
      logoFilenameToSet = `${randomUUID()}.${parsedLogo.extension}`;
      await fs.writeFile(path.join(userLogosDir, logoFilenameToSet), parsedLogo.buffer);
    }

    const existingEmail = await User.findOne({
      email: payload.email,
      _id: { $ne: currentUserId }
    })
      .select({ _id: 1 })
      .lean();
    if (existingEmail) {
      return reply.code(409).send({ ok: false, message: 'A user with that email already exists.' });
    }

    const updateSet = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      organisation: payload.organisation,
      city: payload.city,
      zipcode: payload.zipcode,
      email: payload.email,
      physicalAddress: payload.physicalAddress,
      phoneNumber: payload.phoneNumber,
      businessRegistrationId: siret.value
    };
    if (request.session.user?.role === 'vendor') {
      updateSet.businessDescription = payload.businessDescription;
      updateSet.vatId = payload.vatId;
      updateSet.billMentions = payload.billMentions;
    }
    if (logoFilenameToSet) {
      updateSet.logoFilename = logoFilenameToSet;
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: currentUserId },
      {
        $set: updateSet
      },
      {
        new: true
      }
    ).lean();

    if (!updatedUser) {
      return reply.code(404).send({ ok: false, message: 'User not found.' });
    }

    request.session.user = mapSessionUser(updatedUser);

    return reply.send({
      ok: true,
      message: 'Account updated.',
      user: request.session.user
    });
  });

  app.post('/api/vendor/item-image', { preHandler: requireVendorApi }, async (request, reply) => {
    const parsedUpload = parseImageUploadDataUrl(request.body?.dataUrl);
    if (!parsedUpload.ok) {
      return reply.code(400).send({ ok: false, message: parsedUpload.message });
    }

    await fs.mkdir(itemImagesDir, { recursive: true });
    const imageFilename = `${randomUUID()}.${parsedUpload.extension}`;
    const imagePath = path.join(itemImagesDir, imageFilename);
    await fs.writeFile(imagePath, parsedUpload.buffer);

    return reply.send({
      ok: true,
      imageFilename,
      imageUrl: getMerchandiseImageUrl(imageFilename)
    });
  });

  app.get('/api/session', async (request, reply) => {
    if (!request.session.user) {
      return reply.code(401).send({ ok: false, user: null });
    }

    return reply.send({ ok: true, user: request.session.user });
  });

  app.get('/api/ws-token', { preHandler: requireAuth }, async (request, reply) => {
    const page = normalizeString(request.query?.page) || 'dashboard';
    const wsToken = request.server.issueWsToken(request, page);

    return reply.send({ ok: true, wsToken });
  });

  app.post('/api/webauthn/enrollment/options', { preHandler: requireAuth }, async (request, reply) => {
    const currentUserId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const user = await User.findById(currentUserId)
      .select({
        username: 1,
        firstName: 1,
        lastName: 1,
        passkeys: 1
      })
      .lean();
    if (!user) {
      return reply.code(404).send({ ok: false, message: 'User not found.' });
    }

    const options = await generateRegistrationOptions({
      rpName: getWebAuthnRpName(),
      rpID: getWebAuthnRpId(request),
      userName: user.username,
      userDisplayName: `${normalizeString(user.firstName)} ${normalizeString(user.lastName)}`.trim() || user.username,
      userID: new TextEncoder().encode(user._id.toString()),
      attestationType: 'none',
      timeout: 60000,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: isWebAuthnUserVerificationRequired() ? 'required' : 'preferred'
      },
      preferredAuthenticatorType: 'localDevice'
    });

    request.session.webauthnEnrollment = {
      challenge: options.challenge,
      userId: user._id.toString()
    };

    return reply.send({ ok: true, options });
  });

  app.get('/api/webauthn/keys', { preHandler: requireAuth }, async (request, reply) => {
    const currentUserId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const user = await User.findById(currentUserId)
      .select({ passkeys: 1 })
      .lean();
    if (!user) {
      return reply.code(404).send({ ok: false, message: 'User not found.' });
    }

    const keys = getUserPasskeys(user)
      .map(mapAccessKeySummary)
      .sort((left, right) => {
        const leftTime = Date.parse(String(left.createdAt ?? ''));
        const rightTime = Date.parse(String(right.createdAt ?? ''));
        const safeLeft = Number.isNaN(leftTime) ? 0 : leftTime;
        const safeRight = Number.isNaN(rightTime) ? 0 : rightTime;
        return safeRight - safeLeft;
      });

    return reply.send({ ok: true, keys });
  });

  app.delete('/api/webauthn/keys/:id', { preHandler: requireAuth }, async (request, reply) => {
    const currentUserId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const keyId = normalizeString(request.params?.id);
    if (!keyId) {
      return reply.code(400).send({ ok: false, message: 'Access key id is required.' });
    }

    const result = await User.updateOne(
      { _id: currentUserId },
      { $pull: { passkeys: { id: keyId } } }
    );

    if (!result.modifiedCount) {
      return reply.code(404).send({ ok: false, message: 'Access key not found.' });
    }

    return reply.send({ ok: true, message: 'Access key removed.' });
  });

  app.post('/api/webauthn/enrollment/verify', { preHandler: requireAuth }, async (request, reply) => {
    const currentUserId = normalizeString(request.session.user?.id);
    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
      return reply.code(401).send({ ok: false, message: 'Authentication required.' });
    }

    const enrollmentState = request.session.webauthnEnrollment;
    if (!enrollmentState?.challenge || enrollmentState.userId !== currentUserId) {
      return reply.code(400).send({ ok: false, message: 'WebAuthn enrollment has expired. Please retry.' });
    }

    const registrationResponse = request.body?.response;
    if (!registrationResponse || typeof registrationResponse !== 'object') {
      return reply.code(400).send({ ok: false, message: 'Missing WebAuthn registration response.' });
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge: enrollmentState.challenge,
        expectedOrigin: getWebAuthnExpectedOrigins(request),
        expectedRPID: getWebAuthnRpId(request),
        requireUserVerification: isWebAuthnUserVerificationRequired()
      });
    } catch (error) {
      return reply.code(400).send({
        ok: false,
        message: `Failed to verify WebAuthn enrollment: ${getErrorMessage(error)}`
      });
    }

    if (!verification.verified || !verification.registrationInfo) {
      return reply.code(400).send({ ok: false, message: 'WebAuthn enrollment could not be verified.' });
    }

    const user = await User.findById(currentUserId).select({ passkeys: 1 }).lean();
    if (!user) {
      return reply.code(404).send({ ok: false, message: 'User not found.' });
    }

    const credential = verification.registrationInfo.credential;
    const credentialId = normalizeString(credential?.id);
    if (!credentialId) {
      return reply.code(400).send({ ok: false, message: 'Invalid WebAuthn credential.' });
    }

    const passkeys = getUserPasskeys(user);
    if (!passkeys.some((passkey) => passkey.id === credentialId)) {
      const transports = Array.isArray(credential.transports) ? credential.transports : [];
      const userAgent = request.headers?.['user-agent'];
      const baseDeviceName = summarizeUserAgent(typeof userAgent === 'string' ? userAgent : '');
      const uniqueDeviceName = buildUniqueAccessKeyName(passkeys, baseDeviceName);
      await User.updateOne(
        { _id: currentUserId },
        {
          $push: {
            passkeys: {
              name: uniqueDeviceName,
              id: credentialId,
              publicKey: Buffer.from(credential.publicKey).toString('base64url'),
              counter: Number(credential.counter ?? 0),
              transports,
              deviceType: verification.registrationInfo.credentialDeviceType,
              backedUp: Boolean(verification.registrationInfo.credentialBackedUp),
              createdAt: new Date(),
              lastUsedAt: null
            }
          }
        }
      );
    }

    request.session.webauthnEnrollment = null;

    return reply.send({ ok: true, message: 'Access key enrolled.' });
  });

  app.post('/api/webauthn/authentication/options', async (request, reply) => {
    const options = await generateAuthenticationOptions({
      rpID: getWebAuthnRpId(request),
      timeout: 60000,
      userVerification: isWebAuthnUserVerificationRequired() ? 'required' : 'preferred'
    });

    request.session.webauthnAuthentication = {
      challenge: options.challenge
    };

    return reply.send({ ok: true, options });
  });

  app.post('/api/webauthn/authentication/verify', async (request, reply) => {
    const authenticationState = request.session.webauthnAuthentication;
    if (!authenticationState?.challenge) {
      return reply.code(400).send({ ok: false, message: 'WebAuthn authentication has expired. Please retry.' });
    }

    const authenticationResponse = request.body?.response;
    if (!authenticationResponse || typeof authenticationResponse !== 'object') {
      return reply.code(400).send({ ok: false, message: 'Missing WebAuthn authentication response.' });
    }

    const credentialId = normalizeString(authenticationResponse.id);
    if (!credentialId) {
      return reply.code(400).send({ ok: false, message: 'Invalid WebAuthn credential identifier.' });
    }

    const user = await User.findOne({ 'passkeys.id': credentialId })
      .select({
        role: 1,
        username: 1,
        firstName: 1,
        lastName: 1,
        organisation: 1,
        city: 1,
        zipcode: 1,
        email: 1,
        physicalAddress: 1,
        phoneNumber: 1,
        logoFilename: 1,
        businessRegistrationId: 1,
        isActive: 1,
        passkeys: 1
      })
      .lean();
    if (!user) {
      return reply.code(404).send({ ok: false, message: 'No account matches this access key.' });
    }

    if (!user.isActive) {
      return reply.code(403).send({
        ok: false,
        message: 'Your account is pending admin activation.'
      });
    }

    const storedPasskey = getUserPasskeys(user).find((passkey) => passkey.id === credentialId);
    const credential = mapStoredPasskeyToCredential(storedPasskey);
    if (!credential) {
      return reply.code(400).send({ ok: false, message: 'Stored access key is invalid.' });
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: authenticationState.challenge,
        expectedOrigin: getWebAuthnExpectedOrigins(request),
        expectedRPID: getWebAuthnRpId(request),
        credential,
        requireUserVerification: isWebAuthnUserVerificationRequired()
      });
    } catch (error) {
      return reply.code(401).send({
        ok: false,
        message: `Failed to verify access key authentication: ${getErrorMessage(error)}`
      });
    }

    if (!verification.verified) {
      return reply.code(401).send({ ok: false, message: 'Access key authentication failed.' });
    }

    await User.updateOne(
      {
        _id: user._id,
        'passkeys.id': credentialId
      },
      {
        $set: {
          'passkeys.$.counter': verification.authenticationInfo.newCounter,
          'passkeys.$.deviceType': verification.authenticationInfo.credentialDeviceType,
          'passkeys.$.backedUp': verification.authenticationInfo.credentialBackedUp,
          'passkeys.$.lastUsedAt': new Date()
        }
      }
    );

    request.session.user = mapSessionUser(user);
    request.session.webauthnAuthentication = null;

    return reply.send({
      ok: true,
      redirect: redirectForSessionUser(request.session.user)
    });
  });
}
