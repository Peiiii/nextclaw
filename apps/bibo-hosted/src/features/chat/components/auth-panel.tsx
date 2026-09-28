import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button, Input, SegmentedControl } from "@nextclaw/personal-agent-ui";
import { BiboCompanion } from "@/shared/components/bibo-companion";
import { biboCopy as copy } from "@/shared/configs/bibo-copy.config";
import { useBiboChatStore } from "@/features/chat/stores/bibo-chat.store";

export function AuthPanel() {
  const mode = useBiboChatStore((state) => state.authMode);
  const feedback = useBiboChatStore((state) => state.authFeedback);
  const setMode = useBiboChatStore((state) => state.setAuthMode);
  const sendCode = useBiboChatStore((state) => state.sendCode);
  const authenticate = useBiboChatStore((state) => state.authenticate);
  const panelRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  const [mobileStep, setMobileStep] = useState<"email" | "details">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [codeWorking, setCodeWorking] = useState(false);

  useEffect(() => { panelRef.current?.focus(); }, []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => { if (mobile && mobileStep === "details") titleRef.current?.focus(); }, [mobile, mobileStep]);

  const changeMode = (nextMode: "register" | "login") => {
    setMode(nextMode);
    setMobileStep("email");
  };

  const requestCode = async () => {
    if (emailRef.current && !emailRef.current.reportValidity()) return;
    setCodeWorking(true);
    try { await sendCode(email.trim()); }
    finally { setCodeWorking(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mobile && mobileStep === "email") {
      setMobileStep("details");
      if (mode === "register") await requestCode();
      return;
    }
    setWorking(true);
    try { await authenticate(email.trim(), password, code.trim()); }
    finally { setWorking(false); }
  };

  const mobileDetails = mobile && mobileStep === "details";
  const title = mobileDetails
    ? mode === "register" ? "查收邮箱验证码" : "输入密码"
    : mode === "register" ? "一起，从这里开始。" : "回来啦，继续往前。";
  const description = mobileDetails
    ? mode === "register" ? "输入邮件中的验证码，或重新发送。" : "继续使用你的 Bibo 空间。"
    : mode === "register" ? "创建账号，和 Bibo 开始一段属于你的协作。" : "登录后，回到你的对话与个人空间。";
  return <div className="bibo-auth-overlay"><section ref={panelRef} className="bibo-auth-card" data-step={mobileDetails ? "details" : "email"} role="dialog" aria-modal="true" aria-labelledby="bibo-auth-title" tabIndex={-1}>
    <div className="bibo-auth-story">
      <div className="bibo-auth-wordmark">Bibo<span>.</span></div>
      <div className="bibo-auth-scene" aria-hidden="true"><span className="bibo-auth-halo" /><BiboCompanion className="bibo-auth-companion" /><span className="bibo-auth-spark bibo-auth-spark-one">✳</span><span className="bibo-auth-spark bibo-auth-spark-two">✦</span></div>
      <div className="bibo-auth-story-copy"><span className="bibo-auth-story-kicker">你的个人 AI 搭档</span><h1>有你在意的事，<br />就有我帮忙的地方。</h1><p>从一个想法、一项待办，或一段对话开始。</p></div>
      <p className="bibo-auth-story-foot">想法 · 日程 · 待办 · 文件</p>
    </div>
    <div className="bibo-auth-form-pane">
      {mobileDetails && <button className="bibo-auth-back" type="button" onClick={() => setMobileStep("email")}><ArrowLeft size={18} aria-hidden="true" />返回</button>}
      <div className="bibo-auth-form-head"><p className="bibo-auth-eyebrow">很高兴见到你</p><h2 ref={titleRef} id="bibo-auth-title" tabIndex={mobileDetails ? -1 : undefined}>{title}</h2><p>{description}</p></div>
      {!mobileDetails && <div className="bibo-auth-tabs"><SegmentedControl label="账号操作" value={mode} options={[{ value: "register", label: copy.register }, { value: "login", label: copy.login }]} onChange={changeMode} /></div>}
      <form onSubmit={submit} aria-busy={working}>
        {!mobileDetails ? <div className="bibo-auth-field"><label htmlFor="bibo-email">{copy.email}</label><Input ref={emailRef} id="bibo-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="你的邮箱地址" /></div> : <p className="bibo-auth-email-summary">{email}<button type="button" onClick={() => setMobileStep("email")}>修改</button></p>}
        {(!mobile || mobileDetails) && <>
          {mode === "register" && <div className="bibo-auth-field"><label htmlFor="bibo-code">{copy.code}</label><div className="bibo-code-row"><Input id="bibo-code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value)} placeholder="6 位验证码" /><Button className="bibo-code-send" disabled={!email || codeWorking} onClick={() => void requestCode()}>{codeWorking ? "发送中…" : mobile ? "重新发送" : "获取验证码"}</Button></div></div>}
          <div className="bibo-auth-field"><label htmlFor="bibo-password">{copy.password}</label><Input id="bibo-password" type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "至少 8 个字符" : "输入密码"} /></div>
        </>}
        {feedback && (!mobile || mobileDetails) && <p className={`bibo-auth-feedback is-${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.kind === "success" && <Check size={16} aria-hidden="true" />}{feedback.message}</p>}
        <Button className="bibo-auth-submit" tone="primary" type="submit" disabled={working || (mobile && mobileStep === "email" && codeWorking)}>{working ? "请稍候…" : mobile && mobileStep === "email" ? "继续" : mode === "login" ? copy.login : copy.createAccount}<ArrowRight size={17} aria-hidden="true" /></Button>
      </form>
      <p className="bibo-auth-note">Bibo 提供有限的免费试用，请勿输入敏感信息。</p>
    </div>
  </section></div>;
}
