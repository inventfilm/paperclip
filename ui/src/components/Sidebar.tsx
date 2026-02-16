import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/agents", label: "Agents" },
  { to: "/projects", label: "Projects" },
  { to: "/issues", label: "Issues" },
  { to: "/goals", label: "Goals" },
];

export function Sidebar() {
  return (
    <aside className="w-56 border-r border-gray-200 bg-white p-4 flex flex-col gap-1">
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
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
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
