import type { ReactNode } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface PageTabItem {
  value: string;
  label: ReactNode;
}

export function PageTabBar({ items }: { items: PageTabItem[] }) {
  return (
    <TabsList variant="line">
      {items.map((item) => (
        <TabsTrigger key={item.value} value={item.value}>
          {item.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
