import type { BrowserAuthLocale } from "@/services/auth-browser-page-renderer.service.js";

export type BrowserAuthCopyTree = {
  [key: string]: string | BrowserAuthCopyTree;
};

export const supportedBrowserAuthLocales = ["zh-CN", "en-US"] as const;

export const browserAuthCopy: Record<BrowserAuthLocale, BrowserAuthCopyTree> = {
  "zh-CN": {
    meta: {
      htmlTitle: "NextClaw Account 设备授权",
      platformTag: "NextClaw Platform",
      accountTag: "NextClaw Account",
      languageLabel: "语言",
      languageNames: {
        "zh-CN": "中文",
        "en-US": "English",
      },
      sessionPreview: "会话 {sessionId}...",
      expiresAt: "本次设备授权将在 {expiresAt} 过期。",
    },
    hero: {
      title: "登录 NextClaw Account，把设备和网页入口接到同一套体验里。",
      description:
        "一个 NextClaw Account，把本地设备、网页入口、远程访问和后续协作能力连成一条连续路径。登录之后，你的实例、分享和账号能力都会在这里汇合。",
      highlights: {
        account: {
          title: "一个账号，连接所有入口",
          description:
            "桌面端、网页端和后续账号能力共享同一个 NextClaw Account，不需要维护两套身份。",
        },
        workflow: {
          title: "继续你的实例与 Agent 工作流",
          description:
            "完成授权后，当前设备会直接接入网页入口，后续可以继续远程访问和协作链路。",
        },
        control: {
          title: "统一体验，但边界清晰可控",
          description:
            "我们追求统一入口，而不是割裂页面。登录、注册、找回密码和后续账号操作都应该保持同一套语言与品牌感。",
        },
      },
    },
    heading: {
      pending: {
        title: "连接这台 NextClaw 设备",
        subtitle: "登录 NextClaw Account，授权当前本地设备接入网页与远程能力。",
      },
      authorized: {
        title: "设备已授权",
        subtitle: "可以回到 NextClaw 继续使用了，这个浏览器页面现在可以关闭。",
      },
      expired: {
        title: "授权已过期",
        subtitle: "这个授权会话已经失效，请回到 NextClaw 重新发起一次授权。",
      },
      missing: {
        title: "授权不存在",
        subtitle: "当前设备授权请求已经失效或不存在，请回到 NextClaw 重新开始。",
      },
    },
    modes: {
      login: {
        label: "登录",
        title: "邮箱 + 密码登录",
        subtitle: "已有 NextClaw Account 可直接登录。注册和找回密码在旁边两个入口。",
        sectionLabel: "登录",
        sectionCopy:
          "使用你的 NextClaw Account 邮箱和密码登录。新注册账号需要先完成邮箱验证码验证。",
      },
      register: {
        label: "注册",
        title: "先验证邮箱，再设置密码",
        subtitle: "新账号必须先通过邮箱验证码验证归属，再设置密码完成注册。",
        sectionLabel: "注册",
        sectionCopy: "先输入邮箱并发送验证码，收到 6 位验证码后再设置密码并完成设备授权。",
        verifyLabel: "验证邮箱",
        verifyCopy: "我们已经向 <strong>{email}</strong> 发送了 6 位验证码。输入验证码并设置密码即可完成注册。",
      },
      reset_password: {
        label: "忘记密码",
        title: "验证邮箱后重置密码",
        subtitle: "我们会先确认邮箱归属，再允许你设置新的登录密码。",
        sectionLabel: "重置密码",
        sectionCopy: "输入你的账号邮箱，我们会先发送验证码，验证通过后再允许设置新密码。",
        verifyLabel: "设置新密码",
        verifyCopy: "我们已经向 <strong>{email}</strong> 发送了 6 位验证码。输入验证码并设置新的密码。",
      },
    },
    fields: {
      email: "邮箱",
      password: "密码",
      code: "验证码",
      setPassword: "设置密码",
      newPassword: "新密码",
    },
    placeholders: {
      email: "name@example.com",
      password: "请输入你的密码",
      passwordMin: "至少 8 位",
      code: "123456",
    },
    actions: {
      authorize: "授权设备",
      sendCode: "发送验证码",
      createAccountAndAuthorize: "创建账号并授权",
      resetPasswordAndAuthorize: "重置密码并授权",
      resendCode: "重新发送",
      changeEmail: "更换邮箱",
    },
    notices: {
      success: {
        verificationCodeSent: "验证码已发送。",
        deviceLinked: "这台设备已经成功绑定到你的 NextClaw Account。",
        accountCreatedAndAuthorized: "账号创建完成，设备也已授权。",
        passwordResetAndAuthorized: "密码已重置，设备也已授权。",
        alreadyAuthorized: "这台设备已经完成授权。",
      },
      error: {
        missingSession: "缺少授权会话。",
        sessionNotFound: "授权会话不存在。",
        sessionExpired: "授权会话已过期。",
        invalidCredentials: "邮箱或密码不正确。",
        invalidEmail: "请输入有效的邮箱地址。",
        weakPassword: "密码至少需要 8 位。",
        emailExists: "这个邮箱已经注册过了。",
        emailNotFound: "这个邮箱还没有注册。",
        codeAlreadySent: "验证码刚刚发送过，请稍后再试。",
        invalidCode: "验证码格式不正确或验证码无效。",
        codeNotFound: "验证码不存在或已过期。",
        tooManyAttempts: "尝试次数过多，请稍后再试。",
        accountLocked: "账号因连续失败被临时锁定，请稍后再试。",
        registerFailed: "创建账号失败，请稍后重试。",
        passwordUpdateFailed: "重置密码失败，请稍后重试。",
        emailProviderNotConfigured: "验证码邮件服务暂时不可用，请稍后再试。",
        emailDeliveryFailed: "验证码邮件发送失败，请稍后再试。",
        unknown: "操作失败，请稍后再试。",
      },
      accountLockedUntil: "账号因连续失败被临时锁定，请在 {time} 后重试。",
    },
  },
  "en-US": {
    meta: {
      htmlTitle: "NextClaw Account Device Authorization",
      platformTag: "NextClaw Platform",
      accountTag: "NextClaw Account",
      languageLabel: "Language",
      languageNames: {
        "zh-CN": "中文",
        "en-US": "English",
      },
      sessionPreview: "Session {sessionId}...",
      expiresAt: "This device authorization expires at {expiresAt}.",
    },
    hero: {
      title: "Sign in to NextClaw Account and connect this device to the same web experience.",
      description:
        "One NextClaw Account brings together local devices, web entry, remote access, and future collaboration into a single flow. Once you sign in, your instances, shares, and account capabilities all meet here.",
      highlights: {
        account: {
          title: "One account across every entry point",
          description:
            "Desktop, web, and future account capabilities all use the same NextClaw Account, so you do not have to manage separate identities.",
        },
        workflow: {
          title: "Continue your instances and agent workflows",
          description:
            "After authorization, this device stays connected to the web entry so remote access and follow-up collaboration can continue naturally.",
        },
        control: {
          title: "Unified experience with clear control",
          description:
            "We want a true unified entry point, not a detached auth page. Sign in, sign up, password reset, and later account actions should feel like one product.",
        },
      },
    },
    heading: {
      pending: {
        title: "Connect this NextClaw device",
        subtitle: "Sign in to your NextClaw Account and authorize this local device for web and remote capabilities.",
      },
      authorized: {
        title: "Device authorized",
        subtitle: "Return to NextClaw to continue. This browser page can be closed now.",
      },
      expired: {
        title: "Authorization expired",
        subtitle: "This authorization session has expired. Return to NextClaw and start it again.",
      },
      missing: {
        title: "Authorization not found",
        subtitle: "This authorization request is no longer valid. Return to NextClaw and start again.",
      },
    },
    modes: {
      login: {
        label: "Login",
        title: "Email + password",
        subtitle: "Use your existing NextClaw Account password to sign in. Registration and password reset are in the other tabs.",
        sectionLabel: "Sign in",
        sectionCopy: "Use your NextClaw Account email and password. New accounts must verify email ownership before registration completes.",
      },
      register: {
        label: "Sign up",
        title: "Verify email, then set password",
        subtitle: "New accounts must verify email ownership with a code before choosing a password.",
        sectionLabel: "Create account",
        sectionCopy: "Enter your email first and send a code. Once the 6-digit code arrives, set your password and finish authorizing this device.",
        verifyLabel: "Verify email",
        verifyCopy: "We sent a 6-digit verification code to <strong>{email}</strong>. Enter it and choose your password to finish sign up.",
      },
      reset_password: {
        label: "Reset",
        title: "Verify email, then reset password",
        subtitle: "We verify email ownership first, then allow you to set a new password.",
        sectionLabel: "Reset password",
        sectionCopy: "Enter your account email. We will send a verification code before allowing a new password.",
        verifyLabel: "Set a new password",
        verifyCopy: "We sent a 6-digit verification code to <strong>{email}</strong>. Enter it and set a new password.",
      },
    },
    fields: {
      email: "Email",
      password: "Password",
      code: "Verification code",
      setPassword: "Set password",
      newPassword: "New password",
    },
    placeholders: {
      email: "name@example.com",
      password: "Enter your password",
      passwordMin: "At least 8 characters",
      code: "123456",
    },
    actions: {
      authorize: "Authorize device",
      sendCode: "Send verification code",
      createAccountAndAuthorize: "Create account and authorize",
      resetPasswordAndAuthorize: "Reset password and authorize",
      resendCode: "Resend code",
      changeEmail: "Change email",
    },
    notices: {
      success: {
        verificationCodeSent: "Verification code sent.",
        deviceLinked: "This device is now linked to your NextClaw Account.",
        accountCreatedAndAuthorized: "Account created and device authorized.",
        passwordResetAndAuthorized: "Password reset and device authorized.",
        alreadyAuthorized: "This device is already authorized.",
      },
      error: {
        missingSession: "Missing authorization session.",
        sessionNotFound: "Authorization session not found.",
        sessionExpired: "Authorization session expired.",
        invalidCredentials: "Invalid email or password.",
        invalidEmail: "A valid email is required.",
        weakPassword: "Password must be at least 8 characters.",
        emailExists: "This email is already registered.",
        emailNotFound: "This email is not registered.",
        codeAlreadySent: "A verification code was just sent. Please wait before requesting another one.",
        invalidCode: "The verification code is invalid.",
        codeNotFound: "Verification code not found or expired.",
        tooManyAttempts: "Too many attempts. Please try again later.",
        accountLocked: "This account is temporarily locked. Please retry later.",
        registerFailed: "Failed to create the account. Please try again later.",
        passwordUpdateFailed: "Failed to update the password. Please try again later.",
        emailProviderNotConfigured: "Verification email delivery is temporarily unavailable.",
        emailDeliveryFailed: "Failed to send the verification email. Please try again later.",
        unknown: "Something went wrong. Please try again later.",
      },
      accountLockedUntil: "This account is temporarily locked. Please retry after {time}.",
    },
  },
};
