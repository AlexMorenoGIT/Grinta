'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { X, MapPin, Calendar, Clock, Users, FileText } from 'lucide-react'

interface CreateMatchModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function CreateMatchModal({ open, onClose, onCreated }: CreateMatchModalProps) {
  const supabase = createClient() as any

  const [form, setForm] = useState({
    title: '',
    lieu: '',
    date: '',
    heure: '19:00',
    google_maps_url: '',
    max_players: '10',
    notes: '',
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: match, error } = await supabase
      .from('matches')
      .insert({
        title: form.title,
        lieu: form.lieu,
        date: form.date,
        heure: form.heure,
        google_maps_url: form.google_maps_url || null,
        max_players: parseInt(form.max_players),
        notes: form.notes || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      toast.error('Erreur lors de la création')
      setLoading(false)
      return
    }

    // Auto-inscription du créateur
    await supabase.from('match_players').insert({
      match_id: match.id,
      player_id: user.id,
    })

    toast.success('Match créé ! Tu es automatiquement inscrit.')
    setForm({ title: '', lieu: '', date: '', heure: '19:00', google_maps_url: '', max_players: '10', notes: '' })
    setLoading(false)
    onCreated()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg mx-auto rounded-t-2xl overflow-hidden animate-slide-up"
        style={{ background: '#0F0F0F', border: '1px solid #1F1F1F', maxHeight: '90dvh' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#333]" />
        </div>

        <div className="overflow-y-auto max-h-[calc(90dvh-40px)]">
          <div className="px-5 pb-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-2xl text-white">CRÉER UN MATCH</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#555] hover:text-white hover:bg-[#1A1A1A] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Titre */}
              <div>
                <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-1.5">
                  <FileText className="w-3 h-3 inline mr-1.5" />Titre du match
                </label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Futsal vendredi soir"
                  required
                  className="input-dark"
                />
              </div>

              {/* Lieu */}
              <div>
                <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-1.5">
                  <MapPin className="w-3 h-3 inline mr-1.5" />Lieu
                </label>
                <input
                  name="lieu"
                  value={form.lieu}
                  onChange={handleChange}
                  placeholder="Complexe sportif Marcel Cerdan"
                  required
                  className="input-dark"
                />
              </div>

              {/* Google Maps URL */}
              <div>
                <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-1.5">
                  Lien Google Maps (optionnel)
                </label>
                <input
                  name="google_maps_url"
                  type="url"
                  value={form.google_maps_url}
                  onChange={handleChange}
                  placeholder="https://maps.google.com/..."
                  className="input-dark"
                />
              </div>

              {/* Date + Heure */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-1.5">
                    <Calendar className="w-3 h-3 inline mr-1.5" />Date
                  </label>
                  <input
                    name="date"
                    type="date"
                    value={form.date}
                    onChange={handleChange}
                    required
                    className="input-dark"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-1.5">
                    <Clock className="w-3 h-3 inline mr-1.5" />Heure
                  </label>
                  <input
                    name="heure"
                    type="time"
                    value={form.heure}
                    onChange={handleChange}
                    required
                    className="input-dark"
                  />
                </div>
              </div>

              {/* Nb joueurs */}
              <div>
                <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-1.5">
                  <Users className="w-3 h-3 inline mr-1.5" />Nombre max de joueurs
                </label>
                <select
                  name="max_players"
                  value={form.max_players}
                  onChange={handleChange}
                  className="input-dark"
                >
                  {[6, 8, 10, 12, 14, 16, 18, 20, 22].map(n => (
                    <option key={n} value={n}>{n} joueurs ({n/2}v{n/2})</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-1.5">
                  Notes (optionnel)
                </label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Ex: Amenez vos chasubles rouges..."
                  rows={2}
                  className="input-dark resize-none"
                />
              </div>

              <div className="pt-2 pb-4">
                <button type="submit" disabled={loading} className="btn-lime">
                  {loading ? 'CRÉATION...' : 'CRÉER LE MATCH →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
