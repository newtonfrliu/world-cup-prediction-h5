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
