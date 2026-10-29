export const ROLE_LABEL = {
  admin: "Administrator",
  therapist: "Psikolog",
  patient: "Pacient",
};

export const STATUS = {
  pending: { label: "Në pritje", className: "bg-amber-100 text-amber-950" },
  confirmed: { label: "Konfirmuar", className: "bg-emerald-100 text-emerald-950" },
  completed: { label: "Përfunduar", className: "bg-slate-200 text-slate-700" },
  cancelled: { label: "Anuluar", className: "bg-rose-100 text-rose-900" },
  paid: { label: "E paguar", className: "bg-emerald-100 text-emerald-950" },
  unpaid: { label: "E papaguar", className: "bg-amber-100 text-amber-950" },
};

export function formatWhen(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("sq-AL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function money(value, currency = "EUR") {
  return new Intl.NumberFormat("sq-AL", { style: "currency", currency }).format(Number(value));
}

export function initials(name) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
