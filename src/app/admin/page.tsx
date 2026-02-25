'use client';
import AdminPanel from '@/modules/admin/components/admin-panel';

export default function AdminPage() {
  return (
    <div className="container mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-8">
            Yönetici Paneli
        </h1>
        <AdminPanel />
    </div>
  )
}
