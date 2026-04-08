interface ChatViewProps {
  chatMsgs: { role: string; content: string }[];
  chatLoading: boolean;
  chatInput: string;
  setChatInput: (v: string) => void;
  searchAllBrains: boolean;
  setSearchAllBrains: (v: boolean) => void;
  handleChat: () => void;
  vaultUnlockModal: { vaultData: any; pendingMsg: string } | null;
  setVaultUnlockModal: (v: any) => void;
  vaultModalInput: string;
  setVaultModalInput: (v: string) => void;
  vaultModalMode: "passphrase" | "recovery";
  setVaultModalMode: (v: "passphrase" | "recovery") => void;
  vaultModalError: string;
  vaultModalBusy: boolean;
  handleVaultModalUnlock: () => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
  brains: any[];
  phoneRegex: RegExp;
}

export default function ChatView({
  chatMsgs,
  chatLoading,
  chatInput,
  setChatInput,
  searchAllBrains,
  setSearchAllBrains,
  handleChat,
  vaultUnlockModal,
  setVaultUnlockModal,
  vaultModalInput,
  setVaultModalInput,
  vaultModalMode,
  setVaultModalMode,
  vaultModalError,
  vaultModalBusy,
  handleVaultModalUnlock,
  chatEndRef,
  brains,
  phoneRegex,
}: ChatViewProps) {
  return (
    <div className="flex flex-col h-[calc(100dvh-180px)] lg:h-[calc(100dvh-80px)]">
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {chatMsgs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #d575ff, #9800d0)" }}>
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-on-surface text-lg mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>Ask your brain anything</p>
              <p className="text-sm text-on-surface-variant max-w-xs">Questions, summaries, connections — your knowledge at your fingertips.</p>
            </div>
          </div>
        )}

        {chatMsgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-3 items-start"}>
            {m.role === "assistant" && (
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1" style={{ background: "linear-gradient(135deg, #d575ff, #9800d0)" }}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09z" />
                </svg>
              </div>
            )}
            <div
              className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
              style={
                m.role === "user"
                  ? { background: "rgba(114,239,245,0.12)", border: "1px solid rgba(114,239,245,0.18)", color: "#ffffff", borderRadius: "1rem 1rem 2px 1rem" }
                  : { background: "#1a1919", border: "1px solid rgba(72,72,71,0.08)", color: "#adaaaa", borderRadius: "2px 1rem 1rem 1rem" }
              }
            >
              {m.role === "assistant"
                ? m.content.split(phoneRegex).map((part, pi) =>
                    phoneRegex.test(part) ? <a key={pi} href={`tel:${part}`} className="text-primary underline">{part}</a> : part,
                  )
                : m.content}
            </div>
          </div>
        ))}

        {chatLoading && (
          <div className="flex gap-3 items-center">
            <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center animate-pulse" style={{ background: "linear-gradient(135deg, #d575ff, #9800d0)" }}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09z" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl" style={{ background: "#1a1919" }}>
              <span className="w-2 h-2 rounded-full bg-secondary animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-secondary animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-secondary animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {vaultUnlockModal && (
          <div className="p-4 rounded-2xl border" style={{ background: "rgba(255,154,195,0.06)", borderColor: "rgba(255,154,195,0.18)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-tertiary" style={{ fontFamily: "'Manrope', sans-serif" }}>🔐 Unlock Vault</span>
              <button onClick={() => setVaultUnlockModal(null)} className="text-on-surface-variant hover:text-on-surface press-scale">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex gap-2 mb-3">
              {(["passphrase", "recovery"] as const).map((mode) => (
                <button key={mode} onClick={() => { setVaultModalMode(mode); setVaultModalInput(""); }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                  style={{ background: vaultModalMode === mode ? "rgba(255,154,195,0.15)" : "#262626", color: vaultModalMode === mode ? "#ff9ac3" : "#adaaaa", border: `1px solid ${vaultModalMode === mode ? "rgba(255,154,195,0.25)" : "rgba(72,72,71,0.15)"}` }}
                >{mode === "passphrase" ? "Passphrase" : "Recovery Key"}</button>
              ))}
            </div>
            <input
              type={vaultModalMode === "passphrase" ? "password" : "text"}
              value={vaultModalInput}
              onChange={(e) => setVaultModalInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVaultModalUnlock()}
              placeholder={vaultModalMode === "passphrase" ? "Enter vault passphrase..." : "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"}
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none mb-3 min-h-[44px]"
              style={{ background: "#262626", border: "1px solid rgba(72,72,71,0.2)" }}
            />
            {vaultModalError && <p className="text-xs text-error mb-2">{vaultModalError}</p>}
            <button onClick={handleVaultModalUnlock} disabled={vaultModalBusy || !vaultModalInput.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-bold press-scale disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #ff9ac3, #ec77aa)", color: "#6b0c40" }}
            >{vaultModalBusy ? "Unlocking…" : "Unlock & Answer"}</button>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="pt-3 border-t" style={{ borderColor: "rgba(72,72,71,0.10)" }}>
        {brains.length > 1 && (
          <div className="flex mb-2 p-1 rounded-xl gap-1" style={{ background: "#1a1919" }}>
            <button onClick={() => setSearchAllBrains(false)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={!searchAllBrains ? { background: "#303030", color: "#ffffff" } : { color: "#555" }}>
              This brain
            </button>
            <button onClick={() => setSearchAllBrains(true)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={searchAllBrains ? { background: "rgba(213,117,255,0.15)", color: "#d575ff" } : { color: "#555" }}>
              All brains
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChat()}
            placeholder={searchAllBrains ? "Ask across all your brains…" : "Ask about your memories…"}
            className="flex-1 px-4 py-3 rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none min-h-[44px] transition-all"
            style={{ background: "#262626", border: "1px solid rgba(72,72,71,0.20)" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(114,239,245,0.4)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(72,72,71,0.20)"; }}
          />
          <button onClick={handleChat} disabled={chatLoading}
            className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center press-scale disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #72eff5, #1fb1b7)", color: "#002829" }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
