import { createNavigation } from "next-intl/navigation";

export const { Link, redirect, usePathname, useRouter } =
  createNavigation({
    locales: ["en", "tr"],
    defaultLocale: "en"
  });