import Tabs from "./Tabs";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold text-slate-900">Marketing</h1>
      <Tabs />
      {children}
    </div>
  );
}
