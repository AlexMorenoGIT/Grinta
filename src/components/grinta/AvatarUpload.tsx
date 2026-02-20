'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { PlayerAvatar } from './PlayerAvatar'

interface AvatarUploadProps {
  profile: {
    id: string
    first_name: string
    last_name: string
    avatar_url?: string | null
  }
  onUpdated: () => void
}

export function AvatarUpload({ profile, onUpdated }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Fichier non valide, choisis une image')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image trop lourde (max 5 Mo)')
      return
    }

    setUploading(true)

    try {
      // Resize côté client
      const resized = await resizeImage(file, 256)

      const supabase = createClient() as any
      const filePath = `${profile.id}.webp`

      // Upload vers Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, resized, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/webp',
        })

      if (uploadError) {
        toast.error('Erreur upload : ' + uploadError.message)
        setUploading(false)
        return
      }

      // Récupérer l'URL publique
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const avatarUrl = urlData?.publicUrl + '?t=' + Date.now()

      // Sauvegarder dans le profil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', profile.id)

      if (updateError) {
        toast.error('Erreur sauvegarde : ' + updateError.message)
      } else {
        toast.success('Photo de profil mise à jour !')
        onUpdated()
      }
    } catch (err: any) {
      toast.error('Erreur : ' + (err?.message || 'Erreur inconnue'))
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="relative inline-block">
      <PlayerAvatar player={profile} size={64} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center transition-all"
        style={{
          background: 'var(--lime)',
          border: '2px solid #080808',
          color: '#000',
        }}
      >
        {uploading ? (
          <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
        ) : (
          <Camera className="w-3.5 h-3.5" />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  )
}

async function resizeImage(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let w = img.width
      let h = img.height
      if (w > h) {
        if (w > maxSize) { h = (h * maxSize) / w; w = maxSize }
      } else {
        if (h > maxSize) { w = (w * maxSize) / h; h = maxSize }
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas context null')); return }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Conversion blob échouée'))
        },
        'image/webp',
        0.85
      )
    }
    img.onerror = () => reject(new Error('Image invalide'))
    img.src = url
  })
}
