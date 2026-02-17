import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/companies", label: "Companies" },
  { to: "/org", label: "Org" },
  { to: "/agents", label: "Agents" },
  { to: "/tasks", label: "Tasks" },
  { to: "/projects", label: "Projects" },
  { to: "/goals", label: "Goals" },
  { to: "/approvals", label: "Approvals" },
  { to: "/costs", label: "Costs" },
  { to: "/activity", label: "Activity" },
];

export function Sidebar() {
  return (
    <aside className="w-56 border-r border-border bg-card p-4 flex flex-col gap-1">
      <h1 className="text-lg font-bold mb-6 px-3">Paperclip</h1>
      <nav className="flex flex-col gap-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
