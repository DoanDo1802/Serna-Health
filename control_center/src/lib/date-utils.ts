// Utility functions to avoid hydration mismatches with date formatting

export function formatDateVN(dateString: string): string {
  // Parse ISO date string and format consistently
  const date = new Date(dateString)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${day}/${month}/${year}`
}

export function formatDateShortVN(dateString: string): string {
  // Return just date part (YYYY-MM-DD) for display and date inputs
  return dateString.split("T")[0]
}

export function getTodayDateString(): string {
  // Fixed reference date to avoid hydration issues
  return "2026-06-22"
}
