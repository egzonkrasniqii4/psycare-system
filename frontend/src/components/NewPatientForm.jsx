import { useState } from "react";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import PhoneInput from "./PhoneInput";

export default function NewPatientForm({
  therapists = [],
  defaultTherapist = "",
  submitLabel = "Krijo",
  cancelLabel = "Anulo",
  onCreated,
  onCancel,
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    assigned_therapist: defaultTherapist,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    event.stopPropagation();
    setSaving(true);
    setError("");
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
      };
      if (user.role === "admin" && form.assigned_therapist) {
        payload.assigned_therapist = Number(form.assigned_therapist);
      }
      const { data } = await api.post("/patients/", payload);
      onCreated(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
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
      <div>
        <span className="label">Telefoni</span>
        <PhoneInput value={form.phone} onChange={(phone) => setField("phone", phone)} required />
      </div>
      {user.role === "admin" ? (
        <label className="block">
          <span className="label">Psikologu</span>
          <select className="field" value={form.assigned_therapist} onChange={(event) => setField("assigned_therapist", event.target.value)}>
            <option value="">Pa caktuar</option>
            {therapists.map((therapist) => (
              <option key={therapist.id} value={therapist.id}>{therapist.full_name}</option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm text-slate-500">Pacienti caktohet te ju.</p>
      )}
      <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Pacienti mund të krijojë llogari më vonë me këtë numër: merr një kod me SMS dhe e lidh kartelën me vete.
      </p>
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>{cancelLabel}</button>
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Duke krijuar…" : submitLabel}</button>
      </div>
    </form>
  );
}
