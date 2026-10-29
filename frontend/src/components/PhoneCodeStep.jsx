import { useEffect, useState } from "react";
import { errorMessage } from "../api/client";

const RESEND_SECONDS = 60;
const CODE_LENGTH = 4;

export default function PhoneCodeStep({ phone, debugCode, submitLabel, onVerify, onResend, onBack }) {
  const [code, setCode] = useState("");
  const [hint, setHint] = useState(debugCode || "");
  const [wait, setWait] = useState(RESEND_SECONDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onVerify(code);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  async function resend() {
    setError("");
    try {
      const data = await onResend();
      setHint(data.debug_code || "");
      setCode("");
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <p className="text-sm text-slate-600">
        Dërguam një kod me {CODE_LENGTH} shifra me SMS te <span className="font-medium text-ink">{phone}</span>.
      </p>
      <label className="block">
        <span className="label">Kodi i verifikimit</span>
        <input
          className="field text-center text-lg tracking-[0.5em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern={`\\d{${CODE_LENGTH}}`}
          maxLength={CODE_LENGTH}
          placeholder={"•".repeat(CODE_LENGTH)}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
          required
          autoFocus
        />
      </label>
      {hint ? (
        <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Modaliteti i zhvillimit: kodi është <span className="font-semibold">{hint}</span> (në prodhim shkon vetëm me SMS).
        </p>
      ) : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <button className="btn-primary w-full" type="submit" disabled={busy || code.length !== CODE_LENGTH}>
        {busy ? "Duke verifikuar…" : submitLabel}
      </button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" className="text-slate-500 hover:text-brand" onClick={onBack}>
          Ndrysho numrin
        </button>
        <button
          type="button"
          className="font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
          onClick={resend}
          disabled={wait > 0}
        >
          {wait > 0 ? `Dërgo përsëri (${wait}s)` : "Dërgo përsëri kodin"}
        </button>
      </div>
    </form>
  );
}
