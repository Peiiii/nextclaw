import { useEffect, useRef, useState, type FormEvent } from "react";
import { BiboButton, BiboComposer, BiboMessage } from "@nextclaw/bibo-ui";
import { biboCopy as copy } from "@/features/chat/configs/bibo-copy.config";
import { useBiboChatStore } from "@/features/chat/stores/bibo-chat.store";

const suggestions = [
  { mark: "✳", label: "先认识我", text: "我想让你成为我的个人搭档。先问我三个关键问题，了解我最近最在意的目标，然后帮我选一件今天能推进的事。" },
  { mark: "▤", label: "梳理一个项目", text: "我正在做一个项目，想和你一起理清现状、目标和下一步。请先问我必要的问题。" },
  { mark: "◷", label: "整理今天", text: "今天我有不少事要做。请帮我根据重要性和精力安排一个现实可执行的计划，先问我需要的信息。" },
];

function AuthPanel() {
  const mode = useBiboChatStore((state) => state.authMode);
  const error = useBiboChatStore((state) => state.authError);
  const setMode = useBiboChatStore((state) => state.setAuthMode);
  const sendCode = useBiboChatStore((state) => state.sendCode);
  const authenticate = useBiboChatStore((state) => state.authenticate);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [codeWorking, setCodeWorking] = useState(false);
  const requestCode = async () => {
    setCodeWorking(true);
    try { await sendCode(email.trim()); }
    finally { setCodeWorking(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setWorking(true);
    try { await authenticate(email.trim(), password, code.trim()); }
    finally { setWorking(false); }
  };
  return <div className="bibo-auth-overlay"><section className="bibo-auth-card" aria-labelledby="bibo-auth-title">
    <div className="bibo-auth-mark">✳</div>
    <p className="bibo-eyebrow">WELCOME TO BIBO</p>
    <h2 id="bibo-auth-title">认识你的新搭档</h2>
    <p>{copy.accountIntro}</p>
    <div className="bibo-auth-tabs" role="group" aria-label="账号操作">
      <BiboButton className={mode === "register" ? "is-selected" : ""} onClick={() => setMode("register")}>{copy.register}</BiboButton>
      <BiboButton className={mode === "login" ? "is-selected" : ""} onClick={() => setMode("login")}>{copy.login}</BiboButton>
    </div>
    <form onSubmit={submit}>
      <label htmlFor="bibo-email">{copy.email}</label>
      <input id="bibo-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
      {mode === "register" && <><label htmlFor="bibo-code">{copy.code}</label><div className="bibo-code-row">
        <input id="bibo-code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value)} placeholder="输入 6 位验证码" />
        <BiboButton disabled={!email || codeWorking} onClick={() => void requestCode()}>{copy.sendCode}</BiboButton>
      </div></>}
      <label htmlFor="bibo-password">{copy.password}</label>
      <input id="bibo-password" type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 个字符" />
      <p className="bibo-auth-error" role="alert">{error}</p>
      <BiboButton tone="primary" type="submit" disabled={working}>{mode === "login" ? copy.login : copy.createAccount} ↗</BiboButton>
    </form>
    <p className="bibo-auth-note">账号使用 NextClaw 基础服务；Bibo 提供有上限的模型试用。请勿输入无需分享的敏感信息。</p>
  </section></div>;
}

export function BiboApp() {
  const store = useBiboChatStore();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { void store.bootstrap(); }, []);
  useEffect(() => {
    if (!store.menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { store.setMenuOpen(false); menuButtonRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [store.menuOpen]);
  useEffect(() => {
    const list = listRef.current;
    if (list && store.following) list.scrollTop = list.scrollHeight;
  }, [store.messages.length, store.pendingMessage, store.partial, store.following]);
  const onScroll = () => {
    const list = listRef.current;
    if (list) store.setFollowing(list.scrollHeight - list.scrollTop - list.clientHeight < 90);
  };
  const jumpToLatest = () => {
    store.setFollowing(true);
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  };
  const closeMenu = () => store.setMenuOpen(false);
  const reset = () => { if (window.confirm(copy.resetConfirm)) void store.reset(); };
  const hasMessages = store.messages.length > 0 || Boolean(store.pendingMessage);
  return <div className="bibo-shell">
    <aside className={`bibo-sidebar${store.menuOpen ? " is-open" : ""}`} aria-label="导航">
      <a className="bibo-brand" href="/" aria-label="Bibo 首页"><span className="bibo-brand-mark">✳</span><span>Bibo<span className="bibo-brand-dot">.</span></span></a>
      <p className="bibo-sidebar-label">{copy.space}</p>
      <BiboButton className="bibo-nav-item is-active" onClick={closeMenu}>◫ &nbsp; {copy.companion}</BiboButton>
      <div className="bibo-sidebar-spacer" />
      <nav className="bibo-sidebar-foot" aria-label="帮助和账号">
        <span className="bibo-online"><span /> Bibo 正在这里</span>
        <a href="https://bibo.bot/" target="_blank" rel="noopener noreferrer">认识 Bibo ↗</a>
        <a href="/help.html">{copy.help}</a>
        {store.user && <><BiboButton onClick={reset}>{copy.reset}</BiboButton><BiboButton onClick={() => void store.logout()}>{copy.logout}</BiboButton></>}
      </nav>
    </aside>
    {store.menuOpen && <button className="bibo-nav-backdrop" type="button" aria-label="关闭导航" onClick={closeMenu} />}
    <main className="bibo-main">
      <header className="bibo-topbar"><div className="bibo-topbar-leading">
        <BiboButton ref={menuButtonRef} className="bibo-menu-button" aria-label="打开菜单" title="打开菜单" aria-expanded={store.menuOpen} onClick={() => store.setMenuOpen(!store.menuOpen)}>☰</BiboButton>
        <span>{copy.space} <span className="bibo-slash">/</span> {copy.conversation}</span>
      </div><div className="bibo-account"><span className="bibo-beta">EARLY ACCESS</span>{store.user?.email}</div></header>
      <section className="bibo-conversation" aria-label="与 Bibo 对话">
        {!hasMessages && <div className="bibo-welcome">
          <div className="bibo-orb" aria-hidden="true">✳</div>
          <p className="bibo-eyebrow">A COMPANION FOR YOUR EVERYDAY</p>
          <h1>{copy.greeting}</h1>
          <p>{copy.welcome}</p>
          <div className="bibo-suggestions">{suggestions.map((suggestion) => <BiboButton key={suggestion.label} onClick={() => { store.setDraft(suggestion.text); inputRef.current?.focus(); }}><span>{suggestion.mark}</span>{suggestion.label}<span>↗</span></BiboButton>)}</div>
        </div>}
        {hasMessages && <div className="bibo-messages" ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions text">
          {store.messages.map((message, index) => <BiboMessage key={`${message.at}-${index}`} role={message.role} text={message.text}
            label={message.role === "assistant" ? "Bibo" : copy.you} copyLabel={copy.copy}
            onCopy={message.role === "assistant" ? () => { void navigator.clipboard.writeText(message.text).then(store.copied).catch(store.copyFailed); } : undefined} />)}
          {store.pendingMessage && <><BiboMessage role="user" text={store.pendingMessage} label={copy.you} pending />
            <BiboMessage role="assistant" text={store.partial} label="Bibo" pending /></>}
        </div>}
        {hasMessages && !store.following && <BiboButton className="bibo-jump" onClick={jumpToLatest}>{copy.backToLatest}</BiboButton>}
      </section>
      <div className="bibo-composer-wrap">
        <div className="bibo-status" role="status" aria-live="polite">{store.status}</div>
        <BiboComposer inputRef={inputRef} value={store.draft} onChange={store.setDraft} onSend={() => void store.send()} onStop={() => void store.stop()}
          busy={store.phase !== "idle"} canStop={store.phase === "generating" && Boolean(store.runId)}
          placeholder={copy.placeholder} sendLabel={copy.send} stopLabel={copy.stop} hint={copy.savingHint} />
        <p className="bibo-hint">Bibo 还在早期阶段。请核对重要结果；每小时最多 12 次对话。</p>
      </div>
    </main>
    {store.authChecked && !store.user && <AuthPanel />}
  </div>;
}
