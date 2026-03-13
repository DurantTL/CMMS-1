import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { auth } from "../../auth";
import { routing, type AppLocale } from "../../i18n";
import { AdminShell } from "./_components/admin-shell";

function getLocaleFromCookie(cookieLocale: string | undefined): AppLocale {
  if (cookieLocale && routing.locales.includes(cookieLocale as AppLocale)) {
    return cookieLocale as AppLocale;
  }

  return routing.defaultLocale;
}

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const locale = getLocaleFromCookie((await cookies()).get("NEXT_LOCALE")?.value);

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return (
    <AdminShell
      currentLocale={locale}
      user={{
        name: session.user.name,
        role: session.user.role,
      }}
    >
      {children}
    </AdminShell>
  );
}
