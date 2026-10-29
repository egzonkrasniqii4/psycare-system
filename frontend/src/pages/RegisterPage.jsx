import { ShieldPlus } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import PhoneCodeStep from "../components/PhoneCodeStep";
import PhoneInput from "../components/PhoneInput";
import { useAuth } from "../context/AuthContext";

const EMPTY = { first_name: "", last_name: "", phone: "", email: "" };

export default function RegisterPage() {
  const { user, ready, requestCode, verifyCode } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ready) return null;
  if (user) return <Navigate to="/" replace />;

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function payload() {
    return {
      purpose: "register",
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone,
      email: form.email.trim() || null,
    };
  }

  async function sendCode(event) {
    event.preventDefault();
    if (!form.phone) {
      setError("Shkruani numrin e telefonit.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setSent(await requestCode(payload()));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-brand text-white">
            <ShieldPlus size={18} strokeWidth={1.75} />
          </div>
          <span className="text-lg font-semibold tracking-tight">PsyCare</span>
        </div>
        <div className="card p-6">
          <h1 className="text-xl font-semibold tracking-tight">Regjistrimi i pacientit</h1>
          {sent ? (
            <div className="mt-6">
              <PhoneCodeStep
                phone={sent.phone}
                debugCode={sent.debug_code}
                submitLabel="Verifiko dhe regjistrohu"
                onVerify={async (code) => {
                  await verifyCode({ ...payload(), code });
                  navigate("/");
                }}
                onResend={() => requestCode(payload())}
                onBack={() => setSent(null)}
              />
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-500">
                Nuk ka nevojë për fjalëkalim: do të merrni një kod me SMS. Nëse klinika ju ka regjistruar më parë,
                përdorni të njëjtin emër, mbiemër dhe numër telefoni.
              </p>
              <form className="mt-6 space-y-3" onSubmit={sendCode}>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="label">Emri</span>
                    <input className="field" value={form.first_name} onChange={(event) => setField("first_name", event.target.value)} required autoComplete="given-name" />
                  </label>
                  <label className="block">
                    <span className="label">Mbiemri</span>
                    <input className="field" value={form.last_name} onChange={(event) => setField("last_name", event.target.value)} required autoComplete="family-name" />
                  </label>
                </div>
                <div>
                  <span className="label">Telefoni</span>
                  <PhoneInput value={form.phone} onChange={(phone) => setField("phone", phone)} required />
                </div>
                <label className="block">
                  <span className="label">
                    Email <span className="font-normal text-slate-400">(opsionale)</span>
                  </span>
                  <input className="field" type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} autoComplete="email" />
                </label>
                {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
                <button className="btn-primary w-full" type="submit" disabled={busy}>
                  {busy ? "Duke dërguar…" : "Dërgo kodin"}
                </button>
              </form>
            </>
          )}
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">
          Keni llogari?{" "}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Hyni
          </Link>
        </p>
      </div>
    </div>
  );
}
