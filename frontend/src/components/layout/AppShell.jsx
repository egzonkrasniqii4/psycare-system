import { Calendar, LayoutDashboard, LogOut, ShieldPlus, Stethoscope, UserRound, Users } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROLE_LABEL, initials } from "../../utils/format";

const LINKS = [
  { to: "/", label: "Paneli", icon: LayoutDashboard, roles: ["admin", "therapist", "patient"] },
  { to: "/calendar", label: "Terminet", icon: Calendar, roles: ["admin", "therapist", "patient"] },
  { to: "/patients", label: "Pacientët", icon: Users, roles: ["admin", "therapist"] },
  { to: "/therapists", label: "Psikologët", icon: Stethoscope, roles: ["admin"] },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = LINKS.filter((item) => item.roles.includes(user.role));
  if (user.role === "patient" && user.patient_profile_id) {
    links.push({
      to: `/patients/${user.patient_profile_id}`,
      label: "Profili im",
      icon: UserRound,
    });
  }

  function leave() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
          <Brand />
        </div>
        <p className="px-5 pb-2 pt-5 text-[11px] font-medium uppercase tracking-wider text-slate-400">Menyja</p>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {links.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <UserChip user={user} />
          <button
            type="button"
            onClick={leave}
            className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-ink"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Dil
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2.5 md:hidden">
        <div className="mr-2 flex items-center gap-2">
          <Brand compact />
        </div>
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
                isActive ? "bg-brand-soft font-medium text-brand" : "text-slate-600"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
        <button type="button" onClick={leave} className="ml-auto rounded-md p-2 text-slate-600" aria-label="Dil">
          <LogOut size={16} strokeWidth={1.75} />
        </button>
      </header>

      <main className="md:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Brand({ compact = false }) {
  return (
    <>
      <div className="grid h-8 w-8 place-items-center rounded-md bg-brand text-white">
        <ShieldPlus size={17} strokeWidth={1.75} />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight text-ink">PsyCare</div>
        {compact ? null : <div className="text-xs text-slate-500">Sistemi klinik</div>}
      </div>
    </>
  );
}

function NavItem({ item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
          isActive
            ? "bg-brand-soft font-medium text-brand"
            : "text-slate-600 hover:bg-slate-50 hover:text-ink"
        }`
      }
    >
      <Icon size={17} strokeWidth={1.75} />
      {item.label}
    </NavLink>
  );
}

function UserChip({ user }) {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-xs font-medium text-slate-700">
        {initials(user.full_name)}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-ink">{user.full_name}</div>
        <div className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</div>
      </div>
    </div>
  );
}
