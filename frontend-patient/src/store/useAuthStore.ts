import { create } from 'zustand'
import { UserProfile, DependentLink } from '../types'

interface AuthState {
  user: UserProfile | null
  isAuthenticated: boolean
  dependents: DependentLink[]
  setUser: (user: UserProfile | null) => void
  setDependents: (dependents: DependentLink[]) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: {
    id: 'usr-101',
    fullName: 'Nguyễn Văn An',
    email: 'nguyenvanan@gmail.com',
    phone: '0912 345 678',
    dateOfBirth: '1990-05-15',
    gender: 'Nam',
    address: '123 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
    nationalId: '079090012345',
    nationalIdStatus: 'MANUALLY_VERIFIED',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'
  },
  isAuthenticated: true,
  dependents: [
    {
      id: 'dep-01',
      patientId: 'pat-001',
      fullName: 'Nguyễn Văn An (Bản thân)',
      dateOfBirth: '1990-05-15',
      relationship: 'OWN',
      relationshipLabel: 'Bản thân',
      tier: 'Tier 2',
      tierCode: 2
    },
    {
      id: 'dep-02',
      patientId: 'pat-002',
      fullName: 'Nguyễn Minh Anh (Con trai)',
      dateOfBirth: '2018-09-20',
      relationship: 'CHILD',
      relationshipLabel: 'Con trai',
      tier: 'Tier 2',
      tierCode: 2
    },
    {
      id: 'dep-03',
      patientId: 'pat-003',
      fullName: 'Nguyễn Thị Hải (Mẹ ruột)',
      dateOfBirth: '1962-03-10',
      relationship: 'PARENT',
      relationshipLabel: 'Mẹ ruột',
      tier: 'Tier 1',
      tierCode: 1
    }
  ],
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setDependents: (dependents) => set({ dependents }),
  logout: () => set({ user: null, isAuthenticated: false, dependents: [] })
}))
