import { redirect } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Page({ params }: Props) {
  const { locale } = await params;

  // Root of a locale should always lead to login or dashboard based on auth
  // Auth redirection is handled by ClientLayout, so we just point to /login
  redirect('/login');
}
