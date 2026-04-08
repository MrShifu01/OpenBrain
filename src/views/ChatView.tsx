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
      <div className="flex-1 overflow-y-auto space-y-4 pb-4" aria-live="polite" aria-atomic="false">
        {chatMsgs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <p
              className="text-xl text-on-surface"
              style={{ fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}
            >
              Ask your brain anything
            </p>
            <p className="text-sm max-w-xs leading-relaxed" style={{ color: "var(--color-on-surface-variant)" }}>
              Questions, summaries, connections — your knowledge at your fingertips.
            </p>
          </div>
        )}

        {chatMsgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-3 items-start"}>
            {m.role === "assistant" && (
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1"
                style={{ background: "var(--color-primary-container)" }}
              >
                <svg className="w-4 h-4" style={{ color: "var(--color-primary)" }} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09z" />
                </svg>
              </div>
            )}
            <div
              className="max-w-[80%] px-4 py-3 text-sm leading-relaxed"
              style={
                m.role === "user"
                  ? {
                      background: "var(--color-primary-container)",
                      color: "var(--color-on-primary-container)",
                      borderRadius: "1rem 1rem 2px 1rem",
                    }
                  : {
                      background: "var(--color-surface-container)",
                      border: "1px solid var(--color-outline-variant)",
                      color: "var(--color-on-surface)",
                      borderRadius: "2px 1rem 1rem 1rem",
                    }
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
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{ background: "var(--color-primary-container)" }}
            >
              <svg className="w-4 h-4" style={{ color: "var(--color-primary)" }} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09z" />
              </svg>
            </div>
            <div
              className="flex items-center gap-1.5 px-4 py-3 rounded-2xl"
              style={{ background: "var(--color-surface-container)", border: "1px solid var(--color-outline-variant)" }}
            >
              <span className="typing-dot" style={{ color: "var(--color-on-surface-variant)" }} />
              <span className="typing-dot" style={{ color: "var(--color-on-surface-variant)" }} />
              <span className="typing-dot" style={{ color: "var(--color-on-surface-variant)" }} />
            </div>
          </div>
        )}

        {vaultUnlockModal && (
          <div
            className="p-4 rounded-2xl border"
            style={{ background: "var(--color-surface-container-high)", borderColor: "var(--color-outline-variant)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-on-surface">🔐 Unlock Vault</span>
              <button onClick={() => setVaultUnlockModal(null)} className="text-on-surface-variant hover:text-on-surface press-scale">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex gap-2 mb-3">
              {(["passphrase", "recovery"] as const).map((mode) => (
                <button key={mode} onClick={() => { setVaultModalMode(mode); setVaultModalInput(""); }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                  style={
                    vaultModalMode === mode
                      ? { background: "var(--color-primary-container)", color: "var(--color-on-primary-container)", border: "1px solid var(--color-outline-variant)" }
                      : { background: "var(--color-surface-container)", color: "var(--color-on-surface-variant)", border: "1px solid var(--color-outline-variant)" }
                  }
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
              style={{ background: "var(--color-surface-container)", border: "1px solid var(--color-outline-variant)" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-outline-variant)"; }}
            />
            {vaultModalError && <p className="text-xs text-error mb-2">{vaultModalError}</p>}
            <button onClick={handleVaultModalUnlock} disabled={vaultModalBusy || !vaultModalInput.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold press-scale disabled:opacity-40"
              style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}
            >{vaultModalBusy ? "Unlocking…" : "Unlock & Answer"}</button>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="pt-3 border-t" style={{ borderColor: "var(--color-outline-variant)" }}>
        {brains.length > 1 && (
          <div
            className="flex mb-2 p-1 rounded-xl gap-1"
            style={{ background: "var(--color-surface-container)" }}
          >
            <button onClick={() => setSearchAllBrains(false)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={
                !searchAllBrains
                  ? { background: "var(--color-surface-container-high)", color: "var(--color-on-surface)" }
                  : { color: "var(--color-on-surface-variant)" }
              }>
              This brain
            </button>
            <button onClick={() => setSearchAllBrains(true)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={
                searchAllBrains
                  ? { background: "var(--color-primary-container)", color: "var(--color-primary)" }
                  : { color: "var(--color-on-surface-variant)" }
              }>
              All brains
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChat()}
            placeholder={searchAllBrains ? "Ask across all your brains…" : "Ask about your memories…"}
            className="flex-1 px-4 py-3 rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none min-h-[44px] transition-all"
            style={{ background: "var(--color-surface-container)", border: "1px solid var(--color-outline-variant)" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-outline-variant)"; }}
          />
          <button onClick={handleChat} disabled={chatLoading}
            className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center press-scale disabled:opacity-40"
            style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}
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
