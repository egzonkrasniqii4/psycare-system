import { ChevronLeft, ChevronRight, Plus, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import Modal from "../components/Modal";
import NewPatientForm from "../components/NewPatientForm";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { formatWhen } from "../utils/format";

const HOURS = Array.from({ length: 11 }, (_, index) => index + 8);
const HOUR_PX = 56;
const BLOCK = {
  pending: "border-amber-300 bg-amber-100 text-amber-950",
  confirmed: "border-emerald-300 bg-emerald-100 text-emerald-950",
  completed: "border-slate-300 bg-slate-200 text-slate-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-800 line-through",
};

function startOfWeek(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function addDays(date, count) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + count);
  return copy;
}

function sameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function toDateInput(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function slotStart(day, hour) {
  const start = new Date(day);
  start.setHours(hour, 0, 0, 0);
  return start;
}

function nextFullHour() {
  const next = new Date();
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

function place(appointment) {
  const start = new Date(appointment.starts_at);
  const end = new Date(appointment.ends_at);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const dayStart = 8 * 60;
  const dayEnd = 19 * 60;
  if (endMinutes <= dayStart || startMinutes >= dayEnd) return null;
  const top = ((Math.max(startMinutes, dayStart) - dayStart) / 60) * HOUR_PX;
  const bottom = ((Math.min(endMinutes, dayEnd) - dayStart) / 60) * HOUR_PX;
  return { top, height: Math.max(bottom - top, 28) };
}

const NEW_PATIENT = "__new__";

const emptyDraft = (user) => ({
  id: null,
  patient: "",
  therapist: "",
  date: toDateInput(new Date()),
  time: "10:00",
  duration: 50,
  reason: "",
  status: user.role === "patient" ? "pending" : "confirmed",
});

export default function CalendarPage() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()).getTime());
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [draft, setDraft] = useState(null);
  const [addingPatient, setAddingPatient] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();

  const days = useMemo(() => {
    const monday = new Date(weekStart);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  }, [weekStart]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const from = new Date(weekStart);
    const to = addDays(from, 7);
    api
      .get("/appointments/", {
        params: { from: from.toISOString(), to: to.toISOString(), page_size: 200 },
      })
      .then((response) => {
        if (active) setAppointments(response.data.results || []);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [weekStart, tick]);

  useEffect(() => {
    if (user.role === "patient") return;
    api.get("/patients/", { params: { page_size: 200 } }).then((response) => {
      setPatients(response.data.results || []);
    });
    if (user.role === "admin") {
      api.get("/therapists/").then((response) => setTherapists(response.data));
    }
  }, [user.role]);

  useEffect(() => {
    const patientId = searchParams.get("patient");
    if (!patientId || user.role === "patient") return;
    const next = nextFullHour();
    openCreate(next, next.getHours(), patientId);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate(day, hour, patientId = "") {
    setFormError("");
    setAddingPatient(false);
    setDraft({
      ...emptyDraft(user),
      patient: patientId,
      date: toDateInput(day),
      time: `${String(hour).padStart(2, "0")}:00`,
    });
  }

  function closeDraft() {
    setAddingPatient(false);
    setDraft(null);
  }

  function patientCreated(patient) {
    setPatients((current) =>
      [...current, patient].sort((a, b) => a.full_name.localeCompare(b.full_name, "sq")),
    );
    setDraft((current) => ({
      ...current,
      patient: String(patient.id),
      therapist:
        current.therapist || (patient.assigned_therapist ? String(patient.assigned_therapist) : ""),
    }));
    setAddingPatient(false);
  }

  function openExisting(appointment) {
    const start = new Date(appointment.starts_at);
    const end = new Date(appointment.ends_at);
    setFormError("");
    setDraft({
      id: appointment.id,
      patient: String(appointment.patient),
      therapist: String(appointment.therapist),
      date: toDateInput(start),
      time: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
      original_start: appointment.starts_at,
      duration: Math.max(15, Math.round((end - start) / 60000)),
      reason: appointment.reason || "",
      status: appointment.status,
      patient_name: appointment.patient_name,
      therapist_name: appointment.therapist_name,
    });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (user.role === "patient" && draft.id) {
        await api.patch(`/appointments/${draft.id}/`, { status: "cancelled" });
      } else {
        const start = new Date(`${draft.date}T${draft.time}`);
        const moved = !draft.original_start || new Date(draft.original_start).getTime() !== start.getTime();
        if (moved && start < new Date()) {
          setFormError("Termini nuk mund të caktohet në të kaluarën.");
          return;
        }
        const end = new Date(start.getTime() + Number(draft.duration) * 60000);
        const payload = {
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          reason: draft.reason,
          status: user.role === "patient" ? "pending" : draft.status,
        };
        if (user.role !== "patient") {
          payload.patient = Number(draft.patient);
          if (user.role === "admin") payload.therapist = Number(draft.therapist);
        }
        if (draft.id) await api.patch(`/appointments/${draft.id}/`, payload);
        else await api.post("/appointments/", payload);
      }
      setDraft(null);
      setTick((value) => value + 1);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const outside = appointments.filter((appointment) => place(appointment) === null);
  const today = new Date();
  const title = `${days[0].toLocaleDateString("sq-AL", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("sq-AL", { day: "numeric", month: "short" })}`;

  return (
    <div>
      <PageHeader
        title="Kalendari"
        subtitle={loading ? "Duke ngarkuar javën…" : title}
        action={
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setWeekStart(startOfWeek(new Date()).getTime())}>
              Sot
            </button>
            <button type="button" className="btn-ghost" onClick={() => setWeekStart(addDays(new Date(weekStart), -7).getTime())} aria-label="Java e kaluar">
              <ChevronLeft size={16} />
            </button>
            <button type="button" className="btn-ghost" onClick={() => setWeekStart(addDays(new Date(weekStart), 7).getTime())} aria-label="Java tjetër">
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const next = nextFullHour();
                openCreate(next, next.getHours());
              }}
            >
              <Plus size={16} />
              Termin
            </button>
          </div>
        }
      />
      {error ? <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="card overflow-x-auto p-3 sm:p-4">
        <div className="min-w-[880px]">
          <div className="grid grid-cols-[64px_repeat(7,1fr)]">
            <div />
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={`px-2 pb-3 text-center text-sm ${sameDay(day, today) ? "font-semibold text-brand" : "text-slate-500"}`}
              >
                {day.toLocaleDateString("sq-AL", { weekday: "short", day: "numeric" })}
              </div>
            ))}
            <div>
              {HOURS.map((hour) => (
                <div key={hour} className="h-14 pr-2 text-right text-xs text-slate-400">
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {days.map((day) => (
              <div key={day.toISOString()} className={`relative border-l border-slate-200 ${sameDay(day, today) ? "bg-brand-soft/50" : ""}`}>
                {HOURS.map((hour) => {
                  const past = slotStart(day, hour) < new Date();
                  return (
                    <button
                      key={hour}
                      type="button"
                      disabled={past}
                      className={`block h-14 w-full border-b border-slate-100 ${
                        past ? "cursor-not-allowed bg-slate-100/60" : "hover:bg-white/70"
                      }`}
                      onClick={() => openCreate(day, hour)}
                      aria-label={`Termin i ri, ${day.toLocaleDateString("sq-AL")} ora ${hour}`}
                    />
                  );
                })}
                {appointments.filter((appointment) => sameDay(new Date(appointment.starts_at), day)).map((appointment) => {
                  const box = place(appointment);
                  if (!box) return null;
                  return (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openExisting(appointment);
                      }}
                      style={{ top: box.top, height: box.height }}
                      className={`absolute inset-x-1 z-10 overflow-hidden rounded-lg border px-2 py-1 text-left text-xs ${BLOCK[appointment.status] || BLOCK.confirmed}`}
                    >
                      <div className="font-semibold">{user.role === "patient" ? appointment.therapist_name : appointment.patient_name}</div>
                      <div>{appointment.reason || "Seancë"}</div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {outside.length > 0 ? (
        <section className="card mt-4">
          <h2 className="section-title">Jashtë orarit 08:00–19:00</h2>
          <div className="mt-3 space-y-2">
            {outside.map((appointment) => (
              <button key={appointment.id} type="button" className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover:bg-slate-50" onClick={() => openExisting(appointment)}>
                <span>
                  {formatWhen(appointment.starts_at)} · {appointment.patient_name}
                </span>
                <StatusBadge value={appointment.status} />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {draft ? (
        <Modal
          title={addingPatient ? "Pacient i ri" : draft.id ? "Termini" : "Termin i ri"}
          onClose={closeDraft}
        >
          {addingPatient ? (
            <>
              <p className="mb-4 text-sm text-slate-500">
                Pas ruajtjes, pacienti zgjidhet automatikisht te termini që po caktoni.
              </p>
              <NewPatientForm
                therapists={therapists}
                defaultTherapist={draft.therapist}
                submitLabel="Krijo dhe vazhdo me terminin"
                cancelLabel="Kthehu te termini"
                onCancel={() => setAddingPatient(false)}
                onCreated={patientCreated}
              />
            </>
          ) : (
          <form className="space-y-3" onSubmit={save}>
            {user.role === "patient" && draft.id ? (
              <div className="space-y-2 text-sm">
                <p>{formatWhen(`${draft.date}T${draft.time}`)} · {draft.therapist_name}</p>
                <p>{draft.reason || "Seancë"}</p>
                <StatusBadge value={draft.status} />
              </div>
            ) : (
              <>
                {user.role !== "patient" ? (
                  <label className="block">
                    <span className="label">Pacienti</span>
                    <select
                      className="field"
                      value={draft.patient}
                      onChange={(event) => {
                        if (event.target.value === NEW_PATIENT) setAddingPatient(true);
                        else setDraft({ ...draft, patient: event.target.value });
                      }}
                      required
                      disabled={Boolean(draft.id)}
                    >
                      <option value="">Zgjidh</option>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>{patient.full_name}</option>
                      ))}
                      {draft.id ? null : <option value={NEW_PATIENT}>+ Shto pacient të ri…</option>}
                    </select>
                    {draft.id ? null : (
                      <button
                        type="button"
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                        onClick={() => setAddingPatient(true)}
                      >
                        <UserPlus size={14} strokeWidth={1.75} />
                        Pacienti nuk është në listë? Shto pacient të ri
                      </button>
                    )}
                  </label>
                ) : null}
                {user.role === "admin" ? (
                  <label className="block">
                    <span className="label">Psikologu</span>
                    <select className="field" value={draft.therapist} onChange={(event) => setDraft({ ...draft, therapist: event.target.value })} required>
                      <option value="">Zgjidh</option>
                      {therapists.map((therapist) => (
                        <option key={therapist.id} value={therapist.id}>{therapist.full_name}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="label">Data</span>
                    <input
                      className="field"
                      type="date"
                      min={draft.id ? undefined : toDateInput(new Date())}
                      value={draft.date}
                      onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="label">Ora</span>
                    <input className="field" type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} required />
                  </label>
                </div>
                <label className="block">
                  <span className="label">Kohëzgjatja (minuta)</span>
                  <input className="field" type="number" min="15" step="5" value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: event.target.value })} />
                </label>
                <label className="block">
                  <span className="label">Arsyeja</span>
                  <input className="field" value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
                </label>
                {user.role !== "patient" ? (
                  <label className="block">
                    <span className="label">Statusi</span>
                    <select className="field" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                      <option value="pending">Në pritje</option>
                      <option value="confirmed">Konfirmuar</option>
                      <option value="completed">Përfunduar</option>
                      <option value="cancelled">Anuluar</option>
                    </select>
                  </label>
                ) : null}
              </>
            )}
            {formError ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setDraft(null)}>Mbyll</button>
              {user.role === "patient" && draft.id ? (
                draft.status === "pending" || draft.status === "confirmed" ? (
                  <button className="btn-danger" type="submit" disabled={saving}>Anulo terminin</button>
                ) : null
              ) : (
                <button className="btn-primary" type="submit" disabled={saving}>{saving ? "Duke ruajtur…" : "Ruaj"}</button>
              )}
            </div>
          </form>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
