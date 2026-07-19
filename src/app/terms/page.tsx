import { permanentRedirect } from "next/navigation";

export default function TermsOfServicePage() {
  permanentRedirect("/trust/terms");
}
