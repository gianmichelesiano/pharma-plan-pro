import { useT } from "../i18n/useT";
import { PageHeader } from "../components/PageHeader";
export function PianificazionePage() {
  const t = useT("piano");
  return <section className="page"><PageHeader title={t.title} description={t.description} /><p className="mini-muted">In costruzione…</p></section>;
}
