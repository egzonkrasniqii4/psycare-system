import { Calendar, Clock, CreditCard, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { formatWhen } from "../utils/format";

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/dashboard/")
      .then((response) => {
        if (active) setData(response.data);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, []);

  const hour = new Date().getHours();
  const hello = hour < 12 ? "Mirëmëngjes" : hour < 18 ? "Mirëdita" : "Mirëmbrëma";
  const cards = [
    user.role !== "patient" && { label: "Pacientë", value: data?.patients ?? "—", icon: Users },
    { label: "Termine sot", value: data?.appointments_today ?? "—", icon: Calendar },
    { label: "Në pritje", value: data?.pending ?? "—", icon: Clock },
    { label: "Fatura të papaguara", value: data?.unpaid_invoices ?? "—", icon: CreditCard },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title={`${hello}, ${user.first_name || user.full_name}`}
        subtitle="Pamja e ditës në klinikë."
        action={
          <Link to="/calendar" className="btn-primary">
            <Calendar size={16} strokeWidth={1.75} />
            Hap kalendarin
          </Link>
        }
      />
      {error ? <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="card flex items-start justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{card.label}</div>
                <div className="mt-2 text-3xl font-light tabular-nums text-ink">{card.value}</div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-md bg-brand-soft text-brand">
                <Icon size={17} strokeWidth={1.75} />
              </div>
            </article>
          );
        })}
      </div>

      <section className="card mt-6 p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="section-title">Terminet e ardhshme</h2>
        </div>
        {(data?.upcoming || []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">S'ka termine të ardhshme.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-2.5 font-medium">Data dhe ora</th>
                <th className="px-5 py-2.5 font-medium">{user.role === "patient" ? "Psikologu" : "Pacienti"}</th>
                <th className="hidden px-5 py-2.5 font-medium sm:table-cell">Arsyeja</th>
                <th className="px-5 py-2.5 text-right font-medium">Statusi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.upcoming.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-600">{formatWhen(item.starts_at)}</td>
                  <td className="px-5 py-3">
                    {user.role === "patient" ? (
                      item.therapist_name
                    ) : (
                      <Link to={`/patients/${item.patient}`} className="font-medium text-ink hover:text-brand">
                        {item.patient_name}
                      </Link>
                    )}
                  </td>
                  <td className="hidden px-5 py-3 text-slate-600 sm:table-cell">{item.reason || "Seancë"}</td>
                  <td className="px-5 py-3 text-right">
                    <StatusBadge value={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
