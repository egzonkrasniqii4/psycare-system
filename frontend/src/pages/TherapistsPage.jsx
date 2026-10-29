import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";

const EMPTY = {
  id: null,
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  password: "",
  is_active: true,
};

export default function TherapistsPage() {
  const { user } = useAuth();
  const [therapists, setTherapists] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (user.role !== "admin") return;
    api
      .get("/therapists/", { params: { all: 1 } })
      .then((response) => setTherapists(response.data))
      .catch((err) => setError(errorMessage(err)));
  }, [user.role, tick]);

  if (user.role !== "admin") return <Navigate to="/" replace />;

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function openEdit(therapist) {
    setFormError("");
    setForm({
      id: therapist.id,
      first_name: therapist.first_name,
      last_name: therapist.last_name,
      email: therapist.email || "",
      phone: therapist.phone || "",
      password: "",
      is_active: therapist.is_active,
    });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone,
      is_active: form.is_active,
    };
    if (form.password) payload.password = form.password;
    try {
      if (form.id) await api.patch(`/therapists/${form.id}/`, payload);
      else await api.post("/therapists/", payload);
      setForm(null);
      setTick((value) => value + 1);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const activeCount = therapists.filter((therapist) => therapist.is_active).length;

  return (
    <div>
      <PageHeader
        title="Psikologët"
        subtitle={`${activeCount} aktivë`}
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFormError("");
              setForm(EMPTY);
            }}
          >
            <Plus size={16} strokeWidth={1.75} />
            Psikolog i ri
          </button>
        }
      />
      {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-2.5 font-medium">Psikologu</th>
              <th className="px-5 py-2.5 font-medium">Telefoni</th>
              <th className="px-5 py-2.5 font-medium">Pacientë</th>
              <th className="px-5 py-2.5 text-right font-medium">Statusi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {therapists.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-slate-500" colSpan={4}>
                  Ende nuk ka psikologë.
                </td>
              </tr>
            ) : (
              therapists.map((therapist) => (
                <tr key={therapist.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openEdit(therapist)}>
                  <td className="px-5 py-3">
                    <div className="font-medium">{therapist.full_name}</div>
                    <div className="text-slate-500">{therapist.email}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{therapist.phone || "—"}</td>
                  <td className="px-5 py-3 tabular-nums text-slate-600">{therapist.patient_count}</td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                        therapist.is_active ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {therapist.is_active ? "Aktiv" : "Joaktiv"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {form ? (
        <Modal title={form.id ? "Ndrysho psikologun" : "Psikolog i ri"} onClose={() => setForm(null)}>
          <form className="space-y-3" onSubmit={save}>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">Emri</span>
                <input className="field" value={form.first_name} onChange={(event) => setField("first_name", event.target.value)} required autoFocus />
              </label>
              <label className="block">
                <span className="label">Mbiemri</span>
                <input className="field" value={form.last_name} onChange={(event) => setField("last_name", event.target.value)} required />
              </label>
            </div>
            <label className="block">
              <span className="label">Email (për hyrje)</span>
              <input className="field" type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} required />
            </label>
            <label className="block">
              <span className="label">Telefoni</span>
              <input className="field" type="tel" value={form.phone} onChange={(event) => setField("phone", event.target.value)} />
            </label>
            <label className="block">
              <span className="label">{form.id ? "Fjalëkalim i ri (opsional)" : "Fjalëkalimi i përkohshëm"}</span>
              <input
                className="field"
                type="text"
                value={form.password}
                onChange={(event) => setField("password", event.target.value)}
                required={!form.id}
                autoComplete="new-password"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Jepjani psikologut bashkë me email-in. Minimumi 8 karaktere.
              </span>
            </label>
            {form.id ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand"
                  checked={form.is_active}
                  onChange={(event) => setField("is_active", event.target.checked)}
                />
                Aktiv (mund të hyjë në sistem dhe të marrë pacientë)
              </label>
            ) : null}
            {formError ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Anulo</button>
              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Duke ruajtur…" : form.id ? "Ruaj" : "Krijo llogarinë"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
