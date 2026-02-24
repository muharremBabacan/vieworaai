'use client';
import AdminPanel from '@/modules/admin/components/admin-panel';
import { useTranslations } from 'next-intl';


export default function AdminPage() {
    const tNav = useTranslations('AppLayout');
  return (
    <div className="container mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-8">
            {tNav('title_admin_panel')}
        </h1>
        <AdminPanel />
    </div>
  )
}
