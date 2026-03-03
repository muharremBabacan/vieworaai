'use client';
export const dynamic = 'force-dynamic';
import AdminPanel from '@/modules/admin/components/admin-panel';

export default function AdminPage() {
  return (
    <div className="container mx-auto">
        <AdminPanel />
    </div>
  )
}
