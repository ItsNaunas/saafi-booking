import ServicePage from "@/components/ServicePage";
import { serviceMetadata } from "@/lib/serviceMeta";

export const generateMetadata = () => serviceMetadata("end-of-tenancy-cleaning");

// Prices come from the live config; same freshness as the home page.
export const revalidate = 300;

export default function Page() {
  return <ServicePage slug="end-of-tenancy-cleaning" />;
}
