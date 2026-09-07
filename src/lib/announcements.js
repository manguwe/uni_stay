import { supabase } from './supabaseClient'

// RLS scopes this correctly for whoever calls it: students get only
// relevant/unexpired announcements, staff/admin get everything.
export async function fetchAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select(
      `*,
      hostels ( name ), blocks ( name ), flats ( name ), rooms ( room_number ),
      profiles!announcements_created_by_fkey ( full_name )`
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export function scopeLabel(a) {
  if (a.rooms?.room_number) return `Room ${a.rooms.room_number}`
  if (a.flats?.name) return `${a.hostels?.name} · ${a.flats.name}`
  if (a.blocks?.name) return `${a.hostels?.name} · ${a.blocks.name}`
  if (a.hostels?.name) return a.hostels.name
  return 'All Students'
}

export async function createAnnouncement({
  title,
  body,
  targetHostelId,
  targetBlockId,
  targetFlatId,
  targetRoomId,
  expiresAt,
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('announcements').insert({
    created_by: user.id,
    title,
    body,
    target_hostel_id: targetHostelId || null,
    target_block_id: targetBlockId || null,
    target_flat_id: targetFlatId || null,
    target_room_id: targetRoomId || null,
    expires_at: expiresAt || null,
  })
  if (error) throw error
}

export async function deleteAnnouncement(id) {
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) throw error
}
