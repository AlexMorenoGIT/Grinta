'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { X, MapPin, Calendar, Clock, Users, FileText, Euro } from 'lucide-react'
import type { Match } from '@/types/database'

interface EditMatchModalProps {
  match: Match
  open: boolean
  onClose: () => void
  onUpdated: () => void
}

export function EditMatchModal({ match, open, onClose, onUpdated }: EditMatchModalProps) {
  const supabase = createClient() as any

  const [form, setForm] = useState({
    title: match.title,
    lieu: match.lieu,
    date: match.date,
    heure: match.heure.substring(0, 5),
    google_maps_url: match.google_maps_url || '',
    max_players: String(match.max_players),
    notes: match.notes || '',
    price_total: match.price_total != null ? String(match.price_total) : '',
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase
      .from('matches')
      .update({
        title: form.title,
        lieu: form.lieu,
        date: form.date,
        heure: form.heure,
        google_maps_url: form.google_maps_url || null,
        max_players: parseInt(form.max_players),
        notes: form.notes || null,
        price_total: form.price_total ? parseFloat(form.price_total) : null,
      })
      .eq('id', match.id)

    if (error) {
      toast.error('Erreur lors de la mise à jour')
      setLoading(false)
      return
    }

    toast.success('Match mis à jour !')
    setLoading(false)
    onUpdated()
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
              <h2 className="font-display text-2xl text-white">MODIFIER LE MATCH</h2>
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

              {/* Prix total */}
              <div>
                <label className="block text-xs font-semibold text-[#888] uppercase tracking-wider mb-1.5">
                  <Euro className="w-3 h-3 inline mr-1.5" />Prix total du terrain (optionnel)
                </label>
                <input
                  name="price_total"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price_total}
                  onChange={handleChange}
                  placeholder="Ex: 60"
                  className="input-dark"
                />
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
                  rows={2}
                  className="input-dark resize-none"
                />
              </div>

              <div className="pt-2 pb-4">
                <button type="submit" disabled={loading} className="btn-lime">
                  {loading ? 'MISE À JOUR...' : 'ENREGISTRER LES MODIFICATIONS →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
