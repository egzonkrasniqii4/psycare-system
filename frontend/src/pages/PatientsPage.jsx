import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import Modal from "../components/Modal";
import NewPatientForm from "../components/NewPatientForm";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";

export default function PatientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [count, setCount] = useState(0);
  const [therapists, setTherapists] = useState([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user.role === "patient") return undefined;
    const handle = setTimeout(() => {
      api
        .get("/patients/", { params: { search: query, page_size: 50 } })
        .then((response) => {
          setPatients(response.data.results || []);
          setCount(response.data.count || 0);
        })
        .catch((err) => setError(errorMessage(err)));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, user.role]);

  useEffect(() => {
    if (user.role !== "admin") return;
    api.get("/therapists/").then((response) => setTherapists(response.data));
  }, [user.role]);

  if (user.role === "patient") {
    return <Navigate to={user.patient_profile_id ? `/patients/${user.patient_profile_id}` : "/"} replace />;
  }

  return (
    <div>
      <PageHeader
        title="Pacientët"
        subtitle={`${count} në listë`}
        action={
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} />
            Pacient i ri
          </button>
        }
      />
      <input
        className="field mb-4 max-w-md"
        placeholder="Kërko emër, email ose telefon"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {error ? <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Pacienti</th>
              <th className="px-5 py-3 font-semibold">Kontakt</th>
              <th className="px-5 py-3 font-semibold">Psikologu</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-slate-500" colSpan={3}>
                  Nuk u gjet asnjë pacient.
                </td>
              </tr>
            ) : (
              patients.map((patient) => (
                <tr
                  key={patient.id}
                  className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                  onClick={() => navigate(`/patients/${patient.id}`)}
                >
                  <td className="px-5 py-3">
                    <div className="font-medium">{patient.full_name}</div>
                    {patient.has_account ? (
                      <div className="text-slate-500">{patient.email}</div>
                    ) : (
                      <span className="mt-0.5 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                        Pa llogari
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{patient.phone || "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{patient.assigned_therapist_name || "Pa caktuar"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open ? (
        <Modal title="Pacient i ri" onClose={() => setOpen(false)}>
          <NewPatientForm
            therapists={therapists}
            onCancel={() => setOpen(false)}
            onCreated={(patient) => {
              setOpen(false);
              navigate(`/patients/${patient.id}`);
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
