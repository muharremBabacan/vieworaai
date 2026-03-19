import { redirect } from "next/navigation";

export default function Page() {
  // Redirect base path to the default locale's login
  redirect('/tr/login');
}
