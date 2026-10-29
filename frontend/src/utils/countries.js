export const COUNTRIES = [
  { iso: "XK", name: "Kosovë", dial: "383" },
  { iso: "AL", name: "Shqipëri", dial: "355" },
  { iso: "MK", name: "Maqedoni e Veriut", dial: "389" },
  { iso: "ME", name: "Mal i Zi", dial: "382" },
  { iso: "RS", name: "Serbi", dial: "381" },
  { iso: "DE", name: "Gjermani", dial: "49" },
  { iso: "CH", name: "Zvicër", dial: "41" },
  { iso: "AT", name: "Austri", dial: "43" },
  { iso: "IT", name: "Itali", dial: "39" },
  { iso: "FR", name: "Francë", dial: "33" },
  { iso: "GB", name: "Mbretëri e Bashkuar", dial: "44" },
  { iso: "US", name: "SHBA / Kanada", dial: "1" },
  { iso: "SE", name: "Suedi", dial: "46" },
  { iso: "NO", name: "Norvegji", dial: "47" },
  { iso: "BE", name: "Belgjikë", dial: "32" },
  { iso: "NL", name: "Holandë", dial: "31" },
  { iso: "HR", name: "Kroaci", dial: "385" },
  { iso: "SI", name: "Slloveni", dial: "386" },
  { iso: "TR", name: "Turqi", dial: "90" },
  { iso: "GR", name: "Greqi", dial: "30" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

const BY_LONGEST_DIAL = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

export function splitPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return { country: DEFAULT_COUNTRY, number: "" };
  const country = BY_LONGEST_DIAL.find((item) => digits.startsWith(item.dial));
  if (!country) return { country: DEFAULT_COUNTRY, number: digits };
  return { country, number: digits.slice(country.dial.length) };
}

export function joinPhone(country, number) {
  const national = number.replace(/\D/g, "").replace(/^0+/, "");
  return national ? `+${country.dial}${national}` : "";
}
