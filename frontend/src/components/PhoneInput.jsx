import { useEffect, useState } from "react";
import { COUNTRIES, joinPhone, splitPhone } from "../utils/countries";

export default function PhoneInput({ value, onChange, required = false, autoFocus = false, disabled = false, id }) {
  const [state, setState] = useState(() => splitPhone(value));

  useEffect(() => {
    if (value !== joinPhone(state.country, state.number)) {
      setState(splitPhone(value));
    }
    // Only resync when the parent replaces the value from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function update(next) {
    setState(next);
    onChange(joinPhone(next.country, next.number));
  }

  return (
    <div className="flex">
      <select
        aria-label="Kodi i shtetit"
        className="field w-28 shrink-0 rounded-r-none border-r-0 pr-6"
        value={state.country.iso}
        disabled={disabled}
        onChange={(event) => update({ ...state, country: COUNTRIES.find((item) => item.iso === event.target.value) })}
      >
        {COUNTRIES.map((country) => (
          <option key={country.iso} value={country.iso} title={country.name}>
            {country.iso} +{country.dial}
          </option>
        ))}
      </select>
      <input
        id={id}
        className="field rounded-l-none"
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="tel-national"
        placeholder="44 123 456"
        maxLength={14}
        value={state.number}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        onChange={(event) => update({ ...state, number: event.target.value.replace(/\D/g, "") })}
      />
    </div>
  );
}
