export async function exerciseUserAuthFlows(params) {
  const {
    base,
    email,
    password,
    resetPassword,
    requestJson
  } = params;

  const sendUserCode = await requestJson({
    method: "POST",
    url: `${base}/platform/auth/register/send-code`,
    body: { email },
    expectedStatus: 202
  });
  const debugCode = sendUserCode.body?.data?.debugCode;
  if (!debugCode) {
    throw new Error(`Expected debug code in console email mode, got: ${JSON.stringify(sendUserCode.body)}`);
  }

  await requestJson({
    method: "POST",
    url: `${base}/platform/auth/register/send-code`,
    body: { email },
    expectedStatus: 429
  });

  const registerUser = await requestJson({
    method: "POST",
    url: `${base}/platform/auth/register/complete`,
    body: { email, code: debugCode, password },
    expectedStatus: 201
  });
  if (registerUser.body?.data?.user?.role !== "user") {
    throw new Error(`Expected user role, got: ${JSON.stringify(registerUser.body)}`);
  }

  const registeredUserId = registerUser.body?.data?.user?.id;
  if (!registeredUserId) {
    throw new Error("Missing user id after register.");
  }

  const userLogin = await requestJson({
    method: "POST",
    url: `${base}/platform/auth/login`,
    body: { email, password },
    expectedStatus: 200
  });
  const userToken = userLogin.body?.data?.token;
  const userId = userLogin.body?.data?.user?.id;
  if (!userToken || !userId) {
    throw new Error("Missing user token/id after login.");
  }
  if (userId !== registeredUserId) {
    throw new Error(`Expected login to return registered user ${registeredUserId}, got ${userId}`);
  }

  const sendResetCode = await requestJson({
    method: "POST",
    url: `${base}/platform/auth/password/reset/send-code`,
    body: { email },
    expectedStatus: 202
  });
  const resetCode = sendResetCode.body?.data?.debugCode;
  if (!resetCode) {
    throw new Error(`Expected reset debug code, got: ${JSON.stringify(sendResetCode.body)}`);
  }

  await requestJson({
    method: "POST",
    url: `${base}/platform/auth/password/reset/complete`,
    body: { email, code: resetCode, password: resetPassword },
    expectedStatus: 200
  });

  await requestJson({
    method: "POST",
    url: `${base}/platform/auth/login`,
    body: { email, password: resetPassword },
    expectedStatus: 200
  });

  return {
    userId,
    userToken
  };
}
