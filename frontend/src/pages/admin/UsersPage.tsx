import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { Users, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function UsersPage() {
  const users = [
    { email: 'superadmin@hydronix.com', name: 'Super Admin', role: 'superadmin', active: true },
    { email: 'admin@hydronix.com', name: 'Operations Admin', role: 'admin', active: true },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            User Management
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Superadmin panel to register, edit, and revoke portal access tokens.
          </p>
        </div>
        <Button variant="primary" className="flex items-center gap-1.5 self-start">
          <UserPlus className="h-4 w-4" /> Add Admin User
        </Button>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <table className="w-full text-left border-collapse text-xs font-bold text-slate-600">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Name</th>
              <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Email</th>
              <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider">Security Role</th>
              <th className="p-4 text-[10px] uppercase text-slate-400 tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.email} className="hover:bg-slate-50/20 transition-colors">
                <td className="p-4 text-slate-800 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                    {u.name[0]}
                  </div>
                  {u.name}
                </td>
                <td className="p-4 text-slate-500 font-semibold">{u.email}</td>
                <td className="p-4">
                  <Badge variant={u.role === 'superadmin' ? 'success' : 'info'}>{u.role}</Badge>
                </td>
                <td className="p-4 text-right">
                  <button className="text-sky-600 hover:underline cursor-pointer">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  )
}
