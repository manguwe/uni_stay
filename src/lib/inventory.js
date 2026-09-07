import { supabase } from './supabaseClient'

// ---------------------------------------------------------------------------
// Hostels
// ---------------------------------------------------------------------------
export async function createHostel({ name, gender, campusLocation, totalBedCapacity }) {
  const { data, error } = await supabase
    .from('hostels')
    .insert({
      name,
      gender,
      campus_location: campusLocation || null,
      total_bed_capacity: totalBedCapacity || 0,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateHostel(id, patch) {
  const { error } = await supabase
    .from('hostels')
    .update({
      name: patch.name,
      gender: patch.gender,
      campus_location: patch.campusLocation || null,
      total_bed_capacity: patch.totalBedCapacity || 0,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteHostel(id) {
  const { error } = await supabase.from('hostels').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Blocks / Floors / Flats — thin, near-identical wrappers (KB §6: purely
// structural, optional, name-only levels)
// ---------------------------------------------------------------------------
export async function createBlock({ hostelId, name }) {
  const { data, error } = await supabase
    .from('blocks')
    .insert({ hostel_id: hostelId, name })
    .select()
    .single()
  if (error) throw error
  return data
}
export async function deleteBlock(id) {
  const { error } = await supabase.from('blocks').delete().eq('id', id)
  if (error) throw error
}

export async function createFloor({ hostelId, blockId, name }) {
  const { data, error } = await supabase
    .from('floors')
    .insert({ hostel_id: hostelId, block_id: blockId || null, name })
    .select()
    .single()
  if (error) throw error
  return data
}
export async function deleteFloor(id) {
  const { error } = await supabase.from('floors').delete().eq('id', id)
  if (error) throw error
}

export async function createFlat({ hostelId, floorId, name }) {
  const { data, error } = await supabase
    .from('flats')
    .insert({ hostel_id: hostelId, floor_id: floorId || null, name })
    .select()
    .single()
  if (error) throw error
  return data
}
export async function deleteFlat(id) {
  const { error } = await supabase.from('flats').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------
export async function fetchRoomsForHostelAdmin(hostelId) {
  const { data, error } = await supabase
    .from('rooms')
    .select(
      `*, blocks ( name ), floors ( name ), flats ( name ), beds ( id, bed_label, status )`
    )
    .eq('hostel_id', hostelId)
    .order('room_number')
  if (error) throw error
  return data || []
}

export async function createRoom({
  hostelId,
  blockId,
  floorId,
  flatId,
  roomNumber,
  roomType,
  bedCapacity,
  facilities,
}) {
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      hostel_id: hostelId,
      block_id: blockId || null,
      floor_id: floorId || null,
      flat_id: flatId || null,
      room_number: roomNumber,
      room_type: roomType || null,
      bed_capacity: bedCapacity,
      facilities: facilities || [],
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateRoom(id, patch) {
  const { error } = await supabase
    .from('rooms')
    .update({
      room_number: patch.roomNumber,
      room_type: patch.roomType || null,
      bed_capacity: patch.bedCapacity,
      facilities: patch.facilities || [],
    })
    .eq('id', id)
  if (error) throw error
}

// Surfaces the guard_room_delete() trigger's message verbatim if the room
// still has an occupied bed.
export async function deleteRoom(id) {
  const { error } = await supabase.from('rooms').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Beds
// ---------------------------------------------------------------------------
export async function createBed({ roomId, bedLabel, status }) {
  const { data, error } = await supabase
    .from('beds')
    .insert({ room_id: roomId, bed_label: bedLabel, status: status || 'vacant' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateBedStatus(id, status) {
  const { error } = await supabase.from('beds').update({ status }).eq('id', id)
  if (error) throw error
}

// Surfaces guard_bed_delete()'s message verbatim if the bed is occupied.
export async function deleteBed(id) {
  const { error } = await supabase.from('beds').delete().eq('id', id)
  if (error) throw error
}
