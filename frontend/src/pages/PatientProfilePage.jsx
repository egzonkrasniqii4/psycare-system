import { CalendarPlus, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import PageHeader from "../components/PageHeader";
import PhoneInput from "../components/PhoneInput";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { formatWhen, money } from "../utils/format";

const EMPTY_FORM = {
  email: "",
  first_name: "",
  last_name: "",
  phone: "",
  date_of_birth: "",
  address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  medical_history: "",
  assigned_therapist: "",
};

export default function PatientProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canEditClinical = user.role === "admin" || user.role === "therapist";
  const [patient, setPatient] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notes, setNotes] = useState([]);
  const [bills, setBills] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [note, setNote] = useState("");
  const [noteAppointment, setNoteAppointment] = useState("");
  const [invoice, setInvoice] = useState({ description: "Seancë individuale", amount: "40", status: "unpaid" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const requests = [
          api.get(`/patients/${id}/`),
          api.get("/billing/", { params: { patient: id, page_size: 50 } }),
          api.get("/appointments/", { params: { patient: id, page_size: 20 } }),
        ];
        if (canEditClinical) {
          requests.push(api.get("/session-notes/", { params: { patient: id, page_size: 100 } }));
        }
        const [patientRes, billsRes, apptRes, notesRes] = await Promise.all(requests);
        if (!active) return;
        setPatient(patientRes.data);
        setForm({
          email: patientRes.data.email || "",
          first_name: patientRes.data.first_name || "",
          last_name: patientRes.data.last_name || "",
          phone: patientRes.data.phone || "",
          date_of_birth: patientRes.data.date_of_birth || "",
          address: patientRes.data.address || "",
          emergency_contact_name: patientRes.data.emergency_contact_name || "",
          emergency_contact_phone: patientRes.data.emergency_contact_phone || "",
          medical_history: patientRes.data.medical_history || "",
          assigned_therapist: patientRes.data.assigned_therapist ? String(patientRes.data.assigned_therapist) : "",
        });
        setBills(billsRes.data.results || []);
        setAppointments(apptRes.data.results || []);
        setNotes(notesRes?.data.results || []);
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id, canEditClinical, tick]);

  useEffect(() => {
    if (user.role !== "admin") return;
    api.get("/therapists/").then((response) => setTherapists(response.data));
  }, [user.role]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email.trim() || null,
      address: form.address,
      emergency_contact_name: form.emergency_contact_name,
      emergency_contact_phone: form.emergency_contact_phone,
      date_of_birth: form.date_of_birth || null,
    };
    if (canEditClinical) {
      payload.phone = form.phone;
      payload.medical_history = form.medical_history;
      if (user.role === "admin") {
        payload.assigned_therapist = form.assigned_therapist ? Number(form.assigned_therapist) : null;
      }
    }
    try {
      const { data } = await api.patch(`/patients/${id}/`, payload);
      setPatient(data);
      setNotice("U ruajt.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function addNote(event) {
    event.preventDefault();
    setError("");
    try {
      await api.post("/session-notes/", {
        patient: Number(id),
        content: note,
        appointment: noteAppointment ? Number(noteAppointment) : null,
      });
      setNote("");
      setNoteAppointment("");
      setTick((value) => value + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function addInvoice(event) {
    event.preventDefault();
    setError("");
    try {
      await api.post("/billing/", {
        patient: Number(id),
        description: invoice.description,
        amount: invoice.amount,
        status: invoice.status,
      });
      setTick((value) => value + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function togglePaid(bill) {
    try {
      await api.patch(`/billing/${bill.id}/`, { status: bill.status === "paid" ? "unpaid" : "paid" });
      setTick((value) => value + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading && !patient) {
    return <p className="text-sm text-slate-500">Duke hapur profilin…</p>;
  }
  if (!patient) {
    return <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error || "Nuk u gjet."}</p>;
  }

  return (
    <div>
      <PageHeader
        title={patient.full_name}
        subtitle={patient.assigned_therapist_name ? `Psikologu: ${patient.assigned_therapist_name}` : "Pa psikolog të caktuar"}
        action={
          canEditClinical ? (
            <Link to={`/calendar?patient=${patient.id}`} className="btn-primary">
              <CalendarPlus size={16} strokeWidth={1.75} />
              Cakto termin
            </Link>
          ) : null
        }
      />
      {error ? <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p className="mb-4 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-dark">{notice}</p> : null}

      <form onSubmit={saveProfile} className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="section-title">Kontakti</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Emri</span>
              <input className="field" value={form.first_name} onChange={(event) => setField("first_name", event.target.value)} />
            </label>
            <label className="block">
              <span className="label">Mbiemri</span>
              <input className="field" value={form.last_name} onChange={(event) => setField("last_name", event.target.value)} />
            </label>
          </div>
          <div>
            <span className="label flex items-center justify-between">
              Telefoni
              {patient.has_account ? null : (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-500">
                  Pa llogari — regjistrohet me kod SMS
                </span>
              )}
            </span>
            <PhoneInput value={form.phone} onChange={(phone) => setField("phone", phone)} disabled={!canEditClinical} required />
            {canEditClinical && patient.has_account ? (
              <p className="mt-1 text-[11px] text-slate-400">Nëse ndryshohet, pacienti duhet ta konfirmojë numrin e ri me kod.</p>
            ) : null}
          </div>
          <label className="block">
            <span className="label">
              Email <span className="font-normal text-slate-400">(opsionale)</span>
            </span>
            <input className="field" type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} />
          </label>
          <label className="block">
            <span className="label">Datëlindja</span>
            <input className="field" type="date" value={form.date_of_birth || ""} onChange={(event) => setField("date_of_birth", event.target.value)} />
          </label>
          <label className="block">
            <span className="label">Adresa</span>
            <input className="field" value={form.address} onChange={(event) => setField("address", event.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Kontakt urgjence</span>
              <input className="field" value={form.emergency_contact_name} onChange={(event) => setField("emergency_contact_name", event.target.value)} />
            </label>
            <label className="block">
              <span className="label">Tel. urgjence</span>
              <input className="field" value={form.emergency_contact_phone} onChange={(event) => setField("emergency_contact_phone", event.target.value)} />
            </label>
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="section-title">Historiku</h2>
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
          ) : null}
          <label className="block">
            <span className="label">Historiku klinik</span>
            <textarea
              className="field min-h-40"
              value={form.medical_history}
              onChange={(event) => setField("medical_history", event.target.value)}
              readOnly={!canEditClinical}
            />
          </label>
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Lock size={14} />
            Historiku dhe shënimet e seancës enkriptohen para se të ruhen.
          </p>
          <button className="btn-primary" type="submit">Ruaj profilin</button>
        </section>
      </form>

      {canEditClinical ? (
        <section className="card mt-4">
          <h2 className="section-title">Shënime klinike</h2>
          <form className="mt-4 space-y-3" onSubmit={addNote}>
            <textarea className="field min-h-28" placeholder="Shënimi i seancës" value={note} onChange={(event) => setNote(event.target.value)} required />
            <label className="block max-w-md">
              <span className="label">Lidhe me një termin</span>
              <select className="field" value={noteAppointment} onChange={(event) => setNoteAppointment(event.target.value)}>
                <option value="">Pa termin</option>
                {appointments.map((appointment) => (
                  <option key={appointment.id} value={appointment.id}>
                    {formatWhen(appointment.starts_at)} · {appointment.reason || "Seancë"}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn-primary" type="submit">Shto shënimin</button>
          </form>
          <div className="mt-5 space-y-3">
            {notes.length === 0 ? <p className="text-sm text-slate-500">Ende pa shënime.</p> : null}
            {notes.map((item) => (
              <article key={item.id} className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">
                  {formatWhen(item.created_at)} · {item.therapist_name}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{item.content}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card mt-4">
        <h2 className="section-title">Faturat</h2>
        {canEditClinical ? (
          <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px_140px_auto]" onSubmit={addInvoice}>
            <input className="field" value={invoice.description} onChange={(event) => setInvoice({ ...invoice, description: event.target.value })} placeholder="Përshkrimi" />
            <input className="field" type="number" min="0.01" step="0.01" value={invoice.amount} onChange={(event) => setInvoice({ ...invoice, amount: event.target.value })} />
            <select className="field" value={invoice.status} onChange={(event) => setInvoice({ ...invoice, status: event.target.value })}>
              <option value="unpaid">E papaguar</option>
              <option value="paid">E paguar</option>
            </select>
            <button className="btn-primary" type="submit">Shto</button>
          </form>
        ) : null}
        <div className="mt-4 divide-y divide-slate-100">
          {bills.length === 0 ? <p className="py-3 text-sm text-slate-500">Nuk ka fatura.</p> : null}
          {bills.map((bill) => (
            <div key={bill.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <div className="font-medium">{bill.description || "Faturë"} · {money(bill.amount, bill.currency)}</div>
                <div className="text-xs text-slate-500">{bill.issued_on}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge value={bill.status} />
                {canEditClinical ? (
                  <button type="button" className="btn-ghost" onClick={() => togglePaid(bill)}>
                    {bill.status === "paid" ? "Shëno të papaguar" : "Shëno të paguar"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
