import { supabase } from './supabaseClient'

/**
 * The physical hierarchy is HOSTEL -> BLOCK -> FLOOR -> FLAT -> ROOM -> BED,
 * but KB §6 requires flexibility: not every hostel uses every level
 * (e.g. a hostel might go straight from floor to room, skipping "flat").
 *
 * `path` tracks whichever levels have been selected so far:
 *   { block: rowOrNull, floor: rowOrNull, flat: rowOrNull }
 *
 * findNextLevel walks forward from the deepest selected level and returns
 * the first non-empty level it finds, auto-skipping any level that has no
 * rows for the current branch (so a hostel with no blocks jumps straight
 * to floors, etc). If every intermediate level is empty, it falls through
 * to rooms.
 */
/**
 * Supabase's `.match({ col: value })` serializes every entry as `.eq(col,
 * value)` — including when value is `null`. `.eq('block_id', null)` sends
 * the literal string "null" over the wire, which Postgres rejects for a
 * uuid column ("invalid input syntax for type uuid: \"null\""). A skipped
 * hierarchy level is a genuine SQL NULL, so it needs `.is(col, null)`
 * instead. This applies each filter with the correct operator.
 */
function applyFilters(query, filters) {
  let q = query
  for (const [column, value] of Object.entries(filters)) {
    q = value === null || value === undefined ? q.is(column, null) : q.eq(column, value)
  }
  return q
}

export async function findNextLevel(hostelId, path = {}) {
  // Guard: never let an undefined/missing id reach a query — the caller
  // should hold off calling this until a real hostelId exists.
  if (!hostelId) {
    throw new Error('findNextLevel() called without a hostelId')
  }

  const { block, floor, flat } = path

  const steps = [
    {
      key: 'block',
      table: 'blocks',
      filters: { hostel_id: hostelId },
    },
    {
      key: 'floor',
      table: 'floors',
      filters: { hostel_id: hostelId, block_id: block ? block.id : null },
    },
    {
      key: 'flat',
      table: 'flats',
      filters: { hostel_id: hostelId, floor_id: floor ? floor.id : null },
    },
  ]

  let startIndex = 0
  if (flat) startIndex = 3
  else if (floor) startIndex = 2
  else if (block) startIndex = 1

  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i]
    const { data, error } = await applyFilters(supabase.from(step.table).select('*'), step.filters).order(
      'name'
    )

    if (error) throw error
    if (data && data.length > 0) {
      return { level: step.key, items: data }
    }
    // Empty at this level for this branch — fall through and try the next
    // level down, treating this level as "skipped" for this hostel/branch.
  }

  // Nothing but rooms left — build the room filter from whichever level
  // is actually the deepest real parent for this branch.
  const roomFilters = { hostel_id: hostelId }
  if (flat) {
    roomFilters.flat_id = flat.id
  } else if (floor) {
    roomFilters.floor_id = floor.id
    roomFilters.flat_id = null
  } else if (block) {
    roomFilters.block_id = block.id
    roomFilters.floor_id = null
    roomFilters.flat_id = null
  } else {
    roomFilters.block_id = null
    roomFilters.floor_id = null
    roomFilters.flat_id = null
  }

  const { data, error } = await applyFilters(supabase.from('rooms').select('*'), roomFilters).order(
    'room_number'
  )

  if (error) throw error
  return { level: 'room', items: data || [] }
}

export async function fetchBedsForRoom(roomId) {
  const { data, error } = await supabase
    .from('beds')
    .select('*')
    .eq('room_id', roomId)
    .order('bed_label')

  if (error) throw error
  return data || []
}

export async function fetchBedsForRooms(roomIds) {
  if (!roomIds || roomIds.length === 0) return []
  const { data, error } = await supabase.from('beds').select('*').in('room_id', roomIds)
  if (error) throw error
  return data || []
}

export async function searchRoomsByNumber(query) {
  const { data, error } = await supabase
    .from('rooms')
    .select('*, hostels(name)')
    .ilike('room_number', `%${query}%`)
    .order('room_number')
    .limit(20)
  if (error) throw error
  return data || []
}

// ---------------------------------------------------------------------------
// Simple (non-drill-down) child lookups for the Apply For A Room form, which
// needs plain cascading <select> dropdowns rather than the explorer's
// auto-skip navigation. Each returns an empty list when the parent hasn't
// been chosen yet, which the form treats as "level not applicable/skipped".
// ---------------------------------------------------------------------------

export async function fetchBlocksForHostel(hostelId) {
  if (!hostelId) return []
  const { data, error } = await supabase
    .from('blocks')
    .select('*')
    .eq('hostel_id', hostelId)
    .order('name')
  if (error) throw error
  return data || []
}

export async function fetchFloorsForParent(hostelId, blockId) {
  if (!hostelId) return []
  const query = applyFilters(supabase.from('floors').select('*'), {
    hostel_id: hostelId,
    block_id: blockId || null,
  })
  const { data, error } = await query.order('name')
  if (error) throw error
  return data || []
}

export async function fetchFlatsForParent(hostelId, floorId) {
  if (!hostelId || !floorId) return []
  const { data, error } = await supabase
    .from('flats')
    .select('*')
    .eq('hostel_id', hostelId)
    .eq('floor_id', floorId)
    .order('name')
  if (error) throw error
  return data || []
}

export async function fetchRoomsForParent(hostelId, { blockId, floorId, flatId } = {}) {
  if (!hostelId) return []
  const filters = { hostel_id: hostelId }
  if (flatId) filters.flat_id = flatId
  else if (floorId) {
    filters.floor_id = floorId
    filters.flat_id = null
  } else if (blockId) {
    filters.block_id = blockId
    filters.floor_id = null
    filters.flat_id = null
  }
  const { data, error } = await applyFilters(supabase.from('rooms').select('*'), filters).order(
    'room_number'
  )
  if (error) throw error
  return data || []
}

export async function fetchHostels() {
  const { data, error } = await supabase.from('hostels').select('*').order('name')
  if (error) throw error
  return data || []
}
