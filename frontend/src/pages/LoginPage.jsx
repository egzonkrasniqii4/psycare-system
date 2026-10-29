import { ShieldPlus } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import PhoneCodeStep from "../components/PhoneCodeStep";
import PhoneInput from "../components/PhoneInput";
import { useAuth } from "../context/AuthContext";

const DEMO_STAFF = [
  ["Administrator", "admin@psycare.local", "Admin12345!"],
  ["Psikolog", "arta.dema@psycare.local", "Therapist12345!"],
];
const DEMO_PATIENT_PHONE = "+355690000001";

export default function LoginPage() {
  const { user, ready, login, requestCode, verifyCode } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ready) return null;
  if (user) return <Navigate to="/" replace />;

  function switchTab(next) {
    setTab(next);
    setError("");
    setSent(null);
  }

  async function staffLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(event) {
    event.preventDefault();
    if (!phone) {
      setError("Shkruani numrin e telefonit.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setSent(await requestCode({ purpose: "login", phone }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const errorBox = error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-brand-dark p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-white/10">
            <ShieldPlus size={18} strokeWidth={1.75} />
          </div>
          <span className="text-lg font-semibold tracking-tight">PsyCare</span>
        </div>
        <div>
          <h1 className="max-w-md text-4xl font-light leading-tight tracking-tight">
            Sistemi i menaxhimit të klinikës psikologjike
          </h1>
          <p className="mt-4 max-w-md text-sm font-light text-slate-200">
            Termine, dosje pacientësh, shënime klinike dhe faturim në një platformë të vetme.
          </p>
        </div>
        <span />
      </section>

      <section className="flex items-center justify-center bg-canvas px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-brand text-white">
              <ShieldPlus size={18} strokeWidth={1.75} />
            </div>
            <span className="text-lg font-semibold tracking-tight">PsyCare</span>
          </div>
          <div className="card p-6">
            <h2 className="text-xl font-semibold tracking-tight">Hyrje në sistem</h2>
            <div className="mt-5 grid grid-cols-2 rounded-md bg-slate-100 p-1 text-sm">
              {[
                ["patient", "Pacient"],
                ["staff", "Staf i klinikës"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchTab(key)}
                  className={`rounded px-3 py-1.5 font-medium transition ${
                    tab === key ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "staff" ? (
              <form className="mt-5 space-y-4" onSubmit={staffLogin}>
                <label className="block">
                  <span className="label">Email</span>
                  <input className="field" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </label>
                <label className="block">
                  <span className="label">Fjalëkalimi</span>
                  <input className="field" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                </label>
                {errorBox}
                <button className="btn-primary w-full" type="submit" disabled={busy}>
                  {busy ? "Duke hyrë…" : "Hyr"}
                </button>
              </form>
            ) : sent ? (
              <div className="mt-5">
                <PhoneCodeStep
                  phone={sent.phone}
                  debugCode={sent.debug_code}
                  submitLabel="Hyr"
                  onVerify={async (code) => {
                    await verifyCode({ purpose: "login", phone, code });
                    navigate("/");
                  }}
                  onResend={() => requestCode({ purpose: "login", phone })}
                  onBack={() => setSent(null)}
                />
              </div>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={sendCode}>
                <div>
                  <span className="label">Numri i telefonit</span>
                  <PhoneInput value={phone} onChange={setPhone} required autoFocus />
                </div>
                {errorBox}
                <button className="btn-primary w-full" type="submit" disabled={busy}>
                  {busy ? "Duke dërguar…" : "Dërgo kodin me SMS"}
                </button>
              </form>
            )}

            {tab === "patient" ? (
              <p className="mt-5 border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
                Nuk keni llogari?{" "}
                <Link to="/register" className="font-medium text-brand hover:underline">
                  Regjistrohuni
                </Link>
              </p>
            ) : null}
          </div>

          {import.meta.env.DEV ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-600">
              <p className="mb-2 font-semibold uppercase tracking-wide text-slate-500">Llogari demo</p>
              <ul className="space-y-1">
                {DEMO_STAFF.map(([role, demoEmail, demoPassword]) => (
                  <li key={demoEmail}>
                    <button
                      type="button"
                      className="text-left hover:text-brand"
                      onClick={() => {
                        switchTab("staff");
                        setEmail(demoEmail);
                        setPassword(demoPassword);
                      }}
                    >
                      <span className="font-semibold">{role}:</span> {demoEmail} · {demoPassword}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    className="text-left hover:text-brand"
                    onClick={() => {
                      switchTab("patient");
                      setPhone(DEMO_PATIENT_PHONE);
                    }}
                  >
                    <span className="font-semibold">Pacient:</span> {DEMO_PATIENT_PHONE} · kodi shfaqet në ekran
                  </button>
                </li>
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
