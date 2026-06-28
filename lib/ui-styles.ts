export const buttonStyles = {
  primary:
    "inline-flex h-12 items-center justify-center rounded-xl bg-[#e63535] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#c92828] disabled:cursor-not-allowed disabled:bg-[#9fb3c8]",
  secondary:
    "inline-flex h-12 items-center justify-center rounded-xl border border-[#071b3a]/15 bg-white px-5 text-sm font-black text-[#071b3a] shadow-sm transition hover:border-[#071b3a]/30 hover:bg-[#f8fafc]",
  gold:
    "inline-flex h-12 items-center justify-center rounded-xl border border-[#f6c84c] bg-[#fff4bf] px-5 text-sm font-black text-[#071b3a] shadow-sm transition hover:bg-[#f6c84c]",
  green:
    "inline-flex h-12 items-center justify-center rounded-xl border border-[#25c7b7]/50 bg-[#e6fffb] px-5 text-sm font-black text-[#064e3b] shadow-sm transition hover:bg-[#c6f7ef]",
  muted:
    "inline-flex h-11 items-center justify-center rounded-xl border border-[#cbd2d9] bg-[#f5f7fa] px-4 text-sm font-black text-[#52606d] transition hover:bg-white",
};

export const cardStyles = {
  base: "rounded-2xl border border-[#071b3a]/12 bg-white p-5 shadow-sm",
  compact: "rounded-2xl border border-[#071b3a]/12 bg-white p-4 shadow-sm",
  dark: "rounded-2xl border border-[#f6c84c]/25 bg-[#071b3a] p-5 text-white shadow-sm",
  stat: "rounded-2xl border border-[#071b3a]/10 bg-[#f8fafc] p-4 shadow-sm",
};

export const badgeStyles = {
  success: "rounded-full border border-[#9ae6b4] bg-[#e3f9e5] px-3 py-1 text-xs font-black text-[#0f7b3f]",
  error: "rounded-full border border-[#f7c6c7] bg-[#fde8e8] px-3 py-1 text-xs font-black text-[#9b1c1c]",
  pending: "rounded-full border border-[#f6c84c] bg-[#fff8db] px-3 py-1 text-xs font-black text-[#8d6b00]",
  cancelled: "rounded-full border border-[#cbd2d9] bg-[#edf1f5] px-3 py-1 text-xs font-black text-[#52606d]",
  gold: "rounded-full border border-[#f6c84c] bg-[#fff4bf] px-3 py-1 text-xs font-black text-[#071b3a]",
};

export const pageTitleStyles = {
  kicker: "text-xs font-black uppercase tracking-[0.2em] text-[#e63535]",
  title: "mt-2 text-3xl font-black leading-tight text-[#071b3a]",
};

export const sectionTitleStyles = {
  kicker: "text-[11px] font-black uppercase tracking-[0.18em] text-[#e63535]",
  title: "mt-1 text-xl font-black text-[#071b3a]",
};

export const inputStyles =
  "h-12 w-full rounded-xl border border-[#071b3a]/18 bg-white px-4 text-base text-[#071b3a] outline-none transition focus:border-[#e63535] focus:ring-4 focus:ring-[#e63535]/15";

export const statusStyles = {
  success: "rounded-2xl border border-[#bae6bd] bg-[#e3f9e5] p-4 text-sm font-bold text-[#0f7b3f]",
  error: "rounded-2xl border border-[#f7c6c7] bg-[#fde8e8] p-4 text-sm font-bold text-[#9b1c1c]",
  info: "rounded-2xl border border-[#d9e2ec] bg-white p-4 text-sm font-bold text-[#334e68]",
  warning: "rounded-2xl border border-[#f6c84c] bg-[#fff8db] p-4 text-sm font-bold text-[#8d6b00]",
  empty: "rounded-2xl border border-[#d9e2ec] bg-white p-5 text-sm font-bold text-[#52606d]",
};

export const gameStyles = {
  page:
    "min-h-screen bg-[#020711] text-white [background-image:radial-gradient(circle_at_50%_0%,rgba(246,200,76,0.16),transparent_28rem),radial-gradient(circle_at_12%_16%,rgba(230,53,53,0.18),transparent_18rem),radial-gradient(circle_at_88%_28%,rgba(124,58,237,0.18),transparent_20rem),linear-gradient(180deg,#020711,#07111f_54%,#020711)]",
  shell: "mx-auto w-full max-w-[430px] px-4 pb-24 pt-5",
  panel:
    "rounded-[24px] border border-white/10 bg-[#07111f]/82 shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur",
  goldPanel:
    "rounded-[24px] border border-[#f6c84c]/42 bg-[linear-gradient(135deg,rgba(246,200,76,0.18),rgba(7,17,31,0.88)_38%,rgba(0,0,0,0.72))] shadow-[0_22px_58px_rgba(246,200,76,0.16)] backdrop-blur",
  actionRed:
    "rounded-[24px] border border-[#ff6b4a]/45 bg-[radial-gradient(circle_at_80%_20%,rgba(246,200,76,0.35),transparent_7rem),linear-gradient(135deg,#b91c1c,#e63535_52%,#5b1111)] p-5 shadow-[0_18px_44px_rgba(230,53,53,0.24)]",
  actionPurple:
    "rounded-[24px] border border-[#a855f7]/55 bg-[radial-gradient(circle_at_78%_18%,rgba(246,200,76,0.24),transparent_7rem),linear-gradient(135deg,#2e1065,#6d28d9_55%,#16072f)] p-5 shadow-[0_18px_44px_rgba(124,58,237,0.24)]",
  stat:
    "rounded-2xl border border-white/10 bg-black/38 px-4 py-3 shadow-inner",
  nav:
    "fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[430px] items-center justify-around border-t border-white/10 bg-[#020711]/92 px-3 py-2 text-xs font-black text-white/55 backdrop-blur",
  rarityGlowLegend: "drop-shadow-[0_0_38px_rgba(246,200,76,0.72)]",
  rarityGlowEpic: "drop-shadow-[0_0_34px_rgba(168,85,247,0.58)]",
};
