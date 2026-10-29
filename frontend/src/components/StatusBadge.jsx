import { STATUS } from "../utils/format";

export default function StatusBadge({ value }) {
  const item = STATUS[value] || { label: value, className: "bg-slate-100 text-slate-700" };
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${item.className}`}>
      {item.label}
    </span>
  );
}
