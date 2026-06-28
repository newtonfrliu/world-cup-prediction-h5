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
  shell: "mx-auto w-full max-w-[820px] px-4 pb-24 pt-5 sm:px-6 lg:px-8",
  panel:
    "rounded-[24px] border border-white/10 bg-[#07111f]/82 shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur",
  goldPanel:
    "rounded-[24px] border border-[#f6c84c]/42 bg-[linear-gradient(135deg,rgba(246,200,76,0.18),rgba(7,17,31,0.88)_38%,rgba(0,0,0,0.72))] shadow-[0_22px_58px_rgba(246,200,76,0.16)] backdrop-blur",
  actionRed:
    "group relative overflow-hidden rounded-[24px] border border-[#ff8a4a]/55 bg-[radial-gradient(circle_at_84%_22%,rgba(255,224,146,0.48),transparent_6.8rem),radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.18),transparent_5rem),linear-gradient(135deg,#7f130f,#e63535_48%,#4b0808)] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_20px_48px_rgba(230,53,53,0.34)] transition hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset,0_24px_58px_rgba(255,93,55,0.44)]",
  actionPurple:
    "group relative overflow-hidden rounded-[24px] border border-[#c084fc]/60 bg-[radial-gradient(circle_at_78%_18%,rgba(246,200,76,0.28),transparent_7rem),radial-gradient(circle_at_12%_0%,rgba(255,255,255,0.14),transparent_5rem),linear-gradient(135deg,#1e0b4f,#6d28d9_55%,#12051f)] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_20px_48px_rgba(124,58,237,0.34)] transition hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(246,200,76,0.14)_inset,0_24px_58px_rgba(168,85,247,0.44)]",
  stat:
    "rounded-2xl border border-white/10 bg-black/38 px-4 py-3 shadow-inner",
  nav:
    "fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-[820px] items-center justify-around border-t border-white/10 bg-[#020711]/92 px-3 py-2 text-xs font-black text-white/55 backdrop-blur sm:px-6",
  rarityGlowLegend: "drop-shadow-[0_0_38px_rgba(246,200,76,0.72)]",
  rarityGlowEpic: "drop-shadow-[0_0_34px_rgba(168,85,247,0.58)]",
};
