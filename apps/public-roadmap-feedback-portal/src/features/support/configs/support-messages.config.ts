export const supportMessages = {
  zh: {
    receiptError: "无法读取本地反馈回执，请使用备份文件恢复。", unavailable: "反馈服务暂时不可用。", failed: "操作失败，请重试。", invalidReceipt: "回执不属于当前服务，或格式不正确。",
    heading: "反馈问题", intro: "告诉我们哪里出了问题。无需注册，提交后可以在这里查看回复。",
    title: "简短描述", description: "发生了什么？", environment: "运行环境（选填）", version: "NextClaw 版本（选填）",
    privacy: "反馈仅你和维护者可见。请勿填写密码、密钥或无关个人信息。",
    submit: "提交反馈", pending: "处理中…", mine: "我的反馈", empty: "还没有反馈。提交后，回执会保存在当前设备。",
    refresh: "刷新", back: "返回反馈列表", reply: "补充信息", send: "发送补充", withdraw: "撤回反馈",
    withdrawConfirm: "确认撤回？维护者将停止对该反馈发起新处理。", restore: "恢复回执", export: "下载回执",
    receipt: "请选择之前下载的回执文件", detail: "反馈详情", anonymous: "匿名反馈", verified: "已关联 NextClaw 账号",
    account: "同步账号反馈", link: "关联当前账号", maintainer: "维护者", user: "你",
    published: "修复版本", saved: "反馈已提交，回执已保存在本机。", notice: "清理浏览器数据会丢失匿名回执，建议下载备份。",
    close: "关闭", next: "下一页", first: "回到首页",
    status: { received: "已收到", "needs-info": "待补充", "needs-decision": "待判断", working: "处理中", ready: "待发布", published: "已发布", resolved: "已处理", withdrawn: "已撤回" }
  },
  en: {
    receiptError: "Cannot read local receipts. Restore a backup file.", unavailable: "Feedback service is temporarily unavailable.", failed: "The operation failed. Please retry.", invalidReceipt: "This receipt is invalid or belongs to another service.",
    heading: "Report a problem", intro: "Tell us what went wrong. No account required. Return here to read replies.",
    title: "Short summary", description: "What happened?", environment: "Environment (optional)", version: "NextClaw version (optional)",
    privacy: "Only you and maintainers can read this report. Do not include passwords, keys or unrelated personal data.",
    submit: "Submit report", pending: "Working…", mine: "My reports", empty: "No reports yet. Receipts are saved on this device after submission.",
    refresh: "Refresh", back: "Back to reports", reply: "Additional information", send: "Send update", withdraw: "Withdraw report",
    withdrawConfirm: "Withdraw this report? Maintainers will stop starting new work on it.", restore: "Restore receipt", export: "Download receipt",
    receipt: "Choose a previously downloaded receipt", detail: "Report details", anonymous: "Anonymous report", verified: "NextClaw account linked",
    account: "Sync account reports", link: "Link current account", maintainer: "Maintainer", user: "You",
    published: "Fixed in", saved: "Report submitted. Your receipt is saved on this device.", notice: "Clearing browser data removes anonymous receipts. Download a backup.",
    close: "Close", next: "Next page", first: "First page",
    status: { received: "Received", "needs-info": "Needs information", "needs-decision": "Needs decision", working: "In progress", ready: "Awaiting release", published: "Released", resolved: "Resolved", withdrawn: "Withdrawn" }
  }
};
export const supportText = supportMessages[navigator.language.startsWith("zh") ? "zh" : "en"];
